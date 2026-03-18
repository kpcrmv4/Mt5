const logger = require('../utils/logger');
const config = require('../../config/trading');
const tradeStore = require('../models/trade.model');

class MT5Service {
  constructor() {
    this.api = null;
    this.account = null;
    this.connection = null;
    this.connected = false;
  }

  /**
   * Connect to MT5 via MetaAPI Cloud
   */
  async connect() {
    try {
      const MetaApi = require('metaapi.cloud-sdk').default;
      this.api = new MetaApi(process.env.META_API_TOKEN);

      logger.info('Connecting to MetaAPI...');
      this.account = await this.api.metatraderAccountApi.getAccount(
        process.env.META_API_ACCOUNT_ID
      );

      await this.account.waitConnected();
      this.connection = this.account.getRPCConnection();
      await this.connection.connect();
      await this.connection.waitSynchronized();

      this.connected = true;
      logger.info('Connected to MT5 via MetaAPI');

      return true;
    } catch (error) {
      logger.error(`MT5 connection failed: ${error.message}`);
      this.connected = false;
      return false;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo() {
    if (!this.connected) return null;
    try {
      const info = await this.connection.getAccountInformation();
      tradeStore.updatePerformance({
        balance: info.balance,
        equity: info.equity,
        profit: info.profit || info.equity - info.balance,
      });
      return info;
    } catch (error) {
      logger.error(`Get account info failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get candle data for indicators
   */
  async getCandles(timeframe = '1h', count = 100) {
    if (!this.connected) return [];
    try {
      const candles = await this.connection.getCandle(
        config.SYMBOL,
        timeframe,
        count
      );
      return candles;
    } catch (error) {
      // Fallback: try getHistoricalCandles
      try {
        const now = new Date();
        const startTime = new Date(
          now.getTime() - count * 60 * 60 * 1000
        );
        const candles =
          await this.account.getHistoricalCandles(
            config.SYMBOL,
            timeframe,
            startTime,
            0
          );
        return candles.map((c) => ({
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          time: c.time,
        }));
      } catch (err) {
        logger.error(`Get candles failed: ${err.message}`);
        return [];
      }
    }
  }

  /**
   * Get current price
   */
  async getPrice() {
    if (!this.connected) return null;
    try {
      const tick = await this.connection.getSymbolPrice(config.SYMBOL);
      return {
        bid: tick.bid,
        ask: tick.ask,
        mid: (tick.bid + tick.ask) / 2,
        spread: Math.round((tick.ask - tick.bid) * 100) / 100,
        time: tick.time,
      };
    } catch (error) {
      logger.error(`Get price failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get open positions
   */
  async getPositions() {
    if (!this.connected) return [];
    try {
      const positions = await this.connection.getPositions();
      return positions.filter(
        (p) =>
          p.symbol === config.SYMBOL && p.magic === config.MAGIC_NUMBER
      );
    } catch (error) {
      logger.error(`Get positions failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get pending orders
   */
  async getOrders() {
    if (!this.connected) return [];
    try {
      const orders = await this.connection.getOrders();
      return orders.filter(
        (o) =>
          o.symbol === config.SYMBOL && o.magic === config.MAGIC_NUMBER
      );
    } catch (error) {
      logger.error(`Get orders failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(type, price, volume, tp, sl) {
    if (!this.connected) return null;
    try {
      const order = await this.connection.createLimitOrder(
        config.SYMBOL,
        type, // 'ORDER_TYPE_BUY_LIMIT' or 'ORDER_TYPE_SELL_LIMIT'
        volume,
        price,
        sl,
        tp,
        {
          comment: 'GU_Grid',
          clientId: `gu_${Date.now()}`,
          magic: config.MAGIC_NUMBER,
        }
      );

      logger.info(
        `Order placed: ${type} ${volume} @ ${price} | TP: ${tp} | SL: ${sl}`
      );
      return order;
    } catch (error) {
      logger.error(`Place order failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId) {
    if (!this.connected) return false;
    try {
      await this.connection.cancelOrder(orderId);
      logger.info(`Order cancelled: ${orderId}`);
      return true;
    } catch (error) {
      logger.error(`Cancel order failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId) {
    if (!this.connected) return false;
    try {
      await this.connection.closePosition(positionId);
      logger.info(`Position closed: ${positionId}`);
      return true;
    } catch (error) {
      logger.error(`Close position failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Close all positions (emergency)
   */
  async closeAllPositions() {
    const positions = await this.getPositions();
    const results = [];
    for (const pos of positions) {
      const result = await this.closePosition(pos.id);
      results.push({ id: pos.id, success: result });
    }
    logger.warn(`Emergency close: ${results.length} positions`);
    return results;
  }

  /**
   * Get trade history
   */
  async getTradeHistory(days = 7) {
    if (!this.connected) return [];
    try {
      const startTime = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      );
      const deals = await this.connection.getDealsByTimeRange(
        startTime,
        new Date()
      );
      return deals.filter(
        (d) =>
          d.symbol === config.SYMBOL && d.magic === config.MAGIC_NUMBER
      );
    } catch (error) {
      logger.error(`Get history failed: ${error.message}`);
      return [];
    }
  }

  isConnected() {
    return this.connected;
  }
}

module.exports = new MT5Service();
