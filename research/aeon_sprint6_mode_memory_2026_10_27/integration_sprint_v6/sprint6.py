import copy

import numpy as np

from baseline_benchmark.benchmark import Controller
from battery.battery import PID
from integration_sprint import sprint
from integration_sprint_v2 import sprint2
from integration_sprint_v5.sprint5 import _replace_pending_with_executed_action

sprint2.install()

DEFAULT_CUED_SWITCH_WINDOW = 40
MMAC_MEMORY_CAPACITY = 6
MMAC_CONTEXT_CHANGE_DISTANCE = 0.3
MMAC_MEMORY_MATCH_DISTANCE = 0.2


class CuedSwitch:
    def __init__(self, window=DEFAULT_CUED_SWITCH_WINDOW):
        if window < 0:
            raise ValueError("window must be nonnegative")
        self.window = int(window)
        self.mmac = Controller("mmac", PID, None)
        self.aeon = sprint.IntegratedActor("integrated")
        self.aeon_remaining = 0
        self.retrievals = 0
        self.aeon_ticks = 0

    def decide(self, obs, cue):
        mmac_action = self.mmac.decide(obs)
        aeon_decision = self.aeon.decide(obs, cue)
        retrieved = bool(aeon_decision["retrieved"])

        if retrieved:
            self.retrievals += 1
            self.aeon_remaining = self.window

        use_aeon = self.aeon_remaining > 0
        if use_aeon:
            action = aeon_decision["action"]
            self.aeon_remaining -= 1
            self.aeon_ticks += 1
            controller = "aeon"
        else:
            action = mmac_action
            _replace_pending_with_executed_action(self.aeon, obs, action)
            controller = "mmac"

        return {
            **aeon_decision,
            "action": action,
            "controller": controller,
            "aeon_ticks_remaining": self.aeon_remaining,
        }

    def learn(self, after):
        return self.aeon.learn(after)


class MMACMemory:
    def __init__(self, memory_enabled=True):
        self.mmac = Controller("mmac", PID, None)
        self.memory_enabled = memory_enabled
        self.context = None
        self.bank = []
        self.restores = 0

    def _store_context(self):
        entry = {
            "cue": copy.deepcopy(self.context),
            "delay_error": copy.deepcopy(self.mmac.delay_error),
        }
        duplicate = next(
            (
                index
                for index, old in enumerate(self.bank)
                if np.linalg.norm(np.asarray(old["cue"]) - entry["cue"])
                < MMAC_MEMORY_MATCH_DISTANCE
            ),
            None,
        )
        if duplicate is not None:
            self.bank.pop(duplicate)
        elif len(self.bank) >= MMAC_MEMORY_CAPACITY:
            self.bank.pop(0)
        self.bank.append(entry)

    def _restore_context(self, cue):
        if not self.bank:
            return False
        distances = [
            float(np.linalg.norm(np.asarray(entry["cue"]) - cue)) for entry in self.bank
        ]
        nearest = int(np.argmin(distances))
        if distances[nearest] >= MMAC_MEMORY_MATCH_DISTANCE:
            return False
        entry = self.bank.pop(nearest)
        self.mmac.delay_error = copy.deepcopy(entry["delay_error"])
        self.bank.append(entry)
        self.restores += 1
        return True

    def decide(self, obs, cue):
        restored = False
        if self.memory_enabled:
            cue = np.asarray(cue, dtype=float)
            changed = self.context is None or (
                np.linalg.norm(cue - self.context) > MMAC_CONTEXT_CHANGE_DISTANCE
            )
            if changed:
                if self.context is not None:
                    self._store_context()
                restored = self._restore_context(cue)
                self.context = cue.tolist()
        return {
            "action": self.mmac.decide(obs),
            "restored": restored,
            "bank_size": len(self.bank),
        }
