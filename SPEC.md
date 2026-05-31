# SPEC.md — Human-Like Autonomous Trading Agent (Paper Trading)

## Project: `ai_trader`
A human-like AI trading agent that autonomously analyzes markets, reasons about trades, learns from history, and executes paper trades on Binance Testnet.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AI TRADER — PAPER TRADING                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐     │
│  │                     ORCHESTRATOR (main.py)                           │     │
│  │         (Manages lifecycle, logging, coordinates agents)             │     │
│  └──────────────┬──────────────┬──────────────┬──────────────────────┘     │
│                 │              │              │                              │
│     ┌───────────▼───┐ ┌──────▼──────┐ ┌─────▼──────┐ ┌──────────┐          │
│     │  Personality  │ │   Market    │ │  Reasoning │ │  Memory  │          │
│     │    Engine     │ │   Agent     │ │   Engine   │ │  Agent   │          │
│     │(traits,emotion│ │(Binance API)│ │(LLM think) │ │(learn)   │          │
│     └───────┬───────┘ └──────┬──────┘ └─────┬──────┘ └────┬─────┘          │
│             │                │              │             │                 │
│             └────────────────┴──────┬───────┴─────────────┘                 │
│                                     │                                        │
│                           ┌─────────▼──────────┐                            │
│                           │   Risk Guardian    │                            │
│                           │  (safety override) │                            │
│                           └─────────┬──────────┘                            │
│                                     │                                        │
│                           ┌─────────▼──────────┐                            │
│                           │ Execution Agent    │                            │
│                           │(Binance Testnet)   │                            │
│                           └────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Specifications

### 2.1 Personality Engine (`personality.py`)

**Purpose:** Gives the agent human-like character, emotions, and decision style.

**Traits (configurable):**
- `risk_tolerance`: 0.0-1.0 (0=conservative, 1=aggressive)
- `confidence_level`: 0.0-1.0 (affects conviction in decisions)
- `patience`: 0.0-1.0 (0=impulsive, 1=waits for perfect setups)
- `adaptability`: 0.0-1.0 (how fast it learns from mistakes)

**Emotional States (dynamic):**
- `mood`: "confident", "nervous", "greedy", "fearful", "neutral", "excited", "hesitant"
- `stress_level`: 0.0-1.0 (increases with consecutive losses)
- `streak_bias`: positive/negative streak affects future decisions

**Interface:**
```python
class Personality:
    def __init__(self, config: dict = None) -> None
    def update_emotion(self, trade_result: dict) -> None  # Updates mood after trade
    def get_mood_description(self) -> str  # Returns human-readable mood
    def affects_decision(self, signal_strength: float) -> float  # Modifies signal by emotion
    def to_dict(self) -> dict
    @classmethod
    def from_dict(cls, data: dict) -> "Personality"
```

### 2.2 Market Agent (`market_agent.py`)

**Purpose:** Fetches and preprocesses market data from Binance.

**Interface:**
```python
class MarketAgent:
    def __init__(self, api_key: str = None, api_secret: str = None, testnet: bool = True) -> None
    async def get_price(self, symbol: str) -> float
    async def get_klines(self, symbol: str, interval: str = "1h", limit: int = 100) -> pd.DataFrame
    async def get_account_balance(self) -> dict  # Returns USDT and asset balances
    async def get_ticker_24h(self, symbol: str) -> dict  # 24h stats
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame  # RSI, MACD, BB, EMA
    def analyze_market_structure(self, df: pd.DataFrame) -> dict  # Support/resistance, trend
    async def close(self) -> None
```

**Indicators Calculated:**
- RSI (14-period)
- MACD (12, 26, 9)
- Bollinger Bands (20, 2)
- EMA (20, 50)
- Support/Resistance levels (local min/max)
- Volume analysis

### 2.3 Reasoning Engine (`reasoning.py`)

**Purpose:** Core LLM-powered thinking module. Analyzes market data and personality to form trade decisions with human-like reasoning.

**Interface:**
```python
class ReasoningEngine:
    def __init__(self, personality: Personality, memory: MemoryAgent, model: str = "default") -> None
    async def analyze(self, market_data: dict, indicators: dict, balance: dict) -> dict
    # Returns: {
    #   "thought_process": str,      # Chain-of-thought explanation
    #   "decision": "BUY"|"SELL"|"HOLD",
    #   "confidence": 0.0-1.0,        # How sure it is
    #   "size": float,                # Position size (0-1 of available)
    #   "reasons": list[str],         # Bullet point reasons
    #   "risks": list[str],           # What could go wrong
    #   "entry_price": float|None,
    #   "stop_loss": float|None,
    #   "take_profit": float|None,
    # }
```

**Thinking Process (human-like):**
1. Observes market conditions ("BTC is testing the $43k resistance...")
2. Checks indicators ("RSI is at 68, not overbought but getting warm...")
3. Consults personality ("I'm feeling cautious after yesterday's loss...")
4. Checks memory ("Last time RSI was this high, it reversed...")
5. Weighs pros and cons ("Bullish trend but approaching resistance...")
6. Makes decision with confidence level ("I'll take a small position, 60% sure...")
7. Sets stop loss and take profit ("If it drops 2%, I'm out. Target: 5% gain...")

### 2.4 Memory Agent (`memory.py`)

**Purpose:** Persistent storage of trade history and learned patterns. Agent learns from wins/losses.

**Interface:**
```python
class MemoryAgent:
    def __init__(self, memory_file: str = "memory.json") -> None
    def record_trade(self, trade: dict) -> None
    def get_recent_trades(self, n: int = 10) -> list[dict]
    def get_statistics(self) -> dict  # Win rate, avg profit/loss, best/worst trades
    def get_lessons(self) -> list[str]  # Extracted patterns from history
    def get_performance_summary(self) -> str  # Human-readable summary
    def save(self) -> None
    def load(self) -> None
    def to_context(self) -> str  # Formats memory as context for reasoning engine
```

**Stored per trade:**
- Symbol, side, entry_price, exit_price, size, pnl, timestamp
- Market conditions at entry (RSI, trend, etc.)
- Agent's reasoning snapshot
- Outcome and lessons learned

### 2.5 Risk Guardian (`risk_guardian.py`)

**Purpose:** Hard safety limits that CANNOT be overridden by the agent. The ultimate override.

**Interface:**
```python
class RiskGuardian:
    def __init__(self, config: dict = None) -> None
    def validate_trade(self, decision: dict, balance: dict, open_positions: list) -> tuple[bool, str]
    # Returns (allowed, reason) — if False, trade is blocked
    def check_daily_limits(self, memory: MemoryAgent) -> bool  # Max daily loss check
    def get_risk_report(self) -> dict  # Current risk exposure
```

**Hard Limits (default):**
- Max position size: 20% of portfolio per trade
- Max daily loss: 5% of portfolio
- Max open positions: 3
- Required stop-loss on every trade
- No trading if portfolio down >15% from peak (drawdown circuit breaker)

### 2.6 Execution Agent (`execution.py`)

**Purpose:** Interfaces with Binance Testnet API to place and manage orders.

**Interface:**
```python
class ExecutionAgent:
    def __init__(self, api_key: str, api_secret: str) -> None
    async def place_market_order(self, symbol: str, side: str, quantity: float) -> dict
    async def place_limit_order(self, symbol: str, side: str, quantity: float, price: float) -> dict
    async def place_oco_order(self, symbol: str, side: str, quantity: float, 
                               price: float, stop_price: float, stop_limit_price: float) -> dict
    async def get_open_orders(self, symbol: str = None) -> list[dict]
    async def cancel_order(self, symbol: str, order_id: int) -> dict
    async def get_order_status(self, symbol: str, order_id: int) -> dict
    async def close(self) -> None
```

### 2.7 Main Orchestrator (`main.py`)

**Purpose:** Main loop. Coordinates all modules, manages lifecycle.

**Trading Loop:**
```python
async def trading_loop():
    while running:
        # 1. Fetch market data
        # 2. Calculate indicators
        # 3. Get memory context
        # 4. Reasoning engine makes decision
        # 5. Risk guardian validates
        # 6. Execute if approved
        # 7. Update memory and personality
        # 8. Log everything
        # 9. Sleep (configurable interval: 1m, 5m, 15m, 1h)
```

**Startup Checklist:**
1. Validate API keys (testnet)
2. Check balance
3. Load memory
4. Initialize personality
5. Run initial market scan
6. Start trading loop

---

## 3. Data Flow

```
Trading Cycle (per iteration):

1. MarketAgent fetches latest data + calculates indicators
2. MemoryAgent loads recent trade history + lessons
3. PersonalityEngine provides current emotional state
4. ReasoningEngine receives: market_data + indicators + memory + personality
   → Produces: trade decision with thought process
5. RiskGuardian validates decision against hard limits
   → If rejected: logs reason, skips trade
   → If approved: continues
6. ExecutionAgent places order on Binance Testnet
7. MemoryAgent records the trade attempt
8. PersonalityEngine updates emotions based on context
9. Orchestrator logs everything to console + file
10. Sleep until next cycle
```

---

## 4. Configuration (`config.py`)

```python
CONFIG = {
    # Binance API (Testnet)
    "api_key": os.getenv("BINANCE_API_KEY", ""),
    "api_secret": os.getenv("BINANCE_API_SECRET", ""),
    "testnet": True,
    
    # Trading Parameters
    "symbols": ["BTCUSDT", "ETHUSDT"],  # Markets to trade
    "interval": "15m",                    # Candle interval
    "check_interval": 300,                # Seconds between trading cycles
    
    # Personality (Human-like traits)
    "personality": {
        "risk_tolerance": 0.5,     # 0=conservative, 1=aggressive
        "confidence_level": 0.6,   # Base confidence in decisions
        "patience": 0.6,           # Willingness to wait for good setups
        "adaptability": 0.7,       # Learning rate from mistakes
        "name": "Alex",            # Agent's name
    },
    
    # Risk Limits (Hard-coded safety)
    "risk": {
        "max_position_pct": 0.20,   # Max 20% of portfolio per trade
        "max_daily_loss_pct": 0.05, # Stop trading if down 5% today
        "max_open_positions": 3,    # Max concurrent trades
        "max_drawdown_pct": 0.15,   # Circuit breaker at 15% drawdown
        "require_stop_loss": True,  # Must have stop loss
    },
    
    # Logging
    "log_level": "INFO",
    "log_file": "trading.log",
    "memory_file": "memory.json",
}
```

---

## 5. Console Output Format

```
═══════════════════════════════════════════════════════
  🤖 AI Trader: Alex (Paper Trading)
  ⏰ 2026-05-31 14:32:00 UTC | Cycle #42
═══════════════════════════════════════════════════════

📊 Market Snapshot — BTCUSDT
   Price: $43,250.00 | 24h Change: +2.4%
   RSI: 68.3 | MACD: +145.2 | BB Position: 0.82 (upper)
   Trend: Bullish | Volume: 1.2x average

🧠 Alex's Thoughts:
   "BTC is pushing against the $43.5k resistance I've been watching.
    RSI at 68 tells me it's getting warm but not overbought yet.
    MACD is still bullish. Volume is picking up which gives me confidence.
    But... I'm feeling a bit nervous after that loss on ETH yesterday.
    My gut says this could break through, but I don't want to FOMO in.
    I'll take a small position — maybe 10% of my USDT."

📋 Decision: BUY
   Confidence: 65%
   Position Size: 10% of portfolio ($125 USDT)
   Entry: ~$43,250 (market)
   Stop Loss: $42,300 (-2.2%)
   Take Profit: $45,400 (+5.0%)

✅ Risk Check: PASSED
   Position size: 10% ≤ 20% max ✓
   Daily loss: 0% ≤ 5% max ✓
   Open positions: 0/3 ✓
   Stop loss: Set ✓

📝 Executing market buy order...
✅ Order filled: Buy 0.00289 BTC @ $43,250
   Order ID: 123456789

💼 Portfolio: $1,250.00 USDT | 0.00289 BTC ($125.00)
📈 Today's P&L: +$12.50 (+1.0%)
🎯 Win Rate (30d): 58% (11 wins / 8 losses)

═══════════════════════════════════════════════════════
😊 Alex's Mood: Cautiously Optimistic
   "Small steps. Let's see how this plays out."
═══════════════════════════════════════════════════════

Next check in 5 minutes...
```

---

## 6. File Structure

```
ai_trader/
├── main.py              # Orchestrator / entry point
├── config.py            # Configuration
├── personality.py       # Personality & emotion engine
├── market_agent.py      # Binance market data
├── reasoning.py         # LLM-powered decision engine
├── memory.py            # Trade history & learning
├── risk_guardian.py     # Safety limits
├── execution.py         # Binance testnet order execution
├── requirements.txt     # Dependencies
├── memory.json          # Persistent trade history (created at runtime)
├── trading.log          # Logs (created at runtime)
└── README.md            # Setup & usage guide
```

---

## 7. Dependencies (`requirements.txt`)

```
python-binance==1.0.27
pandas==2.2.2
numpy==1.26.4
aiohttp==3.9.5
python-dotenv==1.0.1
websockets==12.0
```

---

## 8. Setup Instructions

1. Create Binance account → Get API keys from testnet.binance.vision
2. Set environment variables: `BINANCE_API_KEY`, `BINANCE_API_SECRET`
3. `pip install -r requirements.txt`
4. `python main.py`
5. Watch your AI trader come to life!
