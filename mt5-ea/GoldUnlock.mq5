//+------------------------------------------------------------------+
//|                                                  GoldUnlock.mq5  |
//|                        Gold Unlock Grid Trading Bot              |
//|                        XAU/USD with AI Regime Detection          |
//+------------------------------------------------------------------+
#property copyright "Gold Unlock"
#property version   "1.00"
#property strict

//--- Input Parameters
input group "=== Grid Settings ==="
input int      GridLevels        = 6;       // Grid levels per side
input double   AtrMultiplier     = 1.5;     // ATR multiplier for spacing
input double   BaseLot           = 0.01;    // Base lot size
input int      MaxPositions      = 12;      // Maximum open positions
input int      AtrPeriod         = 14;      // ATR period

input group "=== Take Profit & Stop Loss ==="
input double   TpMultiplier      = 2.0;     // TP = spacing × this
input double   SlMultiplier      = 3.0;     // SL = spacing × this

input group "=== Filters ==="
input bool     FilterRsiEnabled  = false;   // Enable RSI filter
input int      RsiPeriod         = 14;      // RSI period
input double   RsiOverbought     = 70.0;    // RSI overbought level
input double   RsiOversold       = 30.0;    // RSI oversold level
input bool     FilterEmaEnabled  = true;    // Enable EMA filter
input int      EmaPeriodFast     = 20;      // EMA fast period
input int      EmaPeriodSlow     = 50;      // EMA slow period

input group "=== AI Integration ==="
input bool     AiAutoEnabled     = true;    // Enable AI auto-config
input int      AiCheckInterval   = 300;     // AI check interval (seconds)
input string   AiConfigFile      = "gold_unlock_config.json"; // Config file from backend

input group "=== Risk Management ==="
input double   MaxDrawdownPct    = 10.0;    // Max drawdown % to close all
input int      MagicNumber       = 202403;  // Magic number

//--- Global Variables
int handleAtr, handleRsi, handleEmaFast, handleEmaSlow;
double gridSpacing;
double gridBuyLevels[];
double gridSellLevels[];
datetime lastAiCheck;
datetime lastGridUpdate;
bool newsShieldActive = false;
string currentRegime = "Neutral";

// Dynamic config (can be overridden by AI)
double dynAtrMultiplier;
int    dynGridLevels;
double dynBaseLot;
bool   dynFilterRsi;
bool   dynFilterEma;

