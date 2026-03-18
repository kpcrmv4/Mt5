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

### News Shield — ป้องกัน Grid Blow Up ช่วงข่าวแรง
ระบบดึงข่าวและวิเคราะห์ sentiment ด้วย Claude เพื่อปรับ risk อัตโนมัติ:

**News Sources:**
- Forex Factory Economic Calendar (high-impact events: NFP, FOMC, CPI)
- RSS feeds (Reuters, Bloomberg)
- Social media sentiment (Truth Social, X) — optional

**Impact Levels & Actions:**
| Level | ตัวอย่าง | Action |
|-------|---------|--------|
| 🟢 Low | Minor economic data | Grid ทำงานปกติ |
| 🟡 Medium | Trump tweet เรื่อง trade | ลด lot 50%, ขยาย spacing 1.5x |
| 🔴 High | NFP, FOMC, CPI release | หยุดเปิด order ใหม่, รอ 30 นาที |
| ⚫ Critical | War/crisis, unexpected rate decision | ปิด positions ทั้งหมด (emergency) |

**News Check Interval:** ทุก 2 นาที (configurable)
**Pre-event Buffer:** หยุดเปิด order 30 นาทีก่อน high-impact event

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
| NEWS_SHIELD_ENABLED | true | เปิด/ปิด News Shield |
| NEWS_CHECK_INTERVAL | 2 | ความถี่เช็คข่าว (นาที) |
| NEWS_PRE_EVENT_BUFFER | 30 | หยุด trade ก่อน high-impact event (นาที) |

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
│       │   ├── news-shield.service.js # News sentiment & event shield
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

## Deployment Phases

### Phase 1 — Local Development (เริ่มต้น, ฟรี)
```
PC ของเรา (Windows/Mac)
├── MT5 Terminal (demo account)
├── Node.js Backend (localhost:3000)
└── Angular Dashboard (localhost:4200)
```
ทุกอย่างรันบนเครื่องเดียว เหมาะสำหรับพัฒนาและทดสอบ

### Phase 2 — Production (เมื่อเวิร์ค)
```
Windows VPS (~$10/mo)          Vercel (free)        Supabase (free)
├── MT5 Terminal          →    Frontend Dashboard   Trade History DB
├── Node.js Backend                                 Realtime updates
└── Bridge to Supabase
```
- ย้าย MT5 + Backend ไป Windows VPS
- Frontend ขึ้น Vercel (ฟรี) หรือเข้าผ่าน VPS IP
- เพิ่ม Supabase สำหรับ trade history ระยะยาว (optional)

## Setup Guide — ขั้นตอนทั้งหมด

### Step 1: สมัคร Services (ทำครั้งเดียว)

#### 1a. MetaAPI Cloud (เชื่อม MT5 ผ่าน cloud — ไม่ต้องเปิด MT5 terminal เอง)
1. ไปที่ https://metaapi.cloud → Sign Up (free tier: 1 account)
2. Dashboard → "New Account" → เลือก MetaTrader 5
3. ใส่ข้อมูล MT5 demo account:
   - **Server**: ชื่อ server ของ broker (เช่น `Exness-MT5Trial6`)
   - **Login**: เลข MT5 account
   - **Password**: investor/master password
4. รอ deploy (~2 นาที) → Copy **Account ID**
5. ไป Settings → API Access → Copy **API Token**

#### 1b. MetaTrader 5 Demo Account
1. ดาวน์โหลด MT5 จาก broker (Exness, XM, ICMarkets, etc.)
2. เปิด Demo Account → เลือก account ที่มี XAU/USD
3. จด Server, Login, Password ไว้ใช้กับ MetaAPI

### Step 2: Setup Project

```bash
# Clone & setup
chmod +x setup.sh
./setup.sh
```

หรือทำ manual:
```bash
# Backend
cd backend
cp .env.example .env
# แก้ไข .env ใส่ credentials ที่ได้จาก Step 1
npm install

# Frontend
cd frontend
npm install
```

