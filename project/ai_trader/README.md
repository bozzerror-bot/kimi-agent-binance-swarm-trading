# AI Trader — Human-Like Autonomous Trading Agent

A human-like AI trading agent that autonomously analyzes cryptocurrency markets, reasons about trades with a unique personality, learns from historical performance, and executes **paper trades** on the Binance Testnet. No real money is ever at risk.

The agent behaves like a human trader — it has emotions, a risk tolerance, patience levels, and adapts its strategy based on wins and losses. Every decision is explained in natural language, making it easy to understand *why* a trade was made.

---

## Features

- **Human-like personality** — Configurable traits (risk tolerance, patience, confidence, adaptability) that influence trading decisions
- **Emotional awareness** — Mood and stress levels change based on trading outcomes, affecting future decisions
- **Technical analysis** — RSI, MACD, Bollinger Bands, EMA, support/resistance levels, and volume analysis
- **LLM-powered reasoning** — Chain-of-thought trade analysis with pros, cons, and confidence scoring
- **Persistent memory** — Trade history, performance stats, and learned patterns stored across sessions
- **Hard risk limits** — Non-negotiable safety guardrails (max position size, daily loss limits, required stop-loss)
- **Paper trading** — All trades executed on Binance Testnet with fake funds — zero financial risk
- **Beautiful console output** — Real-time, human-readable trading logs with market snapshots and agent thoughts
- **Multi-asset support** — Trade across multiple symbols (default: BTCUSDT, ETHUSDT)

---

## Architecture

```
Orchestrator (main.py)
    |
    +-- Personality Engine  → Emotions, traits, mood
    +-- Market Agent        → Binance API, indicators
    +-- Reasoning Engine    → LLM-powered decision making
    +-- Memory Agent        → Trade history & learning
    +-- Risk Guardian       → Safety overrides (hard limits)
    +-- Execution Agent     → Binance Testnet orders
```

---

## Setup Instructions

### 1. Get Binance Testnet API Keys

