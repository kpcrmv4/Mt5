/**
 * In-memory trade store + file persistence for Claude Code to read
 */
const fs = require('fs');
const path = require('path');

const TRADES_FILE = path.join(__dirname, '../../../logs/trades.jsonl');
const PERF_FILE = path.join(__dirname, '../../../logs/performance.json');

class TradeStore {
  constructor() {
    this.trades = [];
    this.performance = {
      balance: 0,
      equity: 0,
      profit: 0,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdown: 0,
      openPositions: 0,
      updatedAt: null,
    };
  }

  addTrade(trade) {
    const record = {
      id: trade.id || Date.now(),
      ticket: trade.ticket,
      type: trade.type,
      symbol: trade.symbol,
      lot: trade.volume,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice || null,
      tp: trade.tp,
      sl: trade.sl,
      profit: trade.profit || 0,
      status: trade.status || 'open',
      openTime: trade.openTime || new Date().toISOString(),
      closeTime: trade.closeTime || null,
      regime: trade.regime || 'Unknown',
      comment: trade.comment || '',
    };

    this.trades.push(record);
    this._appendTradeLog(record);
    return record;
  }

  closeTrade(ticket, closePrice, profit) {
    const trade = this.trades.find(
      (t) => t.ticket === ticket && t.status === 'open'
    );
    if (!trade) return null;

    trade.closePrice = closePrice;
    trade.profit = profit;
    trade.status = 'closed';
    trade.closeTime = new Date().toISOString();

    this._appendTradeLog(trade);
    this.updatePerformance();
    return trade;
  }

  updatePerformance(accountInfo = {}) {
    const closed = this.trades.filter((t) => t.status === 'closed');
    const wins = closed.filter((t) => t.profit > 0);
    const losses = closed.filter((t) => t.profit < 0);

    const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

    this.performance = {
      balance: accountInfo.balance || this.performance.balance,
      equity: accountInfo.equity || this.performance.equity,
      profit: accountInfo.profit || this.performance.profit,
      totalTrades: closed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: closed.length > 0 ? (wins.length / closed.length) * 100 : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdown: accountInfo.maxDrawdown || this.performance.maxDrawdown,
      openPositions: this.trades.filter((t) => t.status === 'open').length,
      updatedAt: new Date().toISOString(),
    };

    this._writePerformance();
    return this.performance;
  }

  getOpenTrades() {
    return this.trades.filter((t) => t.status === 'open');
  }

  getClosedTrades(limit = 50) {
    return this.trades
      .filter((t) => t.status === 'closed')
      .slice(-limit)
      .reverse();
  }

  _appendTradeLog(trade) {
    try {
      fs.appendFileSync(TRADES_FILE, JSON.stringify(trade) + '\n');
    } catch (e) {
      // logs dir may not exist in test
    }
  }

  _writePerformance() {
    try {
      fs.writeFileSync(PERF_FILE, JSON.stringify(this.performance, null, 2));
    } catch (e) {
      // logs dir may not exist in test
    }
  }
}

module.exports = new TradeStore();
