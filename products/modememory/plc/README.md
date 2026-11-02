# FB_ModeMemory (IEC 61131-3 Structured Text)

`FB_ModeMemory.st` is the discrete-mode variant of `ModeMemory` for a PLC: it
keeps one adaptive-state snapshot per operating mode and hands it back when the
machine returns to that mode, so an adaptive controller resumes instead of
relearning after every changeover.

**This function block has not yet been compiled on a PLC runtime.** It is
written to the IEC 61131-3 Structured Text standard and is mirrored statement by
statement by `reference_sim.py`, which is tested against the Python package, but
no vendor toolchain (CODESYS, TwinCAT, GX Works, TIA Portal) has compiled or run
it. Treat it as a reviewed reference implementation, not as commissioned code.

## Interface

| Name | Direction | Type | Meaning |
|---|---|---|---|
| `Execute` | input | `BOOL` | Run the memory this cycle; when `FALSE` nothing changes |
| `ModeId` | input | `DINT` | Current operating mode (recipe, product, gear, batch step) |
| `State` | input | `ARRAY[1..16] OF REAL` | The controller's adaptive state right now |
| `Restored` | output | `BOOL` | `TRUE` for the one cycle a stored state is handed back |
| `RestoredState` | output | `ARRAY[1..16] OF REAL` | The state to load; mirrors `State` when `Restored` is `FALSE` |
| `BankCount` | output | `INT` | Entries currently stored (0 to 6) |
| `Changes`, `Restores` | output | `UDINT` | Declared mode changes and restores, for diagnostics |

`Debounce` is an internal variable, default `3`: a mode change counts only after
`ModeId` has differed from the active mode for three consecutive calls. Raise it
on a noisy mode signal; lower it only if changeovers are shorter than a few
cycles.

## Wiring

1. Call the block once per control cycle, in the same task as the controller and
   **before** the controller computes its output.
2. Feed `State` from the controller's adaptive parameters, packed into a fixed
   `ARRAY[1..16] OF REAL`. Keep one packing order and document it; the block
   never interprets the values.
3. On the cycle where `Restored` is `TRUE`, copy `RestoredState` back into those
   same controller parameters, then let the controller run as usual.
4. Drive `ModeId` from the signal the line already has — recipe number, product
   code, active batch step. A raw sensor value is not a mode; derive a mode from
   it first, or use the Python package's vector-cue mode instead.
5. Hold `Execute` `FALSE` while the controller is in manual, faulted or
   uninitialized. The block then leaves its bank untouched.

```
PROGRAM MAIN
VAR
    Memory : FB_ModeMemory;
    Ctl : FB_AdaptiveController;
    Packed : ARRAY[1..16] OF REAL;
END_VAR

Packed := Ctl.AdaptiveState;
Memory(Execute := Ctl.Ready, ModeId := RecipeNumber, State := Packed);
IF Memory.Restored THEN
    Ctl.AdaptiveState := Memory.RestoredState;
END_IF
Ctl();
```

## Memory and timing

The bank is statically sized: 6 entries x 16 `REAL` plus 6 `DINT`, about 408
bytes, with no dynamic allocation. Work per cycle is bounded by the two bank
scans and the array copies (at most about 200 `REAL` assignments on a changeover
cycle, and none on an unchanged cycle), so the block is safe in a fast task.

## Validation status

* `reference_sim.py` mirrors the ST body line by line and is tested to agree
  with `aeon_modememory.ModeMemory` on random mode sequences.
* Control results come from the simulation study in
  `../../../research/aeon_sprint7_guarded_memory_2026_10_27/`.
* No hardware, no PLC runtime, no plant trial. Commission it as you would any
  new function block, starting with the mode signal and `Restored` traced in
  monitoring mode.
