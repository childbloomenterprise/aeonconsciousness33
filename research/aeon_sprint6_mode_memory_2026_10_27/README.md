# AEON sprint 6: mode memory on top of a classical controller

The first AEON-derived controller that beats textbook multiple-model adaptive control (MMAC) in this world.

`MMACMemory` (`integration_sprint_v6/sprint6.py`) applies AEON's sprint-2 recall idea to MMAC. Whenever the mode signal (context cue) changes, it stores MMAC's online delay-error estimates for the mode it is leaving, then restores them when that mode returns. `CuedSwitch` gives control to AEON v2 for 40 ticks after a cued recall, with MMAC in charge otherwise. Tuned on qualification seeds 19001–19021 only; frozen re-run on fresh seeds 43003–43103 (1,650 runs, `battery6/`).

| Pre-registered gate (MMACMemory) | Result | Outcome |
|---|---|---|
| Beats MMAC on return error in 6+ of 11 tests | 12–23% less return error in 9 of 11; no change without a cue (T3) or with a 10x noisy cue (T2) | Met |
| Never reliably worse than MMAC | 1% more whole-run error with a 10x noisy cue (T2) | Failed (narrowly) |
| No loss of control | 0 of 330 runs | Met |
| Overhead below 2x MMAC | About 1.05x (0.12–0.22 ms per decision) | Met |
| Secondary: CuedSwitch beats MMAC on T5 and T7_phase_64 | 59% and 39% less return error | Met |

Limits:
- It needs a mode signal. With no signal it reduces to plain MMAC.
- A very noisy signal causes wrong recalls; the next step is a confidence guard on the cue.
- Tested in one simulated 1-D world, on Linux with NumPy 2.2.6.
- Storing adapted state per operating mode is a known idea in adaptive control, so the value is in the measured implementation, not novelty.

Not evidence of consciousness.
