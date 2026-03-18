const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');
const config = require('../../config/trading');
const gridService = require('./grid.service');

// Major economic events that affect gold
const HIGH_IMPACT_KEYWORDS = [
  'nfp', 'non-farm', 'fomc', 'fed rate', 'interest rate decision',
  'cpi', 'inflation', 'ppi', 'gdp', 'employment',
  'powell', 'fed chair', 'ecb rate', 'boe rate',
];

const CRITICAL_KEYWORDS = [
  'war', 'invasion', 'nuclear', 'missile', 'attack',
  'emergency rate', 'bank collapse', 'default', 'crisis',
];

class NewsShieldService {
  constructor() {
    this.client = null;
    this.intervalHandle = null;
    this.currentImpact = 'low';
    this.shieldActive = false;
    this.lastCheck = null;
    this.upcomingEvents = [];
  }

  init() {
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY not set — News Shield disabled');
      return;
    }
    this.client = new Anthropic();
    logger.info('News Shield service initialized');
  }

  /**
   * Start periodic news checking
   */
  start() {
    if (!this.client || !config.NEWS_SHIELD_ENABLED) return;
    const intervalMs = config.NEWS_CHECK_INTERVAL * 60 * 1000;
    this.intervalHandle = setInterval(() => this.checkNews(), intervalMs);
    logger.info(
      `News Shield checking every ${config.NEWS_CHECK_INTERVAL} minutes`
    );
    this.checkNews();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Check news and economic calendar
   */
  async checkNews() {
    try {
      const now = new Date();

      // Check pre-scheduled events (hardcoded major events)
      const preEventShield = this._checkPreScheduledEvents(now);
      if (preEventShield) {
        this._activateShield(preEventShield.level, preEventShield.reason);
        return;
      }

      // Use Claude to analyze current news context
      const analysis = await this._analyzeNewsContext();
      if (!analysis) return;

      this.currentImpact = analysis.impact;
      this.lastCheck = now.toISOString();

      // Apply shield based on impact
      if (analysis.impact === 'critical') {
        this._activateShield('critical', analysis.reason);
        // Emergency: close all positions
        logger.warn(`CRITICAL NEWS: ${analysis.reason}`);
      } else if (analysis.impact === 'high') {
        this._activateShield('high', analysis.reason);
      } else if (analysis.impact === 'medium') {
        this._reduceTradingActivity(analysis.reason);
      } else {
        this._deactivateShield();
      }

      logger.info(
        `News check | Impact: ${analysis.impact} | Shield: ${this.shieldActive}`
      );
    } catch (error) {
      logger.error(`News check failed: ${error.message}`);
    }
  }

  /**
   * Ask Claude to analyze current news for gold impact
   */
  async _analyzeNewsContext() {
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `You are a gold market news analyst. Based on your training data knowledge, assess if there are typically high-impact economic events scheduled around this time of the week/month that could cause extreme gold price volatility.

Current time: ${new Date().toISOString()}
Day of week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]}
Day of month: ${new Date().getDate()}

Consider:
- Is it first Friday of month (NFP)?
- Is there typically a Fed meeting around this time?
- Any other major scheduled events?

Respond in JSON:
{
  "impact": "low|medium|high|critical",
  "reason": "<brief explanation>",
  "upcoming_events": [{"event": "name", "expected_time": "approximate", "impact": "level"}],
  "recommendation": "normal|reduce|pause|emergency_close"
}`,
          },
        ],
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      this.upcomingEvents = parsed.upcoming_events || [];
      return parsed;
    } catch (error) {
      logger.error(`News analysis failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Check known recurring high-impact events
   */
  _checkPreScheduledEvents(now) {
    const day = now.getDay();
    const date = now.getDate();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const bufferMinutes = config.NEWS_PRE_EVENT_BUFFER;

    // NFP: First Friday of month, 12:30 UTC
    if (day === 5 && date <= 7) {
      const nfpMinutes = 12 * 60 + 30;
      const currentMinutes = hour * 60 + minute;
      if (
        currentMinutes >= nfpMinutes - bufferMinutes &&
        currentMinutes <= nfpMinutes + 60
      ) {
        return {
          level: 'high',
          reason: 'NFP release window — First Friday of month',
        };
      }
    }

    // FOMC: Usually Wednesday 18:00 UTC (8 times a year)
    // CPI: Usually around 12th-14th of month, 12:30 UTC
    if (date >= 12 && date <= 14 && hour >= 12 && hour <= 13) {
      return {
        level: 'high',
        reason: 'Potential CPI release window',
      };
    }

    return null;
  }

  _activateShield(level, reason) {
    this.shieldActive = true;
    this.currentImpact = level;
    gridService.setNewsShield(true);
    logger.warn(`News Shield ACTIVATED [${level}]: ${reason}`);
  }

  _deactivateShield() {
    if (this.shieldActive) {
      this.shieldActive = false;
      this.currentImpact = 'low';
      gridService.setNewsShield(false);
      logger.info('News Shield deactivated — trading resumed');
    }
  }

  _reduceTradingActivity(reason) {
    // Don't fully pause, but let grid service know to use smaller lots
    this.currentImpact = 'medium';
    gridService.setNewsShield(false); // Don't pause, just reduce
    logger.info(`News impact MEDIUM: ${reason} — reducing lot sizes`);
  }

  getStatus() {
    return {
      enabled: config.NEWS_SHIELD_ENABLED,
      shieldActive: this.shieldActive,
      currentImpact: this.currentImpact,
      lastCheck: this.lastCheck,
      upcomingEvents: this.upcomingEvents,
    };
  }
}

module.exports = new NewsShieldService();
