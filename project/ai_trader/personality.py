import random
import json
from datetime import datetime
from typing import Dict, Optional


class Personality:
    """Human-like personality with emotions that affect trading decisions."""

    MOODS = ["confident", "nervous", "greedy", "fearful", "neutral", "excited", "hesitant", "cautious", "optimistic"]

    def __init__(self, config: dict = None):
        config = config or {}
        self.name = config.get("name", "Alex")
        self.risk_tolerance = config.get("risk_tolerance", 0.5)
        self.confidence_level = config.get("confidence_level", 0.6)
        self.patience = config.get("patience", 0.6)
        self.adaptability = config.get("adaptability", 0.7)

        # Dynamic emotional state
        self.mood = "neutral"
        self.stress_level = 0.0
        self.streak_count = 0  # Positive = win streak, negative = loss streak
        self.total_trades = 0
        self.total_wins = 0
        self.total_losses = 0
        self.peak_balance = 0.0
        self.current_balance = 0.0

    def update_emotion(self, trade_result: dict):
        """Update emotional state based on trade outcome."""
        pnl = trade_result.get("pnl", 0)
        was_win = pnl > 0

        self.total_trades += 1
        if was_win:
            self.total_wins += 1
            if self.streak_count < 0:
                self.streak_count = 1
            else:
                self.streak_count += 1
        else:
            self.total_losses += 1
            if self.streak_count > 0:
                self.streak_count = -1
            else:
                self.streak_count -= 1

        # Update stress based on consecutive losses
        if self.streak_count <= -2:
            self.stress_level = min(1.0, self.stress_level + 0.2)
        elif self.streak_count >= 2:
            self.stress_level = max(0.0, self.stress_level - 0.15)

        # Update mood
        self._recalculate_mood()

    def _recalculate_mood(self):
        """Recalculate mood based on current state."""
        if self.stress_level > 0.6:
            self.mood = "fearful" if random.random() < 0.5 else "nervous"
        elif self.streak_count >= 3:
            self.mood = "confident" if random.random() < 0.7 else "greedy"
        elif self.streak_count <= -3:
            self.mood = "hesitant" if random.random() < 0.5 else "fearful"
        elif self.streak_count > 0:
            self.mood = "optimistic"
        elif self.streak_count < 0:
            self.mood = "cautious"
        else:
            self.mood = "neutral"

    def get_mood_description(self) -> str:
        """Get human-readable mood description with a personal touch."""
        descriptions = {
            "confident": f"{self.name} is riding high, feeling sharp and decisive",
            "nervous": f"{self.name}'s hands are a bit shaky, unsure about the next move",
            "greedy": f"{self.name} is feeling the rush, wanting to push for bigger wins",
            "fearful": f"{self.name} is protective, worried about losing more",
            "neutral": f"{self.name} is calm and balanced, seeing clearly",
            "excited": f"{self.name} is buzzing with energy, seeing opportunity everywhere",
            "hesitant": f"{self.name} is second-guessing, treading carefully",
            "cautious": f"{self.name} is being careful, not taking unnecessary risks",
            "optimistic": f"{self.name} is hopeful, seeing the glass half full",
        }
        return descriptions.get(self.mood, f"{self.name} is thinking...")

    def affects_decision(self, signal_strength: float) -> float:
        """Modify signal strength based on emotional state."""
        modifier = 1.0

        if self.mood == "fearful":
            modifier = 0.4
        elif self.mood == "nervous":
            modifier = 0.6
        elif self.mood == "hesitant":
            modifier = 0.5
        elif self.mood == "cautious":
            modifier = 0.7
        elif self.mood == "greedy":
            modifier = 1.4
        elif self.mood == "confident":
            modifier = 1.2
        elif self.mood == "excited":
            modifier = 1.3
        elif self.mood == "optimistic":
            modifier = 1.1

        # Stress reduces confidence
        stress_penalty = self.stress_level * 0.5
        modifier *= (1 - stress_penalty)

        # Patience affects speed of action
        if self.patience > 0.7 and signal_strength < 0.6:
            modifier *= 0.5  # Patient traders wait for better setups

        return signal_strength * modifier

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "risk_tolerance": self.risk_tolerance,
            "confidence_level": self.confidence_level,
            "patience": self.patience,
            "adaptability": self.adaptability,
            "mood": self.mood,
            "stress_level": self.stress_level,
            "streak_count": self.streak_count,
            "total_trades": self.total_trades,
            "total_wins": self.total_wins,
            "total_losses": self.total_losses,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Personality":
        p = cls(data)
        p.mood = data.get("mood", "neutral")
        p.stress_level = data.get("stress_level", 0.0)
        p.streak_count = data.get("streak_count", 0)
        p.total_trades = data.get("total_trades", 0)
        p.total_wins = data.get("total_wins", 0)
        p.total_losses = data.get("total_losses", 0)
        return p
