#!/bin/bash
# GOLD UNLOCK — Setup Script
# ใช้ครั้งแรกเพื่อเซ็ตระบบทั้งหมด

set -e

echo "================================="
echo "  GOLD UNLOCK Setup"
echo "  Grid Trading Bot + AI"
echo "================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    echo "   https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Setup backend
echo ""
echo "📦 Setting up backend..."
cd backend

if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit backend/.env with your credentials:"
    echo ""
    echo "   META_API_TOKEN      — Get from https://metaapi.cloud"
    echo "   META_API_ACCOUNT_ID — Get from MetaAPI dashboard"
    echo "   ANTHROPIC_API_KEY   — Get from https://console.anthropic.com"
    echo ""
    read -p "Press Enter after editing .env, or Ctrl+C to exit and edit later..."
fi

npm install
echo "✅ Backend dependencies installed"

# Setup frontend
echo ""
echo "📦 Setting up frontend..."
cd ../frontend
npm install
echo "✅ Frontend dependencies installed"

# Create log directories
cd ..
mkdir -p logs ai_reports

echo ""
echo "================================="
echo "  Setup Complete!"
echo "================================="
echo ""
echo "  Start backend:   cd backend && npm run dev"
echo "  Start frontend:  cd frontend && npm start"
echo "  Dashboard:       http://localhost:4200"
echo ""
echo "  For Claude Code cowork:"
echo "  claude --cowork"
echo ""
