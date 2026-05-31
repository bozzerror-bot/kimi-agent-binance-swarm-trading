#!/usr/bin/env python3
"""
Alex V2 - Binance Futures Trading Engine
========================================
A production-grade trading engine for Binance Futures TESTNET.
Handles order execution, position management, portfolio tracking,
and risk management for 20 crypto perpetual futures.

Author: Alex V2 Trading System
"""

import requests
import pandas as pd
import numpy as np
import hmac
import hashlib
import time
import logging
import json
import os
from typing import Optional, Dict, List, Union
from datetime import datetime
from dataclasses import dataclass, field
from urllib.parse import urlencode

# =============================================================================
# CONFIGURATION
# =============================================================================

COINS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
    "MATICUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", "ETCUSDT",
    "FILUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "TIAUSDT"
]

# Symbol precision (quantity decimal places)
SYMBOL_PRECISION = {
    "BTCUSDT": 3, "ETHUSDT": 3, "SOLUSDT": 2, "BNBUSDT": 2, "XRPUSDT": 1,
    "DOGEUSDT": 0, "ADAUSDT": 0, "AVAXUSDT": 2, "LINKUSDT": 2, "DOTUSDT": 2,
    "MATICUSDT": 0, "LTCUSDT": 3, "UNIUSDT": 2, "ATOMUSDT": 2, "ETCUSDT": 2,
    "FILUSDT": 2, "ARBUSDT": 1, "OPUSDT": 1, "SUIUSDT": 1, "TIAUSDT": 2
}

# Min notional values
MIN_NOTIONAL = {
    "BTCUSDT": 100, "ETHUSDT": 20, "SOLUSDT": 10, "BNBUSDT": 10, "XRPUSDT": 10,
    "DOGEUSDT": 5, "ADAUSDT": 5, "AVAXUSDT": 5, "LINKUSDT": 5, "DOTUSDT": 5,
    "MATICUSDT": 5, "LTCUSDT": 5, "UNIUSDT": 5, "ATOMUSDT": 5, "ETCUSDT": 5,
    "FILUSDT": 5, "ARBUSDT": 5, "OPUSDT": 5, "SUIUSDT": 5, "TIAUSDT": 5
}

BASE_URL_TESTNET = "https://testnet.binancefuture.com"
BASE_URL_LIVE = "https://fapi.binance.com"

# Rate limit: 1200 request weight per minute
RATE_LIMIT_WEIGHT_PER_MIN = 1200

# =============================================================================
# LOGGING SETUP
# =============================================================================

def setup_logging(log_level: int = logging.INFO, log_file: Optional[str] = None) -> logging.Logger:
    """Configure logging with both console and file handlers."""
    logger = logging.getLogger("futures_trader")
    logger.setLevel(log_level)
    
    if logger.handlers:
        logger.handlers.clear()
    
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Console handler
    console = logging.StreamHandler()
    console.setLevel(log_level)
    console.setFormatter(formatter)
    logger.addHandler(console)
    
    # File handler
    if log_file:
        os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
        fh = logging.FileHandler(log_file)
        fh.setLevel(logging.DEBUG)
        fh.setFormatter(formatter)
        logger.addHandler(fh)
    
    return logger


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Position:
    """Represents a futures position."""
    symbol: str
    side: str  # "LONG" or "SHORT"
    quantity: float
    entry_price: float
    leverage: int = 1
    unrealized_pnl: float = 0.0
    margin: float = 0.0
    liquidation_price: float = 0.0
    mark_price: float = 0.0
    
    def roi_pct(self) -> float:
        """Return ROI percentage."""
        if self.entry_price == 0 or self.margin == 0:
            return 0.0
        return (self.unrealized_pnl / self.margin) * 100
    
    def notional_value(self) -> float:
        """Return notional value of position."""
        return abs(self.quantity) * self.mark_price


@dataclass
class TradeSignal:
    """Represents a trade signal."""
    symbol: str
    side: str  # "BUY" or "SELL"
    confidence: float  # 0.0 to 1.0
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    atr: float = 0.0


# =============================================================================
# BINANCE FUTURES CLIENT (Low-level HTTP)
# =============================================================================

class BinanceFuturesClient:
    """
    Low-level HTTP client for Binance Futures API.
    Handles request signing, rate limiting, and retries.
    """
    
    def __init__(self, api_key: str, api_secret: str, testnet: bool = True):
        self.api_key = api_key
        self.secret = api_secret
        self.testnet = testnet
        self.base_url = BASE_URL_TESTNET if testnet else BASE_URL_LIVE
        self.session = requests.Session()
        self.session.headers.update({"X-MBX-APIKEY": api_key})
        
        self.logger = logging.getLogger("futures_trader.client")
        
        # Rate limiting tracking
        self._weight_used = 0
        self._weight_reset_time = time.time() + 60
        self._request_timestamps: List[float] = []
        
        # Retry config
        self.max_retries = 5
        self.base_delay = 1.0  # seconds
    
    def _sign(self, params: dict) -> str:
        """Create HMAC SHA256 signature for request parameters."""
        query = urlencode(sorted(params.items()))
        signature = hmac.new(
            self.secret.encode("utf-8"),
            query.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def _update_rate_limit(self, weight: int = 1):
        """Track request weight for rate limiting."""
        now = time.time()
        
        # Reset counter every 60 seconds
        if now > self._weight_reset_time:
            self._weight_used = 0
            self._weight_reset_time = now + 60
            self._request_timestamps = []
        
        self._weight_used += weight
        self._request_timestamps.append(now)
        
        # Clean old timestamps (> 60s)
        self._request_timestamps = [
            t for t in self._request_timestamps if now - t < 60
        ]
    
    def _wait_for_rate_limit(self, weight: int = 1):
        """Wait if approaching rate limit."""
        self._update_rate_limit(weight)
        
        # If > 80% of rate limit used, throttle
        if self._weight_used > RATE_LIMIT_WEIGHT_PER_MIN * 0.8:
            sleep_time = self._weight_reset_time - time.time()
            if sleep_time > 0:
                self.logger.warning(
                    f"Rate limit at {self._weight_used}/{RATE_LIMIT_WEIGHT_PER_MIN}. "
                    f"Throttling for {sleep_time:.1f}s"
                )
                time.sleep(min(sleep_time, 5))  # Max 5s wait
    
    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        signed: bool = False,
        weight: int = 1
    ) -> dict:
        """
        Send HTTP request to Binance Futures API with retries and rate limiting.
        
        Args:
            method: HTTP method (GET, POST, DELETE)
            path: API endpoint path (e.g., "/fapi/v2/account")
            params: Query parameters
            signed: Whether to sign the request
            weight: Request weight for rate limiting
            
        Returns:
            Parsed JSON response as dict
        """
        params = params or {}
        url = f"{self.base_url}{path}"
        
        for attempt in range(self.max_retries):
            try:
                self._wait_for_rate_limit(weight)
                
                if signed:
                    params["timestamp"] = int(time.time() * 1000)
                    params["recvWindow"] = 5000
                    params["signature"] = self._sign(params)
                
                self.logger.debug(f"{method} {path} | params={params}")
                
                if method == "GET":
                    response = self.session.get(url, params=params, timeout=10)
                elif method == "POST":
                    response = self.session.post(url, data=params, timeout=10)
                elif method == "DELETE":
                    response = self.session.delete(url, params=params, timeout=10)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                # Handle rate limit (429)
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 2 ** attempt))
                    self.logger.warning(
                        f"Rate limit hit (429). Retry after {retry_after}s. "
                        f"Attempt {attempt + 1}/{self.max_retries}"
                    )
                    time.sleep(retry_after)
                    continue
                
                # Handle 5xx server errors
                if response.status_code >= 500:
                    delay = self.base_delay * (2 ** attempt)
                    self.logger.warning(
                        f"Server error {response.status_code}. "
                        f"Retrying in {delay}s. Attempt {attempt + 1}/{self.max_retries}"
                    )
                    time.sleep(delay)
                    continue
                
                # Handle 4xx client errors (don't retry)
                if response.status_code >= 400:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("msg", response.text)
                        error_code = error_data.get("code", -1)
                    except:
                        error_msg = response.text
                        error_code = -1
                    
                    self.logger.error(
                        f"API Error {response.status_code}: {error_msg} "
                        f"(code={error_code}) | {method} {path}"
                    )
                    raise BinanceAPIError(error_msg, error_code, response.status_code)
                
                # Success
                return response.json()
                
            except requests.exceptions.Timeout:
                delay = self.base_delay * (2 ** attempt)
                self.logger.warning(f"Request timeout. Retrying in {delay}s.")
                time.sleep(delay)
                continue
                
            except requests.exceptions.ConnectionError:
                delay = self.base_delay * (2 ** attempt)
                self.logger.warning(f"Connection error. Retrying in {delay}s.")
                time.sleep(delay)
                continue
                
            except BinanceAPIError:
                raise  # Don't retry client errors
                
            except Exception as e:
                delay = self.base_delay * (2 ** attempt)
                self.logger.error(f"Unexpected error: {e}. Retrying in {delay}s.")
                time.sleep(delay)
                continue
        
        raise BinanceAPIError(f"Max retries ({self.max_retries}) exceeded for {method} {path}")


