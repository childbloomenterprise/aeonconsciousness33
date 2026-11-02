"""Self-contained multiple-model adaptive controller for delayed plants.

This is a port of the ``kind='mmac'`` branch of the research baseline
controller used in the sprint-7 study: a warmup excitation phase, least-squares
identification of which measurement channels respond to the actuators, fused
body estimation, a bank of candidate pure delays scored by smoothed one-step
squared prediction error, and a landing choice over a fixed candidate action
set. The adaptive state exposed to :class:`~aeon_modememory.ModeMemory` is the
per-delay error vector, which is what the controller learns online.

The port depends on NumPy only.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from typing import Optional, Union

import numpy as np

WARMUP = 128
DELAYS = range(5)
ERROR_DECAY = 0.9
ERROR_RATE = 0.1
INITIAL_DELAY_ERROR = 0.01
ACTION_COST = 0.002
CANDIDATES = np.array(
    [[0.0, 0.0]]
    + [
        [value if channel == index else 0.0 for channel in range(2)]
        for index in range(2)
        for value in (-1.0, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1.0)
    ]
)

Measurement = Union[float, Mapping[str, float]]


def excitation(tick: int) -> list:
    """Warmup probe sequence that makes the plant identifiable."""
    channel = tick % 2
    amount = (-1.0, -0.5, 0.5, 1.0)[((tick // 2) * 7 + tick // 11) % 4]
    return [amount if index == channel else 0.0 for index in range(2)]


class DelayMMAC:
    """Delay-adaptive controller with a generic ``act`` interface."""

    def __init__(self) -> None:
        self.tick = 0
        self.data: dict = {}
        self.prev_measurement: Optional[dict] = None
        self.prev_target: Optional[float] = None
        self.prev_action: Optional[list] = None
        self.actions: list = []
        self.velocity = 0.0
        self.body = 0.0
        self.prev_body: Optional[float] = None
        self.members: Optional[list] = None
        self.weights: Optional[dict] = None
        self.gains: Optional[np.ndarray] = None
        self.delay_error = np.full(len(DELAYS), INITIAL_DELAY_ERROR)
        self.delay_choice: list = []

    def get_adaptive_state(self) -> list:
        """Return the online-adapted per-delay error vector."""
        return [float(value) for value in self.delay_error]

    def set_adaptive_state(self, state: Sequence[float]) -> None:
        """Replace the per-delay error vector."""
        values = np.asarray(state, dtype=float)
        if values.shape != self.delay_error.shape:
            raise ValueError("adaptive state must have one entry per candidate delay")
        self.delay_error = values.copy()

    @staticmethod
    def _channels(measurement: Measurement) -> dict:
        if isinstance(measurement, Mapping):
            return {key: float(value) for key, value in measurement.items()}
        return {"measurement": float(measurement)}

    def identify(self) -> None:
        fits = {}
        for channel, rows in self.data.items():
            if len(rows) < 20:
                continue
            design = np.array([[1.0, action[0], action[1]] for action, _ in rows])
            response = np.array([delta for _, delta in rows])
            coefficients, *_ = np.linalg.lstsq(design, response, rcond=None)
            residual = response - design @ coefficients
            fits[channel] = (coefficients[1:], float(np.var(residual)) + 1e-12)
        score = {
            channel: np.linalg.norm(gain) / math.sqrt(variance)
            for channel, (gain, variance) in fits.items()
        }
        self.members = sorted(score, key=score.get, reverse=True)[:2]
        inverse = {channel: 1 / fits[channel][1] for channel in self.members}
        total = sum(inverse.values())
        self.weights = {channel: value / total for channel, value in inverse.items()}
        self.gains = sum(
            self.weights[channel] * fits[channel][0] for channel in self.members
        )

    def estimate(self, channels: Mapping[str, float]) -> float:
        available = [channel for channel in self.members if channel in channels]
        if not available:
            return self.body
        weight = sum(self.weights[channel] for channel in available)
        return (
            sum(self.weights[channel] * channels[channel] for channel in available)
            / weight
        )

    def past(self, lag: int) -> np.ndarray:
        index = len(self.actions) - lag
        return np.array(self.actions[index]) if index >= 0 else np.zeros(2)

    def landing_choice(self, gains: np.ndarray, delay: int, target: float):
        queued = sum((gains @ self.past(lag) for lag in range(1, delay + 1)), 0.0)
        goal = target + self.velocity * (delay + 1)
        predicted = self.body + queued + CANDIDATES @ gains
        scores = (predicted - goal) ** 2 + ACTION_COST * np.sum(CANDIDATES**2, axis=1)
        return CANDIDATES[int(np.argmin(scores))]

    def act(self, measurement: Measurement, target: float) -> list:
        """Consume one tick of plant feedback and return the next action."""
        channels = self._channels(measurement)
        target = float(target)
        tick = self.tick
        if self.prev_measurement is not None:
            self.velocity = float(
                np.clip(
                    0.5 * self.velocity + 0.5 * (target - self.prev_target),
                    -0.1,
                    0.1,
                )
            )
            if tick <= WARMUP:
                for channel in channels.keys() & self.prev_measurement.keys():
                    self.data.setdefault(channel, []).append(
                        (
                            self.prev_action,
                            channels[channel] - self.prev_measurement[channel],
                        )
                    )
        if tick == WARMUP:
            self.identify()
        if tick < WARMUP:
            action = np.array(excitation(tick))
        else:
            self.body = self.estimate(channels)
            if self.prev_body is not None:
                delta = self.body - self.prev_body
                for delay in DELAYS:
                    predicted = float(self.gains @ self.past(delay + 1))
                    self.delay_error[delay] = (
                        ERROR_DECAY * self.delay_error[delay]
                        + ERROR_RATE * (delta - predicted) ** 2
                    )
            delay = int(np.argmin(self.delay_error))
            self.delay_choice.append(delay)
            action = self.landing_choice(self.gains, delay, target)
            self.prev_body = self.body
        self.prev_measurement = channels
        self.prev_target = target
        self.prev_action = list(map(float, action))
        self.actions.append(self.prev_action)
        self.tick = tick + 1
        return self.prev_action
