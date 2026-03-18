const logger = require('../utils/logger');
const config = require('../../config/trading');
const mt5Service = require('./mt5.service');
const indicatorService = require('./indicator.service');
const tradeStore = require('../models/trade.model');

class GridService {
  constructor() {
    this.currentGrid = null;
    this.regime = 'Neutral';
    this.newsShieldActive = false;
    this.running = false;
    this.intervalHandle = null;
  }

  /**
   * Start grid trading loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    logger.info('Grid service started');
    this._loop();
    // Run every 30 seconds
    this.intervalHandle = setInterval(() => this._loop(), 30000);
  }

  stop() {
    this.running = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    logger.info('Grid service stopped');
  }

  /**
   * Main loop iteration
   */
  async _loop() {
    try {
      if (!mt5Service.isConnected()) return;
      if (this.newsShieldActive) {
        logger.info('News Shield active — skipping grid update');
        return;
      }

      // Get current data
      const [price, candles, positions, orders] = await Promise.all([
        mt5Service.getPrice(),
        mt5Service.getCandles('1h', 100),
        mt5Service.getPositions(),
        mt5Service.getOrders(),
      ]);

      if (!price || candles.length === 0) return;

      // Calculate indicators
      const indicators = indicatorService.calculate(candles);
      if (!indicators) return;

      // Calculate grid
      const spacing = indicatorService.calculateGridSpacing(indicators.atr);
      this.currentGrid = indicatorService.generateGridLevels(
        price.mid,
        spacing,
        config.GRID_LEVELS
      );
      this.currentGrid.indicators = indicators;

      // Update account info
      await mt5Service.getAccountInfo();

      // Manage grid orders
      await this._manageOrders(
        price,
        positions,
        orders,
        indicators,
        spacing
      );

      logger.info(
        `Grid loop | Price: ${price.mid} | Spacing: ${spacing} | Pos: ${positions.length} | Orders: ${orders.length}`
      );
    } catch (error) {
      logger.error(`Grid loop error: ${error.message}`);
    }
  }

  /**
   * Place/cancel orders to match grid
   */
  async _manageOrders(price, positions, orders, indicators, spacing) {
    const totalOpen = positions.length + orders.length;
    if (totalOpen >= config.MAX_POSITIONS) return;

    const tp = spacing * config.TP_MULTIPLIER;
    const sl = spacing * config.SL_MULTIPLIER;
    const grid = this.currentGrid;

    // Place buy limit orders
    for (const level of grid.buyLevels) {
      if (totalOpen >= config.MAX_POSITIONS) break;
      if (level >= price.bid) continue;
      if (this._hasOrderNear(orders, positions, level)) continue;
      if (!this._shouldBuy(indicators)) continue;

      const lot = this._adjustLot(config.BASE_LOT, 'buy');
      await mt5Service.placeLimitOrder(
        'ORDER_TYPE_BUY_LIMIT',
        level,
        lot,
        Math.round((level + tp) * 100) / 100,
        Math.round((level - sl) * 100) / 100
      );
    }

    // Place sell limit orders
    for (const level of grid.sellLevels) {
      if (totalOpen >= config.MAX_POSITIONS) break;
      if (level <= price.ask) continue;
      if (this._hasOrderNear(orders, positions, level)) continue;
      if (!this._shouldSell(indicators)) continue;

      const lot = this._adjustLot(config.BASE_LOT, 'sell');
      await mt5Service.placeLimitOrder(
        'ORDER_TYPE_SELL_LIMIT',
        level,
        lot,
        Math.round((level - tp) * 100) / 100,
        Math.round((level + sl) * 100) / 100
      );
    }
  }

  _shouldBuy(indicators) {
    if (config.FILTER_RSI_ENABLED && indicators.rsi > config.RSI_OVERBOUGHT)
      return false;
    if (
      config.FILTER_EMA_ENABLED &&
      indicators.emaCross === 'bearish' &&
      this.regime === 'Strong Downtrend'
    )
      return false;
    return true;
  }

  _shouldSell(indicators) {
    if (config.FILTER_RSI_ENABLED && indicators.rsi < config.RSI_OVERSOLD)
      return false;
    if (
      config.FILTER_EMA_ENABLED &&
      indicators.emaCross === 'bullish' &&
      this.regime === 'Strong Uptrend'
    )
      return false;
    return true;
  }

  _adjustLot(baseLot, side) {
    let lot = baseLot;
    const r = this.regime;

    if (r === 'Strong Uptrend' && side === 'buy') lot *= 1.5;
    else if (r === 'Strong Uptrend' && side === 'sell') lot *= 0.5;
    else if (r === 'Mild Uptrend' && side === 'buy') lot *= 1.2;
    else if (r === 'Strong Downtrend' && side === 'sell') lot *= 1.5;
    else if (r === 'Strong Downtrend' && side === 'buy') lot *= 0.5;
    else if (r === 'Mild Downtrend' && side === 'sell') lot *= 1.2;
    else if (r === 'High Volatility') lot *= 0.5;

    return Math.max(0.01, Math.round(lot * 100) / 100);
  }

  _hasOrderNear(orders, positions, price, tolerance = 1.0) {
    for (const o of orders) {
      if (Math.abs(o.openPrice - price) < tolerance) return true;
    }
    for (const p of positions) {
      if (Math.abs(p.openPrice - price) < tolerance) return true;
    }
    return false;
  }

  /**
   * Update regime from AI analysis
   */
  setRegime(regime) {
    this.regime = regime;
    logger.info(`Regime updated: ${regime}`);
  }

  setNewsShield(active) {
    this.newsShieldActive = active;
    logger.info(`News Shield: ${active ? 'ACTIVE' : 'inactive'}`);
  }

  getStatus() {
    return {
      running: this.running,
      grid: this.currentGrid,
      regime: this.regime,
      newsShieldActive: this.newsShieldActive,
    };
  }
}

module.exports = new GridService();