class BinanceAPIError(Exception):
    """Custom exception for Binance API errors."""
    
    def __init__(self, message: str, code: int = -1, http_status: int = 400):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


# =============================================================================
# MOCK CLIENT (for testing without API keys)
# =============================================================================

class MockFuturesClient:
    """
    Mock client that simulates Binance Futures API responses.
    Useful for testing and development without real API keys.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("futures_trader.mock")
        self.logger.info("Using MOCK mode - no real trades will be executed")
        
        # Simulated account state
        self._balance = 10000.0
        self._positions: Dict[str, dict] = {}
        self._leverage: Dict[str, int] = {c: 10 for c in COINS}
        self._order_counter = 0
        self._orders: List[dict] = []
        
        # Simulated prices (roughly realistic)
        self._prices = {
            "BTCUSDT": 65000.0, "ETHUSDT": 3500.0, "SOLUSDT": 145.0,
            "BNBUSDT": 590.0, "XRPUSDT": 0.62, "DOGEUSDT": 0.16,
            "ADAUSDT": 0.45, "AVAXUSDT": 35.0, "LINKUSDT": 18.0,
            "DOTUSDT": 7.2, "MATICUSDT": 0.72, "LTCUSDT": 78.0,
            "UNIUSDT": 9.5, "ATOMUSDT": 8.5, "ETCUSDT": 28.0,
            "FILUSDT": 5.8, "ARBUSDT": 0.95, "OPUSDT": 2.2,
            "SUIUSDT": 1.15, "TIAUSDT": 6.5
        }
    
    def _request(self, method: str, path: str, params: Optional[dict] = None, 
                 signed: bool = False, weight: int = 1) -> dict:
        """Simulate API responses."""
        params = params or {}
        self.logger.debug(f"[MOCK] {method} {path} | {params}")
        
        # Account info
        if path == "/fapi/v2/account":
            return self._mock_account()
        
        # Position info
        if path == "/fapi/v2/positionRisk":
            symbol = params.get("symbol")
            if symbol:
                return [self._mock_position(symbol)]
            return [self._mock_position(s) for s in COINS if s in self._positions]
        
        # Ticker/Price
        if path == "/fapi/v1/ticker/24hr":
            symbol = params.get("symbol", "BTCUSDT")
            return self._mock_ticker(symbol)
        
        if path == "/fapi/v1/ticker/price":
            symbol = params.get("symbol", "BTCUSDT")
            return {"symbol": symbol, "price": str(self._prices.get(symbol, 100.0))}
        
        # Klines
        if path == "/fapi/v1/klines":
            return self._mock_klines(params)
        
        # Order placement
        if path == "/fapi/v1/order":
            return self._mock_order(params)
        
        # Leverage change
        if path == "/fapi/v1/leverage":
            symbol = params["symbol"]
            leverage = int(params["leverage"])
            self._leverage[symbol] = leverage
            return {
                "symbol": symbol,
                "leverage": leverage,
                "maxNotionalValue": "1000000"
            }
        
        # Exchange info (for symbol filters)
        if path == "/fapi/v1/exchangeInfo":
            return self._mock_exchange_info()
        
        # Funding rate
        if path == "/fapi/v1/fundingRate":
            symbol = params.get("symbol", "BTCUSDT")
            return [{"symbol": symbol, "fundingRate": "0.0001", "fundingTime": int(time.time()*1000)}]
        
        # Open orders
        if path == "/fapi/v1/openOrders":
            symbol = params.get("symbol")
            if symbol:
                return [o for o in self._orders if o["symbol"] == symbol and o["status"] == "NEW"]
            return [o for o in self._orders if o["status"] == "NEW"]
        
        # Cancel order
        if path == "/fapi/v1/order" and method == "DELETE":
            return {"status": "CANCELED", "symbol": params.get("symbol", ""), 
                    "orderId": params.get("orderId", 0)}
        
        return {}
    
    def _mock_account(self) -> dict:
        """Generate mock account info."""
        total_pos_margin = sum(
            p["initialMargin"] for p in self._positions.values()
        )
        return {
            "totalWalletBalance": str(self._balance),
            "totalUnrealizedProfit": "0.0",
            "totalMarginBalance": str(self._balance),
            "availableBalance": str(self._balance - total_pos_margin),
            "totalPositionInitialMargin": str(total_pos_margin),
            "assets": [{"asset": "USDT", "walletBalance": str(self._balance),
                        "unrealizedProfit": "0.0"}],
            "positions": [
                {
                    "symbol": s,
                    "positionAmt": str(p["positionAmt"]),
                    "entryPrice": str(p["entryPrice"]),
                    "unRealizedProfit": "0.0",
                    "leverage": str(p["leverage"]),
                    "isolated": False,
                    "marginType": "CROSSED"
                }
                for s, p in self._positions.items()
            ]
        }
    
    def _mock_position(self, symbol: str) -> dict:
        """Generate mock position data."""
        if symbol in self._positions:
            p = self._positions[symbol]
            return {
                "symbol": symbol,
                "positionAmt": str(p["positionAmt"]),
                "entryPrice": str(p["entryPrice"]),
                "markPrice": str(p.get("markPrice", self._prices.get(symbol, 100))),
                "unRealizedProfit": str(p.get("unRealizedProfit", "0")),
                "liquidationPrice": "0",
                "leverage": str(p["leverage"]),
                "notional": str(abs(p["positionAmt"]) * p["entryPrice"]),
                "marginType": "CROSSED",
                "isolatedMargin": "0",
                "positionSide": "BOTH"
            }
        return {
            "symbol": symbol, "positionAmt": "0", "entryPrice": "0",
            "markPrice": str(self._prices.get(symbol, 100)),
            "unRealizedProfit": "0", "liquidationPrice": "0",
            "leverage": str(self._leverage.get(symbol, 10)),
            "notional": "0", "marginType": "CROSSED"
        }
    
    def _mock_ticker(self, symbol: str) -> dict:
        """Generate mock 24hr ticker data."""
        base_price = self._prices.get(symbol, 100.0)
        change = (np.random.random() - 0.5) * 0.1  # +/- 5% change
        price_change = base_price * change
        return {
            "symbol": symbol,
            "lastPrice": str(base_price),
            "priceChange": str(price_change),
            "priceChangePercent": str(change * 100),
            "volume": str(np.random.random() * 1000000),
            "quoteVolume": str(np.random.random() * 50000000),
            "highPrice": str(base_price * 1.05),
            "lowPrice": str(base_price * 0.95),
            "openPrice": str(base_price - price_change),
            "weightedAvgPrice": str(base_price),
            "count": str(int(np.random.random() * 100000))
        }
    
    def _mock_klines(self, params: dict) -> list:
        """Generate mock OHLCV klines."""
        symbol = params.get("symbol", "BTCUSDT")
        limit = int(params.get("limit", 50))
        base_price = self._prices.get(symbol, 100.0)
        
        klines = []
        ts = int(time.time() * 1000) - limit * 15 * 60 * 1000
        
        for i in range(limit):
            open_p = base_price * (1 + (np.random.random() - 0.5) * 0.02)
            close_p = open_p * (1 + (np.random.random() - 0.5) * 0.01)
            high_p = max(open_p, close_p) * (1 + np.random.random() * 0.005)
            low_p = min(open_p, close_p) * (1 - np.random.random() * 0.005)
            volume = np.random.random() * 1000
            
            klines.append([
                ts + i * 15 * 60 * 1000,  # open time
                str(open_p),               # open
                str(high_p),               # high
                str(low_p),                # low
                str(close_p),              # close
                str(volume),               # volume
                ts + (i + 1) * 15 * 60 * 1000,  # close time
                str(volume * close_p),     # quote volume
                int(np.random.random() * 1000),  # trades
                str(volume * 0.4),         # taker buy base
                str(volume * close_p * 0.4),  # taker buy quote
                "0"                        # ignore
            ])
        
        return klines
    
    def _mock_order(self, params: dict) -> dict:
        """Simulate order placement."""
        self._order_counter += 1
        symbol = params["symbol"]
        side = params["side"]
        order_type = params.get("type", "MARKET")
        quantity = float(params.get("quantity", 0))
        
        price = self._prices.get(symbol, 100.0)
        if "price" in params:
            price = float(params["price"])
        
        # Update simulated position
        pos_amt = quantity if side == "BUY" else -quantity
        if symbol in self._positions:
            self._positions[symbol]["positionAmt"] += pos_amt
        else:
            self._positions[symbol] = {
                "positionAmt": pos_amt,
                "entryPrice": price,
                "leverage": self._leverage.get(symbol, 10),
                "markPrice": price
            }
        
        order = {
            "orderId": self._order_counter,
            "symbol": symbol,
            "status": "FILLED",
            "side": side,
            "type": order_type,
            "price": str(price),
            "avgPrice": str(price),
            "origQty": str(quantity),
            "executedQty": str(quantity),
            "cumQuote": str(quantity * price),
            "timeInForce": params.get("timeInForce", "GTC"),
            "reduceOnly": params.get("reduceOnly", "false"),
            "updateTime": int(time.time() * 1000)
        }
        self._orders.append(order)
        return order
    
    def _mock_exchange_info(self) -> dict:
        """Generate mock exchange info with symbol filters."""
        symbols = []
        for sym in COINS:
            symbols.append({
                "symbol": sym,
                "status": "TRADING",
                "baseAsset": sym.replace("USDT", ""),
                "quoteAsset": "USDT",
                "filters": [
                    {"filterType": "PRICE_FILTER", "tickSize": "0.01"},
                    {"filterType": "LOT_SIZE", "stepSize": "0.001"},
                    {"filterType": "MIN_NOTIONAL", "notional": str(MIN_NOTIONAL.get(sym, 5))},
                    {"filterType": "LEVERAGE", "maxLeverage": "125"}
                ]
            })
        return {"symbols": symbols, "timezone": "UTC"}


# =============================================================================
# FUTURES TRADER (High-level interface)
# =============================================================================

class FuturesTrader:
    """
    High-level trading engine for Binance Futures.
    
    Provides:
    - Account info and balance queries
    - Position tracking and management
    - Order execution (market, limit, stop-loss, take-profit)
    - Leverage management
    - Market data (tickers, klines)
    - Multi-coin scanning for opportunities
    - Position sizing with dynamic risk management
    """
    
    def __init__(self, api_key: str, api_secret: str, testnet: bool = True,
                 log_level: int = logging.INFO):
        """
        Initialize the Futures Trader.
        
        Args:
            api_key: Binance API key
            api_secret: Binance API secret
            testnet: Use testnet (default: True)
            log_level: Logging level
        """
        # Setup logging
        log_dir = "/mnt/agents/output/alex_v2/logs"
        os.makedirs(log_dir, exist_ok=True)
        self.logger = setup_logging(
            log_level=log_level,
            log_file=f"{log_dir}/futures_trader_{datetime.now().strftime('%Y%m%d')}.log"
        )
        
        # Mock mode: no API keys provided
        self.mock_mode = not api_key or not api_secret
        
        if self.mock_mode:
            self.logger.warning("=" * 60)
            self.logger.warning("RUNNING IN MOCK MODE - NO REAL TRADES")
            self.logger.warning("=" * 60)
            self.client = MockFuturesClient()
        else:
            self.logger.info("Initializing Futures Trader (testnet=%s)", testnet)
            self.client = BinanceFuturesClient(api_key, api_secret, testnet)
        
        self.testnet = testnet
        self._exchange_info: Optional[dict] = None
        self._symbol_info: Dict[str, dict] = {}
        
        # Load exchange info for precision/limits
        self._load_exchange_info()
        
        self.logger.info("Futures Trader initialized. Mock=%s", self.mock_mode)
    
    def _load_exchange_info(self):
        """Load exchange info for symbol filters and precision."""
        try:
            self._exchange_info = self.client._request(
                "GET", "/fapi/v1/exchangeInfo", weight=1
            )
            for sym_info in self._exchange_info.get("symbols", []):
                self._symbol_info[sym_info["symbol"]] = sym_info
            self.logger.debug(f"Loaded exchange info for {len(self._symbol_info)} symbols")
        except Exception as e:
            self.logger.error(f"Failed to load exchange info: {e}")
            self._exchange_info = None
    
    # -------------------------------------------------------------------------
    # ACCOUNT & POSITION
    # -------------------------------------------------------------------------
    
    def get_account_info(self) -> dict:
        """
        Get account information including balance, margin, and positions.
        
        Returns:
            dict with keys: balance, available, margin, positions, unrealized_pnl
        """
        try:
            data = self.client._request("GET", "/fapi/v2/account", signed=True, weight=5)
            
            # Parse USDT balance
            usdt_asset = None
            for asset in data.get("assets", []):
                if asset["asset"] == "USDT":
                    usdt_asset = asset
                    break
            
            # Parse positions
            positions = []
            for pos in data.get("positions", []):
                amt = float(pos.get("positionAmt", 0))
                if abs(amt) > 0:
                    positions.append({
                        "symbol": pos["symbol"],
                        "side": "LONG" if amt > 0 else "SHORT",
                        "quantity": abs(amt),
                        "entry_price": float(pos.get("entryPrice", 0)),
                        "leverage": int(pos.get("leverage", 1)),
                        "unrealized_pnl": float(pos.get("unRealizedProfit", 0)),
                        "notional": float(pos.get("notional", 0)),
                        "margin_type": pos.get("marginType", "CROSSED")
                    })
            
            wallet = float(usdt_asset["walletBalance"]) if usdt_asset else 0
            unrealized = float(usdt_asset["unrealizedProfit"]) if usdt_asset else 0
            available = float(data.get("availableBalance", 0))
            
            result = {
                "balance": wallet,
                "available": available,
                "margin": wallet - available,
                "unrealized_pnl": unrealized,
                "total_equity": wallet + unrealized,
                "positions_count": len(positions),
                "positions": positions,
                "raw": data
            }
            
            self.logger.info(
                f"Account: Balance={wallet:.2f} USDT, "
                f"Available={available:.2f}, "
                f"Positions={len(positions)}"
            )
            return result
            
        except Exception as e:
            self.logger.error(f"get_account_info failed: {e}")
            if self.mock_mode:
                return {
                    "balance": 10000.0, "available": 9000.0,
                    "margin": 1000.0, "unrealized_pnl": 0.0,
                    "total_equity": 10000.0, "positions_count": 0,
                    "positions": [], "raw": {}
                }
            raise
    
    def get_all_positions(self) -> list:
        """
        Get all open positions.
        
        Returns:
            List of position dicts with symbol, side, quantity, entry_price, etc.
        """
        try:
            positions_data = self.client._request(
                "GET", "/fapi/v2/positionRisk", signed=True, weight=5
            )
            
            open_positions = []
            for pos in positions_data:
                amt = float(pos.get("positionAmt", 0))
                if abs(amt) > 1e-10:
                    open_positions.append({
                        "symbol": pos["symbol"],
                        "side": "LONG" if amt > 0 else "SHORT",
                        "quantity": abs(amt),
                        "entry_price": float(pos.get("entryPrice", 0)),
                        "mark_price": float(pos.get("markPrice", 0)),
                        "unrealized_pnl": float(pos.get("unRealizedProfit", 0)),
                        "leverage": int(float(pos.get("leverage", 1))),
                        "liquidation_price": float(pos.get("liquidationPrice", 0)),
                        "notional": float(pos.get("notional", 0)),
                        "margin_type": pos.get("marginType", "CROSSED")
                    })
            
            self.logger.info(f"Found {len(open_positions)} open positions")
            return open_positions
            
        except Exception as e:
            self.logger.error(f"get_all_positions failed: {e}")
            return []
    
    def get_position(self, symbol: str) -> Optional[dict]:
        """Get position for a specific symbol."""
        try:
            positions = self.client._request(
                "GET", "/fapi/v2/positionRisk",
                params={"symbol": symbol}, signed=True, weight=1
            )
            
            for pos in positions:
                amt = float(pos.get("positionAmt", 0))
                if abs(amt) > 1e-10:
                    return {
                        "symbol": pos["symbol"],
                        "side": "LONG" if amt > 0 else "SHORT",
                        "quantity": abs(amt),
                        "entry_price": float(pos.get("entryPrice", 0)),
                        "mark_price": float(pos.get("markPrice", 0)),
                        "unrealized_pnl": float(pos.get("unRealizedProfit", 0)),
                        "leverage": int(float(pos.get("leverage", 1))),
                        "liquidation_price": float(pos.get("liquidationPrice", 0))
                    }
            return None
            
        except Exception as e:
            self.logger.error(f"get_position({symbol}) failed: {e}")
            return None
    
    # -------------------------------------------------------------------------
    # ORDER EXECUTION
    # -------------------------------------------------------------------------
    
    def place_market_order(self, symbol: str, side: str, quantity: float) -> dict:
        """
        Place a market order.
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            side: "BUY" or "SELL"
            quantity: Order quantity
            
        Returns:
            Order response dict with orderId, status, avgPrice, etc.
        """
        side = side.upper()
        quantity = round_quantity(symbol, quantity)
        
        if quantity <= 0:
            raise ValueError(f"Invalid quantity: {quantity}")
        
        params = {
            "symbol": symbol,
            "side": side,
            "type": "MARKET",
            "quantity": quantity
        }
        
        self.logger.info(f"MARKET ORDER | {symbol} {side} qty={quantity}")
        
        try:
            result = self.client._request("POST", "/fapi/v1/order", params, signed=True, weight=1)
            
            order_info = {
                "order_id": result.get("orderId"),
                "symbol": result.get("symbol"),
                "status": result.get("status"),
                "side": result.get("side"),
                "type": result.get("type"),
                "price": float(result.get("avgPrice", result.get("price", 0))),
                "quantity": float(result.get("executedQty", 0)),
                "cum_quote": float(result.get("cumQuote", 0)),
                "raw": result
            }
            
            self.logger.info(
                f"ORDER FILLED | {symbol} {side} | "
                f"Price={order_info['price']:.4f} | Qty={order_info['quantity']}"
            )
            return order_info
            
        except Exception as e:
            self.logger.error(f"place_market_order failed: {e}")
            raise
    
    def place_limit_order(self, symbol: str, side: str, quantity: float, 
                          price: float, time_in_force: str = "GTC") -> dict:
        """
        Place a limit order.
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            side: "BUY" or "SELL"
            quantity: Order quantity
            price: Limit price
            time_in_force: GTC, IOC, FOK
            
        Returns:
            Order response dict
        """
        side = side.upper()
        quantity = round_quantity(symbol, quantity)
        price = round_price(symbol, price)
        
        params = {
            "symbol": symbol,
            "side": side,
            "type": "LIMIT",
            "quantity": quantity,
            "price": price,
            "timeInForce": time_in_force
        }
        
        self.logger.info(f"LIMIT ORDER | {symbol} {side} qty={quantity} @ {price}")
        
        try:
            result = self.client._request("POST", "/fapi/v1/order", params, signed=True, weight=1)
            
            return {
                "order_id": result.get("orderId"),
                "symbol": result.get("symbol"),
                "status": result.get("status"),
                "side": result.get("side"),
                "type": result.get("type"),
                "price": float(result.get("price", 0)),
                "quantity": float(result.get("origQty", 0)),
                "raw": result
            }
            
        except Exception as e:
            self.logger.error(f"place_limit_order failed: {e}")
            raise
    
    def place_stop_loss(self, symbol: str, side: str, stop_price: float, 
                        quantity: float) -> dict:
        """
        Place a STOP_MARKET order (stop-loss).
        
        Args:
            symbol: Trading pair
            side: "BUY" (for closing short) or "SELL" (for closing long)
            stop_price: Trigger price
            quantity: Quantity to close
            
        Returns:
            Order response dict
        """
        side = side.upper()
        quantity = round_quantity(symbol, quantity)
        stop_price = round_price(symbol, stop_price)
        
        params = {
            "symbol": symbol,
            "side": side,
            "type": "STOP_MARKET",
            "stopPrice": stop_price,
            "quantity": quantity,
            "closePosition": "false"
        }
        
        self.logger.info(f"STOP LOSS | {symbol} {side} trigger={stop_price} qty={quantity}")
        
        try:
            result = self.client._request("POST", "/fapi/v1/order", params, signed=True, weight=1)
            return {
                "order_id": result.get("orderId"),
                "symbol": result.get("symbol"),
                "status": result.get("status"),
                "type": "STOP_MARKET",
                "stop_price": stop_price,
                "quantity": quantity,
                "raw": result
            }
        except Exception as e:
            self.logger.error(f"place_stop_loss failed: {e}")
            raise
    
    def place_take_profit(self, symbol: str, side: str, price: float, 
                          quantity: float) -> dict:
        """
        Place a TAKE_PROFIT_MARKET order.
        
        Args:
            symbol: Trading pair
            side: "BUY" (for closing short) or "SELL" (for closing long)
            price: Trigger price for take profit
            quantity: Quantity to close
            
        Returns:
            Order response dict
        """
        side = side.upper()
        quantity = round_quantity(symbol, quantity)
        price = round_price(symbol, price)
        
        params = {
            "symbol": symbol,
            "side": side,
            "type": "TAKE_PROFIT_MARKET",
            "stopPrice": price,
            "quantity": quantity,
            "closePosition": "false"
        }
        
        self.logger.info(f"TAKE PROFIT | {symbol} {side} trigger={price} qty={quantity}")
        
        try:
            result = self.client._request("POST", "/fapi/v1/order", params, signed=True, weight=1)
            return {
                "order_id": result.get("orderId"),
                "symbol": result.get("symbol"),
                "status": result.get("status"),
                "type": "TAKE_PROFIT_MARKET",
                "trigger_price": price,
                "quantity": quantity,
                "raw": result
            }
        except Exception as e:
            self.logger.error(f"place_take_profit failed: {e}")
            raise
    
    def close_position(self, symbol: str) -> dict:
        """
        Close an open position with a market order.
        
        Args:
            symbol: Trading pair to close
            
        Returns:
            Order response dict
        """
        position = self.get_position(symbol)
        
        if not position:
            self.logger.warning(f"No open position for {symbol} to close")
            return {"status": "NO_POSITION", "symbol": symbol}
        
        # Opposite side to close
        close_side = "SELL" if position["side"] == "LONG" else "BUY"
        quantity = position["quantity"]
        
        self.logger.info(
            f"CLOSING POSITION | {symbol} {position['side']} "
            f"qty={quantity} entry={position['entry_price']:.4f} "
            f"pnl={position['unrealized_pnl']:.2f}"
        )
        
        return self.place_market_order(symbol, close_side, quantity)
    
    def cancel_order(self, symbol: str, order_id: int) -> dict:
        """Cancel an open order."""
        params = {"symbol": symbol, "orderId": order_id}
        try:
            result = self.client._request("DELETE", "/fapi/v1/order", params, signed=True, weight=1)
            self.logger.info(f"Order {order_id} on {symbol} cancelled")
            return result
        except Exception as e:
            self.logger.error(f"cancel_order failed: {e}")
            raise
    
    def cancel_all_orders(self, symbol: str) -> dict:
        """Cancel all open orders for a symbol."""
        params = {"symbol": symbol}
        try:
            result = self.client._request("DELETE", "/fapi/v1/allOpenOrders", params, signed=True, weight=1)
            self.logger.info(f"All orders on {symbol} cancelled")
            return result
        except Exception as e:
            self.logger.error(f"cancel_all_orders failed: {e}")
            raise
    
    # -------------------------------------------------------------------------
    # LEVERAGE & MARGIN
    # -------------------------------------------------------------------------
    
    def set_leverage(self, symbol: str, leverage: int) -> dict:
        """
        Set leverage for a symbol.
        
        Args:
            symbol: Trading pair
            leverage: Leverage (1-125)
            
        Returns:
            Response dict with new leverage settings
        """
        leverage = max(1, min(125, leverage))
        
        params = {
            "symbol": symbol,
            "leverage": leverage
        }
        
        self.logger.info(f"Setting leverage for {symbol} to {leverage}x")
        
        try:
            result = self.client._request("POST", "/fapi/v1/leverage", params, signed=True, weight=1)
            self.logger.info(f"Leverage set: {symbol} = {result.get('leverage')}x")
            return {
                "symbol": result.get("symbol"),
                "leverage": int(result.get("leverage", leverage)),
                "max_notional": float(result.get("maxNotionalValue", 0)),
                "raw": result
            }
        except Exception as e:
            self.logger.error(f"set_leverage failed: {e}")
            raise
    
    def set_margin_type(self, symbol: str, margin_type: str) -> dict:
        """
        Set margin type (ISOLATED or CROSSED).
        
        Args:
            symbol: Trading pair
            margin_type: "ISOLATED" or "CROSSED"
        """
        margin_type = margin_type.upper()
        params = {"symbol": symbol, "marginType": margin_type}
        
        try:
            result = self.client._request("POST", "/fapi/v1/marginType", params, signed=True, weight=1)
            self.logger.info(f"Margin type set: {symbol} = {margin_type}")
            return result
        except Exception as e:
            self.logger.error(f"set_margin_type failed: {e}")
            raise
    
    # -------------------------------------------------------------------------
    # MARKET DATA
    # -------------------------------------------------------------------------
    
    def get_ticker(self, symbol: str) -> dict:
        """
        Get 24-hour ticker data for a symbol.
        
        Args:
            symbol: Trading pair (e.g., "BTCUSDT")
            
        Returns:
            dict with price, change, volume, high, low
        """
        try:
            result = self.client._request(
                "GET", "/fapi/v1/ticker/24hr",
                params={"symbol": symbol}, weight=1
            )
            
            return {
                "symbol": result.get("symbol"),
                "price": float(result.get("lastPrice", 0)),
                "price_change": float(result.get("priceChange", 0)),
                "price_change_pct": float(result.get("priceChangePercent", 0)),
                "volume": float(result.get("volume", 0)),
                "quote_volume": float(result.get("quoteVolume", 0)),
                "high": float(result.get("highPrice", 0)),
                "low": float(result.get("lowPrice", 0)),
                "open": float(result.get("openPrice", 0)),
                "weighted_avg": float(result.get("weightedAvgPrice", 0)),
                "trades": int(result.get("count", 0))
            }
            
        except Exception as e:
            self.logger.error(f"get_ticker({symbol}) failed: {e}")
            raise
    
    def get_price(self, symbol: str) -> float:
        """Get current mark price for a symbol."""
        try:
            result = self.client._request(
                "GET", "/fapi/v1/ticker/price",
                params={"symbol": symbol}, weight=1
            )
            return float(result.get("price", 0))
        except Exception as e:
            self.logger.error(f"get_price({symbol}) failed: {e}")
            raise
    
    def get_klines(self, symbol: str, interval: str = "15m", 
                   limit: int = 50) -> pd.DataFrame:
        """
        Get OHLCV klines/candlestick data.
        
        Args:
            symbol: Trading pair
            interval: Kline interval (1m, 3m, 5m, 15m, 1h, 4h, 1d, etc.)
            limit: Number of candles (max 1500)
            
        Returns:
            DataFrame with columns: open_time, open, high, low, close, volume, 
            close_time, quote_volume, trades, taker_buy_base, taker_buy_quote
        """
        limit = min(limit, 1500)
        
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        }
        
        try:
            klines = self.client._request("GET", "/fapi/v1/klines", params, weight=1)
            
            df = pd.DataFrame(klines, columns=[
                "open_time", "open", "high", "low", "close", "volume",
                "close_time", "quote_volume", "trades",
                "taker_buy_base", "taker_buy_quote", "ignore"
            ])
            
            # Convert to numeric
            numeric_cols = ["open", "high", "low", "close", "volume",
                          "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"]
            for col in numeric_cols:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            
            # Convert timestamps
            df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
            df["close_time"] = pd.to_datetime(df["close_time"], unit="ms")
            
            return df
            
        except Exception as e:
            self.logger.error(f"get_klines({symbol}, {interval}) failed: {e}")
            raise
    
    def get_funding_rate(self, symbol: str) -> dict:
        """Get current funding rate for a symbol."""
        try:
            result = self.client._request(
                "GET", "/fapi/v1/fundingRate",
                params={"symbol": symbol, "limit": 1}, weight=1
            )
            if result:
                return {
                    "symbol": result[0]["symbol"],
                    "funding_rate": float(result[0]["fundingRate"]),
                    "funding_time": pd.to_datetime(int(result[0]["fundingTime"]), unit="ms")
                }
            return {}
        except Exception as e:
            self.logger.error(f"get_funding_rate failed: {e}")
            return {}
    
    # -------------------------------------------------------------------------
    # POSITION SIZING & RISK MANAGEMENT
    # -------------------------------------------------------------------------
    
    def calculate_position_size(
        self,
        symbol: str,
        signal_confidence: float,
        atr: float,
        account_balance: Optional[float] = None,
        stop_multiplier: float = 2.0
    ) -> float:
        """
        Calculate position size using dynamic risk management.
        
        Risk = 1% + (confidence * 1%), so risk ranges from 1% to 2% of balance.
        Position size = Risk Amount / (ATR * stop_multiplier)
        
        Args:
            symbol: Trading pair
            signal_confidence: 0.0 to 1.0 (signal strength)
            atr: Average True Range value
            account_balance: Account balance (fetched if None)
            stop_multiplier: ATR multiplier for stop distance (default 2.0)
            
        Returns:
            Rounded position quantity
        """
        if account_balance is None:
            account = self.get_account_info()
            account_balance = account["available"]
        
        # Risk: 1% base + up to 1% based on confidence
        risk_pct = 0.01 + (signal_confidence * 0.01)  # 1% to 2%
        risk_amount = account_balance * risk_pct
        
        # Stop distance = ATR * multiplier
        stop_distance = atr * stop_multiplier
        
        if stop_distance <= 0:
            self.logger.warning(f"Invalid stop distance: {stop_distance}. Using default.")
            stop_distance = 0.05 * self.get_price(symbol)  # 5% default
        
        # Position size in base asset
        quantity = risk_amount / stop_distance
        
        self.logger.info(
            f"Position sizing | {symbol}: "
            f"Balance={account_balance:.2f}, Risk={risk_pct*100:.1f}%, "
            f"RiskAmt={risk_amount:.2f}, ATR={atr:.4f}, "
            f"StopDist={stop_distance:.4f}, Qty={quantity:.6f}"
        )
        
        return round_quantity(symbol, quantity)
    
    def calculate_bracket_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        entry_price: float,
        atr: float,
        risk_reward: float = 2.0
    ) -> dict:
        """
        Calculate entry, stop-loss, and take-profit prices.
        
        Args:
            symbol: Trading pair
            side: "BUY" or "SELL"
            quantity: Position size
            entry_price: Entry price
            atr: Average True Range
            risk_reward: Risk/Reward ratio (default 2.0)
            
        Returns:
            dict with entry, stop_loss, take_profit, quantity
        """
        side = side.upper()
        stop_distance = atr * 2.0
        
        if side == "BUY":
            stop_loss = entry_price - stop_distance
            take_profit = entry_price + (stop_distance * risk_reward)
        else:  # SELL
            stop_loss = entry_price + stop_distance
            take_profit = entry_price - (stop_distance * risk_reward)
        
        stop_loss = round_price(symbol, stop_loss)
        take_profit = round_price(symbol, take_profit)
        quantity = round_quantity(symbol, quantity)
        
        self.logger.info(
            f"Bracket order | {symbol} {side}: "
            f"Entry={entry_price:.4f}, SL={stop_loss:.4f}, "
            f"TP={take_profit:.4f}, R:R=1:{risk_reward}"
        )
        
        return {
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "entry_price": entry_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "atr": atr,
            "risk_reward": risk_reward
        }
    
    # -------------------------------------------------------------------------
    # MULTI-COIN SCANNER
    # -------------------------------------------------------------------------
    
    def scan_all_coins(self, symbols: Optional[list] = None,
                       interval: str = "15m", limit: int = 50) -> dict:
        """
        Quick scan of all 20 coins to find best trading opportunities.
        
        For each coin, fetches:
        - Current price and 24h change
        - RSI (Relative Strength Index)
        - Trend direction (EMA crossover)
        - Volatility (ATR-based)
        
        Args:
            symbols: List of symbols to scan (defaults to COINS)
            interval: Kline interval for technical analysis
            limit: Number of klines to fetch
            
        Returns:
            dict with scan results, ranked opportunities, and summary
        """
        symbols = symbols or COINS
        results = {}
        opportunities = []
        
        self.logger.info(f"Scanning {len(symbols)} coins on {interval} timeframe...")
        
        for symbol in symbols:
            try:
                # Fetch ticker and klines
                ticker = self.get_ticker(symbol)
                df = self.get_klines(symbol, interval=interval, limit=limit)
                
                if df.empty or len(df) < 20:
                    continue
                
                # Calculate indicators
                rsi = self._calculate_rsi(df["close"])
                ema_fast = df["close"].ewm(span=9).mean().iloc[-1]
                ema_slow = df["close"].ewm(span=21).mean().iloc[-1]
                atr = self._calculate_atr(df)
                
                price = ticker["price"]
                change_pct = ticker["price_change_pct"]
                
                # Trend detection
                if ema_fast > ema_slow * 1.001:
                    trend = "BULLISH"
                elif ema_fast < ema_slow * 0.999:
                    trend = "BEARISH"
                else:
                    trend = "NEUTRAL"
                
                # Volatility
                volatility = (atr / price) * 100 if price > 0 else 0
                
                # Score: combine momentum and trend
                trend_score = 0
                if trend == "BULLISH" and rsi < 70:
                    trend_score = (70 - rsi) / 70  # Buy opportunity
                elif trend == "BEARISH" and rsi > 30:
                    trend_score = (rsi - 30) / 70  # Sell opportunity
                
                momentum_score = abs(change_pct) / 10  # Normalize
                score = trend_score * 0.6 + min(momentum_score, 1.0) * 0.4
                
                coin_data = {
                    "symbol": symbol,
                    "price": price,
                    "change_24h_pct": change_pct,
                    "rsi": round(rsi, 2),
                    "trend": trend,
                    "ema_9": round(ema_fast, 4),
                    "ema_21": round(ema_slow, 4),
                    "atr": round(atr, 4),
                    "volatility_pct": round(volatility, 4),
                    "score": round(score, 4),
                    "volume": ticker["volume"],
                    "volume_quote": ticker["quote_volume"]
                }
                
                results[symbol] = coin_data
                
                if score > 0.3:  # Threshold for opportunity
                    opportunities.append(coin_data)
                
                self.logger.debug(
                    f"{symbol}: ${price:.2f} | 24h: {change_pct:+.2f}% | "
                    f"RSI: {rsi:.1f} | Trend: {trend} | Score: {score:.3f}"
                )
                
                # Small delay to respect rate limits
                time.sleep(0.05)
                
            except Exception as e:
                self.logger.error(f"Scan failed for {symbol}: {e}")
                continue
        
        # Sort opportunities by score (descending)
        opportunities.sort(key=lambda x: x["score"], reverse=True)
        
        summary = {
            "total_scanned": len(symbols),
            "successful": len(results),
            "opportunities_found": len(opportunities),
            "top_opportunities": opportunities[:5],
            "avg_change_24h": round(
                np.mean([r["change_24h_pct"] for r in results.values()]), 2
            ) if results else 0,
            "best_performer": max(results.values(), key=lambda x: x["change_24h_pct"])["symbol"]
                if results else None,
            "worst_performer": min(results.values(), key=lambda x: x["change_24h_pct"])["symbol"]
                if results else None,
        }
        
        self.logger.info(
            f"Scan complete: {summary['successful']}/{summary['total_scanned']} "
            f"coins | {summary['opportunities_found']} opportunities | "
            f"Best: {summary['best_performer']} | "
            f"Worst: {summary['worst_performer']}"
        )
        
        return {
            "coins": results,
            "opportunities": opportunities,
            "summary": summary
        }
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Calculate RSI for a price series."""
        if len(prices) < period + 1:
            return 50.0
        
        deltas = prices.diff()
        gain = deltas.where(deltas > 0, 0.0)
        loss = (-deltas.where(deltas < 0, 0.0))
        
        avg_gain = gain.ewm(alpha=1.0/period, min_periods=period).mean()
        avg_loss = loss.ewm(alpha=1.0/period, min_periods=period).mean()
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi.iloc[-1]
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Calculate Average True Range."""
        if len(df) < period + 1:
            return 0.0
        
        high = df["high"]
        low = df["low"]
        close = df["close"]
        
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))
        
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.ewm(span=period, min_periods=period).mean()
        
        return atr.iloc[-1]
    
    # -------------------------------------------------------------------------
    # BATCH OPERATIONS
    # -------------------------------------------------------------------------
    
    def close_all_positions(self) -> list:
        """Close all open positions. Returns list of close results."""
        positions = self.get_all_positions()
        results = []
        
        for pos in positions:
            try:
                result = self.close_position(pos["symbol"])
                results.append(result)
                time.sleep(0.1)  # Rate limit
            except Exception as e:
                self.logger.error(f"Failed to close {pos['symbol']}: {e}")
                results.append({"symbol": pos["symbol"], "error": str(e)})
        
        self.logger.info(f"Closed {len(positions)} positions")
        return results
    
    def set_all_leverage(self, leverage: int) -> list:
        """Set leverage for all 20 coins."""
        results = []
        for symbol in COINS:
            try:
                result = self.set_leverage(symbol, leverage)
                results.append(result)
                time.sleep(0.05)
            except Exception as e:
                self.logger.error(f"Failed to set leverage for {symbol}: {e}")
        return results
    
    def get_portfolio_summary(self) -> dict:
        """Get comprehensive portfolio summary."""
        account = self.get_account_info()
        positions = self.get_all_positions()
        
        total_pnl = sum(p["unrealized_pnl"] for p in positions)
        total_notional = sum(p["notional"] for p in positions)
        
        # Exposure by direction
        long_exposure = sum(p["notional"] for p in positions if p["side"] == "LONG")
        short_exposure = sum(p["notional"] for p in positions if p["side"] == "SHORT")
        
        return {
            "balance": account["balance"],
            "available": account["available"],
            "total_equity": account["total_equity"],
            "unrealized_pnl": total_pnl,
            "realized_pnl": account.get("realized_pnl", 0),
            "positions_count": len(positions),
            "total_notional": total_notional,
            "long_exposure": long_exposure,
            "short_exposure": short_exposure,
            "net_exposure": long_exposure - short_exposure,
            "margin_used_pct": (
                (account["balance"] - account["available"]) / account["balance"] * 100
                if account["balance"] > 0 else 0
            ),
            "positions": positions,
            "timestamp": datetime.now().isoformat()
        }


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def round_quantity(symbol: str, quantity: float) -> float:
    """Round quantity to symbol's precision."""
    precision = SYMBOL_PRECISION.get(symbol, 3)
    return round(quantity, precision)


