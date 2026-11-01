"""Hybrid fixes for executed-action learning and dropout-safe fallback."""

from collections import deque

import numpy as np

from developmental_v0_2.actors import WARMUP
from integration_sprint_v2 import sprint2
from integration_sprint_v3.sprint3 import (
    DETECTOR_HAZARD_LAMBDA as V3_DETECTOR_HAZARD_LAMBDA,
)
from integration_sprint_v3.sprint3 import DETECTOR_LAG as V3_DETECTOR_LAG
from integration_sprint_v3.sprint3 import DETECTOR_SIGNAL as V3_DETECTOR_SIGNAL
from integration_sprint_v3.sprint3 import (
    DETECTOR_THRESHOLD as V3_DETECTOR_THRESHOLD,
)
from integration_sprint_v3.sprint3 import (
    RETRIEVAL_IMPROVEMENT as V3_RETRIEVAL_IMPROVEMENT,
)
from integration_sprint_v3.sprint3 import V3Actor, V3Hybrid
from integration_sprint_v4.sprint4 import (
    DETECTOR_COMBINE as V4_DETECTOR_COMBINE,
)
from integration_sprint_v4.sprint4 import (
    DETECTOR_HAZARD_LAMBDA as V4_DETECTOR_HAZARD_LAMBDA,
)
from integration_sprint_v4.sprint4 import DETECTOR_LAG as V4_DETECTOR_LAG
from integration_sprint_v4.sprint4 import DETECTOR_SIGNAL as V4_DETECTOR_SIGNAL
from integration_sprint_v4.sprint4 import (
    DETECTOR_THRESHOLD as V4_DETECTOR_THRESHOLD,
)
from integration_sprint_v4.sprint4 import MULTISTEP_LAG, V4Hybrid
from integration_sprint_v4.sprint4 import RETRIEVAL_MARGIN as V4_RETRIEVAL_MARGIN

V3_FIXED_FALLBACK_FLOOR = 0.3
V3_FIXED_FALLBACK_MULTIPLIER = 3.0
V4_FIXED_FALLBACK_K = 3.0


def _replace_pending_with_executed_action(actor, obs, executed_action):
    before = actor.pending[0]
    action = np.asarray(executed_action, dtype=float)
    x = sprint2.features(action, actor.history)
    predicted = {
        sensor: float(x @ model.w)
        for sensor, model in actor.models.items()
        if sensor in obs.signals
    }
    actor.pending = (before, action.tolist(), x, predicted)


class V3HybridFixed(V3Hybrid):
    """V3 hybrid that learns from the action actually executed by MMAC."""

    def __init__(
        self,
        hazard_lambda=V3_DETECTOR_HAZARD_LAMBDA,
        lag=V3_DETECTOR_LAG,
        threshold=V3_DETECTOR_THRESHOLD,
        max_run_length=300,
        detector_signal=V3_DETECTOR_SIGNAL,
        retrieval_margin=V3_RETRIEVAL_IMPROVEMENT,
        fallback_enabled=True,
        fallback_floor=V3_FIXED_FALLBACK_FLOOR,
        fallback_multiplier=V3_FIXED_FALLBACK_MULTIPLIER,
    ):
        super().__init__(
            hazard_lambda=hazard_lambda,
            lag=lag,
            threshold=threshold,
            max_run_length=max_run_length,
            detector_signal=detector_signal,
            retrieval_margin=retrieval_margin,
            fallback_enabled=fallback_enabled,
            fallback_floor=fallback_floor,
            fallback_multiplier=fallback_multiplier,
        )

    def decide(self, obs, cue=None):
        result = super().decide(obs, cue)
        if result["fallback"]:
            _replace_pending_with_executed_action(self, obs, result["action"])
        return result


