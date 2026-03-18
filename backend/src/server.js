require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const logger = require('./utils/logger');
const mt5Service = require('./services/mt5.service');
const gridService = require('./services/grid.service');
const aiRegimeService = require('./services/ai-regime.service');
const newsShieldService = require('./services/news-shield.service');
const tradingRoutes = require('./routes/trading.routes');
const configRoutes = require('./routes/config.routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trading', tradingRoutes);
app.use('/api/config', configRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mt5Connected: mt5Service.isConnected(),
    gridRunning: gridService.getStatus().running,
    uptime: process.uptime(),
  });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Broadcast status updates every 5 seconds
setInterval(async () => {
  if (!mt5Service.isConnected()) return;

  try {
    const [price, positions, orders, accountInfo] = await Promise.all([
      mt5Service.getPrice(),
      mt5Service.getPositions(),
      mt5Service.getOrders(),
      mt5Service.getAccountInfo(),
    ]);

    io.emit('update', {
      price,
      positions,
      orders,
      account: accountInfo,
      grid: gridService.getStatus(),
      newsShield: newsShieldService.getStatus(),
      aiRegime: aiRegimeService.getLastAnalysis(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Broadcast error: ${error.message}`);
  }
}, 5000);

// Startup
async function start() {
  const PORT = process.env.PORT || 3000;

  logger.info('=================================');
  logger.info('  GOLD UNLOCK Grid Trading Bot');
  logger.info('=================================');

  // Connect to MT5
  const connected = await mt5Service.connect();
  if (connected) {
    logger.info('MT5 connected — starting services');

    // Start grid trading
    gridService.start();

    // Start file-based AI regime (reads from cowork's ai_config.json)
    aiRegimeService.init();
    aiRegimeService.start();

    // Start calendar-based news shield
    newsShieldService.init();
    newsShieldService.start();
  } else {
    logger.warn(
      'MT5 not connected — running in monitor-only mode. Set META_API_TOKEN and META_API_ACCOUNT_ID in .env'
    );
  }

  server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Dashboard: http://localhost:4200`);
    logger.info(`API: http://localhost:${PORT}/api/health`);
  });
}

start().catch((error) => {
  logger.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
