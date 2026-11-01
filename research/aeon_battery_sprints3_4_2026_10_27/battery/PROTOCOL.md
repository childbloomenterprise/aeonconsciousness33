# AEON capability battery — frozen protocol

Frozen before any evaluation-seed result exists. Controller code is the unchanged sprint-2 `IntegratedLanding`
(integrated and no_retrieval); baselines are the unchanged `baseline_benchmark.Controller` (MMAC with delays 0..4; PID
with gains kp=.3, ki=.01, kd=.1 frozen from qualification seed 19001 in the baseline benchmark). No oracle/true-model MPC
here (they need privileged world access that the new worlds do not define).

World: `BatteryWorld` generalises the sprint `RepeatingWorld` (phase 192, sequence A,B,C,A). Qualification proved it
reproduces the sprint-2 world bit-for-bit for AEON integrated/no_retrieval and the baseline-benchmark MMAC/PID on seed
19001. Contexts: A none; B delay 1 / sensor 0 dropped; C delay 3 / sensor 1 dropped; D delay 2 / sensor 0 dropped
(delay applies in delay families, dropout in dropout families). Cues A(.1,.2) B(.8,.1) C(.3,.9) D(.9,.8), noise .012 sd.

Tests (3 families x 10 fresh seeds 29001..29053 x 4 controllers each; 1320 runs):
| Test | Change | Pre-registered expectation |
|---|---|---|
| T1_replication | none | integrated beats no_retrieval by >=15% on return loss, CI>0 (sprint-2 RETAIN replicates) |
| T2_cue_noise_x4 / x10 | cue noise x4 / x10 | x4: advantage holds; x10: advantage shrinks or reverses (spurious recalls) |
| T3_no_cue | cue always A | integrated ~= no_retrieval (|diff| < 5%): memory depends on the cue |
| T4_capacity_ABCDA | 4 contexts before return; bank holds 3 | A evicted; integrated ~= no_retrieval |
| T4_revisits_ABCBA | two returns | advantage on both the B return and the A return |
| T5_changed_physics_on_return | A returns with gains x0.5 | recalled model is wrong; integrated not better than no_retrieval (may be worse) |
| T6_sensor_noise_x2 / x4 | sensor noise sd x2 / x4 | return advantage persists |
| T7_phase_96 / 64 | shorter phases | return advantage persists; overall gap to MMAC persists |

Metrics: `loss` = summed absolute error over the first 20 actions of the final phase (sprint endpoint);
`overall` = mean error after warmup (128); `final_phase` = mean error over the final phase; `loss_B_return` for ABCBA;
recalls per run; microseconds per decision. Statistics: paired seed clusters (family-pooled), 10,000 bootstrap
resamples, RNG 81234 (`developmental_cases.common.paired`). A difference is "reliable" only if the 95% CI excludes 0.
No tuning after results; every test is reported whichever way it goes. Not evidence of consciousness.
Also reported: framework health (sprint-2 bit-for-bit reproduction; aeonconsciousness repo test suite).
