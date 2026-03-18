module.exports = {
  // Grid Settings
  GRID_LEVELS: parseInt(process.env.GRID_LEVELS) || 6,
  ATR_MULTIPLIER: parseFloat(process.env.ATR_MULTIPLIER) || 1.5,
  BASE_LOT: parseFloat(process.env.BASE_LOT) || 0.01,
  MAX_POSITIONS: parseInt(process.env.MAX_POSITIONS) || 12,
  ATR_PERIOD: parseInt(process.env.ATR_PERIOD) || 14,

  // TP/SL
  TP_MULTIPLIER: parseFloat(process.env.TP_MULTIPLIER) || 2.0,
  SL_MULTIPLIER: parseFloat(process.env.SL_MULTIPLIER) || 3.0,

  // Filters
  FILTER_RSI_ENABLED: process.env.FILTER_RSI_ENABLED === 'true',
  FILTER_EMA_ENABLED: process.env.FILTER_EMA_ENABLED !== 'false',
  RSI_PERIOD: parseInt(process.env.RSI_PERIOD) || 14,
  RSI_OVERBOUGHT: parseFloat(process.env.RSI_OVERBOUGHT) || 70,
  RSI_OVERSOLD: parseFloat(process.env.RSI_OVERSOLD) || 30,
  EMA_FAST: parseInt(process.env.EMA_FAST) || 20,
  EMA_SLOW: parseInt(process.env.EMA_SLOW) || 50,

  // AI
  AI_AUTO_ENABLED: process.env.AI_AUTO_ENABLED !== 'false',
  AI_INTERVAL_MINUTES: parseInt(process.env.AI_INTERVAL_MINUTES) || 5,

  // News Shield
  NEWS_SHIELD_ENABLED: process.env.NEWS_SHIELD_ENABLED !== 'false',
  NEWS_CHECK_INTERVAL: parseInt(process.env.NEWS_CHECK_INTERVAL) || 2,
  NEWS_PRE_EVENT_BUFFER: parseInt(process.env.NEWS_PRE_EVENT_BUFFER) || 30,

  // Risk
  MAX_DRAWDOWN_PCT: parseFloat(process.env.MAX_DRAWDOWN_PCT) || 10,
  MAGIC_NUMBER: parseInt(process.env.MAGIC_NUMBER) || 202403,

  // Symbol
  SYMBOL: process.env.SYMBOL || 'XAUUSD',
};