class V4HybridFixed(V4Hybrid):
    """V4 hybrid with executed-action learning and dropout-safe hysteresis."""

    def __init__(
        self,
        hazard_lambda=V4_DETECTOR_HAZARD_LAMBDA,
        threshold=V4_DETECTOR_THRESHOLD,
        detector_signal=V4_DETECTOR_SIGNAL,
        combine=V4_DETECTOR_COMBINE,
        lag=V4_DETECTOR_LAG,
        retrieval_margin=V4_RETRIEVAL_MARGIN,
        fallback_enabled=True,
        fallback_k=V4_FIXED_FALLBACK_K,
    ):
        super().__init__(
            hazard_lambda=hazard_lambda,
            threshold=threshold,
            detector_signal=detector_signal,
            combine=combine,
            lag=lag,
            retrieval_margin=retrieval_margin,
            fallback_enabled=fallback_enabled,
            fallback_k=fallback_k,
        )

    def _update_fallback_state(self, tick):
        if not self.fallback_enabled or tick < WARMUP:
            return False
        if (
            not self._locked_residual_history
            or self._latest_locked_error_tick is None
            or self._latest_locked_error_tick == self._last_fallback_evaluation_tick
        ):
            return self.fallback_active
        return super()._update_fallback_state(tick)

    def decide(self, obs, cue=None):
        mmac_action = self.mmac.decide(obs)
        fallback = self._update_fallback_state(obs.tick)
        result = V3Actor.decide(self, obs, cue)
        if fallback:
            result["action"] = mmac_action
            self.fallback_ticks.append(obs.tick)
            _replace_pending_with_executed_action(self, obs, result["action"])
        self._record_multistep_prediction(obs, result)
        result["fallback"] = fallback
        return result

    def _record_multistep_prediction(self, obs, result):
        if self.v4_detector_signal != "multistep":
            return

        action = np.asarray(result["action"], dtype=float).tolist()
        for forecast in self._multistep_pending:
            expected_tick = forecast["start_tick"] + len(forecast["actions"])
            if len(forecast["actions"]) < MULTISTEP_LAG and obs.tick == expected_tick:
                forecast["actions"].append(action.copy())

        sensor = self.locked
        if sensor is None or sensor not in obs.signals or sensor not in self.models:
            return
        self._multistep_pending.append(
            {
                "start_tick": obs.tick,
                "due_tick": obs.tick + MULTISTEP_LAG,
                "sensor": sensor,
                "start_value": float(obs.signals[sensor]),
                "history": [list(item) for item in self.history],
                "weights": self.models[sensor].w.copy(),
                "actions": [action],
            }
        )

    @staticmethod
    def _rollout_executed_actions(forecast):
        history = [list(item) for item in forecast["history"]]
        total = 0.0
        for action in forecast["actions"]:
            action_array = np.asarray(action, dtype=float)
            x = sprint2.features(action_array, history)
            total += float(np.clip(x @ forecast["weights"], -0.6, 0.6))
            history.append(action_array.tolist())
            history = history[-sprint2.LAGS :]
        return total

    def _multistep_values(self, after):
        ready = []
        pending = deque()
        while self._multistep_pending:
            forecast = self._multistep_pending.popleft()
            due_tick = forecast["due_tick"]
            sensor = forecast["sensor"]
            if due_tick <= after.tick:
                if (
                    due_tick == after.tick
                    and sensor in after.signals
                    and len(forecast["actions"]) == MULTISTEP_LAG
                ):
                    prediction = self._rollout_executed_actions(forecast)
                    realized = float(after.signals[sensor]) - forecast["start_value"]
                    value = realized - prediction
                    ready.append((after.tick, value))
                    self.multistep_signals.append(
                        {
                            "tick": after.tick,
                            "sensor": sensor,
                            "realized": realized,
                            "predicted": prediction,
                            "signal": value,
                            "actions": [list(action) for action in forecast["actions"]],
                        }
                    )
                    self.multistep_signals = self.multistep_signals[-64:]
            else:
                pending.append(forecast)
        self._multistep_pending = pending
        return ready