### Step 3: แก้ไข .env

แก้ `backend/.env`:
```env
META_API_TOKEN=eyJ...          # จาก MetaAPI Settings
META_API_ACCOUNT_ID=abc123...  # จาก MetaAPI Dashboard
# ไม่ต้องใส่ ANTHROPIC_API_KEY — ใช้ Claude Code cowork แทน!
```

### Step 4: Start

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm start
```

เปิด http://localhost:4200 ดู dashboard

### Step 5: ใช้ Claude Code Cowork

```bash
# ใน project directory
claude --cowork
```

Claude จะอ่าน `.claude/cowork.md` แล้วเริ่ม monitor bot ให้อัตโนมัติ:
- อ่าน `logs/performance.json` ดู balance/drawdown
- อ่าน `ai_reports/*.md` ดู AI analysis ล่าสุด
- เรียก API เช็คสถานะ bot
- แจ้งเตือนเมื่อมีปัญหา

### Environment Variables Reference
| Variable | ได้จากไหน | จำเป็น |
|----------|----------|--------|
| META_API_TOKEN | https://metaapi.cloud → Settings → API Access | ✅ |
| META_API_ACCOUNT_ID | https://metaapi.cloud → Accounts → ID | ✅ |
| PORT | ไม่ต้องแก้ | ❌ default 3000 |
| SYMBOL | ไม่ต้องแก้ | ❌ default XAUUSD |

**ไม่ต้องมี ANTHROPIC_API_KEY** — AI ทำงานผ่าน Claude Code cowork โดยใช้ subscription ที่สมัครอยู่แล้ว

## Risk Management
- Max Drawdown limit: 10% (auto-close all positions)
- Max positions: 12 (configurable)
- AI จะลด lot size อัตโนมัติในช่วง high volatility
- Grid spacing ขยายตาม ATR เมื่อตลาดผันผวน

## Claude Code Integration (Cowork = AI Brain)

### Architecture: ไม่ต้องจ่าย API — ใช้ subscription เดิม

```
Backend                          Claude Code Cowork
┌────────────────┐               ┌─────────────────────┐
│ เขียน market   │──────────────►│ อ่าน market_data     │
│ data ทุก 10 วิ │  market_      │ วิเคราะห์ regime     │
│                │  data.json    │ เช็คข่าว (web search) │
│ อ่าน config    │◄──────────────│ เขียน ai_config      │
│ ปรับ grid      │  ai_config.   │ แจ้งเตือน user       │
└────────────────┘  json         └─────────────────────┘
```

### File-based Communication
| File | เขียนโดย | อ่านโดย | เนื้อหา |
|------|---------|--------|---------|
| `logs/market_data.json` | Backend | Cowork | Indicators, config, performance |
| `ai_config.json` | Cowork | Backend | Regime, config changes, news shield |
| `logs/performance.json` | Backend | Cowork | Balance, DD, win rate |
| `logs/trades.jsonl` | Backend | Cowork | Trade history |
| `logs/news_status.json` | Backend | Cowork | Calendar events |
| `logs/errors.log` | Backend | Cowork | Error logs |

### Cowork ทำอะไรได้:
1. **AI Regime Detection** — วิเคราะห์ indicators → เขียน regime ลง ai_config.json
2. **News Analysis** — ใช้ web search เช็คข่าวแล้ว set news_shield_active
3. **Config Optimization** — ปรับ ATR multiplier, grid levels, lot size ตามสภาวะตลาด
4. **Monitoring** — เตือนเมื่อ DD สูง, win rate ต่ำ, error เกิดขึ้น
5. **Daily Summary** — สรุป performance ประจำวัน

### Dispatch — Parallel Agents
ใช้ dispatch ส่ง agents ทำงานพร้อมกัน:
- **Monitor Agent**: ติดตาม trade logs + alert
- **Analyst Agent**: วิเคราะห์ performance, สร้าง report
- **News Agent**: ค้นหาข่าวที่กระทบทองคำ via web search

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
