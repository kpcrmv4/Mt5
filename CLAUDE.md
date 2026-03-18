# GOLD UNLOCK - MT5 Grid Trading Bot with AI Regime Detection

## Project Overview
ระบบ Grid Trading Bot สำหรับ XAU/USD บน MetaTrader 5 พร้อม AI Regime Detection ใช้ Claude Sonnet 4.6 วิเคราะห์สภาวะตลาด และปรับ config อัตโนมัติ

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  MT5 EA     │◄───►│  Node.js Backend │◄───►│ Angular        │
│  (MQL5)     │     │  + Claude AI     │     │ Dashboard      │
│  Port: MT5  │     │  Port: 3000      │     │ Port: 4200     │
└─────────────┘     └──────────────────┘     └────────────────┘
```

### Components
1. **mt5-ea/** — Expert Advisor (MQL5) Grid Trading logic, ส่ง/จัดการ orders บน MT5
2. **backend/** — Node.js + Express, AI regime detection via Claude API, WebSocket real-time updates
3. **frontend/** — Angular dashboard แสดง performance, grid levels, AI regime, orders

## Tech Stack
- **MT5 EA**: MQL5 (MetaTrader 5)
- **Backend**: Node.js, Express, Socket.IO, MetaAPI Cloud SDK
- **AI**: Claude Sonnet 4.6 (`@anthropic-ai/sdk`)
- **Frontend**: Angular 17+, TailwindCSS
- **Indicators**: RSI, ATR, EMA20/50 (via `technicalindicators`)

## Trading Strategy

### Grid Trading Logic
- วาง Buy/Sell grid levels รอบราคาปัจจุบัน
- Default: 6 levels per side, spacing = ATR × ATR_MULTIPLIER
- TP/SL คำนวณจาก grid spacing (TP ~2x spacing, SL ~3x spacing)

### AI Regime Detection
Claude วิเคราะห์ indicators แล้วจำแนกตลาดเป็น:
- **Strong Uptrend** — เปิดเฉพาะ Buy grids, เพิ่ม lot
- **Mild Uptrend** — เน้น Buy, ลด Sell lots
- **Neutral** — เปิดทั้ง Buy/Sell เท่ากัน
- **Mild Downtrend** — เน้น Sell, ลด Buy lots
- **Strong Downtrend** — เปิดเฉพาะ Sell grids, เพิ่ม lot
- **High Volatility** — ขยาย grid spacing, ลด lot size

### Key Config Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| GRID_LEVELS | 6 | จำนวน grid levels ต่อฝั่ง |
| ATR_MULTIPLIER | 1.5 | ตัวคูณ ATR สำหรับ grid spacing |
| BASE_LOT | 0.01 | Lot size พื้นฐาน |
| MAX_POSITIONS | 12 | จำนวน positions สูงสุด |
| FILTER_RSI_ENABLED | false | กรอง entry ด้วย RSI |
| FILTER_EMA_ENABLED | true | กรอง entry ด้วย EMA crossover |
| AI_AUTO_ENABLED | true | เปิด/ปิด AI ปรับ config อัตโนมัติ |
| AI_INTERVAL_MINUTES | 5 | ความถี่ AI วิเคราะห์ตลาด |

## Project Structure

```
Mt5/
├── CLAUDE.md              # ไฟล์นี้
├── mt5-ea/
│   └── GoldUnlock.mq5     # Expert Advisor หลัก
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── config/
│   │   └── trading.js      # Trading parameters & defaults
│   └── src/
│       ├── server.js        # Express + Socket.IO entry point
│       ├── services/
│       │   ├── mt5.service.js       # MetaAPI connection & order management
│       │   ├── grid.service.js      # Grid calculation & management
│       │   ├── ai-regime.service.js # Claude AI regime detection
│       │   └── indicator.service.js # Technical indicator calculations
│       ├── routes/
│       │   ├── trading.routes.js    # REST API for trading operations
│       │   └── config.routes.js     # REST API for config management
│       ├── models/
│       │   └── trade.model.js       # Trade data structures
│       └── utils/
│           └── logger.js            # Winston logger setup
├── frontend/
│   ├── angular.json
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── components/   # Reusable UI components
│       │   ├── pages/        # Route pages (dashboard, config, history)
│       │   ├── services/     # Angular services (API, WebSocket)
│       │   └── models/       # TypeScript interfaces
│       ├── assets/
│       └── environments/
├── ai_reports/              # AI analysis reports (auto-generated)
└── docker-compose.yml
```

## Development

### Prerequisites
- Node.js 20+
- MetaTrader 5 with demo/live account
- MetaAPI Cloud account (free tier available)
- Anthropic API key

### Quick Start
```bash
# Backend
cd backend
cp .env.example .env    # แก้ไข credentials
npm install
npm run dev

# Frontend
cd frontend
npm install
ng serve
```

### Environment Variables
ดู `backend/.env.example` สำหรับ variables ที่จำเป็น

## Risk Management
- Max Drawdown limit: 10% (auto-close all positions)
- Max positions: 12 (configurable)
- AI จะลด lot size อัตโนมัติในช่วง high volatility
- Grid spacing ขยายตาม ATR เมื่อตลาดผันผวน

## Coding Conventions
- Backend: CommonJS modules, camelCase, JSDoc comments เฉพาะ public functions
- Frontend: Angular style guide, TypeScript strict mode
- MQL5: PascalCase สำหรับ functions, UPPER_SNAKE_CASE สำหรับ constants
- Commit messages: ภาษาอังกฤษ, conventional commits format

## Important Notes
- **ห้าม** ใช้กับเงินจริงโดยไม่ผ่าน backtesting อย่างน้อย 3 เดือน
- Grid Trading มีความเสี่ยงสูงช่วงตลาด trend แรง (NFP, FOMC, CPI)
- ระบบนี้ออกแบบสำหรับ demo account เป็นหลัก
- AI regime detection ช่วยลดความเสี่ยง แต่ไม่ได้ guarantee กำไร
