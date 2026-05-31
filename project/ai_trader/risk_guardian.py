from typing import Dict, List, Tuple
from datetime import datetime


class RiskGuardian:
    """Hard safety limits that override the AI's decisions."""

    def __init__(self, config: dict = None):
        config = config or {}
        self.max_position_pct = config.get("max_position_pct", 0.20)
        self.max_daily_loss_pct = config.get("max_daily_loss_pct", 0.05)
        self.max_open_positions = config.get("max_open_positions", 3)
        self.max_drawdown_pct = config.get("max_drawdown_pct", 0.15)
        self.require_stop_loss = config.get("require_stop_loss", True)
        self.initial_balance = 0.0

    def validate_trade(self, decision: dict, balance: dict, open_positions: list) -> Tuple[bool, str]:
        """Validate a trade decision against hard limits. Returns (allowed, reason)."""

        # Check max open positions
        if len(open_positions) >= self.max_open_positions:
            return False, f"Max open positions reached ({self.max_open_positions})"

        # Check position size
        total_balance = balance.get("total_usdt", 0)
        trade_value = total_balance * decision.get("size", 0)
        max_trade_value = total_balance * self.max_position_pct

        if trade_value > max_trade_value:
            return False, f"Position size ${trade_value:.2f} exceeds max ${max_trade_value:.2f} ({self.max_position_pct*100:.0f}%)"

        # Require stop loss
        if self.require_stop_loss and decision.get("stop_loss") is None:
            return False, "Stop loss required but not set"

        return True, "Risk check passed"

    def check_daily_limits(self, memory) -> bool:
        """Check if daily loss limit has been hit."""
        daily_pnl = memory.get_daily_pnl()
        total_balance = sum(
            t.get("entry_price", 0) * t.get("size", 0)
            for t in memory.trades[-10:]
        ) or 1000  # Default estimate

        daily_loss_pct = abs(daily_pnl) / total_balance if total_balance > 0 else 0

        if daily_pnl < 0 and daily_loss_pct >= self.max_daily_loss_pct:
            return False  # Daily loss limit hit
        return True

    def check_drawdown(self, memory, current_balance: float) -> bool:
        """Check if max drawdown has been exceeded."""
        if self.initial_balance == 0:
            self.initial_balance = current_balance
            return True

        drawdown = (self.initial_balance - current_balance) / self.initial_balance
        if drawdown >= self.max_drawdown_pct:
            return False  # Circuit breaker
        return True

    def get_risk_report(self, balance: dict, open_positions: list) -> dict:
        """Get current risk exposure summary."""
        total_balance = balance.get("total_usdt", 0)
        exposed = sum(p.get("value", 0) for p in open_positions)

        return {
            "total_balance": total_balance,
            "exposed_capital": exposed,
            "exposure_pct": (exposed / total_balance * 100) if total_balance > 0 else 0,
            "open_positions": len(open_positions),
            "max_positions": self.max_open_positions,
            "position_limit_pct": self.max_position_pct * 100,
            "daily_loss_limit_pct": self.max_daily_loss_pct * 100,
            "drawdown_limit_pct": self.max_drawdown_pct * 100,
        }
