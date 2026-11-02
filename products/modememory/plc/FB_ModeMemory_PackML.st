(*
  FB_ModeMemory_PackML - PackML adapter for FB_ModeMemory.

  Combine PackTags ProductID and UnitModeCurrent as ProductID * 100 +
  UnitModeCurrent. ProductID and UnitModeCurrent must be numeric DINT values,
  UnitModeCurrent must be in the range 0..99, and the result must not overflow
  DINT or collide across product/mode pairs.

  Not yet compiled on a PLC runtime. See plc/README.md.
*)
FUNCTION_BLOCK FB_ModeMemory_PackML
VAR_INPUT
    Execute : BOOL;
    ProductID : DINT;
    UnitModeCurrent : DINT;
    State : ARRAY[1..16] OF REAL;
END_VAR
VAR_OUTPUT
    Restored : BOOL;
    RestoredState : ARRAY[1..16] OF REAL;
END_VAR
VAR
    Memory : FB_ModeMemory;
    ModeId : DINT;
    i : INT;
END_VAR

ModeId := ProductID * 100 + UnitModeCurrent;
Memory(Execute := Execute, ModeId := ModeId, State := State);
Restored := Memory.Restored;
FOR i := 1 TO 16 DO
    RestoredState[i] := Memory.RestoredState[i];
END_FOR

END_FUNCTION_BLOCK
