import random

import numpy as np

from aeon_modememory import ModeMemory


class DummyController:
    def __init__(self, state=0):
        self.state = state

    def get_adaptive_state(self):
        return {"value": self.state}

    def set_adaptive_state(self, state):
        self.state = state["value"]


def test_discrete_mode_waits_for_debounce_before_change_and_restore():
    controller = DummyController()
    memory = ModeMemory(debounce=3)

    assert memory.step("A", controller) is False
    controller.state = 7
    assert memory.step("B", controller) is False
    assert memory.step("B", controller) is False
    assert memory.mode == "A"
    assert memory.step("B", controller) is False
    assert memory.mode == "B"
    assert memory.bank[0]["state"] == {"value": 7}

    controller.state = 9
    for _ in range(3):
        restored = memory.step("A", controller)
    assert restored is True
    assert controller.state == 7


def test_discrete_debounce_requires_the_same_candidate_id():
    controller = DummyController()
    memory = ModeMemory(debounce=3)
    memory.step("A", controller)
    assert memory.step("B", controller) is False
    assert memory.step("C", controller) is False
    assert memory.step("B", controller) is False
    assert memory.step("B", controller) is False
    assert memory.step("B", controller) is False
    assert memory.mode == "B"


def test_lru_capacity_evicts_the_least_recent_mode():
    controller = DummyController()
    memory = ModeMemory(capacity=2, debounce=1)
    for mode in ("A", "B", "C", "D", "E"):
        memory.step(mode, controller)
        controller.state += 1
    assert [entry["mode"] for entry in memory.bank] == ["C", "D"]


def test_re_storing_a_mode_replaces_its_prior_state():
    controller = DummyController()
    memory = ModeMemory(debounce=1)
    memory.step("A", controller)
    controller.state = 11
    memory.step("B", controller)
    controller.state = 22
    assert memory.step("A", controller) is True
    assert controller.state == 11

    controller.state = 33
    memory.step("B", controller)
    assert memory.step("A", controller) is True
    assert controller.state == 33


def test_json_save_load_round_trip(tmp_path):
    controller = DummyController()
    memory = ModeMemory(capacity=3, debounce=2)
    memory.step([0.1, 0.2], controller)
    controller.state = 42
    assert memory.step([0.8, 0.1], controller) is False
    assert memory.step([0.8, 0.1], controller) is False
    path = tmp_path / "memory.json"
    memory.save(path)

    restored = ModeMemory.load(path)
    assert restored.capacity == 3
    assert restored.debounce == 2
    assert restored.mode == [0.8, 0.1]
    assert restored.bank == [{"mode": [0.1, 0.2], "state": {"value": 42}}]
    assert restored.changes == memory.changes


def test_debounce_one_without_an_existing_entry_leaves_controller_untouched():
    controller = DummyController(state={"opaque": [1, 2, 3]})
    memory = ModeMemory(debounce=1)

    assert memory.step("A", controller) is False
    assert controller.state == {"opaque": [1, 2, 3]}
    assert memory.step("B", controller) is False
    assert controller.state == {"opaque": [1, 2, 3]}


def test_reference_simulator_matches_discrete_mode_memory_on_random_sequence():
    from plc.reference_sim import FB_ModeMemory

    rng = random.Random(73019)
    sequence = []
    while len(sequence) < 250:
        sequence.extend([rng.choice((10, 20, 30, 40))] * rng.randint(3, 8))
    sequence = sequence[:250]
    controller = DummyController(np.zeros(16).tolist())
    memory = ModeMemory(capacity=6, debounce=3)
    reference = FB_ModeMemory(debounce=3)

    for tick, mode in enumerate(sequence):
        controller.state = [value + 0.01 for value in controller.state]
        current_state = list(controller.state)
        restored = memory.step(mode, controller)
        plc_restored, plc_state = reference.call(True, mode, current_state)
        assert plc_restored == restored
        if restored:
            controller.set_adaptive_state({"value": plc_state})
        assert np.allclose(controller.state, plc_state)
