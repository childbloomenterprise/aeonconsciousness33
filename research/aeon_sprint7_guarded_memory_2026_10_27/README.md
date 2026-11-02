# AEON sprint 7: guarded mode memory (all gates met)

`GuardedMMACMemory(n=1, d=3, v=0)` (`integration_sprint_v7/sprint7.py`) is sprint-6 `MMACMemory` with one change: a mode change counts only after the cue has stayed more than .3 away for 3 consecutive ticks. This stops noisy mode signals from triggering wrong restores. The setting was chosen on qualification seeds 19001–19021 as the best objective among settings with no loss under a 10x noisy cue. Frozen re-run on fresh seeds 47017–47129: 1,320 runs in `battery7/`.

| Gate (guarded memory vs MMAC) | Result | Outcome |
|---|---|---|
| Less return error in 6+ of 11 tests | 6–25% less in 10 of 11; T3 (no cue) equals MMAC | Met |
| Never reliably worse, return or whole run | Never worse in any test | Met |
| No loss of control | 0 of 330 runs | Met |
| Compute below 2x MMAC | About 1.25x (0.18–0.23 ms per decision) | Met |

Trade-off: with a clean cue, unguarded MMACMemory gains more (11–25% vs MMAC) but loses 10% under a 10x noisy cue; the guarded version gains 6–25% and is safe under noise. Recommended product default: guarded. Simulated 1-D world, Linux, NumPy 2.2.6. Not evidence of consciousness.
