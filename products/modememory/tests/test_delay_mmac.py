import sys
from pathlib import Path

import pytest

from aeon_modememory import DelayMMAC, ModeMemory

AEON_FULL = Path("/home/ubuntu/aeon_full")


@pytest.mark.skipif(not AEON_FULL.exists(), reason="local AEON research tree absent")
def test_bit_identical_to_sprint7_guarded_memory():
    sys.path.insert(0, str(AEON_FULL))
    from battery.battery import FAMILIES, TESTS, BatteryWorld
    from integration_sprint_v7.sprint7 import GuardedMMACMemory

    selected_tests = (
        "T1_replication",
        "T2_cue_noise_x10",
        "T4_revisits_ABCBA",
    )
    selected_families = FAMILIES
    for test_name in selected_tests:
        for family in selected_families:
            world_reference = BatteryWorld(19001, family, **TESTS[test_name])
            reference = GuardedMMACMemory(n=1, d=3, v=0)
            expected_errors = []

            world_product = BatteryWorld(19001, family, **TESTS[test_name])
            controller = DelayMMAC()
            memory = ModeMemory(debounce=3)
            actual_errors = []

            for _ in range(world_reference.total()):
                observation_reference = world_reference.observe()
                cue_reference = world_reference.cue()
                reference_action = reference.decide(
                    observation_reference, cue_reference
                )["action"]
                world_reference.step(reference_action)
                expected_errors.append(
                    abs(world_reference.body - world_reference.target())
                )

                observation = world_product.observe()
                cue = world_product.cue()
                memory.step(cue, controller)
                sensors = {
                    name: value
                    for name, value in observation.signals.items()
                    if name != observation.target_channel
                }
                action = controller.act(
                    sensors, observation.signals[observation.target_channel]
                )
                assert action == reference_action, (test_name, family)
                world_product.step(action)
                actual_errors.append(abs(world_product.body - world_product.target()))

            assert actual_errors == expected_errors, (test_name, family)


def test_delay_state_round_trip_is_copied_and_validated():
    controller = DelayMMAC()
    state = controller.get_adaptive_state()
    state[0] = 0.25
    assert controller.delay_error[0] == 0.01
    controller.set_adaptive_state(state)
    assert controller.delay_error[0] == 0.25
    with pytest.raises(ValueError):
        controller.set_adaptive_state([1.0, 2.0])


def test_delay_mmac_accepts_sensor_mapping_and_returns_bounded_action():
    controller = DelayMMAC()
    action = controller.act({"sensor_a": 0.1, "sensor_b": 0.2}, 0.0)
    assert len(action) == 2
    assert all(abs(value) <= 1.0 for value in action)
    assert sum(abs(value) > 1e-12 for value in action) <= 1
