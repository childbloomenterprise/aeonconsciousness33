import pytest

from aeon_modememory import ModeKey, ModeMemory, isa88_mode, packml_mode


class DummyController:
    def __init__(self, state=0):
        self.state = state

    def get_adaptive_state(self):
        return {"value": self.state}

    def set_adaptive_state(self, state):
        self.state = state["value"]


def test_mode_keys_are_stable_and_ignore_keyword_order():
    first = ModeKey.from_fields(UnitModeCurrent=3, ProductID=42)
    second = ModeKey.from_fields(ProductID=42, UnitModeCurrent=3)
    assert first == second
    assert hash(first) == hash(second)


def test_mode_adapters_use_their_plc_tag_names():
    assert packml_mode(42, 3) == (
        ("ProductID", 42),
        ("UnitModeCurrent", 3),
    )
    assert isa88_mode("Recipe-A", unit=2, version=7) == (
        ("RecipeID", "Recipe-A"),
        ("Unit", 2),
        ("Version", 7),
    )


def test_none_fields_are_ignored():
    assert ModeKey.from_fields(recipe="R1", unit=None) == ModeKey.from_fields(
        recipe="R1"
    )
    assert packml_mode(42, None) == (("ProductID", 42),)


@pytest.mark.parametrize(
    "factory",
    [
        lambda: ModeKey.from_fields(product=""),
        lambda: ModeKey.from_fields(product="   "),
        lambda: ModeKey.from_fields(product=True),
        lambda: ModeKey.from_fields(product=42.0),
        lambda: ModeKey.from_fields(product=None),
        lambda: packml_mode(None),
        lambda: packml_mode([]),
        lambda: isa88_mode(""),
        lambda: isa88_mode("R1", unit=False),
    ],
)
def test_invalid_mode_key_fields_raise_value_error(factory):
    with pytest.raises(ValueError):
        factory()


def test_packml_product_return_restores_saved_controller_state():
    controller = DummyController()
    memory = ModeMemory(debounce=1)
    product_a = packml_mode(42, 3)
    product_b = packml_mode(84, 3)

    assert memory.step(product_a, controller) is False
    controller.state = 11
    assert memory.step(product_b, controller) is False
    controller.state = 29
    assert memory.step(product_a, controller) is True
    assert controller.state == 11


def test_packml_mode_key_round_trips_through_json(tmp_path):
    controller = DummyController()
    memory = ModeMemory(debounce=1)
    product_a = packml_mode(42, 3)
    memory.step(product_a, controller)
    controller.state = 11
    memory.step(packml_mode(84, 3), controller)
    path = tmp_path / "memory.json"
    memory.save(path)

    restored = ModeMemory.load(path)
    controller.state = 29
    assert restored.step(product_a, controller) is True
    assert controller.state == 11
