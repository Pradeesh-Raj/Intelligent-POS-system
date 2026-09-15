"""
Epsilon-greedy contextual bandit for expiry-based discount selection.

No external RL library — implemented from scratch in ~150 lines.

Arms (discount tiers): [0, 10, 20, 30, 40] %
Context features used externally: days_to_expiry, current_stock, recent_velocity.
The bandit maintains per-arm Q-values (average reward) and pull counts.

State is persisted to a JSON file so it survives server restarts.
"""

import json
import logging
import os
import random
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

ARMS: List[float] = [0.0, 10.0, 20.0, 30.0, 40.0]
DEFAULT_EPSILON = 0.1

# Use backend/data/ locally; fall back to /tmp on Render (ephemeral is fine for bandit state)
_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DATA_CANDIDATE = os.path.join(_BASE, "data")

def _get_data_dir() -> str:
    try:
        os.makedirs(_DATA_CANDIDATE, exist_ok=True)
        test = os.path.join(_DATA_CANDIDATE, ".writable")
        with open(test, "w") as f:
            f.write("ok")
        os.remove(test)
        return _DATA_CANDIDATE
    except OSError:
        return "/tmp"

STATE_PATH = os.path.join(_get_data_dir(), "bandit_state.json")



class EpsilonGreedyBandit:
    """
    Stateful epsilon-greedy bandit with per-batch arm tracking.

    arms: list of discount percentages
    epsilon: exploration probability (0.1 = 10% random exploration)

    Q[batch_key][arm_idx] = estimated average reward
    N[batch_key][arm_idx] = number of pulls for this arm/batch
    """

    def __init__(self, epsilon: float = DEFAULT_EPSILON):
        self.epsilon = epsilon
        self.arms = ARMS
        # Q[batch_key] = list of average rewards per arm
        self.Q: Dict[str, List[float]] = {}
        # N[batch_key] = list of pull counts per arm
        self.N: Dict[str, List[int]] = {}
        self._load_state()

    def _key(self, batch_id: int) -> str:
        return str(batch_id)

    def _ensure_batch(self, batch_id: int):
        k = self._key(batch_id)
        if k not in self.Q:
            self.Q[k] = [0.0] * len(self.arms)
            self.N[k] = [0] * len(self.arms)

    def select_arm(self, batch_id: int, context: Optional[dict] = None) -> int:
        """
        Select an arm index using epsilon-greedy policy.

        context (optional dict) can bias the initial arm choice:
          - days_to_expiry: int
          - current_stock: int
          - velocity: float (units/day)

        Returns: index into ARMS list.
        """
        self._ensure_batch(batch_id)
        k = self._key(batch_id)

        if random.random() < self.epsilon:
            # Explore: choose randomly, but bias towards higher discounts
            # when expiry is very close (context-aware exploration)
            if context:
                days = context.get("days_to_expiry", 7)
                if days <= 1:
                    return random.choice([3, 4])   # 30% or 40%
                elif days <= 3:
                    return random.choice([2, 3, 4])  # 20-40%
                elif days <= 5:
                    return random.choice([1, 2, 3])  # 10-30%
            return random.randint(0, len(self.arms) - 1)

        # Exploit: pick arm with highest estimated Q-value
        return int(np.argmax(self.Q[k]))

    def update(self, batch_id: int, arm_idx: int, reward: float):
        """
        Update the Q-value for a (batch, arm) pair using incremental average.
        reward = units sold at this discount tier since last check.
        """
        self._ensure_batch(batch_id)
        k = self._key(batch_id)
        self.N[k][arm_idx] += 1
        n = self.N[k][arm_idx]
        old_q = self.Q[k][arm_idx]
        self.Q[k][arm_idx] = old_q + (reward - old_q) / n
        self._save_state()

    def get_arm_discount(self, arm_idx: int) -> float:
        return self.arms[arm_idx]

    def _save_state(self):
        os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
        with open(STATE_PATH, "w") as f:
            json.dump({"Q": self.Q, "N": self.N, "epsilon": self.epsilon}, f)

    def _load_state(self):
        if os.path.exists(STATE_PATH):
            try:
                with open(STATE_PATH) as f:
                    data = json.load(f)
                self.Q = data.get("Q", {})
                self.N = data.get("N", {})
                self.epsilon = data.get("epsilon", DEFAULT_EPSILON)
                logger.info("Loaded bandit state from %s", STATE_PATH)
            except Exception as e:
                logger.warning("Failed to load bandit state: %s — starting fresh.", e)

    def simulate_reward(self, discount_pct: float, days_to_expiry: int,
                        velocity: float, current_stock: int) -> float:
        """
        Simulate reward for seeding/testing. Reward = estimated units sold
        at this discount tier before the next check (1 day).
        Higher discount + less time → higher expected sell-through.
        """
        base_rate = velocity  # units/day at full price
        # Demand elasticity: each 10% discount lifts demand by ~15%
        multiplier = 1.0 + (discount_pct / 10) * 0.15
        expected_sold = min(current_stock, base_rate * multiplier)
        # Add a bit of noise
        noise = random.gauss(0, expected_sold * 0.1)
        return max(0.0, expected_sold + noise)


# Singleton instance used by the expiry engine and scheduler
_bandit: Optional[EpsilonGreedyBandit] = None


def get_bandit() -> EpsilonGreedyBandit:
    global _bandit
    if _bandit is None:
        _bandit = EpsilonGreedyBandit()
    return _bandit
