from types import SimpleNamespace

import numpy as np
import pytest

from battery.battery import FAMILIES, TESTS, BatteryWorld
from developmental_v0_2.actors import WARMUP, Regression
from integration_sprint_v2 import sprint2
from integration_sprint_v3.sprint3 import V3Hybrid
from integration_sprint_v4.sprint4 import V4Hybrid
from integration_sprint_v5.sprint5 import V3HybridFixed, V4HybridFixed


def observation(tick, signals):
    return SimpleNamespace(tick=tick, signals=signals, target_channel="target")


def test_fallback_disabled_is_identical_to_unfixed_parents_on_all_33_runs():
    pairs = ((V3Hybrid, V3HybridFixed), (V4Hybrid, V4HybridFixed))
    for parent_class, fixed_class in pairs:
        for test in TESTS:
            for family in FAMILIES:
                world = BatteryWorld(19001, family, **TESTS[test])
                parent = parent_class(fallback_enabled=False)
                fixed = fixed_class(fallback_enabled=False)
                for _ in range(world.total()):
                    obs = world.observe()
                    cue = world.cue()
                    parent_decision = parent.decide(obs, cue)
                    fixed_decision = fixed.decide(obs, cue)
                    assert parent_decision == fixed_decision, (
                        parent_class.__name__,
                        test,
                        family,
                        obs.tick,
                    )
                    world.step(parent_decision["action"])
                    after = world.observe()
                    assert parent.learn(after) == fixed.learn(after), (
                        parent_class.__name__,
                        test,
                        family,
                        obs.tick,
                    )


@pytest.mark.parametrize(
    ("actor_class", "kind"),
    ((V3HybridFixed, "v3"), (V4HybridFixed, "v4")),
)
def test_fallback_learning_and_history_use_the_executed_action(actor_class, kind):
    actor = actor_class(fallback_enabled=True)
    actor.locked = "locked"
    actor.members = ["locked"]
    actor.models = {"locked": Regression(), "target": Regression()}
    actor.history = [[0.1, -0.2]]
    tick = WARMUP + 10
    obs = observation(tick, {"target": 0.5, "locked": 0.5})
    executed_action = [0.75, -0.25]
    actor.mmac.decide = lambda current: executed_action
    if kind == "v3":
        actor.fallback_until = tick + 10
    else:
        actor.fallback_active = True

    original_history = [list(action) for action in actor.history]
    original_model = Regression.restore(actor.models["locked"].state())
    result = actor.decide(obs)
    expected_x = sprint2.features(executed_action, original_history)

    assert result["fallback"] is True
    assert result["action"] == executed_action
    assert actor.pending[1] == executed_action
    np.testing.assert_array_equal(actor.pending[2], expected_x)
    assert actor.pending[3]["locked"] == float(expected_x @ original_model.w)

    after = observation(tick + 1, {"target": 0.52, "locked": 0.65})
    original_model.update(
        expected_x,
        after.signals["locked"] - obs.signals["locked"],
    )
    actor.learn(after)

    np.testing.assert_array_equal(actor.models["locked"].w, original_model.w)
    np.testing.assert_array_equal(actor.models["locked"].p, original_model.p)
    assert actor.models["locked"].error == original_model.error
    assert actor.models["locked"].count == original_model.count
    assert actor.history[-1] == executed_action


def test_locked_sensor_dropout_keeps_mmac_in_control_during_active_fallback():
    actor = V4HybridFixed(fallback_enabled=True)
    actor.locked = "locked"
    actor.members = ["locked"]
    actor.models = {"locked": Regression(), "member": Regression()}
    actor.fallback_active = True
    actor.mmac.decide = lambda obs: [0.75, 0.0]

    for offset in range(20):
        obs = observation(
            WARMUP + 1 + offset,
            {"target": 0.5, "member": 0.5},
        )
        result = actor.decide(obs)
        assert result["fallback"] is True
        assert result["action"] == [0.75, 0.0]
        actor.pending = None


def test_multistep_prediction_rolls_out_the_five_executed_actions():
    actor = V4HybridFixed(
        detector_signal="multistep",
        threshold=2.0,
        fallback_enabled=True,
    )
    actor.locked = "locked"
    actor.members = ["locked"]
    actor.models = {"locked": Regression()}
    actor.models["locked"].w[0] = 0.03
    actor.models["locked"].w[1] = 0.4
    actor.models["locked"].w[2] = -0.2
    actor.models["locked"].w[8] = 0.1
    actor.history = [[0.1, 0.0], [-0.2, 0.1]]
    actor.fallback_active = True

    actions = [
        [0.5, 0.0],
        [0.0, -0.4],
        [-0.25, 0.2],
        [0.75, 0.0],
        [0.0, 0.3],
    ]
    action_iterator = iter(actions)
    actor.mmac.decide = lambda obs: next(action_iterator)

    initial_history = [list(action) for action in actor.history]
    initial_weights = actor.models["locked"].w.copy()
    expected_prediction = 0.0
    rollout_history = [list(action) for action in initial_history]
    for action in actions:
        x = sprint2.features(action, rollout_history)
        expected_prediction += float(np.clip(x @ initial_weights, -0.6, 0.6))
        rollout_history.append(list(action))
        rollout_history = rollout_history[-sprint2.LAGS :]

    value = 0.0
    start_tick = WARMUP + 72
    for offset, action in enumerate(actions):
        tick = start_tick + offset
        obs = observation(tick, {"target": 0.5, "locked": value})
        result = actor.decide(obs)
        assert result["action"] == action
        value += 0.07
        actor.learn(observation(tick + 1, {"target": 0.5, "locked": value}))

    signal = actor.multistep_signals[0]
    assert signal["actions"] == actions
    assert np.isclose(signal["predicted"], expected_prediction)
    assert np.isclose(signal["realized"], 0.35)
    assert np.isclose(signal["signal"], 0.35 - expected_prediction)


def test_cue_is_never_read_by_either_fixed_hybrid():
    def run_with_cue(actor_class, randomized):
        world = BatteryWorld(19001, "variable_delay", **TESTS["T1_replication"])
        actor = actor_class(threshold=2.0, fallback_enabled=False)
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

    for actor_class in (V3HybridFixed, V4HybridFixed):
        assert run_with_cue(actor_class, True) == run_with_cue(actor_class, False)
