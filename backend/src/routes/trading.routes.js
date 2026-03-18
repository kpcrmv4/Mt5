const express = require('express');
const router = express.Router();
const mt5Service = require('../services/mt5.service');
const gridService = require('../services/grid.service');
const tradeStore = require('../models/trade.model');

// GET /api/trading/status - Overall bot status
router.get('/status', async (req, res) => {
  const gridStatus = gridService.getStatus();
  const accountInfo = await mt5Service.getAccountInfo();
  const performance = tradeStore.performance;

  res.json({
    connected: mt5Service.isConnected(),
    grid: gridStatus,
    account: accountInfo,
    performance,
  });
});

// GET /api/trading/positions - Open positions
router.get('/positions', async (req, res) => {
  const positions = await mt5Service.getPositions();
  res.json(positions);
});

// GET /api/trading/orders - Pending orders
router.get('/orders', async (req, res) => {
  const orders = await mt5Service.getOrders();
  res.json(orders);
});

// GET /api/trading/history - Trade history
router.get('/history', async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const history = await mt5Service.getTradeHistory(days);
  res.json(history);
});

// GET /api/trading/performance - Performance metrics
router.get('/performance', (req, res) => {
  res.json(tradeStore.performance);
});

// POST /api/trading/start - Start grid trading
router.post('/start', (req, res) => {
  gridService.start();
  res.json({ success: true, message: 'Grid trading started' });
});

// POST /api/trading/stop - Stop grid trading
router.post('/stop', (req, res) => {
  gridService.stop();
  res.json({ success: true, message: 'Grid trading stopped' });
});

// POST /api/trading/close-all - Emergency close all
router.post('/close-all', async (req, res) => {
  const results = await mt5Service.closeAllPositions();
  res.json({ success: true, closed: results });
});

// GET /api/trading/price - Current price
router.get('/price', async (req, res) => {
  const price = await mt5Service.getPrice();
  res.json(price);
});

module.exports = router;
