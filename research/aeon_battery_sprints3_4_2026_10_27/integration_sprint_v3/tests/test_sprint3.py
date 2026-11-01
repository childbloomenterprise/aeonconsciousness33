"""Behavior checks for cue-free context memory and hybrid fallback."""

import time

import numpy as np
import pytest

from battery.battery import TESTS, BatteryWorld
from battery.battery import run as run_battery
from developmental_v0_2.actors import DIM, WARMUP, Regression
from developmental_v0_2.worlds import Observation
from integration_sprint_v3.sprint3 import V3Actor, V3Hybrid


def _model_state(weights=None):
    model = Regression()
    if weights is not None:
        model.w = np.asarray(weights, dtype=float).copy()
    return model.state()


@pytest.mark.behavior
def test_bank_deduplicates_refreshes_lru_and_caps_at_six():
    actor = V3Actor()
    weights = np.linspace(0.1, 0.2, DIM)
    actor._store_context({"sensor": _model_state(weights)}, 1)
    actor._store_context({"sensor": _model_state(weights + 0.01)}, 2)
    assert len(actor.bank) == 1
    assert actor.bank[0]["tick"] == 2

    actor = V3Actor()
    for index in range(6):
        actor._store_context({f"sensor-{index}": _model_state()}, index)
    actor._store_context({"sensor-0": _model_state()}, 6)
    actor._store_context({"sensor-6": _model_state()}, 7)

    assert len(actor.bank) == 6
    stored_sensors = [next(iter(entry["models"])) for entry in actor.bank]
    assert stored_sensors == [
        "sensor-2",
        "sensor-3",
        "sensor-4",
        "sensor-5",
        "sensor-0",
        "sensor-6",
    ]


@pytest.mark.behavior
def test_fit_retrieval_restores_model_that_generated_buffered_data():
    actor = V3Actor()
    correct = Regression()
    correct.w[1] = 0.4
    current = Regression()
    current.w[1] = -0.4
    actor.models = {"sensor": current}
    actor.bank = [{"tick": 0, "models": {"sensor": correct.state()}}]

    x = np.zeros(DIM)
    x[1] = 1.0
    samples = [(x.copy(), {"sensor": float(x @ correct.w)}) for _ in range(12)]
    actor._retrieval_buffer = {"declared_tick": 0, "samples": samples}
    actor._finish_retrieval(12)

    np.testing.assert_array_equal(actor.models["sensor"].w, correct.w)
    assert actor.recalls == [(12, 0)]
    assert actor.retrieval_restored == 1
    assert actor._retrieved_next


@pytest.mark.behavior
def test_retrieval_margin_and_attempt_restore_counters():
    x = np.zeros(DIM)
    x[1] = 1.0
    samples = [(x.copy(), {"sensor": 0.0}) for _ in range(12)]

    for margin, restored in ((0.5, False), (0.8, True)):
        actor = V3Actor(retrieval_margin=margin)
        current = Regression()
        current.w[1] = 3.0
        candidate = Regression()
        candidate.w[1] = 2.4
        actor.models = {"sensor": current}
        actor.bank = [{"tick": 0, "models": {"sensor": candidate.state()}}]
        actor._retrieval_buffer = {"declared_tick": 0, "samples": samples}
        actor._finish_retrieval(12)
        assert bool(actor.retrieval_restored) is restored

    actor = V3Actor()
    actor._declare_change(160)
    actor._retrieval_buffer["samples"] = [(x.copy(), {}) for _ in range(12)]
    actor._finish_retrieval(172)
    assert actor.retrieval_attempts == 1
    assert actor.retrieval_restored == 0


@pytest.mark.behavior
def test_retrieval_compares_against_current_models_before_buffer_learning():
    actor = V3Actor(retrieval_margin=0.5)
    current = Regression()
    current.w[1] = 3.0
    correct = Regression()
    correct.w[1] = 1.5
    actor.models = {"sensor": current}
    actor.bank = [{"tick": 180, "models": {"sensor": correct.state()}}]
    actor._declare_change(576)

    x = np.zeros(DIM)
    x[1] = 1.0
    actor._retrieval_buffer["samples"] = [
        (x.copy(), {"sensor": 0.0}) for _ in range(12)
    ]
    actor.models["sensor"].w[1] = 0.0
    actor._finish_retrieval(588)

    np.testing.assert_array_equal(actor.models["sensor"].w, correct.w)
    assert actor.retrieval_restored == 1


@pytest.mark.behavior
def test_a_phase_model_beats_pre_return_model_on_return_pairs():
    for family in ("variable_delay", "sensor_dropout", "delay_dropout"):
        world = BatteryWorld(19001, family, **TESTS["T1_replication"])
        actor = V3Actor(threshold=2.0)
        a_snapshot = None
        pre_return_models = None
        samples = []
        for tick in range(world.total()):
            before = world.observe()
            actor.decide(before, world.cue())
            x = actor.pending[2].copy()
            world.step(actor.pending[1])
            after = world.observe()
            if 576 <= tick < 588:
                changes = {
                    sensor: float(after.signals[sensor] - before.signals[sensor])
                    for sensor in before.signals.keys() & after.signals.keys()
                }
                samples.append((x, changes))
            actor.learn(after)
            if tick == 183:
                a_snapshot = actor._copy_models(actor.models)
            if tick == 575:
                pre_return_models = actor._copy_models(actor.models)

        a_error = actor._score_models(a_snapshot, samples)
        pre_return_error = actor._score_models(pre_return_models, samples)
        assert a_error < 0.5 * pre_return_error, (
            family,
            a_error,
            pre_return_error,
        )