//+------------------------------------------------------------------+
//| Expert initialization function                                     |
//+------------------------------------------------------------------+
int OnInit()
{
   // Initialize indicators
   handleAtr     = iATR(_Symbol, PERIOD_H1, AtrPeriod);
   handleRsi     = iRSI(_Symbol, PERIOD_H1, RsiPeriod, PRICE_CLOSE);
   handleEmaFast = iMA(_Symbol, PERIOD_H1, EmaPeriodFast, 0, MODE_EMA, PRICE_CLOSE);
   handleEmaSlow = iMA(_Symbol, PERIOD_H1, EmaPeriodSlow, 0, MODE_EMA, PRICE_CLOSE);

   if(handleAtr == INVALID_HANDLE || handleRsi == INVALID_HANDLE ||
      handleEmaFast == INVALID_HANDLE || handleEmaSlow == INVALID_HANDLE)
   {
      Print("Error creating indicators");
      return INIT_FAILED;
   }

   // Initialize dynamic config with input defaults
   dynAtrMultiplier = AtrMultiplier;
   dynGridLevels    = GridLevels;
   dynBaseLot       = BaseLot;
   dynFilterRsi     = FilterRsiEnabled;
   dynFilterEma     = FilterEmaEnabled;

   // Initialize grid arrays
   ArrayResize(gridBuyLevels, dynGridLevels);
   ArrayResize(gridSellLevels, dynGridLevels);

   lastAiCheck = 0;
   lastGridUpdate = 0;

   Print("Gold Unlock Grid Bot initialized");
   Print("Symbol: ", _Symbol, " | Grid Levels: ", dynGridLevels,
         " | ATR Mult: ", dynAtrMultiplier, " | Lot: ", dynBaseLot);

   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                    |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   IndicatorRelease(handleAtr);
   IndicatorRelease(handleRsi);
   IndicatorRelease(handleEmaFast);
   IndicatorRelease(handleEmaSlow);
   Print("Gold Unlock Grid Bot stopped. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                                |
//+------------------------------------------------------------------+
void OnTick()
{
   // Check max drawdown - emergency close
   if(CheckMaxDrawdown())
   {
      CloseAllPositions("Max Drawdown exceeded");
      return;
   }

   // Load AI config periodically
   if(AiAutoEnabled && TimeCurrent() - lastAiCheck >= AiCheckInterval)
   {
      LoadAiConfig();
      lastAiCheck = TimeCurrent();
   }

   // News shield check
   if(newsShieldActive)
   {
      Comment("NEWS SHIELD ACTIVE - Trading paused");
      return;
   }

   // Update grid every new bar (H1)
   if(IsNewBar(PERIOD_H1))
   {
      CalculateGrid();
      ManageGrid();
   }
}

//+------------------------------------------------------------------+
//| Calculate grid levels around current price                         |
//+------------------------------------------------------------------+
void CalculateGrid()
{
   double atr[];
   ArraySetAsSeries(atr, true);
   if(CopyBuffer(handleAtr, 0, 0, 3, atr) < 3) return;

   gridSpacing = atr[1] * dynAtrMultiplier;
   if(gridSpacing < SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 100)
      gridSpacing = SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 100;

   double midPrice = GetMidPrice();

   ArrayResize(gridBuyLevels, dynGridLevels);
   ArrayResize(gridSellLevels, dynGridLevels);

   for(int i = 0; i < dynGridLevels; i++)
   {
      gridBuyLevels[i]  = NormalizeDouble(midPrice - gridSpacing * (i + 1), _Digits);
      gridSellLevels[i] = NormalizeDouble(midPrice + gridSpacing * (i + 1), _Digits);
   }

   // Write grid info to file for backend to read
   WriteGridStatus(midPrice);

   Print("Grid updated | Mid: ", midPrice, " | Spacing: ", gridSpacing,
         " | Levels: ", dynGridLevels);
}

//+------------------------------------------------------------------+
//| Manage grid - place/cancel orders as needed                        |
//+------------------------------------------------------------------+
void ManageGrid()
{
   int totalPositions = CountPositions();
   if(totalPositions >= MaxPositions) return;

   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);

   // Get indicator values for filtering
   double rsi = GetIndicatorValue(handleRsi);
   double emaFast = GetIndicatorValue(handleEmaFast);
   double emaSlow = GetIndicatorValue(handleEmaSlow);

   double tp = gridSpacing * TpMultiplier;
   double sl = gridSpacing * SlMultiplier;

   // Place buy limit orders at grid levels
   for(int i = 0; i < dynGridLevels; i++)
   {
      if(totalPositions >= MaxPositions) break;

      // Buy levels (below current price)
      if(gridBuyLevels[i] < bid && !HasOrderAtPrice(gridBuyLevels[i], ORDER_TYPE_BUY_LIMIT))
      {
         if(ShouldBuy(rsi, emaFast, emaSlow))
         {
            double lotSize = CalculateLotSize(POSITION_TYPE_BUY);
            PlaceLimitOrder(ORDER_TYPE_BUY_LIMIT, gridBuyLevels[i], lotSize, tp, sl);
         }
      }

      // Sell levels (above current price)
      if(gridSellLevels[i] > ask && !HasOrderAtPrice(gridSellLevels[i], ORDER_TYPE_SELL_LIMIT))
      {
         if(ShouldSell(rsi, emaFast, emaSlow))
         {
            double lotSize = CalculateLotSize(POSITION_TYPE_SELL);
            PlaceLimitOrder(ORDER_TYPE_SELL_LIMIT, gridSellLevels[i], lotSize, tp, sl);
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Check if should buy based on filters                               |
//+------------------------------------------------------------------+
bool ShouldBuy(double rsi, double emaFast, double emaSlow)
{
   if(dynFilterRsi && rsi > RsiOverbought) return false;
   if(dynFilterEma && emaFast < emaSlow)
   {
      // In downtrend regime, allow reduced buying
      if(currentRegime == "Strong Downtrend") return false;
   }
   return true;
}

//+------------------------------------------------------------------+
//| Check if should sell based on filters                              |
//+------------------------------------------------------------------+
bool ShouldSell(double rsi, double emaFast, double emaSlow)
{
   if(dynFilterRsi && rsi < RsiOversold) return false;
   if(dynFilterEma && emaFast > emaSlow)
   {
      if(currentRegime == "Strong Uptrend") return false;
   }
   return true;
}

//+------------------------------------------------------------------+
//| Calculate lot size based on regime                                 |
//+------------------------------------------------------------------+
double CalculateLotSize(ENUM_POSITION_TYPE type)
{
   double lot = dynBaseLot;

   if(currentRegime == "Strong Uptrend" && type == POSITION_TYPE_BUY)
      lot *= 1.5;
   else if(currentRegime == "Strong Uptrend" && type == POSITION_TYPE_SELL)
      lot *= 0.5;
   else if(currentRegime == "Mild Uptrend" && type == POSITION_TYPE_BUY)
      lot *= 1.2;
   else if(currentRegime == "Strong Downtrend" && type == POSITION_TYPE_SELL)
      lot *= 1.5;
   else if(currentRegime == "Strong Downtrend" && type == POSITION_TYPE_BUY)
      lot *= 0.5;
   else if(currentRegime == "Mild Downtrend" && type == POSITION_TYPE_SELL)
      lot *= 1.2;
   else if(currentRegime == "High Volatility")
      lot *= 0.5;

   // Normalize lot
   double minLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double maxLot = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   lot = MathMax(minLot, MathMin(maxLot, MathRound(lot / lotStep) * lotStep));

   return lot;
}

//+------------------------------------------------------------------+
//| Place a limit order                                                |
//+------------------------------------------------------------------+
bool PlaceLimitOrder(ENUM_ORDER_TYPE type, double price, double lot, double tpPoints, double slPoints)
{
   MqlTradeRequest request = {};
   MqlTradeResult  result  = {};

   request.action    = TRADE_ACTION_PENDING;
   request.symbol    = _Symbol;
   request.volume    = lot;
   request.type      = type;
   request.price     = NormalizeDouble(price, _Digits);
   request.magic     = MagicNumber;
   request.comment   = "GU_Grid_" + currentRegime;

   if(type == ORDER_TYPE_BUY_LIMIT)
   {
      request.tp = NormalizeDouble(price + tpPoints, _Digits);
      request.sl = NormalizeDouble(price - slPoints, _Digits);
   }
   else
   {
      request.tp = NormalizeDouble(price - tpPoints, _Digits);
      request.sl = NormalizeDouble(price + slPoints, _Digits);
   }

   request.type_filling = ORDER_FILLING_IOC;
   request.expiration   = 0;

   if(!OrderSend(request, result))
   {
      Print("Order failed: ", result.retcode, " | ", result.comment);
      return false;
   }

   Print("Order placed: ", EnumToString(type), " @ ", price, " | Lot: ", lot,
         " | TP: ", request.tp, " | SL: ", request.sl);
   return true;
}

//+------------------------------------------------------------------+
//| Load AI config from JSON file                                      |
//+------------------------------------------------------------------+
void LoadAiConfig()
{
   string filename = AiConfigFile;
   int fileHandle = FileOpen(filename, FILE_READ | FILE_TXT | FILE_COMMON);
   if(fileHandle == INVALID_HANDLE) return;

   string content = "";
   while(!FileIsEnding(fileHandle))
      content += FileReadString(fileHandle);
   FileClose(fileHandle);

   if(StringLen(content) == 0) return;

   // Parse JSON manually (MQL5 doesn't have native JSON)
   string regime = ExtractJsonString(content, "regime");
   if(StringLen(regime) > 0) currentRegime = regime;

   double atrMult = ExtractJsonDouble(content, "atr_multiplier");
   if(atrMult > 0) dynAtrMultiplier = atrMult;

   int levels = (int)ExtractJsonDouble(content, "grid_levels");
   if(levels > 0) dynGridLevels = levels;

   double lot = ExtractJsonDouble(content, "base_lot");
   if(lot > 0) dynBaseLot = lot;

   bool shield = ExtractJsonBool(content, "news_shield_active");
   newsShieldActive = shield;

   bool rsiFilter = ExtractJsonBool(content, "filter_rsi");
   dynFilterRsi = rsiFilter;

   bool emaFilter = ExtractJsonBool(content, "filter_ema");
   dynFilterEma = emaFilter;

   Print("AI Config loaded | Regime: ", currentRegime, " | ATR Mult: ", dynAtrMultiplier,
         " | Levels: ", dynGridLevels, " | Shield: ", newsShieldActive);
}

//+------------------------------------------------------------------+
//| Write grid status to file for backend                              |
//+------------------------------------------------------------------+
void WriteGridStatus(double midPrice)
{
   int fileHandle = FileOpen("gold_unlock_status.json", FILE_WRITE | FILE_TXT | FILE_COMMON);
   if(fileHandle == INVALID_HANDLE) return;

   string json = "{\n";
   json += "  \"timestamp\": \"" + TimeToString(TimeCurrent()) + "\",\n";
   json += "  \"symbol\": \"" + _Symbol + "\",\n";
   json += "  \"mid_price\": " + DoubleToString(midPrice, _Digits) + ",\n";
   json += "  \"bid\": " + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits) + ",\n";
   json += "  \"ask\": " + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_ASK), _Digits) + ",\n";
   json += "  \"spread\": " + DoubleToString(SymbolInfoDouble(_Symbol, SYMBOL_ASK) - SymbolInfoDouble(_Symbol, SYMBOL_BID), _Digits) + ",\n";
   json += "  \"grid_spacing\": " + DoubleToString(gridSpacing, _Digits) + ",\n";
   json += "  \"grid_levels\": " + IntegerToString(dynGridLevels) + ",\n";
   json += "  \"regime\": \"" + currentRegime + "\",\n";
   json += "  \"open_positions\": " + IntegerToString(CountPositions()) + ",\n";
   json += "  \"open_orders\": " + IntegerToString(CountPendingOrders()) + ",\n";
   json += "  \"balance\": " + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",\n";
   json += "  \"equity\": " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",\n";
   json += "  \"profit\": " + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",\n";

   // Buy levels
   json += "  \"buy_levels\": [";
   for(int i = 0; i < dynGridLevels; i++)
   {
      json += DoubleToString(gridBuyLevels[i], _Digits);
      if(i < dynGridLevels - 1) json += ", ";
   }
   json += "],\n";

   // Sell levels
   json += "  \"sell_levels\": [";
   for(int i = 0; i < dynGridLevels; i++)
   {
      json += DoubleToString(gridSellLevels[i], _Digits);
      if(i < dynGridLevels - 1) json += ", ";
   }
   json += "]\n";

   json += "}";

   FileWriteString(fileHandle, json);
   FileClose(fileHandle);
}

//+------------------------------------------------------------------+
//| Check max drawdown                                                 |
//+------------------------------------------------------------------+
bool CheckMaxDrawdown()
{
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(balance <= 0) return false;

   double drawdown = ((balance - equity) / balance) * 100.0;
   return drawdown >= MaxDrawdownPct;
}

//+------------------------------------------------------------------+
//| Close all positions                                                |
//+------------------------------------------------------------------+
void CloseAllPositions(string reason)
{
   Print("EMERGENCY CLOSE: ", reason);

   // Cancel all pending orders
   for(int i = OrdersTotal() - 1; i >= 0; i--)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket) && OrderGetInteger(ORDER_MAGIC) == MagicNumber)
      {
         MqlTradeRequest request = {};
         MqlTradeResult  result  = {};
         request.action = TRADE_ACTION_REMOVE;
         request.order  = ticket;
         OrderSend(request, result);
      }
   }

   // Close all positions
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket) && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         MqlTradeRequest request = {};
         MqlTradeResult  result  = {};
         request.action   = TRADE_ACTION_DEAL;
         request.symbol   = _Symbol;
         request.volume   = PositionGetDouble(POSITION_VOLUME);
         request.position = ticket;
         request.type     = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
                            ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
         request.price    = (request.type == ORDER_TYPE_SELL)
                            ? SymbolInfoDouble(_Symbol, SYMBOL_BID)
                            : SymbolInfoDouble(_Symbol, SYMBOL_ASK);
         request.type_filling = ORDER_FILLING_IOC;
         OrderSend(request, result);
      }
   }
}

