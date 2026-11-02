(*
  FB_ModeMemory - per-mode adaptive-state memory for a switching-mode controller.

  Discrete-mode variant of the Python ModeMemory: the bank holds up to six
  adaptive states of ARRAY[1..16] OF REAL, keyed by a DINT mode identifier,
  evicted least-recently-used first. A mode change counts only after ModeId has
  differed from the active mode for Debounce consecutive executions.

  Call once per control cycle, before the controller computes its output.
  State  : the controller's current adaptive state (stored when the mode leaves).
  Restored / RestoredState : load RestoredState into the controller only when
  Restored is TRUE; otherwise RestoredState mirrors State.

  Not yet compiled on a PLC runtime. See plc/README.md.
*)
FUNCTION_BLOCK FB_ModeMemory
VAR_INPUT
    Execute : BOOL;
    ModeId : DINT;
    State : ARRAY[1..16] OF REAL;
END_VAR
VAR_OUTPUT
    Restored : BOOL;
    RestoredState : ARRAY[1..16] OF REAL;
    BankCount : INT;
    Changes : UDINT;
    Restores : UDINT;
END_VAR
VAR
    Debounce : INT := 3;
    CurrentMode : DINT := 0;
    CurrentValid : BOOL := FALSE;
    OutsideCount : INT := 0;
    PendingMode : DINT := 0;
    PendingValid : BOOL := FALSE;
    BankModes : ARRAY[1..6] OF DINT;
    BankStates : ARRAY[1..6, 1..16] OF REAL;
    Changed : BOOL;
    Found : INT;
    i : INT;
    j : INT;
END_VAR

Restored := FALSE;
FOR j := 1 TO 16 DO
    RestoredState[j] := State[j];
END_FOR

IF NOT Execute THEN
    RETURN;
END_IF

(* Debounced change detection. *)
IF NOT CurrentValid THEN
    OutsideCount := 0;
    Changed := TRUE;
ELSE
    IF ModeId <> CurrentMode THEN
        IF NOT PendingValid OR ModeId <> PendingMode THEN
            PendingMode := ModeId;
            PendingValid := TRUE;
            OutsideCount := 1;
        ELSE
            OutsideCount := OutsideCount + 1;
        END_IF
    ELSE
        OutsideCount := 0;
        PendingValid := FALSE;
    END_IF
    IF OutsideCount < Debounce THEN
        Changed := FALSE;
    ELSE
        OutsideCount := 0;
        PendingValid := FALSE;
        Changed := TRUE;
    END_IF
END_IF

IF NOT Changed THEN
    RETURN;
END_IF

Changes := Changes + 1;

(* Store the departing mode's state; re-storing a mode replaces its entry. *)
IF CurrentValid THEN
    Found := 0;
    FOR i := 1 TO BankCount DO
        IF Found = 0 AND BankModes[i] = CurrentMode THEN
            Found := i;
        END_IF
    END_FOR
    IF Found = 0 AND BankCount >= 6 THEN
        Found := 1;
    END_IF
    IF Found > 0 THEN
        FOR i := Found TO BankCount - 1 DO
            BankModes[i] := BankModes[i + 1];
            FOR j := 1 TO 16 DO
                BankStates[i, j] := BankStates[i + 1, j];
            END_FOR
        END_FOR
        BankCount := BankCount - 1;
    END_IF
    BankCount := BankCount + 1;
    BankModes[BankCount] := CurrentMode;
    FOR j := 1 TO 16 DO
        BankStates[BankCount, j] := State[j];
    END_FOR
END_IF

(* Restore the arriving mode's state if the bank holds it. *)
Found := 0;
FOR i := 1 TO BankCount DO
    IF Found = 0 AND BankModes[i] = ModeId THEN
        Found := i;
    END_IF
END_FOR
IF Found > 0 THEN
    FOR j := 1 TO 16 DO
        RestoredState[j] := BankStates[Found, j];
    END_FOR
    FOR i := Found TO BankCount - 1 DO
        BankModes[i] := BankModes[i + 1];
        FOR j := 1 TO 16 DO
            BankStates[i, j] := BankStates[i + 1, j];
        END_FOR
    END_FOR
    BankModes[BankCount] := ModeId;
    FOR j := 1 TO 16 DO
        BankStates[BankCount, j] := RestoredState[j];
    END_FOR
    Restored := TRUE;
    Restores := Restores + 1;
END_IF

CurrentMode := ModeId;
CurrentValid := TRUE;

END_FUNCTION_BLOCK
