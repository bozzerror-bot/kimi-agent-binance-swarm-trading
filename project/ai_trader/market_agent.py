"""Market data agent for fetching and analyzing Binance market data."""
import asyncio
import pandas as pd
import numpy as np
from typing import Dict, Optional
from binance.client import Client
from binance.enums import *


class MarketAgent:
    """Fetches market data from Binance and calculates technical indicators."""
    
    def __init__(self, api_key: str = None, api_secret: str = None, testnet: bool = True):
        self.client = Client(api_key or "", api_secret or "", testnet=testnet)
        self.testnet = testnet
    
    async def get_price(self, symbol: str) -> float:
        """Get current price for a symbol."""
        ticker = self.client.get_symbol_ticker(symbol=symbol)
        return float(ticker["price"])
    
    async def get_klines(self, symbol: str, interval: str = "1h", limit: int = 100) -> pd.DataFrame:
        """Fetch OHLCV candlestick data."""
        klines = self.client.get_klines(
            symbol=symbol,
            interval=interval,
            limit=limit
        )
        
        df = pd.DataFrame(klines, columns=[
            "timestamp", "open", "high", "low", "close", "volume",
            "close_time", "quote_volume", "trades", "taker_buy_base",
            "taker_buy_quote", "ignore"
        ])
        
        numeric_cols = ["open", "high", "low", "close", "volume", "quote_volume"]
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms")
        return df
    
    async def get_account_balance(self) -> dict:
        """Get account balance in USDT and assets."""
        try:
            account = self.client.get_account()
            balances = {}
            total_usdt = 0.0
            
            for b in account["balances"]:
                free = float(b["free"])
                locked = float(b["locked"])
                total = free + locked
                
                if total > 0:
                    balances[b["asset"]] = {
                        "free": free,
                        "locked": locked,
                        "total": total,
                    }
                    if b["asset"] == "USDT":
                        total_usdt = total
            
            # Estimate total portfolio value in USDT
            portfolio_value = total_usdt
            for asset, data in balances.items():
                if asset != "USDT" and data["total"] > 0:
                    try:
                        price = float(self.client.get_symbol_ticker(symbol=f"{asset}USDT")["price"])
                        portfolio_value += data["total"] * price
                    except:
                        pass
            
            return {
                "balances": balances,
                "total_usdt": portfolio_value,
                "usdt_available": balances.get("USDT", {}).get("free", 0),
            }
        except Exception as e:
            return {
                "balances": {},
                "total_usdt": 10000.0,  # Fallback for testnet
                "usdt_available": 10000.0,
                "error": str(e),
            }
    
    async def get_ticker_24h(self, symbol: str) -> dict:
        """Get 24h ticker statistics."""
        ticker = self.client.get_ticker_24hr(symbol=symbol)
        return {
            "price_change": float(ticker["priceChange"]),
            "price_change_percent": float(ticker["priceChangePercent"]),
            "weighted_avg_price": float(ticker["weightedAvgPrice"]),
            "prev_close": float(ticker["prevClosePrice"]),
            "last_price": float(ticker["lastPrice"]),
            "bid_price": float(ticker["bidPrice"]),
            "ask_price": float(ticker["askPrice"]),
            "open_price": float(ticker["openPrice"]),
            "high_price": float(ticker["highPrice"]),
            "low_price": float(ticker["lowPrice"]),
            "volume": float(ticker["volume"]),
            "quote_volume": float(ticker["quoteVolume"]),
        }
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical indicators."""
        df = df.copy()
        
        # RSI (14-period)
        delta = df["close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df["rsi"] = 100 - (100 / (1 + rs))
        
        # MACD
        ema_12 = df["close"].ewm(span=12, adjust=False).mean()
        ema_26 = df["close"].ewm(span=26, adjust=False).mean()
        df["macd"] = ema_12 - ema_26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_hist"] = df["macd"] - df["macd_signal"]
        
        # Bollinger Bands
        df["sma_20"] = df["close"].rolling(window=20).mean()
        df["std_20"] = df["close"].rolling(window=20).std()
        df["bb_upper"] = df["sma_20"] + (df["std_20"] * 2)
        df["bb_lower"] = df["sma_20"] - (df["std_20"] * 2)
        df["bb_position"] = (df["close"] - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"])
        
        # EMAs
        df["ema_20"] = df["close"].ewm(span=20, adjust=False).mean()
        df["ema_50"] = df["close"].ewm(span=50, adjust=False).mean()
        
        # Volume analysis
        df["volume_sma"] = df["volume"].rolling(window=20).mean()
        
        return df
    
    def analyze_market_structure(self, df: pd.DataFrame) -> dict:
        """Analyze market structure: trend, support/resistance."""
        if len(df) < 50:
            return {"trend": "neutral", "support": 0, "resistance": 0, "volume_ratio": 1.0}
        
        latest = df.iloc[-1]
        
        # Determine trend
        if latest["ema_20"] > latest["ema_50"] * 1.02:
            trend = "bullish"
        elif latest["ema_20"] < latest["ema_50"] * 0.98:
            trend = "bearish"
        else:
            trend = "neutral"
        
        # Find support and resistance (recent local min/max)
        recent = df.tail(30)
        support = recent["low"].min()
        resistance = recent["high"].max()
        
        # Volume ratio
        volume_ratio = latest["volume"] / latest["volume_sma"] if latest["volume_sma"] > 0 else 1.0
        
        return {
            "trend": trend,
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "volume_ratio": round(volume_ratio, 2),
        }
    
    async def close(self):
        """Close connections."""
        pass  # python-binance handles cleanup
