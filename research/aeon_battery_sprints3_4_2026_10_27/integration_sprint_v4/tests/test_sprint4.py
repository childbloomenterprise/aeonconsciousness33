from collections import deque
from types import SimpleNamespace

import numpy as np

from battery.battery import FAMILIES, TESTS, BatteryWorld, run
from developmental_v0_2.actors import WARMUP, Regression
from integration_sprint_v4.sprint4 import V4Actor, V4Hybrid


def observation(tick, signals):
    return SimpleNamespace(tick=tick, signals=signals, target_channel="target")


def test_disabled_v4_is_identical_to_no_retrieval_on_all_33_runs():
    for test in TESTS:
        for family in FAMILIES:
            expected = run(test, 19001, family, "aeon_no_retrieval")["absolute_errors"]
            world = BatteryWorld(19001, family, **TESTS[test])
            actor = V4Actor(threshold=2.0)
            hybrid = V4Hybrid(threshold=2.0, fallback_enabled=False)
            actor_errors = []
            hybrid_errors = []
            for _ in range(world.total()):
                obs = world.observe()
                cue = world.cue()
                decision = actor.decide(obs, cue)
                hybrid_decision = hybrid.decide(obs, cue)
                assert decision["action"] == hybrid_decision["action"]
                world.step(decision["action"])
                after = world.observe()
                actor.learn(after)
                hybrid.learn(after)
                error = abs(world.body - world.target())
                actor_errors.append(error)
                hybrid_errors.append(error)
            assert actor_errors == expected, (test, family)
            assert hybrid_errors == expected, (test, family)


def test_fallback_holds_mmac_until_sixteen_recovery_ticks():
    actor = V4Hybrid(fallback_enabled=True, fallback_k=3)
    actor.locked = "locked"
    actor.members = ["locked", "member"]
    actor.models = {"locked": Regression(), "member": Regression()}
    actor._locked_residual_history.extend([0.001] * 256)
    actor._locked_residual_window.extend([1.0] * 16)
    actor._latest_locked_error_tick = WARMUP + 99
    actor.mmac.decide = lambda obs: [0.25, 0.0]
    obs = observation(WARMUP + 100, {"target": 0.5, "locked": 0.5, "member": 0.5})

    result = actor.decide(obs)
    assert result["fallback"] is True
    assert result["action"] == [0.25, 0.0]
    actor.pending = None

    actor._locked_residual_window.clear()
    actor._locked_residual_window.extend([0.001] * 16)
    for tick in range(15):
        actor._latest_locked_error_tick = obs.tick + tick
        result = actor.decide(observation(obs.tick + tick + 1, obs.signals))
        assert result["fallback"] is True
        assert result["action"] == [0.25, 0.0]
        actor.pending = None

    actor._latest_locked_error_tick = obs.tick + 15
    result = actor.decide(observation(obs.tick + 16, obs.signals))
    assert result["fallback"] is False
    assert result["action"] != [0.25, 0.0]


def test_fallback_restores_diverged_model_from_pretrigger_snapshot():
    actor = V4Hybrid(fallback_enabled=True)
    saved = Regression()
    saved.w[0] = 0.125
    current = Regression()
    current.w[0] = 9.0
    current.error = 0.5
    actor.models = {"sensor": current}
    actor._model_error_history["sensor"] = deque([0.01] * 64, maxlen=256)
    actor.snapshots.append((16, {"sensor": saved.state()}))

    assert actor._restore_diverged_models(24) == ["sensor"]
    assert actor.models["sensor"].w[0] == 0.125


def test_multistep_signal_is_realized_minus_saved_prediction():
    actor = V4Actor(detector_signal="multistep", threshold=2.0)
    actor.locked = "locked"
    actor.members = ["locked"]
    actor.models["locked"] = Regression()
    actor.models["locked"].w[0] = 0.1
    value = 0.0
    for tick in range(200, 205):
        obs = observation(tick, {"target": 0.5, "locked": value})
        actor.decide(obs)
        value += 0.14
        actor.learn(observation(tick + 1, {"target": 0.5, "locked": value}))

    signal = actor.multistep_signals[0]
    assert np.isclose(signal["predicted"], 0.5)
    assert np.isclose(signal["realized"], 0.7)
    assert np.isclose(signal["signal"], 0.2)


def test_cue_is_ignored_on_t1_seed_19001():
    def run_with_cue(randomized):
        world = BatteryWorld(19001, "variable_delay", **TESTS["T1_replication"])
        actor = V4Actor()
        rng = np.random.default_rng(19001)
        errors = []
        for _ in range(world.total()):
            obs = world.observe()
            cue = rng.normal(size=2).tolist() if randomized else [0.25, 0.75]
            decision = actor.decide(obs, cue)
            world.step(decision["action"])
            actor.learn(world.observe())
            errors.append(abs(world.body - world.target()))
        return errors

    assert run_with_cue(True) == run_with_cue(False)
