/**
 * News Shield Service — File-based + Calendar-based
 *
 * 1. Built-in calendar detection (NFP, CPI, FOMC) — no API needed
 * 2. Claude Code cowork can override via ai_config.json news_shield_active field
 * 3. Cowork does the real-time news analysis using its own subscription
 */
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const config = require('../../config/trading');
const gridService = require('./grid.service');

const NEWS_STATUS_FILE = path.join(__dirname, '../../../logs/news_status.json');

class NewsShieldService {
  constructor() {
    this.intervalHandle = null;
    this.currentImpact = 'low';
    this.shieldActive = false;
    this.lastCheck = null;
    this.upcomingEvents = [];
  }

  init() {
    logger.info('News Shield initialized (calendar + cowork mode)');
  }

  /**
   * Start periodic calendar checking
   */
  start() {
    if (!config.NEWS_SHIELD_ENABLED) return;
    const intervalMs = config.NEWS_CHECK_INTERVAL * 60 * 1000;
    this.intervalHandle = setInterval(() => this.checkCalendar(), intervalMs);
    logger.info(
      `News Shield checking calendar every ${config.NEWS_CHECK_INTERVAL} minutes`
    );
    this.checkCalendar();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Check built-in economic calendar (no API needed)
   */
  checkCalendar() {
    const now = new Date();
    this.lastCheck = now.toISOString();
    this.upcomingEvents = [];

    // Check all known recurring events
    const events = this._getScheduledEvents(now);
    this.upcomingEvents = events;

    // Find active event (within buffer window)
    const activeEvent = events.find((e) => e.active);

    if (activeEvent) {
      if (activeEvent.impact === 'critical') {
        this._activateShield('critical', activeEvent.event);
      } else if (activeEvent.impact === 'high') {
        this._activateShield('high', activeEvent.event);
      } else if (activeEvent.impact === 'medium') {
        this._reduceTradingActivity(activeEvent.event);
      }
    } else {
      this._deactivateShield();
    }

    // Write status file for cowork to read and potentially override
    this._writeStatus();

    logger.info(
      `News calendar check | Impact: ${this.currentImpact} | Shield: ${this.shieldActive} | Events: ${events.length}`
    );
  }

  /**
   * Get known recurring high-impact events
   */
  _getScheduledEvents(now) {
    const events = [];
    const day = now.getDay(); // 0=Sun, 5=Fri
    const date = now.getDate();
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const currentMinutes = hour * 60 + minute;
    const buffer = config.NEWS_PRE_EVENT_BUFFER;

    // NFP: First Friday of month, 12:30 UTC (08:30 EST)
    if (day === 5 && date <= 7) {
      const eventTime = 12 * 60 + 30;
      events.push({
        event: 'Non-Farm Payrolls (NFP)',
        time: '12:30 UTC',
        impact: 'high',
        active: currentMinutes >= eventTime - buffer && currentMinutes <= eventTime + 60,
      });
    }

    // CPI: Usually around 10th-14th of month, 12:30 UTC
    if (date >= 10 && date <= 14) {
      const eventTime = 12 * 60 + 30;
      const isLikelyCpiDay = day >= 2 && day <= 4; // Tue-Thu
      if (isLikelyCpiDay) {
        events.push({
          event: 'CPI Release (potential)',
          time: '12:30 UTC',
          impact: 'high',
          active: currentMinutes >= eventTime - buffer && currentMinutes <= eventTime + 60,
        });
      }
    }

    // FOMC: 8 times/year, usually Wednesday 18:00 UTC
    // Approximate: mid-month Jan,Mar,May,Jun,Jul,Sep,Nov,Dec
    const month = now.getMonth(); // 0-indexed
    const fomcMonths = [0, 2, 4, 5, 6, 8, 10, 11];
    if (fomcMonths.includes(month) && date >= 14 && date <= 20 && day === 3) {
      const eventTime = 18 * 60;
      events.push({
        event: 'FOMC Rate Decision (potential)',
        time: '18:00 UTC',
        impact: 'high',
        active: currentMinutes >= eventTime - buffer && currentMinutes <= eventTime + 120,
      });
    }

    // PPI: Usually around 11th-15th of month, 12:30 UTC
    if (date >= 11 && date <= 15 && day >= 2 && day <= 4) {
      const eventTime = 12 * 60 + 30;
      events.push({
        event: 'PPI Release (potential)',
        time: '12:30 UTC',
        impact: 'medium',
        active: currentMinutes >= eventTime - buffer && currentMinutes <= eventTime + 30,
      });
    }

    // Weekly: Jobless Claims every Thursday 12:30 UTC
    if (day === 4) {
      const eventTime = 12 * 60 + 30;
      events.push({
        event: 'Weekly Jobless Claims',
        time: '12:30 UTC',
        impact: 'medium',
        active: currentMinutes >= eventTime - 15 && currentMinutes <= eventTime + 15,
      });
    }

    // Weekend gap protection: Friday close
    if (day === 5 && hour >= 20) {
      events.push({
        event: 'Weekend Gap Risk',
        time: 'Market close',
        impact: 'medium',
        active: true,
      });
    }

    return events;
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
    this.currentImpact = 'medium';
    gridService.setNewsShield(false);
    logger.info(`News impact MEDIUM: ${reason} — reducing lot sizes`);
  }

  _writeStatus() {
    try {
      fs.writeFileSync(
        NEWS_STATUS_FILE,
        JSON.stringify(this.getStatus(), null, 2)
      );
    } catch (error) {
      // ignore
    }
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
