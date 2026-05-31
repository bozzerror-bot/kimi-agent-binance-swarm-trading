import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class MemoryAgent:
    """Persistent memory: records trades, extracts patterns, learns from history."""

    def __init__(self, memory_file: str = "memory.json"):
        self.memory_file = memory_file
        self.trades: List[dict] = []
        self.daily_stats = {}
        self.load()

    def record_trade(self, trade: dict):
        """Record a trade with full context."""
        trade_record = {
            "id": len(self.trades) + 1,
            "timestamp": datetime.utcnow().isoformat(),
            "symbol": trade.get("symbol"),
            "side": trade.get("side"),
            "entry_price": trade.get("entry_price"),
            "exit_price": trade.get("exit_price"),
            "size": trade.get("size"),
            "pnl": trade.get("pnl", 0),
            "pnl_pct": trade.get("pnl_pct", 0),
            "status": trade.get("status", "open"),
            "reasoning": trade.get("reasoning", ""),
            "mood_at_entry": trade.get("mood_at_entry", ""),
            "rsi_at_entry": trade.get("rsi_at_entry"),
            "trend_at_entry": trade.get("trend_at_entry", ""),
            "lesson": trade.get("lesson", ""),
        }
        self.trades.append(trade_record)
        self.save()

    def update_trade(self, trade_id: int, updates: dict):
        """Update a trade (e.g., when it closes)."""
        for t in self.trades:
            if t["id"] == trade_id:
                t.update(updates)
                # Auto-extract lesson
                if "pnl" in updates:
                    t["lesson"] = self._extract_lesson(t)
                break
        self.save()

    def _extract_lesson(self, trade: dict) -> str:
        """Extract a lesson from a completed trade."""
        pnl = trade.get("pnl", 0)
        mood = trade.get("mood_at_entry", "")

        if pnl > 0:
            if mood in ["greedy", "excited"]:
                return "Got lucky while feeling greedy. Should stick to plan."
            elif mood in ["confident", "optimistic"]:
                return "Good trade with clear head. Trust the process."
            else:
                return "Solid setup paid off."
        else:
            if mood in ["fearful", "hesitant"]:
                return "Emotional entry led to loss. Wait for better setup."
            elif trade.get("rsi_at_entry", 50) > 70:
                return "Bought overbought market. Patience next time."
            elif trade.get("rsi_at_entry", 50) < 30:
                return "Sold oversold market. Counter-trend is risky."
            else:
                return "Loss happens. Review the setup criteria."

    def get_recent_trades(self, n: int = 10) -> List[dict]:
        return sorted(self.trades, key=lambda x: x["timestamp"], reverse=True)[:n]

    def get_statistics(self) -> dict:
        closed = [t for t in self.trades if t["status"] == "closed"]
        if not closed:
            return {"total_trades": 0, "win_rate": 0, "avg_pnl": 0, "wins": 0, "losses": 0, "total_pnl": 0, "current_streak": 0}

        wins = [t for t in closed if t["pnl"] > 0]
        losses = [t for t in closed if t["pnl"] <= 0]

        total_pnl = sum(t["pnl"] for t in closed)

        return {
            "total_trades": len(closed),
            "win_rate": len(wins) / len(closed) * 100,
            "wins": len(wins),
            "losses": len(losses),
            "avg_pnl": total_pnl / len(closed),
            "total_pnl": total_pnl,
            "best_trade": max((t["pnl"] for t in closed), default=0),
            "worst_trade": min((t["pnl"] for t in closed), default=0),
            "current_streak": self._get_current_streak(),
        }

    def _get_current_streak(self) -> int:
        """Calculate current win/loss streak."""
        closed = [t for t in self.trades if t["status"] == "closed"]
        if not closed:
            return 0

        streak = 0
        for t in reversed(sorted(closed, key=lambda x: x["timestamp"])):
            is_win = t["pnl"] > 0
            if streak == 0:
                streak = 1 if is_win else -1
            elif (streak > 0 and is_win) or (streak < 0 and not is_win):
                streak += 1 if is_win else -1
            else:
                break
        return streak

    def get_lessons(self) -> List[str]:
        """Get learned lessons from past trades."""
        lessons = []
        for t in sorted(self.trades, key=lambda x: x["timestamp"], reverse=True)[:20]:
            if t.get("lesson"):
                lessons.append(t["lesson"])
        return lessons[:5]  # Return top 5 recent lessons

    def get_performance_summary(self) -> str:
        stats = self.get_statistics()
        if stats["total_trades"] == 0:
            return "No trades yet. Fresh start!"

        streak = stats["current_streak"]
        streak_str = f"{abs(streak)}-trade {'win' if streak > 0 else 'loss'} streak"

        return (
            f"Record: {stats['wins']}W / {stats['losses']}L "
            f"({stats['win_rate']:.0f}% win rate) | "
            f"Total P&L: ${stats['total_pnl']:.2f} | "
            f"{streak_str}"
        )

    def to_context(self) -> str:
        """Format memory as context string for the reasoning engine."""
        recent = self.get_recent_trades(5)
        stats = self.get_statistics()
        lessons = self.get_lessons()

        lines = ["=== MY TRADING HISTORY ==="]
        lines.append(f"Overall: {stats['wins']}W/{stats['losses']}L ({stats['win_rate']:.0f}%) | Total P&L: ${stats.get('total_pnl', 0):.2f}")

        if recent:
            lines.append("\nRecent trades:")
            for t in recent:
                emoji = "✅" if t.get("pnl", 0) > 0 else "❌"
                lines.append(f"  {emoji} {t['symbol']} {t['side']} @ ${t.get('entry_price', 0):.2f} → P&L: ${t.get('pnl', 0):.2f}")

        if lessons:
            lines.append(f"\nLessons learned:")
            for l in lessons[:3]:
                lines.append(f"  • {l}")

        return "\n".join(lines)

    def get_daily_pnl(self) -> float:
        """Get today's P&L."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return sum(
            t.get("pnl", 0)
            for t in self.trades
            if t["timestamp"].startswith(today) and t["status"] == "closed"
        )

    def save(self):
        data = {
            "trades": self.trades,
            "last_updated": datetime.utcnow().isoformat(),
        }
        with open(self.memory_file, "w") as f:
            json.dump(data, f, indent=2)

    def load(self):
        if os.path.exists(self.memory_file):
            with open(self.memory_file, "r") as f:
                data = json.load(f)
                self.trades = data.get("trades", [])
