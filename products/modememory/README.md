# AEON ModeMemory 0.1.0

**Remember what an adaptive controller has already learned in each operating
mode.** `aeon_modememory` is a small NumPy-only Python package that wraps an
existing controller's adaptive state with a debounced mode-change detector and
a fixed-size LRU memory bank. When a known mode returns, the controller can
resume its saved state rather than relearning from scratch.

The package includes `DelayMMAC`, a standalone NumPy port of the baseline
multiple-model adaptive controller for delayed plants, and an IEC 61131-3
Structured Text function block for controllers that expose a discrete mode ID.

## Quick start

```python
from aeon_modememory import DelayMMAC, ModeMemory
from my_plant import plant, stream, log

controller = DelayMMAC()
memory = ModeMemory()
for measurement, target, mode_cue in stream:
    restored = memory.step(mode_cue, controller)
    action = controller.act(measurement, target)
    plant.step(action)
    log(action, restored)
memory.save("memory.json")
```

The quick start is ten lines and shows the complete call order.

## API

### `ModeMemory`

```python
ModeMemory(
    capacity=6,
    debounce=3,
    change_distance=0.3,
    match_distance=0.2,
)
```

Call `step(mode, controller)` once per control tick **before** asking the
controller for its next action. `mode` may be a hashable discrete ID such as a
recipe number, or a numeric vector cue. The controller supplies
`get_adaptive_state()` and `set_adaptive_state(state)`.

* A discrete mode is considered changed after its ID differs from the active
  ID for `debounce` consecutive ticks. It restores only an exact matching ID.
* A vector cue is considered changed after it stays more than
  `change_distance` from the active cue for `debounce` consecutive ticks. At
  changeover, the nearest saved cue is restored only if it is within
  `match_distance`.
* On a declared change, the departing state is deep-copied into the LRU bank.
  Re-storing a mode replaces its older snapshot.
* `step()` returns `True` only when a saved state was restored.
* `save(path)` writes the bank and detector state as JSON; use
  `ModeMemory.load(path)` to create an instance from a saved file.

### Works with your recipe system

For PackML, key memory with the product and current unit mode exposed by
`PackTags.Status.Product[0].ProductID` and `PackTags.Status.UnitModeCurrent`:

```python
from aeon_modememory.adapters import packml_mode

mode = packml_mode(product_id=product_id, unit_mode=unit_mode)
restored = memory.step(mode, controller)
```

For ISA-88, use the active recipe identifier and optionally its unit and
version:

```python
from aeon_modememory.adapters import isa88_mode

mode = isa88_mode(recipe_id=recipe_id, unit=unit, version=version)
restored = memory.step(mode, controller)
```

For a raw format or tool identifier, build a key from the tags your machine
already exposes:

```python
from aeon_modememory.adapters import ModeKey

mode = ModeKey.from_fields(format_id=format_id, tool_id=tool_id)
restored = memory.step(mode, controller)
```

### `DelayMMAC`

`act(measurement, target) -> action` accepts a mapping of sensor names to
measurements and the current observed target value. It starts with a 128-tick
identification sequence, selects up to two informative sensors, fuses them by
inverse residual variance, and updates a five-candidate delay-error bank
online. `get_adaptive_state()` / `set_adaptive_state(state)` expose that
five-value delay posterior to `ModeMemory`.

### Demo

Run `python -m aeon_modememory.demo` to compare DelayMMAC and
DelayMMAC+ModeMemory over ten fixed seeds. The synthetic plant parameters are
specified in the demo module docstring before the experiment. It reports
post-changeover and whole-run errors along with paired-bootstrap 95% confidence
intervals. Results describe only that particular simulation; the demo is not
tuned to guarantee a memory advantage.

## Evidence and limitations

The sprint-7 evaluation summary is in
[`research/aeon_sprint7_guarded_memory_2026_10_27/`](../../research/aeon_sprint7_guarded_memory_2026_10_27/):
guarded mode memory produced **6–25% less return error than MMAC in 10 of 11
tests**, was **never worse** on return or whole-run error, had **0/330 loss-of-
control runs**, and used about **1.25× the compute**. This is **simulation
only**: a simulated 1-D world, not a physical plant, PLC runtime, safety
certification, or evidence of consciousness. See
[`plc/README.md`](plc/README.md) for the PLC block's validation status.

## Install and test

```bash
python -m pip install .
python -m pytest
python -m ruff check .
python -m ruff format --check .
python -m aeon_modememory.demo
```

Runtime dependency: NumPy. Python 3.9 or newer.

## License

See [`LICENSE`](LICENSE). Source is available for evaluation only. Commercial
or production use requires written permission from the ModeMemory authors.
Contact: vaibhavvarunmr@gmail.com.
