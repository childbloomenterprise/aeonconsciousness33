"""Controller-agnostic per-mode memory of a controller's adaptive state.

A controller that adapts online relearns from scratch every time the plant
returns to a mode it has already seen. ``ModeMemory`` keeps one snapshot of the
controller's adaptive state per mode and restores it on return, so the
controller resumes instead of relearning.

The change-detection rule is the one evaluated in the sprint-7 study: a mode
change counts only after the mode signal has stayed away from the current mode
for ``debounce`` consecutive ticks, which keeps a noisy mode signal from
triggering a wrong restore.
"""

from __future__ import annotations

import copy
import json
from collections.abc import Mapping, Sequence
from typing import Any, Optional

import numpy as np

DEFAULT_CAPACITY = 6
DEFAULT_DEBOUNCE = 3
DEFAULT_CHANGE_DISTANCE = 0.3
DEFAULT_MATCH_DISTANCE = 0.2


class ModeMemory:
    """Bank of per-mode controller states with debounced change detection.

    The controller must expose ``get_adaptive_state()`` and
    ``set_adaptive_state(state)``. Call :meth:`step` once per control tick,
    before the controller computes its action.
    """

    def __init__(
        self,
        capacity: int = DEFAULT_CAPACITY,
        debounce: int = DEFAULT_DEBOUNCE,
        change_distance: float = DEFAULT_CHANGE_DISTANCE,
        match_distance: float = DEFAULT_MATCH_DISTANCE,
    ) -> None:
        if capacity < 1:
            raise ValueError("capacity must be positive")
        if debounce < 1:
            raise ValueError("debounce must be positive")
        if change_distance < 0.0 or match_distance < 0.0:
            raise ValueError("distances must be nonnegative")
        self.capacity = int(capacity)
        self.debounce = int(debounce)
        self.change_distance = float(change_distance)
        self.match_distance = float(match_distance)
        self.bank: list = []
        self.mode: Optional[Any] = None
        self.restores = 0
        self.changes = 0
        self._outside_count = 0
        self._pending_mode = None

    @staticmethod
    def _is_vector(mode: Any) -> bool:
        return isinstance(mode, (list, tuple, np.ndarray))

    @staticmethod
    def _as_vector(mode: Any) -> np.ndarray:
        return np.asarray(mode, dtype=float)

    def _distance(self, left: Any, right: Any) -> float:
        if self._is_vector(left) or self._is_vector(right):
            return float(np.linalg.norm(self._as_vector(left) - self._as_vector(right)))
        return 0.0 if left == right else float("inf")

    def _mode_changed(self, mode: Any) -> bool:
        if self.mode is None:
            self._outside_count = 0
            self._pending_mode = None
            return True
        if not self._is_vector(mode) and not self._is_vector(self.mode):
            if mode == self.mode:
                self._outside_count = 0
                self._pending_mode = None
                return False
            if self._pending_mode != mode:
                self._pending_mode = copy.deepcopy(mode)
                self._outside_count = 1
            else:
                self._outside_count += 1
            if self._outside_count < self.debounce:
                return False
            self._outside_count = 0
            self._pending_mode = None
            return True
        outside = self._distance(mode, self.mode) > self.change_distance
        self._outside_count = self._outside_count + 1 if outside else 0
        if self._outside_count < self.debounce:
            if not outside:
                self._pending_mode = None
            return False
        self._outside_count = 0
        self._pending_mode = None
        return True

    def _store(self, mode: Any, state: Any) -> None:
        entry = {"mode": copy.deepcopy(mode), "state": copy.deepcopy(state)}
        duplicate = next(
            (
                index
                for index, old in enumerate(self.bank)
                if self._distance(old["mode"], mode) < self.match_distance
            ),
            None,
        )
        if duplicate is not None:
            self.bank.pop(duplicate)
        elif len(self.bank) >= self.capacity:
            self.bank.pop(0)
        self.bank.append(entry)

    def _restore(self, mode: Any, controller: Any) -> bool:
        if not self.bank:
            return False
        distances = [self._distance(entry["mode"], mode) for entry in self.bank]
        nearest = int(np.argmin(distances))
        if distances[nearest] >= self.match_distance:
            return False
        entry = self.bank.pop(nearest)
        controller.set_adaptive_state(copy.deepcopy(entry["state"]))
        self.bank.append(entry)
        self.restores += 1
        return True

    def step(self, mode: Any, controller: Any) -> bool:
        """Account for this tick's mode signal; return True on a restore."""
        if not self._mode_changed(mode):
            return False
        self.changes += 1
        if self.mode is not None:
            self._store(self.mode, controller.get_adaptive_state())
        restored = self._restore(mode, controller)
        self.mode = self._as_vector(mode).tolist() if self._is_vector(mode) else mode
        return restored

    def save(self, path) -> None:
        """Write the bank and detection state to ``path`` as JSON."""
        payload = {
            "version": 1,
            "capacity": self.capacity,
            "debounce": self.debounce,
            "change_distance": self.change_distance,
            "match_distance": self.match_distance,
            "mode": self.mode,
            "outside_count": self._outside_count,
            "pending_mode": self._pending_mode,
            "restores": self.restores,
            "changes": self.changes,
            "bank": [
                {"mode": entry["mode"], "state": _to_json(entry["state"])}
                for entry in self.bank
            ],
        }
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle)

    @classmethod
    def load(cls, path) -> ModeMemory:
        """Create a memory instance from a JSON file."""
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if payload.get("version") != 1:
            raise ValueError("unsupported ModeMemory save format")
        memory = cls(
            capacity=int(payload["capacity"]),
            debounce=int(payload["debounce"]),
            change_distance=float(payload["change_distance"]),
            match_distance=float(payload["match_distance"]),
        )
        memory.mode = payload["mode"]
        memory._outside_count = int(payload["outside_count"])
        memory._pending_mode = payload["pending_mode"]
        memory.restores = int(payload["restores"])
        memory.changes = int(payload["changes"])
        memory.bank = [
            {"mode": entry["mode"], "state": entry["state"]}
            for entry in payload["bank"]
        ]
        return memory


def _to_json(state: Any) -> Any:
    if isinstance(state, np.generic):
        return state.item()
    if isinstance(state, np.ndarray):
        return state.tolist()
    if isinstance(state, Mapping):
        return {key: _to_json(value) for key, value in state.items()}
    if isinstance(state, Sequence) and not isinstance(state, (str, bytes)):
        return [_to_json(value) for value in state]
    return state
