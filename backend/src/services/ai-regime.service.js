const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../../config/trading');
const gridService = require('./grid.service');

const REPORTS_DIR = path.join(__dirname, '../../../ai_reports');

class AiRegimeService {
  constructor() {
    this.client = null;
    this.lastRegime = null;
    this.lastAnalysis = null;
    this.intervalHandle = null;
  }

  init() {
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY not set — AI regime detection disabled');
      return;
    }
    this.client = new Anthropic();
    logger.info('AI Regime service initialized');
  }

  /**
   * Start periodic analysis
   */
  start() {
    if (!this.client) return;
    const intervalMs = config.AI_INTERVAL_MINUTES * 60 * 1000;
    this.intervalHandle = setInterval(() => this.analyze(), intervalMs);
    logger.info(
      `AI Regime analysis every ${config.AI_INTERVAL_MINUTES} minutes`
    );
    // Run first analysis immediately
    this.analyze();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Run AI regime analysis
   */
  async analyze() {
    try {
      const gridStatus = gridService.getStatus();
      if (!gridStatus.grid || !gridStatus.grid.indicators) {
        logger.info('Skipping AI analysis — no indicator data yet');
        return null;
      }

      const indicators = gridStatus.grid.indicators;
      const prompt = this._buildPrompt(indicators, gridStatus);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      const analysis = this._parseResponse(text, indicators);

      // Apply regime to grid service
      if (analysis.regime) {
        gridService.setRegime(analysis.regime);
      }

      // Apply config changes
      if (analysis.configChanges) {
        this._applyConfigChanges(analysis.configChanges);
      }

      this.lastRegime = analysis.regime;
      this.lastAnalysis = analysis;

      // Write report for Claude Code cowork to read
      this._writeReport(analysis, indicators);

      // Write config file for MT5 EA to read
      this._writeMt5Config(analysis);

      logger.info(
        `AI Analysis | Regime: ${analysis.regime} | Confidence: ${analysis.confidence}`
      );

      return analysis;
    } catch (error) {
      logger.error(`AI analysis failed: ${error.message}`);
      return null;
    }
  }

  _buildPrompt(indicators, gridStatus) {
    return `You are a gold (XAU/USD) market regime analyst for an automated grid trading bot.

Analyze the following market data and classify the current regime.

## Current Market Data
- Price: $${indicators.price}
- RSI(14): ${indicators.rsi}
- ATR(14): $${indicators.atr} (ratio vs 20-avg: ${indicators.atrRatio})
- EMA(20): $${indicators.emaFast}
- EMA(50): $${indicators.emaSlow}
- EMA Cross: ${indicators.emaCross}
- Current Grid Spacing: $${gridStatus.grid.spacing}
- Open Positions: ${gridStatus.grid.indicators ? 'active' : 0}

## Classify into exactly ONE regime:
1. Strong Uptrend
2. Mild Uptrend
3. Neutral
4. Mild Downtrend
5. Strong Downtrend
6. High Volatility

## Respond in this exact JSON format:
{
  "regime": "<regime name>",
  "confidence": <0.0-1.0>,
  "trend": "<up/down/sideways>",
  "reasoning": "<1-2 sentences>",
  "config_changes": {
    "atr_multiplier": <number or null>,
    "grid_levels": <number or null>,
    "base_lot": <number or null>,
    "filter_rsi": <boolean or null>,
    "filter_ema": <boolean or null>
  },
  "risk_level": "<low/medium/high/critical>"
}

Only suggest config_changes if the current values need adjustment. Use null for no change.`;
  }

  _parseResponse(text, indicators) {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          regime: 'Neutral',
          confidence: 0,
          reasoning: 'Failed to parse AI response',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        regime: parsed.regime || 'Neutral',
        confidence: parsed.confidence || 0,
        trend: parsed.trend || 'sideways',
        reasoning: parsed.reasoning || '',
        configChanges: parsed.config_changes || {},
        riskLevel: parsed.risk_level || 'medium',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to parse AI response: ${error.message}`);
      return {
        regime: 'Neutral',
        confidence: 0,
        reasoning: 'Parse error',
      };
    }
  }

  _applyConfigChanges(changes) {
    const applied = [];
    if (changes.atr_multiplier != null) {
      config.ATR_MULTIPLIER = changes.atr_multiplier;
      applied.push(`ATR_MULTIPLIER → ${changes.atr_multiplier}`);
    }
    if (changes.grid_levels != null) {
      config.GRID_LEVELS = changes.grid_levels;
      applied.push(`GRID_LEVELS → ${changes.grid_levels}`);
    }
    if (changes.base_lot != null) {
      config.BASE_LOT = changes.base_lot;
      applied.push(`BASE_LOT → ${changes.base_lot}`);
    }
    if (changes.filter_rsi != null) {
      config.FILTER_RSI_ENABLED = changes.filter_rsi;
      applied.push(`FILTER_RSI → ${changes.filter_rsi}`);
    }
    if (changes.filter_ema != null) {
      config.FILTER_EMA_ENABLED = changes.filter_ema;
      applied.push(`FILTER_EMA → ${changes.filter_ema}`);
    }

    if (applied.length > 0) {
      logger.info(`Config changes applied: ${applied.join(', ')}`);
    }
  }

  _writeReport(analysis, indicators) {
    try {
      const now = new Date();
      const filename = `${now.toISOString().slice(0, 16).replace(/[T:]/g, '-')}.md`;
      const filepath = path.join(REPORTS_DIR, filename);

      const content = `# AI Regime Report - ${now.toISOString()}

## Market State
- **Regime**: ${analysis.regime}
- **Confidence**: ${Math.round(analysis.confidence * 100)}%
- **Trend**: ${analysis.trend}
- **Risk Level**: ${analysis.riskLevel}

## Indicators
- RSI(14): ${indicators.rsi}
- ATR(14): $${indicators.atr} (ratio: ${indicators.atrRatio})
- EMA(20): $${indicators.emaFast}
- EMA(50): $${indicators.emaSlow}
- EMA Cross: ${indicators.emaCross}
- Price: $${indicators.price}

## AI Reasoning
${analysis.reasoning}

## Config Changes Applied
${
  analysis.configChanges
    ? Object.entries(analysis.configChanges)
        .filter(([, v]) => v != null)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n') || '- No changes'
    : '- No changes'
}

## Current Config
- ATR_MULTIPLIER: ${config.ATR_MULTIPLIER}
- GRID_LEVELS: ${config.GRID_LEVELS}
- BASE_LOT: ${config.BASE_LOT}
- FILTER_RSI: ${config.FILTER_RSI_ENABLED}
- FILTER_EMA: ${config.FILTER_EMA_ENABLED}
`;

      fs.writeFileSync(filepath, content);
      logger.info(`Report written: ${filename}`);
    } catch (error) {
      logger.error(`Write report failed: ${error.message}`);
    }
  }

  _writeMt5Config(analysis) {
    try {
      const mt5Config = {
        regime: analysis.regime,
        atr_multiplier: config.ATR_MULTIPLIER,
        grid_levels: config.GRID_LEVELS,
        base_lot: config.BASE_LOT,
        filter_rsi: config.FILTER_RSI_ENABLED,
        filter_ema: config.FILTER_EMA_ENABLED,
        news_shield_active: gridService.newsShieldActive,
        risk_level: analysis.riskLevel,
        timestamp: new Date().toISOString(),
      };

      // Write to MT5 common files directory
      const filepath = path.join(
        __dirname,
        '../../../mt5-ea/gold_unlock_config.json'
      );
      fs.writeFileSync(filepath, JSON.stringify(mt5Config, null, 2));
    } catch (error) {
      logger.error(`Write MT5 config failed: ${error.message}`);
    }
  }

  getLastAnalysis() {
    return this.lastAnalysis;
  }
}

module.exports = new AiRegimeService();
