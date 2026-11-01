"""Cue-free changepoint memory and MMAC safety fallback for sprint 2."""

import copy
import math
from collections import deque

import numpy as np

from integration_sprint_v2 import sprint2

sprint2.install()

from baseline_benchmark.benchmark import Controller
from battery.battery import PID
from developmental_v0_2.actors import WARMUP, Regression

from .bocpd import BOCPD

DETECTOR_HAZARD_LAMBDA = 100
DETECTOR_LAG = 8
DETECTOR_THRESHOLD = 0.3
DETECTOR_SIGNAL = "locked_sensor_signed_residual"
DETECTOR_SIGNALS = (
    "current_log_residual_squared",
    "rolling_log_residual_squared",
    "locked_sensor_signed_residual",
)
SNAPSHOT_INTERVAL = 8
SNAPSHOT_CAPACITY = 8
BANK_CAPACITY = 6
RETRIEVAL_BUFFER_SIZE = 12
RETRIEVAL_IMPROVEMENT = 0.8
FALLBACK_ABS_FLOOR = 0.1
FALLBACK_MULTIPLIER = 3.0


class V3Actor(sprint2.LandingActor):
    """Sprint-2 landing planner with cue-free, fit-based context retrieval."""

    def __init__(
        self,
        hazard_lambda=DETECTOR_HAZARD_LAMBDA,
        lag=DETECTOR_LAG,
        threshold=DETECTOR_THRESHOLD,
        max_run_length=300,
        detector_signal=DETECTOR_SIGNAL,
        retrieval_margin=RETRIEVAL_IMPROVEMENT,
    ):
        super().__init__("adaptive_baseline")
        self.calibration = []
        self.hazard_lambda = hazard_lambda
        self.lag = lag
        self.threshold = threshold
        if detector_signal not in DETECTOR_SIGNALS:
            raise ValueError(f"Unknown detector signal: {detector_signal}")
        self.detector_signal = detector_signal
        self.retrieval_margin = retrieval_margin
        self.detector = BOCPD(hazard_lambda, lag=lag, max_run_length=max_run_length)
        self.detector_probability = 0.0
        self.residual_energy_window = deque(maxlen=8)
        self.snapshots = deque(maxlen=SNAPSHOT_CAPACITY)
        self.bank = []
        self.declarations = []
        self.recalls = []
        self.retrieval_attempts = 0
        self.retrieval_restored = 0
        self.last_declaration = -48
        self._retrieval_buffer = None
        self._retrieved_next = False

    def decide(self, obs, cue=None):
        if obs.tick < WARMUP:
            self.calibration.append(dict(obs.signals))
        result = super().decide(obs)
        result["retrieved"] = self._retrieved_next
        self._retrieved_next = False
        return result

    def establish_members(self, target):
        super().establish_members(target)
        sensors = [sensor for sensor in self.models if sensor != target]
        pairs = []
        for index, first in enumerate(sensors):
            for second in sensors[index + 1 :]:
                rows = [
                    (row[first], row[second])
                    for row in self.calibration
                    if first in row and second in row
                ]
                x, y = np.array(rows).T
                agreement = float(np.sqrt(np.mean((x - y) ** 2)))
                if agreement < 0.06:
                    pairs.append((agreement, first, second))
        if pairs:
            _, first, second = min(pairs)
            self.members = [first, second]
            self.locked = min(
                self.members, key=lambda sensor: self.models[sensor].error
            )
        self.calibration = []

    @staticmethod
    def _copy_models(models):
        return {
            sensor: copy.deepcopy(model.state()) for sensor, model in models.items()
        }

    def _save_snapshot(self, tick):
        if (tick + 1) % SNAPSHOT_INTERVAL == 0:
            self.snapshots.append((tick, self._copy_models(self.models)))

    def _store_context(self, models, tick):
        new_entry = {"tick": tick, "models": copy.deepcopy(models)}
        new_weights = {
            sensor: np.asarray(state["w"], dtype=float)
            for sensor, state in models.items()
        }
        for index, entry in enumerate(self.bank):
            old_models = entry["models"]
            shared = new_weights.keys() & old_models.keys()
            if not shared:
                continue
            ratios = [
                np.linalg.norm(
                    new_weights[sensor]
                    - np.asarray(old_models[sensor]["w"], dtype=float)
                )
                / (
                    np.linalg.norm(np.asarray(old_models[sensor]["w"], dtype=float))
                    + 1e-9
                )
                for sensor in shared
            ]
            if float(np.mean(ratios)) < 0.25:
                self.bank.pop(index)
                self.bank.append(new_entry)
                return len(self.bank) - 1

        self.bank.append(new_entry)
        if len(self.bank) > BANK_CAPACITY:
            self.bank.pop(0)
        return len(self.bank) - 1

    def _departing_context(self, tick):
        cutoff = tick - self.lag - 16
        eligible = [snapshot for snapshot in self.snapshots if snapshot[0] <= cutoff]
        return eligible[-1] if eligible else None

    def _score_models(self, models, samples):
        squared_errors = []
        for x, changes in samples:
            for sensor, delta in changes.items():
                state = models.get(sensor)
                if state is None:
                    continue
                weights = np.asarray(
                    state["w"] if isinstance(state, dict) else state.w,
                    dtype=float,
                )
                squared_errors.append(float((float(x @ weights) - delta) ** 2))
        return float(np.mean(squared_errors)) if squared_errors else math.inf

    def _detector_input(self, residuals):
        values = np.asarray(list(residuals.values()), dtype=float)
        residual_energy = float(np.mean(values * values))
        self.residual_energy_window.append(residual_energy)
        if self.detector_signal == "current_log_residual_squared":
            return math.log(1e-6 + residual_energy)
        if self.detector_signal == "rolling_log_residual_squared":
            rolling_energy = float(np.mean(self.residual_energy_window))
            return math.log(1e-6 + rolling_energy)
        return float(residuals.get(self.locked, np.mean(values)))

    def _finish_retrieval(self, tick):
        buffer = self._retrieval_buffer
        if buffer is None:
            return
        samples = buffer["samples"]
        if len(samples) < RETRIEVAL_BUFFER_SIZE:
            return

        current_models = buffer.get("current_models", self.models)
        current_error = self._score_models(current_models, samples)
        candidates = [
            (index, self._score_models(entry["models"], samples))
            for index, entry in enumerate(self.bank)
        ]
        if not candidates:
            self._retrieval_buffer = None
            return
        index, best_error = min(candidates, key=lambda candidate: candidate[1])
        if best_error < self.retrieval_margin * current_error:
            selected = self.bank[index]
            for sensor, state in selected["models"].items():
                self.models[sensor] = Regression.restore(copy.deepcopy(state))
            self.bank.append(self.bank.pop(index))
            self.recalls.append((tick, index))
            self.retrieval_restored += 1
            self._retrieved_next = True
        self._retrieval_buffer = None

    def _declare_change(self, tick):
        self.declarations.append(tick)
        self.last_declaration = tick
        self.retrieval_attempts += 1
        current_models = self._copy_models(self.models)
        departing = self._departing_context(tick)
        if departing is not None:
            self._store_context(departing[1], departing[0])
        self._retrieval_buffer = {
            "declared_tick": tick,
            "current_models": current_models,
            "samples": [],
        }

    def learn(self, after):
        if self.pending is None:
            raise RuntimeError("Decision must precede feedback")
        before, _, x, _ = self.pending
        tick = before.tick
        residuals = super().learn(after)

        if (
            self._retrieval_buffer is not None
            and tick > self._retrieval_buffer["declared_tick"]
        ):
            changes = {
                sensor: float(after.signals[sensor] - before.signals[sensor])
                for sensor in before.signals.keys() & after.signals.keys()
            }
            self._retrieval_buffer["samples"].append((x.copy(), changes))
            self._finish_retrieval(tick)

        self._save_snapshot(tick)
        if residuals:
            z = self._detector_input(residuals)
            self.detector_probability = self.detector.update(z)
            if (
                tick >= WARMUP + 16
                and self.detector_probability > self.threshold
                and tick - self.last_declaration >= 48
            ):
                self._declare_change(tick)
        return residuals


