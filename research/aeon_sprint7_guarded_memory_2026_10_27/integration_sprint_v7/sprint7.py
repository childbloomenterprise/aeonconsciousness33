import copy
from collections import deque

import numpy as np

from developmental_v0_2.actors import WARMUP
from integration_sprint_v6.sprint6 import (
    MMAC_CONTEXT_CHANGE_DISTANCE,
    MMAC_MEMORY_MATCH_DISTANCE,
    MMACMemory,
)

FROZEN_N = 1
FROZEN_D = 1
FROZEN_V = 0
DEFAULT_N = FROZEN_N
DEFAULT_D = FROZEN_D
DEFAULT_V = FROZEN_V
MMAC_ERROR_DECAY = 0.9
MMAC_ERROR_RATE = 0.1
RESTORE_ERROR_FACTOR = 1.5


class GuardedMMACMemory(MMACMemory):
    def __init__(self, n=DEFAULT_N, d=DEFAULT_D, v=DEFAULT_V, memory_enabled=True):
        if n < 1 or d < 1 or v < 0:
            raise ValueError("n and d must be positive; v must be nonnegative")
        super().__init__(memory_enabled=memory_enabled)
        self.n = int(n)
        self.d = int(d)
        self.v = int(v)
        self._cue_history = deque(maxlen=self.n)
        self._outside_count = 0
        self._recent_errors = deque(maxlen=self.v)
        self._restore_monitor = None
        self.reverts = 0

    def _effective_cue(self, cue):
        self._cue_history.append(np.asarray(cue, dtype=float).tolist())
        return np.median(np.asarray(self._cue_history, dtype=float), axis=0)

    def _context_changed(self, cue):
        if self.context is None:
            self._outside_count = 0
            return True
        outside = (
            np.linalg.norm(cue - np.asarray(self.context, dtype=float))
            > MMAC_CONTEXT_CHANGE_DISTANCE
        )
        self._outside_count = self._outside_count + 1 if outside else 0
        if self._outside_count < self.d:
            return False
        self._outside_count = 0
        return True

    def _restore_matching_context(self, cue):
        if not self.bank:
            return None
        distances = [
            float(np.linalg.norm(np.asarray(entry["cue"]) - cue)) for entry in self.bank
        ]
        nearest = int(np.argmin(distances))
        if distances[nearest] >= MMAC_MEMORY_MATCH_DISTANCE:
            return None
        if self.bank[nearest].get("skip_once", False):
            self.bank[nearest]["skip_once"] = False
            candidates = [
                index
                for index, distance in enumerate(distances)
                if distance < MMAC_MEMORY_MATCH_DISTANCE
                and index != nearest
                and not self.bank[index].get("skip_once", False)
            ]
            if not candidates:
                return None
            nearest = min(candidates, key=lambda index: distances[index])
        entry = self.bank.pop(nearest)
        self.mmac.delay_error = copy.deepcopy(entry["delay_error"])
        self.bank.append(entry)
        self.restores += 1
        return entry

    def _one_step_error(self, before, obs, previous_body, choice_count):
        if obs.tick < WARMUP or previous_body is None or before is None:
            return None
        if len(self.mmac.delay_choice) == choice_count:
            return None
        squared_errors = np.maximum(
            0.0,
            (self.mmac.delay_error - MMAC_ERROR_DECAY * before) / MMAC_ERROR_RATE,
        )
        selected_delay = self.mmac.delay_choice[-1]
        return float(squared_errors[selected_delay])

    def _check_restore(self, error):
        if error is None:
            return False
        self._recent_errors.append(error)
        monitor = self._restore_monitor
        if monitor is None:
            return False
        monitor["errors"].append(error)
        if len(monitor["errors"]) < self.v:
            return False
        reverted = (
            monitor["baseline_mean"] is not None
            and float(np.mean(monitor["errors"]))
            > RESTORE_ERROR_FACTOR * monitor["baseline_mean"]
        )
        if reverted:
            self.mmac.delay_error = copy.deepcopy(monitor["delay_error"])
            monitor["entry"]["skip_once"] = True
            self.reverts += 1
        self._restore_monitor = None
        return reverted

    def decide(self, obs, cue):
        if not self.memory_enabled:
            return {
                "action": self.mmac.decide(obs),
                "restored": False,
                "bank_size": len(self.bank),
            }

        effective_cue = self._effective_cue(cue)
        restored = False
        if self._context_changed(effective_cue):
            if self.context is not None:
                self._store_context()
            before_restore = copy.deepcopy(self.mmac.delay_error)
            entry = self._restore_matching_context(effective_cue)
            restored = entry is not None
            if restored and self.v:
                previous_errors = list(self._recent_errors)
                baseline_mean = (
                    float(np.mean(previous_errors))
                    if len(previous_errors) == self.v
                    else None
                )
                self._restore_monitor = {
                    "delay_error": before_restore,
                    "entry": entry,
                    "baseline_mean": baseline_mean,
                    "errors": [],
                }
            self.context = effective_cue.tolist()

        before = copy.deepcopy(self.mmac.delay_error) if self.v else None
        previous_body = self.mmac.prev_body
        choice_count = len(self.mmac.delay_choice)
        action = self.mmac.decide(obs)
        if self.v:
            error = self._one_step_error(before, obs, previous_body, choice_count)
            self._check_restore(error)
        return {
            "action": action,
            "restored": restored,
            "bank_size": len(self.bank),
        }
