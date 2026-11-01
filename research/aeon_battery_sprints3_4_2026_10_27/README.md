# AEON capability battery and sprints 3–4 (C → D attempts)

> **Correction:** the hybrid results here (`V3Hybrid`, `V4Hybrid`) are affected by two bugs fixed in `../aeon_sprint5_hybrid_fixes_2026_10_27/` (fallback ticks trained on unexecuted actions; v4 sensor dropout ended an active fallback). The non-hybrid results are unaffected.

Simulated 1-D tracking world; every protocol was frozen (file hashes in `protocol_freeze.json`) before evaluation seeds were run, and nothing was tuned afterwards. Not evidence of consciousness.

| Folder | What it is | Evaluation seeds | Result |
|---|---|---|---|
| `battery/` | 11 stress tests: sprint-2 AEON vs no-memory AEON, MMAC, PID (1,320 runs) | 29001–29053 | Memory works only with a clean context cue; 3-slot bank too small; loss of control at 4x sensor noise; loses to MMAC over whole runs in 10 of 11 tests |
| `integration_sprint_v3/`, `battery3/` | v3: cue-free memory (Bayesian online changepoint detection ported from MIT-licensed hildensia/bayesian_changepoint_detection), de-duplicated bank, retrieval by fit, MMAC safety fallback (1,980 runs) | 31001–31081 | 1 of 3 gates met: loss-of-control runs 9 → 3 of 30; cue-free memory +3% (n.s.); tuning on one seed overfit |
| `integration_sprint_v4/`, `battery4/` | v4: standardized multi-sensor detector, model-error fallback with hysteresis and diverged-model reset, tuned on 5 seeds (2,310 runs) | 37003–37117 | 2 of 4 gates met: beats v3 hybrid in 10 of 11 tests and beats v2 under a very noisy cue (+60%), but runs on MMAC 63% of the time, cue-free memory still -3% (n.s.), 7 of 30 loss-of-control runs at 4x noise, and still worse than MMAC |
| `reports/` | Self-contained HTML reports | | |

Conclusion so far: AEON's proven advantage is cue-driven memory (sprint 2) when a clean mode signal exists. Detecting context changes from its own residuals is near chance (about 50% of switches caught, about one false alarm per switch), so cue-free memory does not yet help. Recommended deployment pattern: a classical controller (MMAC/MPC) as primary, with AEON memory restore driven by an explicit mode signal.

Reproduce from a workspace that also holds the unpublished packages `developmental_v0_2`, `developmental_cases`, `aeon_developmental` and the sprint folders: `python -m battery.battery run --out <dir>`, `python -m battery3.battery3 --out <dir>`, `python -m battery4.battery4 --out <dir>` (NumPy 2.2.6, Linux). Raw per-action outcomes are in each `evaluation/outcomes.zip`.
