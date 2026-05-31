"""Configuration for AI Trader.

Central configuration module for the AI trading agent. All settings are
defined here and can be overridden via environment variables for sensitive
data like API keys.

Usage:
    from config import CONFIG

    api_key = CONFIG["api_key"]
    symbols = CONFIG["symbols"]
"""

import os


CONFIG = {
    # ------------------------------------------------------------------
    # Binance API (Testnet)
    # ------------------------------------------------------------------
    # Get testnet keys from: https://testnet.binance.vision/
    # Set via environment variables: BINANCE_API_KEY, BINANCE_API_SECRET
    "api_key": os.getenv("BINANCE_API_KEY", ""),
    "api_secret": os.getenv("BINANCE_API_SECRET", ""),
    "testnet": True,

    # ------------------------------------------------------------------
    # Trading Parameters
    # ------------------------------------------------------------------
    "symbols": ["BTCUSDT", "ETHUSDT"],   # Markets to monitor and trade
    "interval": "15m",                     # Candlestick interval
    "check_interval": 300,                 # Seconds between trading cycles (5 min)

    # ------------------------------------------------------------------
    # Personality (Human-like traits)
    # ------------------------------------------------------------------
    # These traits shape the agent's decision-making style, emotional
    # responses, and overall "character". Adjust to make the agent more
    # conservative or aggressive.
    "personality": {
        "risk_tolerance": 0.5,    # 0.0 = very conservative, 1.0 = very aggressive
        "confidence_level": 0.6,  # Base confidence in trade decisions (0.0-1.0)
        "patience": 0.6,          # 0.0 = impulsive, 1.0 = waits for perfect setups
        "adaptability": 0.7,      # How quickly the agent learns from mistakes (0.0-1.0)
        "name": "Alex",           # Agent's display name
    },

    # ------------------------------------------------------------------
    # Risk Limits (Hard-coded safety — CANNOT be overridden by agent)
    # ------------------------------------------------------------------
    # These are absolute safety limits enforced by the Risk Guardian.
    # The agent has no authority to bypass these constraints.
    "risk": {
        "max_position_pct": 0.20,    # Max 20% of portfolio per position
        "max_daily_loss_pct": 0.05,  # Stop trading if daily loss exceeds 5%
        "max_open_positions": 3,     # Maximum concurrent open trades
        "max_drawdown_pct": 0.15,    # Circuit breaker at 15% portfolio drawdown
        "require_stop_loss": True,   # Every trade MUST have a stop-loss
    },

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    "log_level": "INFO",         # DEBUG, INFO, WARNING, ERROR
    "log_file": "trading.log",   # Main log file path
    "memory_file": "memory.json",  # Persistent trade history file
}
