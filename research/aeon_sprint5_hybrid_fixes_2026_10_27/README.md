# AEON sprint 5: hybrid bug fixes (correction to sprints 3–4)

Devin Review on PR #3 found two bugs in the published hybrid controllers (`V3Hybrid`, `V4Hybrid` in `research/aeon_battery_sprints3_4_2026_10_27/`):
1. On fallback ticks, AEON learned from (and recorded in its history) its own action, not the one MMAC actually executed.
2. In v4, a dropout of the locked sensor ended an active fallback.

A third, minor issue (v4's unselected `multistep` detector option assumed zero follow-up actions) is fixed too. The non-hybrid results (cue-free memory, `V3Actor`/`V4Actor`, the capability battery) do not use the fallback and are unaffected.

`integration_sprint_v5/` holds the fixes and tests; fallback parameters were re-tuned on qualification seeds 19001–19021 only. `battery5/` is a frozen re-run on fresh seeds 41011–41117 (2,310 runs).

| Pre-registered gate | Result | Outcome |
|---|---|---|
| Fix matters: fixed v4 hybrid beats the published one in at least 3 of 11 tests, worse in none | Better in 10 of 11 (9–25% less return error), within noise in 1 | Met |
| No loss of control at 4x sensor noise | 4 of 30 runs (published v4 hybrid 12, sprint-2 AEON 12, MMAC 0) | Failed |
| Beats MMAC on return error in at least 1 test | +6% on changed physics on return (T5); within noise in 6 tests | Met |
| Beats MMAC over whole runs in 6 or more tests | 0 of 11 | Failed (expected) |

Corrected conclusion: the fixed v4 hybrid roughly matches MMAC on return error without any context cue, but only by running on MMAC about half the time, and it is still worse than MMAC over whole runs. AEON's clearest standalone value remains cue-driven recall (sprint 2). Not evidence of consciousness.
