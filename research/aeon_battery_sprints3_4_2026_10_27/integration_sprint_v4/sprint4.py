"""V4 detection signals and hysteretic model-error fallback."""

import copy
import math
from collections import deque

import numpy as np

from developmental_v0_2.actors import WARMUP, Regression
from integration_sprint_v2 import sprint2
from integration_sprint_v3.bocpd import BOCPD
from integration_sprint_v3.sprint3 import (
    DETECTOR_SIGNAL as V3_DETECTOR_SIGNAL,
)
from integration_sprint_v3.sprint3 import (
    V3Actor,
    V3Hybrid,
)

DETECTOR_SIGNAL = "member_standardized"
DETECTOR_COMBINE = "single"
DETECTOR_HAZARD_LAMBDA = 100
DETECTOR_THRESHOLD = 0.3
DETECTOR_LAG = 8
RETRIEVAL_MARGIN = 0.8
FALLBACK_K = 3.0
MULTISTEP_LAG = 5
DETECTOR_SIGNALS = ("locked_signed", "member_standardized", "multistep")
DETECTOR_COMBINATIONS = (
    ("locked_signed", "single"),
    ("member_standardized", "single"),
    ("member_standardized", "per_sensor_or"),
    ("multistep", "single"),
)


class _V4Core:
    def _initialize_v4(
        self,
        hazard_lambda,
        threshold,
        detector_signal,
        combine,
        lag,
    ):
        if detector_signal not in DETECTOR_SIGNALS:
            raise ValueError(f"Unknown V4 detector signal: {detector_signal}")
        if combine not in ("single", "per_sensor_or"):
            raise ValueError(f"Unknown detector combination: {combine}")
        if combine == "per_sensor_or" and detector_signal != "member_standardized":
            raise ValueError("per_sensor_or is only available for member_standardized")
        self.v4_detector_signal = detector_signal
        self.v4_combine = combine
        self.v4_threshold = threshold
        self.v4_hazard_lambda = hazard_lambda
        self.v4_lag = lag
        self.v4_single_detector = BOCPD(hazard_lambda, lag=lag)
        self.v4_sensor_detectors = {}
        self._multistep_pending = deque()
        self.multistep_signals = []
        self.v4_detector_probabilities = {}

    def _predict_multistep(self, action):
        sensor = self.locked
        if sensor is None or sensor not in self.models:
            return None
        history = [list(item) for item in self.history]
        model = self.models[sensor]
        total = 0.0
        zero = np.zeros(2)
        for step in range(MULTISTEP_LAG):
            action_at_step = np.asarray(action, dtype=float) if step == 0 else zero
            x = sprint2.features(action_at_step, history)
            total += float(np.clip(x @ model.w, -0.6, 0.6))
            history.append(action_at_step.tolist())
            history = history[-sprint2.LAGS :]
        return total

    def _record_multistep_prediction(self, obs, result):
        if self.v4_detector_signal != "multistep":
            return
        sensor = self.locked
        if sensor is None or sensor not in obs.signals:
            return
        prediction = self._predict_multistep(result["action"])
        if prediction is None:
            return
        self._multistep_pending.append(
            (
                obs.tick + MULTISTEP_LAG,
                sensor,
                float(obs.signals[sensor]),
                prediction,
            )
        )

    def _multistep_values(self, after):
        ready = []
        pending = deque()
        while self._multistep_pending:
            due, sensor, start, prediction = self._multistep_pending.popleft()
            if due <= after.tick:
                if due == after.tick and sensor in after.signals:
                    realized = float(after.signals[sensor]) - start
                    value = realized - prediction
                    ready.append((after.tick, value))
                    self.multistep_signals.append(
                        {
                            "tick": after.tick,
                            "sensor": sensor,
                            "realized": realized,
                            "predicted": prediction,
                            "signal": value,
                        }
                    )
                    self.multistep_signals = self.multistep_signals[-64:]
            else:
                pending.append((due, sensor, start, prediction))
        self._multistep_pending = pending
        return ready

    def _standardized_components(self, residuals):
        components = {}
        for sensor in self.members:
            if sensor not in residuals or sensor not in self.models:
                continue
            error = max(float(self.models[sensor].error), 0.0)
            components[sensor] = float(residuals[sensor]) / math.sqrt(error + 1e-6)
        return components

    def _signals_for_tick(self, residuals, after):
        if self.v4_detector_signal == "multistep":
            return self._multistep_values(after)
        if self.v4_detector_signal == "locked_signed":
            if self.locked in residuals:
                return [(after.tick - 1, float(residuals[self.locked]))]
            return []

        components = self._standardized_components(residuals)
        if self.v4_combine == "per_sensor_or":
            return [
                (after.tick - 1, value, sensor) for sensor, value in components.items()
            ]
        if not components:
            return []
        return [(after.tick - 1, float(sum(components.values())))]

    def _v4_detector_update(self, residuals, after, tick):
        signals = self._signals_for_tick(residuals, after)
        probabilities = []
        if self.v4_combine == "per_sensor_or":
            for _, value, sensor in signals:
                detector = self.v4_sensor_detectors.setdefault(
                    sensor, BOCPD(self.v4_hazard_lambda, lag=self.v4_lag)
                )
                probabilities.append((sensor, detector.update(value)))
        else:
            for _, value in signals:
                probabilities.append((None, self.v4_single_detector.update(value)))

        self.v4_detector_probabilities = dict(probabilities)
        probability = max((value for _, value in probabilities), default=0.0)
        self.detector_probability = probability
        if (
            probabilities
            and tick >= WARMUP + 16
            and probability > self.v4_threshold
            and tick - self.last_declaration >= 48
        ):
            self._declare_change(tick)


