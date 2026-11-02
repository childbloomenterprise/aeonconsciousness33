"""Python reference for plc/FB_ModeMemory.st, mirroring the ST body line by line.

Names, control flow and 1-based indexing follow the Structured Text source, so
the two can be compared statement by statement. Behaviour is checked against
:class:`aeon_modememory.ModeMemory` in ``tests/test_plc_reference.py``.
"""

STATE_SIZE = 16
BANK_SIZE = 6


class FB_ModeMemory:
    """Discrete-mode LRU state bank with debounced change detection."""

    def __init__(self, debounce=3):
        self.Debounce = int(debounce)
        self.CurrentMode = 0
        self.CurrentValid = False
        self.OutsideCount = 0
        self.PendingMode = 0
        self.PendingValid = False
        self.BankModes = [0] * (BANK_SIZE + 1)
        self.BankStates = [[0.0] * (STATE_SIZE + 1) for _ in range(BANK_SIZE + 1)]
        self.BankCount = 0
        self.Changes = 0
        self.Restores = 0
        self.Restored = False
        self.RestoredState = [0.0] * (STATE_SIZE + 1)

    def call(self, Execute, ModeId, State):
        """One PLC cycle. ``State`` is a 16-element sequence, 0-based."""
        if len(State) != STATE_SIZE:
            raise ValueError("State must hold exactly 16 REAL values")
        state = [0.0] + [float(value) for value in State]

        self.Restored = False
        for j in range(1, STATE_SIZE + 1):
            self.RestoredState[j] = state[j]

        if not Execute:
            return self._outputs()

        if not self.CurrentValid:
            self.OutsideCount = 0
            Changed = True
        else:
            if ModeId != self.CurrentMode:
                if not self.PendingValid or ModeId != self.PendingMode:
                    self.PendingMode = ModeId
                    self.PendingValid = True
                    self.OutsideCount = 1
                else:
                    self.OutsideCount = self.OutsideCount + 1
            else:
                self.OutsideCount = 0
                self.PendingValid = False
            if self.OutsideCount < self.Debounce:
                Changed = False
            else:
                self.OutsideCount = 0
                self.PendingValid = False
                Changed = True

        if not Changed:
            return self._outputs()

        self.Changes = self.Changes + 1

        if self.CurrentValid:
            Found = 0
            for i in range(1, self.BankCount + 1):
                if Found == 0 and self.BankModes[i] == self.CurrentMode:
                    Found = i
            if Found == 0 and self.BankCount >= BANK_SIZE:
                Found = 1
            if Found > 0:
                for i in range(Found, self.BankCount):
                    self.BankModes[i] = self.BankModes[i + 1]
                    for j in range(1, STATE_SIZE + 1):
                        self.BankStates[i][j] = self.BankStates[i + 1][j]
                self.BankCount = self.BankCount - 1
            self.BankCount = self.BankCount + 1
            self.BankModes[self.BankCount] = self.CurrentMode
            for j in range(1, STATE_SIZE + 1):
                self.BankStates[self.BankCount][j] = state[j]

        Found = 0
        for i in range(1, self.BankCount + 1):
            if Found == 0 and self.BankModes[i] == ModeId:
                Found = i
        if Found > 0:
            for j in range(1, STATE_SIZE + 1):
                self.RestoredState[j] = self.BankStates[Found][j]
            for i in range(Found, self.BankCount):
                self.BankModes[i] = self.BankModes[i + 1]
                for j in range(1, STATE_SIZE + 1):
                    self.BankStates[i][j] = self.BankStates[i + 1][j]
            self.BankModes[self.BankCount] = ModeId
            for j in range(1, STATE_SIZE + 1):
                self.BankStates[self.BankCount][j] = self.RestoredState[j]
            self.Restored = True
            self.Restores = self.Restores + 1

        self.CurrentMode = ModeId
        self.CurrentValid = True
        return self._outputs()

    def _outputs(self):
        return self.Restored, list(self.RestoredState[1:])
