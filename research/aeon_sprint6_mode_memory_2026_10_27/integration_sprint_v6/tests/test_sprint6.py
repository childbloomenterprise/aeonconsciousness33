import copy

import numpy as np

from baseline_benchmark.benchmark import Controller
from battery.battery import FAMILIES, PID, TESTS, BatteryWorld
from developmental_v0_2.actors import WARMUP, Regression
from developmental_v0_2.worlds import Observation
from integration_sprint_v2 import sprint2
from integration_sprint_v6.sprint6 import CuedSwitch, MMACMemory

sprint2.install()


def _errors_and_actions(test, seed, family, controller):
    world = BatteryWorld(seed, family, **TESTS[test])
    errors = []
    actions = []
    for _ in range(world.total()):
        obs = world.observe()
        if isinstance(controller, (CuedSwitch, MMACMemory)):
            decision = controller.decide(obs, world.cue())
            action = decision["action"]
        else:
            action = controller.decide(obs)
        actions.append(copy.deepcopy(action))
        world.step(action)
        if isinstance(controller, CuedSwitch):
            controller.learn(world.observe())
        errors.append(abs(world.body - world.target()))
    return actions, errors


def test_cued_switch_zero_window_is_bit_identical_to_mmac():
    for test in TESTS:
        for family in FAMILIES:
            reference = _errors_and_actions(
                test, 19001, family, Controller("mmac", PID, None)
            )
            switched = _errors_and_actions(test, 19001, family, CuedSwitch(window=0))
            assert switched == reference, (test, family)


def test_mmac_memory_disabled_is_bit_identical_to_mmac():
    for test in TESTS:
        for family in FAMILIES:
            reference = _errors_and_actions(
                test, 19001, family, Controller("mmac", PID, None)
            )
            memory = _errors_and_actions(
                test, 19001, family, MMACMemory(memory_enabled=False)
            )
            assert memory == reference, (test, family)


def test_aeon_learns_from_the_executed_mmac_action():
    switch = CuedSwitch(window=0)
    actor = switch.aeon
    actor.models = {"sensor": Regression(), "target": Regression()}
    actor.members = ["sensor"]
    actor.history = [[0.2, -0.1]]
    actor.context = [0.1, 0.2]
    before = Observation(
        WARMUP + 5,
        {"sensor": 0.15, "target": 0.4},
        (None, None),
        "target",
    )
    executed_action = [0.75, -0.5]
    switch.mmac.decide = lambda obs: executed_action

    original_model = copy.deepcopy(actor.models["sensor"])
    history_before = copy.deepcopy(actor.history)
    result = switch.decide(before, [0.1, 0.2])
    x = sprint2.features(np.asarray(executed_action), history_before)
    after = Observation(
        before.tick + 1,
        {"sensor": 0.22, "target": 0.43},
        before.ports,
        "target",
    )
    expected = copy.deepcopy(original_model)
    expected.update(x, after.signals["sensor"] - before.signals["sensor"])

    switch.learn(after)

    assert result["controller"] == "mmac"
    assert actor.pending is None
    np.testing.assert_array_equal(actor.models["sensor"].w, expected.w)
    np.testing.assert_array_equal(actor.models["sensor"].p, expected.p)
    assert actor.models["sensor"].error == expected.error
    assert actor.models["sensor"].count == expected.count
    assert actor.history[-1] == executed_action


def test_mmac_memory_restores_delay_error_on_context_return():
    memory = MMACMemory()
    memory.mmac.decide = lambda obs: [0.0, 0.0]
    obs = Observation(WARMUP + 1, {"target": 0.0}, (None, None), "target")
    state_a = np.array([0.11, 0.22, 0.33, 0.44, 0.55])
    state_b = np.array([0.91, 0.82, 0.73, 0.64, 0.55])
    memory.context = [0.1, 0.2]
    memory.mmac.delay_error = state_a.copy()

    memory.decide(obs, [0.8, 0.1])
    assert len(memory.bank) == 1
    memory.mmac.delay_error = state_b.copy()
    result = memory.decide(obs, [0.1, 0.2])

    assert result["restored"]
    assert memory.restores == 1
    np.testing.assert_array_equal(memory.mmac.delay_error, state_a)