class V3Hybrid(V3Actor):
    """V3 actor with an MMAC fallback driven by tracking-error degradation."""

    def __init__(
        self,
        hazard_lambda=DETECTOR_HAZARD_LAMBDA,
        lag=DETECTOR_LAG,
        threshold=DETECTOR_THRESHOLD,
        max_run_length=300,
        detector_signal=DETECTOR_SIGNAL,
        retrieval_margin=RETRIEVAL_IMPROVEMENT,
        fallback_enabled=True,
        fallback_floor=FALLBACK_ABS_FLOOR,
        fallback_multiplier=FALLBACK_MULTIPLIER,
    ):
        super().__init__(
            hazard_lambda,
            lag,
            threshold,
            max_run_length,
            detector_signal,
            retrieval_margin,
        )
        self.fallback_enabled = fallback_enabled
        self.fallback_floor = fallback_floor
        self.fallback_multiplier = fallback_multiplier
        self.mmac = Controller("mmac", PID, None)
        self.tracking_errors = deque(maxlen=256)
        self.rolling_errors = deque(maxlen=16)
        self.fallback_until = -1
        self.fallback_ticks = []

    def decide(self, obs, cue=None):
        result = super().decide(obs, cue)
        mmac_action = self.mmac.decide(obs)
        body_estimate = result.get("body_estimate")
        if body_estimate is None:
            readings = [
                obs.signals[sensor] for sensor in self.members if sensor in obs.signals
            ]
            body_estimate = float(np.mean(readings)) if readings else self.last_body
        tracking_error = abs(float(body_estimate) - obs.signals[obs.target_channel])

        fallback = False
        if self.fallback_enabled and obs.tick >= WARMUP:
            self.tracking_errors.append(tracking_error)
            self.rolling_errors.append(tracking_error)
            if len(self.rolling_errors) == 16 and self.tracking_errors:
                limit = max(
                    self.fallback_multiplier * float(np.median(self.tracking_errors)),
                    self.fallback_floor,
                )
                if (
                    obs.tick >= self.fallback_until
                    and float(np.mean(self.rolling_errors)) > limit
                ):
                    self.fallback_until = obs.tick + 32
            fallback = obs.tick < self.fallback_until

        if fallback:
            result["action"] = mmac_action
            self.fallback_ticks.append(obs.tick)
        result["fallback"] = fallback
        return result

    def learn(self, after):
        return super().learn(after)
