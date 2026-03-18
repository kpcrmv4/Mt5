const express = require('express');
const router = express.Router();
const config = require('../../config/trading');
const gridService = require('../services/grid.service');
const aiRegimeService = require('../services/ai-regime.service');
const newsShieldService = require('../services/news-shield.service');

// GET /api/config - Get current config
router.get('/', (req, res) => {
  res.json({
    grid: {
      GRID_LEVELS: config.GRID_LEVELS,
      ATR_MULTIPLIER: config.ATR_MULTIPLIER,
      BASE_LOT: config.BASE_LOT,
      MAX_POSITIONS: config.MAX_POSITIONS,
      TP_MULTIPLIER: config.TP_MULTIPLIER,
      SL_MULTIPLIER: config.SL_MULTIPLIER,
    },
    filters: {
      FILTER_RSI_ENABLED: config.FILTER_RSI_ENABLED,
      FILTER_EMA_ENABLED: config.FILTER_EMA_ENABLED,
      RSI_OVERBOUGHT: config.RSI_OVERBOUGHT,
      RSI_OVERSOLD: config.RSI_OVERSOLD,
    },
    ai: {
      AI_AUTO_ENABLED: config.AI_AUTO_ENABLED,
      AI_INTERVAL_MINUTES: config.AI_INTERVAL_MINUTES,
    },
    newsShield: {
      NEWS_SHIELD_ENABLED: config.NEWS_SHIELD_ENABLED,
      NEWS_CHECK_INTERVAL: config.NEWS_CHECK_INTERVAL,
      NEWS_PRE_EVENT_BUFFER: config.NEWS_PRE_EVENT_BUFFER,
    },
    risk: {
      MAX_DRAWDOWN_PCT: config.MAX_DRAWDOWN_PCT,
    },
  });
});

// PUT /api/config - Update config
router.put('/', (req, res) => {
  const updates = req.body;
  const applied = [];

  const allowedKeys = [
    'GRID_LEVELS', 'ATR_MULTIPLIER', 'BASE_LOT', 'MAX_POSITIONS',
    'TP_MULTIPLIER', 'SL_MULTIPLIER', 'FILTER_RSI_ENABLED',
    'FILTER_EMA_ENABLED', 'AI_AUTO_ENABLED', 'AI_INTERVAL_MINUTES',
    'NEWS_SHIELD_ENABLED', 'NEWS_CHECK_INTERVAL', 'NEWS_PRE_EVENT_BUFFER',
    'MAX_DRAWDOWN_PCT',
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.includes(key)) {
      config[key] = value;
      applied.push({ key, value });
    }
  }

  res.json({ success: true, applied });
});

// GET /api/config/ai-status - AI regime status
router.get('/ai-status', (req, res) => {
  res.json({
    lastAnalysis: aiRegimeService.getLastAnalysis(),
    regime: gridService.getStatus().regime,
  });
});

// POST /api/config/ai-analyze - Force AI analysis
router.post('/ai-analyze', async (req, res) => {
  const result = await aiRegimeService.analyze();
  res.json(result);
});

// GET /api/config/news-status - News shield status
router.get('/news-status', (req, res) => {
  res.json(newsShieldService.getStatus());
});

// POST /api/config/news-check - Force news check
router.post('/news-check', async (req, res) => {
  await newsShieldService.checkNews();
  res.json(newsShieldService.getStatus());
});

module.exports = router;
