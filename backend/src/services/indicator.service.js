const { RSI, ATR, EMA } = require('technicalindicators');
const logger = require('../utils/logger');
const config = require('../../config/trading');

class IndicatorService {
  /**
   * Calculate all indicators from candle data
   * @param {Array} candles - [{open, high, low, close, time}]
   */
  calculate(candles) {
    if (!candles || candles.length < 50) {
      logger.warn('Not enough candles for indicator calculation');
      return null;
    }

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);

    const rsiValues = RSI.calculate({
      values: closes,
      period: config.RSI_PERIOD,
    });

    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: config.ATR_PERIOD,
    });

    const emaFastValues = EMA.calculate({
      values: closes,
      period: config.EMA_FAST,
    });

    const emaSlowValues = EMA.calculate({
      values: closes,
      period: config.EMA_SLOW,
    });

    const currentRsi = rsiValues[rsiValues.length - 1];
    const currentAtr = atrValues[atrValues.length - 1];
    const prevAtr = atrValues[atrValues.length - 2] || currentAtr;
    const currentEmaFast = emaFastValues[emaFastValues.length - 1];
    const currentEmaSlow = emaSlowValues[emaSlowValues.length - 1];

    // ATR ratio (current vs average of last 20)
    const recentAtr = atrValues.slice(-20);
    const avgAtr =
      recentAtr.reduce((sum, v) => sum + v, 0) / recentAtr.length;
    const atrRatio = avgAtr > 0 ? currentAtr / avgAtr : 1;

    const result = {
      rsi: Math.round(currentRsi * 10) / 10,
      atr: Math.round(currentAtr * 100) / 100,
      atrRatio: Math.round(atrRatio * 100) / 100,
      emaFast: Math.round(currentEmaFast * 100) / 100,
      emaSlow: Math.round(currentEmaSlow * 100) / 100,
      emaCross: currentEmaFast > currentEmaSlow ? 'bullish' : 'bearish',
      price: closes[closes.length - 1],
      timestamp: new Date().toISOString(),
    };

    logger.info(
      `Indicators | RSI: ${result.rsi} | ATR: ${result.atr} (ratio: ${result.atrRatio}) | EMA: ${result.emaFast}/${result.emaSlow} (${result.emaCross})`
    );

    return result;
  }

  /**
   * Calculate grid spacing from ATR
   */
  calculateGridSpacing(atr) {
    return Math.round(atr * config.ATR_MULTIPLIER * 100) / 100;
  }

  /**
   * Generate grid levels around a mid price
   */
  generateGridLevels(midPrice, spacing, levels = config.GRID_LEVELS) {
    const buyLevels = [];
    const sellLevels = [];

    for (let i = 1; i <= levels; i++) {
      buyLevels.push(Math.round((midPrice - spacing * i) * 100) / 100);
      sellLevels.push(Math.round((midPrice + spacing * i) * 100) / 100);
    }

    return { buyLevels, sellLevels, midPrice, spacing };
  }
}

module.exports = new IndicatorService();