def round_price(symbol: str, price: float) -> float:
    """Round price to appropriate tick size."""
    if price >= 1000:
        return round(price, 1)
    elif price >= 100:
        return round(price, 2)
    elif price >= 10:
        return round(price, 3)
    elif price >= 1:
        return round(price, 4)
    else:
        return round(price, 6)


def get_min_notional(symbol: str) -> float:
    """Get minimum notional value for a symbol."""
    return MIN_NOTIONAL.get(symbol, 5.0)


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Alex V2 - Binance Futures Trading Engine")
    print("=" * 70)
    
    # -----------------------------------------------------------------------
    # Get API keys from environment or use mock mode
    # -----------------------------------------------------------------------
    API_KEY = os.environ.get("BINANCE_TESTNET_API_KEY", "")
    API_SECRET = os.environ.get("BINANCE_TESTNET_SECRET", "")
    
    # Initialize trader (mock mode if no keys)
    trader = FuturesTrader(API_KEY, API_SECRET, testnet=True)
    
    print(f"\nMock Mode: {trader.mock_mode}")
    print(f"Testnet: {trader.testnet}")
    
    # -----------------------------------------------------------------------
    # 1. Account Info
    # -----------------------------------------------------------------------
    print("\n--- Account Info ---")
    account = trader.get_account_info()
    print(f"Balance: {account['balance']:.2f} USDT")
    print(f"Available: {account['available']:.2f} USDT")
    print(f"Positions: {account['positions_count']}")
    
    # -----------------------------------------------------------------------
    # 2. Get Positions
    # -----------------------------------------------------------------------
    print("\n--- Open Positions ---")
    positions = trader.get_all_positions()
    if positions:
        for pos in positions:
            print(f"  {pos['symbol']}: {pos['side']} {pos['quantity']} "
                  f"@ {pos['entry_price']:.4f} (PnL: {pos['unrealized_pnl']:.2f})")
    else:
        print("  No open positions")
    
    # -----------------------------------------------------------------------
    # 3. Get Ticker
    # -----------------------------------------------------------------------
    print("\n--- Ticker: BTCUSDT ---")
    ticker = trader.get_ticker("BTCUSDT")
    print(f"Price: {ticker['price']:.2f}")
    print(f"24h Change: {ticker['price_change_pct']:+.2f}%")
    print(f"24h High: {ticker['high']:.2f} | Low: {ticker['low']:.2f}")
    print(f"Volume: {ticker['volume']:.2f}")
    
    # -----------------------------------------------------------------------
    # 4. Get Klines
    # -----------------------------------------------------------------------
    print("\n--- Klines: BTCUSDT 15m (last 5) ---")
    df = trader.get_klines("BTCUSDT", interval="15m", limit=5)
    print(df[["open_time", "open", "high", "low", "close", "volume"]].to_string())
    
    # -----------------------------------------------------------------------
    # 5. Set Leverage
    # -----------------------------------------------------------------------
    print("\n--- Set Leverage ---")
    lev_result = trader.set_leverage("BTCUSDT", 10)
    print(f"Leverage set to {lev_result['leverage']}x for BTCUSDT")
    
    # -----------------------------------------------------------------------
    # 6. Position Sizing Example
    # -----------------------------------------------------------------------
    print("\n--- Position Sizing ---")
    # Simulate ATR calculation
    df_50 = trader.get_klines("BTCUSDT", interval="15m", limit=50)
    atr = trader._calculate_atr(df_50)
    print(f"ATR (14): {atr:.2f}")
    
    qty = trader.calculate_position_size(
        symbol="BTCUSDT",
        signal_confidence=0.7,
        atr=atr,
        account_balance=account["available"]
    )
    print(f"Position size for 70% confidence: {qty} BTC")
    
    # -----------------------------------------------------------------------
    # 7. Bracket Order Calculation
    # -----------------------------------------------------------------------
    print("\n--- Bracket Order ---")
    bracket = trader.calculate_bracket_order(
        symbol="BTCUSDT",
        side="BUY",
        quantity=qty,
        entry_price=ticker["price"],
        atr=atr,
        risk_reward=2.0
    )
    print(f"Entry: {bracket['entry_price']:.2f}")
    print(f"Stop Loss: {bracket['stop_loss']:.2f}")
    print(f"Take Profit: {bracket['take_profit']:.2f}")
    print(f"Risk:Reward = 1:{bracket['risk_reward']}")
    
    # -----------------------------------------------------------------------
    # 8. Scan All Coins (quick scan of 5 for demo)
    # -----------------------------------------------------------------------
    print("\n--- Quick Scan (5 coins) ---")
    scan = trader.scan_all_coins(symbols=COINS[:5], interval="15m", limit=50)
    
    print(f"\nScanned: {scan['summary']['successful']}/{scan['summary']['total_scanned']}")
    print(f"Opportunities: {scan['summary']['opportunities_found']}")
    print(f"Best performer: {scan['summary']['best_performer']}")
    print(f"Worst performer: {scan['summary']['worst_performer']}")
    
    if scan["opportunities"]:
        print("\n--- Top Opportunities ---")
        for opp in scan["opportunities"][:3]:
            print(f"  {opp['symbol']}: Score={opp['score']:.3f} | "
                  f"Price=${opp['price']:.2f} | 24h={opp['change_24h_pct']:+.2f}% | "
                  f"RSI={opp['rsi']:.1f} | Trend={opp['trend']}")
    
    # -----------------------------------------------------------------------
    # 9. Portfolio Summary
    # -----------------------------------------------------------------------
    print("\n--- Portfolio Summary ---")
    portfolio = trader.get_portfolio_summary()
    print(f"Total Equity: {portfolio['total_equity']:.2f} USDT")
    print(f"Unrealized PnL: {portfolio['unrealized_pnl']:.2f} USDT")
    print(f"Margin Used: {portfolio['margin_used_pct']:.1f}%")
    print(f"Net Exposure: {portfolio['net_exposure']:.2f} USDT")
    
    # -----------------------------------------------------------------------
    # 10. Mock Order Execution (only in mock mode)
    # -----------------------------------------------------------------------
    if trader.mock_mode:
        print("\n--- Mock Order Execution ---")
        
        # Market buy
        order = trader.place_market_order("BTCUSDT", "BUY", 0.01)
        print(f"Market BUY: {order['quantity']} @ {order['price']:.2f}")
        
        # Check position
        pos = trader.get_position("BTCUSDT")
        if pos:
            print(f"Position: {pos['side']} {pos['quantity']} @ {pos['entry_price']:.2f}")
        
        # Close position
        close = trader.close_position("BTCUSDT")
        print(f"Close result: {close['status']}")
    
    print("\n" + "=" * 70)
    print("Demo complete!")
    print("=" * 70)