//+------------------------------------------------------------------+
//| Count open positions with our magic number                         |
//+------------------------------------------------------------------+
int CountPositions()
{
   int count = 0;
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket) && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| Count pending orders with our magic number                         |
//+------------------------------------------------------------------+
int CountPendingOrders()
{
   int count = 0;
   for(int i = 0; i < OrdersTotal(); i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket) && OrderGetInteger(ORDER_MAGIC) == MagicNumber)
         count++;
   }
   return count;
}

//+------------------------------------------------------------------+
//| Check if there's already an order at a specific price              |
//+------------------------------------------------------------------+
bool HasOrderAtPrice(double price, ENUM_ORDER_TYPE type)
{
   double tolerance = SymbolInfoDouble(_Symbol, SYMBOL_POINT) * 10;

   // Check pending orders
   for(int i = 0; i < OrdersTotal(); i++)
   {
      ulong ticket = OrderGetTicket(i);
      if(OrderSelect(ticket) && OrderGetInteger(ORDER_MAGIC) == MagicNumber)
      {
         if(OrderGetInteger(ORDER_TYPE) == type &&
            MathAbs(OrderGetDouble(ORDER_PRICE_OPEN) - price) < tolerance)
            return true;
      }
   }

   // Check open positions
   for(int i = 0; i < PositionsTotal(); i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(PositionSelectByTicket(ticket) && PositionGetInteger(POSITION_MAGIC) == MagicNumber)
      {
         if(MathAbs(PositionGetDouble(POSITION_PRICE_OPEN) - price) < tolerance)
            return true;
      }
   }

   return false;
}