1. Visit [https://testnet.binance.vision/](https://testnet.binance.vision/)
2. Log in with your GitHub account
3. Click **"Generate HMAC_SHA256 Key"**
4. Copy your **API Key** and **Secret Key**
5. (Optional) Fund your testnet account with fake USDT using the "Generate" button

### 2. Set Environment Variables

**Linux / macOS:**
```bash
export BINANCE_API_KEY="your_api_key_here"
export BINANCE_API_SECRET="your_secret_key_here"
```

**Windows (PowerShell):**
```powershell
$env:BINANCE_API_KEY="your_api_key_here"
$env:BINANCE_API_SECRET="your_secret_key_here"
```

**Windows (CMD):**
```cmd
set BINANCE_API_KEY=your_api_key_here
set BINANCE_API_SECRET=your_secret_key_here
```

**Using a .env file (optional):**
```bash
cp .env.example .env
# Edit .env and add your keys
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

Requires **Python 3.10+**.

### 4. Run the Agent

```bash
python main.py
```

On first run, the agent will:
1. Validate your API keys against the Binance testnet
2. Check your account balance
3. Initialize its memory and personality
4. Run an initial market scan
5. Start the trading loop

---

## Customizing the Personality

Edit `config.py` to change the agent's personality traits:

```python
"personality": {
    "risk_tolerance": 0.5,    # 0.0 = very conservative, 1.0 = very aggressive
    "confidence_level": 0.6,  # How confident the agent is in decisions
    "patience": 0.6,          # 0.0 = impulsive trader, 1.0 = waits for perfect setups
    "adaptability": 0.7,      # How fast it learns from mistakes
    "name": "Alex",           # Give your agent a name!
},
```

### Personality Trait Guide

| Trait | Low (0.0) | High (1.0) |
|-------|-----------|------------|
| `risk_tolerance` | Takes small positions, avoids volatile setups | Takes large positions, chases breakouts |
| `confidence_level` | Second-guesses, needs strong confirmation | Decisive, trusts analysis quickly |
| `patience` | FOMO trades, enters on weak signals | Waits for ideal setups, fewer trades |
| `adaptability` | Stubborn, slow to change strategy | Quickly adjusts after losses/wins |

**Example — Conservative Agent:**
```python
"personality": {
    "risk_tolerance": 0.2,
    "confidence_level": 0.4,
    "patience": 0.9,
    "adaptability": 0.5,
    "name": "Cautious Charlie",
}
```

**Example — Aggressive Agent:**
```python
"personality": {
    "risk_tolerance": 0.8,
    "confidence_level": 0.8,
    "patience": 0.2,
    "adaptability": 0.9,
    "name": "Bold Bella",
}
```

---

## Risk Limits (Safety Guardrails)

The Risk Guardian enforces **hard-coded safety limits** that the agent **cannot override**, no matter how confident it feels:

| Limit | Default | Description |
|-------|---------|-------------|
| `max_position_pct` | 20% | Maximum portfolio allocation per trade |
| `max_daily_loss_pct` | 5% | Trading stops if daily loss exceeds this |
| `max_open_positions` | 3 | Maximum number of concurrent trades |
| `max_drawdown_pct` | 15% | Circuit breaker — all trading halts at 15% drawdown |
| `require_stop_loss` | True | Every trade MUST specify a stop-loss level |

These limits exist to protect the portfolio from emotional or overconfident decisions. Even if the agent is "feeling lucky," the Risk Guardian will block any trade that violates these rules.

---

## Project Structure

```
ai_trader/
├── main.py              # Entry point / trading loop orchestrator
├── config.py            # Configuration (API keys, personality, risk limits)
├── personality.py       # Personality & emotion engine
├── market_agent.py      # Binance market data & technical indicators
├── reasoning.py         # LLM-powered decision engine
├── memory.py            # Trade history, stats & learning
├── risk_guardian.py     # Hard safety limits enforcer
├── execution.py         # Binance testnet order execution
├── requirements.txt     # Python dependencies
├── README.md            # This file
├── memory.json          # Persistent trade history (created at runtime)
└── trading.log          # Activity logs (created at runtime)
```

---

## Console Output Example

```
=======================================================
  AI Trader: Alex (Paper Trading)
  2026-05-31 14:32:00 UTC | Cycle #42
=======================================================

Market Snapshot — BTCUSDT
   Price: $43,250.00 | 24h Change: +2.4%
   RSI: 68.3 | MACD: +145.2 | BB Position: 0.82 (upper)
   Trend: Bullish | Volume: 1.2x average

Alex's Thoughts:
   "BTC is pushing against the $43.5k resistance I've been watching.
    RSI at 68 tells me it's getting warm but not overbought yet.
    MACD is still bullish. Volume is picking up which gives me confidence.
    But... I'm feeling a bit nervous after that loss on ETH yesterday.
    My gut says this could break through, but I don't want to FOMO in.
    I'll take a small position — maybe 10% of my USDT."

Decision: BUY
   Confidence: 65%
   Position Size: 10% of portfolio ($125 USDT)
   Entry: ~$43,250 (market)
   Stop Loss: $42,300 (-2.2%)
   Take Profit: $45,400 (+5.0%)

Risk Check: PASSED
   Position size: 10% <= 20% max OK
   Daily loss: 0% <= 5% max OK
   Open positions: 0/3 OK
   Stop loss: Set OK

Executing market buy order...
Order filled: Buy 0.00289 BTC @ $43,250
   Order ID: 123456789

Portfolio: $1,250.00 USDT | 0.00289 BTC ($125.00)
Today's P&L: +$12.50 (+1.0%)
Win Rate (30d): 58% (11 wins / 8 losses)

=======================================================
Alex's Mood: Cautiously Optimistic
   "Small steps. Let's see how this plays out."
=======================================================

Next check in 5 minutes...
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `python-binance` | 1.0.27 | Binance API client (testnet + live) |
| `pandas` | 2.2.2 | Data processing & analysis |
| `numpy` | 1.26.4 | Numerical computing |
| `aiohttp` | 3.9.5 | Async HTTP client |
| `python-dotenv` | 1.0.1 | Environment variable management |
| `websockets` | 12.0 | Real-time WebSocket data feeds |

---

## License

This project is for educational and research purposes. Always be cautious when trading with real funds. The paper trading environment ensures no real money is at risk during development and testing.
