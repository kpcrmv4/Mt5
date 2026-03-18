/**
 * AI Regime Service — File-based communication with Claude Code cowork
 *
 * Flow:
 * 1. Backend writes market data to logs/market_data.json (every cycle)
 * 2. Claude Code cowork reads it, analyzes, writes ai_config.json
 * 3. Backend reads ai_config.json and applies regime/config changes
 *
 * No API key needed — uses Claude Code subscription via cowork mode
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../../config/trading');
const gridService = require('./grid.service');

const DATA_DIR = path.join(__dirname, '../../../logs');
const CONFIG_DIR = path.join(__dirname, '../../../');
const MARKET_DATA_FILE = path.join(DATA_DIR, 'market_data.json');
const AI_CONFIG_FILE = path.join(CONFIG_DIR, 'ai_config.json');
const MT5_CONFIG_FILE = path.join(__dirname, '../../../mt5-ea/gold_unlock_config.json');

class AiRegimeService {
  constructor() {
    this.lastRegime = null;
    this.lastAnalysis = null;
    this.intervalHandle = null;
    this.lastConfigMtime = 0;
  }

  init() {
    logger.info('AI Regime service initialized (cowork file-based mode)');
  }

  /**
   * Start periodic file watching
   */
  start() {
    // Write market data every cycle for cowork to read
    // Read ai_config.json for cowork's decisions
    const intervalMs = 10 * 1000; // check every 10 seconds
    this.intervalHandle = setInterval(() => {
      this._writeMarketData();
      this._readAiConfig();
    }, intervalMs);
    logger.info('AI Regime: watching for cowork config changes');
    this._writeMarketData();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Write current market data for Claude Code cowork to analyze
   */
  _writeMarketData() {
    try {
      const gridStatus = gridService.getStatus();
      const indicators = gridStatus.grid?.indicators || null;

      const data = {
        timestamp: new Date().toISOString(),
        symbol: config.SYMBOL,
        indicators: indicators,
        currentConfig: {
          ATR_MULTIPLIER: config.ATR_MULTIPLIER,
          GRID_LEVELS: config.GRID_LEVELS,
          BASE_LOT: config.BASE_LOT,
          MAX_POSITIONS: config.MAX_POSITIONS,
          FILTER_RSI_ENABLED: config.FILTER_RSI_ENABLED,
          FILTER_EMA_ENABLED: config.FILTER_EMA_ENABLED,
        },
        gridStatus: {
          running: gridStatus.running,
          regime: gridStatus.regime,
          newsShieldActive: gridStatus.newsShieldActive,
          spacing: gridStatus.grid?.spacing || 0,
          buyLevels: gridStatus.grid?.buyLevels || [],
          sellLevels: gridStatus.grid?.sellLevels || [],
        },
        performance: require('../models/trade.model').performance,
      };

      fs.writeFileSync(MARKET_DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error(`Write market data failed: ${error.message}`);
    }
  }

  /**
   * Read AI config written by Claude Code cowork
   * Cowork writes to ai_config.json with regime and config changes
   */
  _readAiConfig() {
    try {
      if (!fs.existsSync(AI_CONFIG_FILE)) return;

      const stat = fs.statSync(AI_CONFIG_FILE);
      const mtime = stat.mtimeMs;

      // Only process if file was modified since last read
      if (mtime <= this.lastConfigMtime) return;
      this.lastConfigMtime = mtime;

      const content = fs.readFileSync(AI_CONFIG_FILE, 'utf8');
      const aiConfig = JSON.parse(content);

      // Apply regime
      if (aiConfig.regime) {
        gridService.setRegime(aiConfig.regime);
        this.lastRegime = aiConfig.regime;
      }

      // Apply news shield
      if (aiConfig.news_shield_active != null) {
        gridService.setNewsShield(aiConfig.news_shield_active);
      }

      // Apply config changes
      const changes = [];
      if (aiConfig.atr_multiplier != null && aiConfig.atr_multiplier !== config.ATR_MULTIPLIER) {
        config.ATR_MULTIPLIER = aiConfig.atr_multiplier;
        changes.push(`ATR_MULTIPLIER → ${aiConfig.atr_multiplier}`);
      }
      if (aiConfig.grid_levels != null && aiConfig.grid_levels !== config.GRID_LEVELS) {
        config.GRID_LEVELS = aiConfig.grid_levels;
        changes.push(`GRID_LEVELS → ${aiConfig.grid_levels}`);
      }
      if (aiConfig.base_lot != null && aiConfig.base_lot !== config.BASE_LOT) {
        config.BASE_LOT = aiConfig.base_lot;
        changes.push(`BASE_LOT → ${aiConfig.base_lot}`);
      }
      if (aiConfig.filter_rsi != null) {
        config.FILTER_RSI_ENABLED = aiConfig.filter_rsi;
        changes.push(`FILTER_RSI → ${aiConfig.filter_rsi}`);
      }
      if (aiConfig.filter_ema != null) {
        config.FILTER_EMA_ENABLED = aiConfig.filter_ema;
        changes.push(`FILTER_EMA → ${aiConfig.filter_ema}`);
      }

      if (changes.length > 0) {
        logger.info(`Cowork config applied: ${changes.join(', ')}`);
      }

      // Store analysis
      this.lastAnalysis = {
        regime: aiConfig.regime || this.lastRegime || 'Neutral',
        confidence: aiConfig.confidence || 0,
        trend: aiConfig.trend || 'sideways',
        reasoning: aiConfig.reasoning || '',
        riskLevel: aiConfig.risk_level || 'medium',
        timestamp: aiConfig.timestamp || new Date().toISOString(),
      };

      // Also write to MT5 EA config file
      this._writeMt5Config(aiConfig);

      logger.info(
        `Cowork AI | Regime: ${this.lastAnalysis.regime} | Risk: ${this.lastAnalysis.riskLevel}`
      );
    } catch (error) {
      // File may not exist yet or be in the middle of being written
      if (error.code !== 'ENOENT') {
        logger.error(`Read AI config failed: ${error.message}`);
      }
    }
  }

  _writeMt5Config(aiConfig) {
    try {
      const mt5Config = {
        regime: aiConfig.regime || 'Neutral',
        atr_multiplier: config.ATR_MULTIPLIER,
        grid_levels: config.GRID_LEVELS,
        base_lot: config.BASE_LOT,
        filter_rsi: config.FILTER_RSI_ENABLED,
        filter_ema: config.FILTER_EMA_ENABLED,
        news_shield_active: gridService.newsShieldActive,
        risk_level: aiConfig.risk_level || 'medium',
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(MT5_CONFIG_FILE, JSON.stringify(mt5Config, null, 2));
    } catch (error) {
      logger.error(`Write MT5 config failed: ${error.message}`);
    }
  }

  getLastAnalysis() {
    return this.lastAnalysis;
  }
}

module.exports = new AiRegimeService();
