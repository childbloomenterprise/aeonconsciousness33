import copy

import numpy as np

from battery.battery import FAMILIES, TESTS, BatteryWorld
from developmental_v0_2.actors import WARMUP
from developmental_v0_2.worlds import Observation
from integration_sprint_v6.sprint6 import MMACMemory
from integration_sprint_v7.sprint7 import GuardedMMACMemory


def _run(test, family, controller):
    world = BatteryWorld(19001, family, **TESTS[test])
    actions = []
    errors = []
    for _ in range(world.total()):
        obs = world.observe()
        decision = controller.decide(obs, world.cue())
        actions.append(copy.deepcopy(decision["action"]))
        world.step(decision["action"])
        errors.append(abs(world.body - world.target()))
    return actions, errors


def test_default_reduction_matches_mmac_memory_on_all_33_runs():
    for test in TESTS:
        for family in FAMILIES:
            reference = MMACMemory()
            guarded = GuardedMMACMemory(n=1, d=1, v=0)
            assert _run(test, family, guarded) == _run(test, family, reference)
            np.testing.assert_array_equal(
                guarded.mmac.delay_error, reference.mmac.delay_error
            )
            assert guarded.mmac.delay_choice == reference.mmac.delay_choice
            assert guarded.context == reference.context
            assert len(guarded.bank) == len(reference.bank)
            for guarded_entry, reference_entry in zip(guarded.bank, reference.bank):
                assert guarded_entry["cue"] == reference_entry["cue"]
                np.testing.assert_array_equal(
                    guarded_entry["delay_error"], reference_entry["delay_error"]
                )


def test_debounce_ignores_a_two_tick_cue_spike():
    guarded = GuardedMMACMemory(n=1, d=3, v=0)
    guarded.context = [0.1, 0.2]
    guarded.mmac.decide = lambda obs: [0.0, 0.0]
    obs = Observation(WARMUP + 1, {"target": 0.0}, (None, None), "target")

    guarded.decide(obs, [0.8, 0.1])
    guarded.decide(obs, [0.8, 0.1])

    assert guarded.context == [0.1, 0.2]
    assert guarded.bank == []
    assert guarded._outside_count == 2


def test_wrong_restore_reverts_and_marks_entry_suspect():
    guarded = GuardedMMACMemory(n=1, d=1, v=2)
    pre_restore = np.full(5, 0.01)
    wrong_restore = np.full(5, 0.2)
    guarded.context = [0.8, 0.1]
    guarded.mmac.delay_error = pre_restore.copy()
    guarded.mmac.prev_body = 0.0
    guarded._recent_errors.extend([0.01, 0.01])
    guarded.bank = [{"cue": [0.1, 0.2], "delay_error": wrong_restore.copy()}]

    def high_error_decide(obs):
        guarded.mmac.delay_error = 0.9 * guarded.mmac.delay_error + 0.1 * np.ones(5)
        guarded.mmac.delay_choice.append(0)
        return [0.0, 0.0]

    guarded.mmac.decide = high_error_decide
    obs = Observation(WARMUP + 1, {"target": 0.0}, (None, None), "target")

    result = guarded.decide(obs, [0.1, 0.2])
    guarded.decide(
        Observation(obs.tick + 1, obs.signals, obs.ports, obs.target_channel),
        [0.1, 0.2],
    )

    assert result["restored"]
    assert guarded.reverts == 1
    np.testing.assert_array_equal(guarded.mmac.delay_error, pre_restore)
    suspect = next(entry for entry in guarded.bank if entry["cue"] == [0.1, 0.2])
    assert suspect["skip_once"]
