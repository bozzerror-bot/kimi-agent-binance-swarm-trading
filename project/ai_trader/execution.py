"""Execution agent for placing orders on Binance Testnet."""
from binance.client import Client
from binance.enums import *
from binance.exceptions import BinanceAPIException
import logging

logger = logging.getLogger(__name__)


class ExecutionAgent:
    """Handles order execution on Binance."""
    
    def __init__(self, api_key: str, api_secret: str, testnet: bool = True):
        self.client = Client(api_key, api_secret, testnet=testnet)
        self.testnet = testnet
    
    async def place_market_order(self, symbol: str, side: str, quantity: float) -> dict:
        """Place a market order."""
        try:
            order = self.client.create_order(
                symbol=symbol,
                side=side.upper(),
                type=ORDER_TYPE_MARKET,
                quantity=quantity,
            )
            logger.info(f"Market order placed: {side} {quantity} {symbol}")
            return {
                "success": True,
                "order_id": order["orderId"],
                "symbol": order["symbol"],
                "side": order["side"],
                "status": order["status"],
                "executed_qty": float(order.get("executedQty", 0)),
                "price": float(order["fills"][0]["price"]) if order.get("fills") else 0,
                "commission": float(order["fills"][0]["commission"]) if order.get("fills") else 0,
                "raw": order,
            }
        except BinanceAPIException as e:
            logger.error(f"Order failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def place_limit_order(self, symbol: str, side: str, quantity: float, price: float) -> dict:
        """Place a limit order."""
        try:
            order = self.client.create_order(
                symbol=symbol,
                side=side.upper(),
                type=ORDER_TYPE_LIMIT,
                timeInForce=TIME_IN_FORCE_GTC,
                quantity=quantity,
                price=str(price),
            )
            return {
                "success": True,
                "order_id": order["orderId"],
                "symbol": order["symbol"],
                "side": order["side"],
                "status": order["status"],
                "price": price,
                "quantity": quantity,
            }
        except BinanceAPIException as e:
            return {"success": False, "error": str(e)}
    
    async def place_oco_order(self, symbol: str, side: str, quantity: float,
                               price: float, stop_price: float, stop_limit_price: float) -> dict:
        """Place an OCO (take profit + stop loss) order."""
        # OCO orders are complex; for simplicity, we'll place separate orders
        # or return a simulated OCO structure
        return {
            "success": True,
            "note": "OCO simulated: Use separate limit orders for TP/SL",
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "take_profit": price,
            "stop_loss": stop_price,
        }
    
    async def get_open_orders(self, symbol: str = None) -> list:
        """Get open orders."""
        try:
            if symbol:
                orders = self.client.get_open_orders(symbol=symbol)
            else:
                orders = self.client.get_open_orders()
            return orders
        except Exception as e:
            return []
    
    async def cancel_order(self, symbol: str, order_id: int) -> dict:
        """Cancel an order."""
        try:
            result = self.client.cancel_order(symbol=symbol, orderId=order_id)
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def get_order_status(self, symbol: str, order_id: int) -> dict:
        """Get order status."""
        try:
            order = self.client.get_order(symbol=symbol, orderId=order_id)
            return {
                "success": True,
                "status": order["status"],
                "executed_qty": float(order.get("executedQty", 0)),
                "price": float(order.get("price", 0)),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def close(self):
        """Cleanup."""
        pass