//+------------------------------------------------------------------+
//| Get mid price between bid and ask                                  |
//+------------------------------------------------------------------+
double GetMidPrice()
{
   return (SymbolInfoDouble(_Symbol, SYMBOL_BID) + SymbolInfoDouble(_Symbol, SYMBOL_ASK)) / 2.0;
}

//+------------------------------------------------------------------+
//| Get single indicator value                                         |
//+------------------------------------------------------------------+
double GetIndicatorValue(int handle)
{
   double value[];
   ArraySetAsSeries(value, true);
   if(CopyBuffer(handle, 0, 0, 2, value) < 2) return 0;
   return value[0];
}

//+------------------------------------------------------------------+
//| Detect new bar                                                     |
//+------------------------------------------------------------------+
bool IsNewBar(ENUM_TIMEFRAMES tf)
{
   static datetime lastBarTime = 0;
   datetime currentBarTime = iTime(_Symbol, tf, 0);
   if(currentBarTime != lastBarTime)
   {
      lastBarTime = currentBarTime;
      return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Extract string value from JSON                                     |
//+------------------------------------------------------------------+
string ExtractJsonString(string json, string key)
{
   string searchKey = "\"" + key + "\"";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return "";

   int colonPos = StringFind(json, ":", pos + StringLen(searchKey));
   if(colonPos < 0) return "";

   int quoteStart = StringFind(json, "\"", colonPos + 1);
   if(quoteStart < 0) return "";

   int quoteEnd = StringFind(json, "\"", quoteStart + 1);
   if(quoteEnd < 0) return "";

   return StringSubstr(json, quoteStart + 1, quoteEnd - quoteStart - 1);
}

//+------------------------------------------------------------------+
//| Extract double value from JSON                                     |
//+------------------------------------------------------------------+
double ExtractJsonDouble(string json, string key)
{
   string searchKey = "\"" + key + "\"";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return 0;

   int colonPos = StringFind(json, ":", pos + StringLen(searchKey));
   if(colonPos < 0) return 0;

   string valueStr = "";
   for(int i = colonPos + 1; i < StringLen(json); i++)
   {
      ushort ch = StringGetCharacter(json, i);
      if((ch >= '0' && ch <= '9') || ch == '.' || ch == '-')
         valueStr += ShortToString(ch);
      else if(StringLen(valueStr) > 0)
         break;
   }

   return StringToDouble(valueStr);
}

//+------------------------------------------------------------------+
//| Extract bool value from JSON                                       |
//+------------------------------------------------------------------+
bool ExtractJsonBool(string json, string key)
{
   string searchKey = "\"" + key + "\"";
   int pos = StringFind(json, searchKey);
   if(pos < 0) return false;

   int colonPos = StringFind(json, ":", pos + StringLen(searchKey));
   if(colonPos < 0) return false;

   return StringFind(json, "true", colonPos) > 0 &&
          StringFind(json, "true", colonPos) < colonPos + 20;
}
//+------------------------------------------------------------------+