@pytest.mark.behavior
def test_detector_signal_modes_use_expected_residual_statistics():
    current = V3Actor(detector_signal="current_log_residual_squared")
    assert current._detector_input({"sensor": 2.0}) == pytest.approx(np.log(4.0 + 1e-6))

    rolling = V3Actor(detector_signal="rolling_log_residual_squared")
    rolling._detector_input({"sensor": 2.0})
    assert rolling._detector_input({"sensor": -4.0}) == pytest.approx(
        np.log(10.0 + 1e-6)
    )

    signed = V3Actor(detector_signal="locked_sensor_signed_residual")
    signed.locked = "locked"
    assert signed._detector_input({"locked": -2.0, "other": 3.0}) == -2.0
    assert signed._detector_input({"other": 3.0, "another": 1.0}) == 2.0


@pytest.mark.behavior
def test_random_and_constant_cues_give_identical_t1_errors():
    total = BatteryWorld(19001, "variable_delay", **TESTS["T1_replication"]).total()
    random_cues = np.random.default_rng(2718).normal(size=(total, 2)).tolist()
    errors = []
    for cues in (random_cues, [[0.13, 0.27]] * total):
        world = BatteryWorld(19001, "variable_delay", **TESTS["T1_replication"])
        actor = V3Actor()
        run_errors = []
        for tick in range(total):
            observation = world.observe()
            decision = actor.decide(observation, cues[tick])
            world.step(decision["action"])
            actor.learn(world.observe())
            run_errors.append(abs(world.body - world.target()))
        errors.append(run_errors)
    assert errors[0] == errors[1]


@pytest.mark.behavior
def test_hybrid_switches_to_mmac_when_synthetic_error_rule_fires():
    actor = V3Hybrid()
    actor.members = ["sensor-0", "sensor-1"]
    actor.models = {
        "sensor-0": Regression(),
        "sensor-1": Regression(),
    }
    actor.tracking_errors.extend([0.0] * 256)
    actor.rolling_errors.extend([0.0] * 15)
    actor.mmac.decide = lambda observation: [0.75, 0.0]
    observation = Observation(
        tick=WARMUP + 1,
        signals={"sensor-0": 3.0, "sensor-1": 3.0, "target": 0.0},
        ports=(0, 1),
        target_channel="target",
    )

    decision = actor.decide(observation, cue=[0.0, 0.0])

    assert decision["fallback"]
    assert decision["action"] == [0.75, 0.0]
    assert actor.fallback_ticks == [WARMUP + 1]


def _run_actor_pair_errors(test, family, actor, hybrid):
    world = BatteryWorld(19001, family, **TESTS[test])
    errors = []
    for _ in range(world.total()):
        observation = world.observe()
        cue = world.cue()
        decision = actor.decide(observation, cue)
        hybrid_decision = hybrid.decide(observation, cue)
        assert decision["action"] == hybrid_decision["action"]
        world.step(decision["action"])
        after = world.observe()
        actor.learn(after)
        hybrid.learn(after)
        errors.append(abs(world.body - world.target()))
    return errors


@pytest.mark.behavior
def test_detector_disabled_matches_battery_no_retrieval_on_all_qualification_runs():
    for test in TESTS:
        for family in ("variable_delay", "sensor_dropout", "delay_dropout"):
            actual = _run_actor_pair_errors(
                test,
                family,
                V3Actor(threshold=2.0),
                V3Hybrid(threshold=2.0, fallback_enabled=False),
            )
            expected = run_battery(test, 19001, family, "aeon_no_retrieval")[
                "absolute_errors"
            ]
            if actual != expected:
                mismatch = next(
                    index
                    for index, (left, right) in enumerate(zip(actual, expected))
                    if left != right
                )
                raise AssertionError(
                    f"{test}/{family} diverges at tick {mismatch}: "
                    f"V3Actor={actual[mismatch]}, baseline={expected[mismatch]}"
                )


def _measure_t1(actor_type):
    world = BatteryWorld(19001, "variable_delay", **TESTS["T1_replication"])
    actor = actor_type()
    started = time.perf_counter()
    for _ in range(world.total()):
        observation = world.observe()
        decision = actor.decide(observation, world.cue())
        world.step(decision["action"])
        actor.learn(world.observe())
    return 1e6 * (time.perf_counter() - started) / world.total()


@pytest.mark.behavior
def test_measure_decision_time_on_t1_seed_19001():
    actor_us = _measure_t1(V3Actor)
    hybrid_us = _measure_t1(V3Hybrid)
    print(
        f"T1 seed 19001: V3Actor={actor_us:.2f} µs/decision, "
        f"V3Hybrid={hybrid_us:.2f} µs/decision"
    )
    assert np.isfinite(actor_us) and actor_us > 0
    assert np.isfinite(hybrid_us) and hybrid_us > 0