class V4Actor(_V4Core, V3Actor):
    """V3 memory actor with V4 residual, standardized, or multistep detection."""

    def __init__(
        self,
        hazard_lambda=DETECTOR_HAZARD_LAMBDA,
        threshold=DETECTOR_THRESHOLD,
        detector_signal=DETECTOR_SIGNAL,
        combine=DETECTOR_COMBINE,
        lag=DETECTOR_LAG,
        retrieval_margin=RETRIEVAL_MARGIN,
    ):
        super().__init__(
            hazard_lambda=hazard_lambda,
            lag=lag,
            threshold=2.0,
            detector_signal=V3_DETECTOR_SIGNAL,
            retrieval_margin=retrieval_margin,
        )
        self._initialize_v4(hazard_lambda, threshold, detector_signal, combine, lag)

    def decide(self, obs, cue=None):
        result = V3Actor.decide(self, obs, cue)
        self._record_multistep_prediction(obs, result)
        return result

    def learn(self, after):
        before = self.pending[0]
        tick = before.tick
        residuals = V3Actor.learn(self, after)
        self._v4_detector_update(residuals, after, tick)
        return residuals


class V4Hybrid(_V4Core, V3Hybrid):
    """V4 memory actor with model-error-triggered MMAC fallback."""

    def __init__(
        self,
        hazard_lambda=DETECTOR_HAZARD_LAMBDA,
        threshold=DETECTOR_THRESHOLD,
        detector_signal=DETECTOR_SIGNAL,
        combine=DETECTOR_COMBINE,
        lag=DETECTOR_LAG,
        retrieval_margin=RETRIEVAL_MARGIN,
        fallback_enabled=True,
        fallback_k=FALLBACK_K,
    ):
        super().__init__(
            hazard_lambda=hazard_lambda,
            lag=lag,
            threshold=2.0,
            detector_signal=V3_DETECTOR_SIGNAL,
            retrieval_margin=retrieval_margin,
            fallback_enabled=False,
        )
        self._initialize_v4(hazard_lambda, threshold, detector_signal, combine, lag)
        self.fallback_enabled = fallback_enabled
        self.fallback_k = fallback_k
        self.fallback_active = False
        self.fallback_recovery_ticks = 0
        self._locked_residual_history = deque(maxlen=256)
        self._locked_residual_window = deque(maxlen=16)
        self._latest_locked_error_tick = None
        self._last_fallback_evaluation_tick = None
        self._model_error_history = {}

    def _record_model_errors(self, tick, residuals):
        if tick < WARMUP:
            return
        if self.locked in residuals:
            value = float(residuals[self.locked]) ** 2
            self._locked_residual_history.append(value)
            self._locked_residual_window.append(value)
            self._latest_locked_error_tick = tick
        for sensor, model in self.models.items():
            history = self._model_error_history.setdefault(sensor, deque(maxlen=256))
            history.append(float(model.error))

    def _restore_diverged_models(self, trigger_tick):
        snapshots = [
            snapshot for snapshot in self.snapshots if snapshot[0] < trigger_tick
        ]
        if not snapshots:
            return []
        snapshot = snapshots[-1][1]
        restored = []
        for sensor, model in list(self.models.items()):
            history = self._model_error_history.get(sensor)
            if not history or sensor not in snapshot:
                continue
            median = float(np.median(history))
            if float(model.error) > 10.0 * median:
                self.models[sensor] = Regression.restore(
                    copy.deepcopy(snapshot[sensor])
                )
                restored.append(sensor)
        return restored

    def _update_fallback_state(self, tick):
        if not self.fallback_enabled or tick < WARMUP:
            return False
        if (
            not self._locked_residual_history
            or self._latest_locked_error_tick is None
            or self._latest_locked_error_tick == self._last_fallback_evaluation_tick
        ):
            return False
        self._last_fallback_evaluation_tick = self._latest_locked_error_tick

        median = float(np.median(self._locked_residual_history))
        rolling_mean = (
            float(np.mean(self._locked_residual_window))
            if self._locked_residual_window
            else math.inf
        )
        if self.fallback_active:
            if len(self._locked_residual_window) == 16 and rolling_mean < 1.5 * median:
                self.fallback_recovery_ticks += 1
            else:
                self.fallback_recovery_ticks = 0
            if self.fallback_recovery_ticks >= 16:
                self.fallback_active = False
                self.fallback_recovery_ticks = 0
            return self.fallback_active

        if (
            len(self._locked_residual_window) == 16
            and rolling_mean > self.fallback_k * median
            and rolling_mean > 1e-4
        ):
            self.fallback_active = True
            self.fallback_recovery_ticks = 0
            self._restore_diverged_models(tick)
        return self.fallback_active

    def decide(self, obs, cue=None):
        mmac_action = self.mmac.decide(obs)
        fallback = self._update_fallback_state(obs.tick)
        result = V3Actor.decide(self, obs, cue)
        self._record_multistep_prediction(obs, result)
        if fallback:
            result["action"] = mmac_action
            self.fallback_ticks.append(obs.tick)
        result["fallback"] = fallback
        return result

    def learn(self, after):
        before = self.pending[0]
        tick = before.tick
        residuals = V3Actor.learn(self, after)
        self._v4_detector_update(residuals, after, tick)
        self._record_model_errors(tick, residuals)
        return residuals
