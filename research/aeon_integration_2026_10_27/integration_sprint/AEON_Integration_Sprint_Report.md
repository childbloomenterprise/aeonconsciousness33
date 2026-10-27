# AEON 30-minute integration sprint — decision report

**Decision: SIMPLIFY.** Frozen success criterion: NOT MET.

Completed 120/120 trials; runtime failures: 0. Each run used 768 actions, for 92,160 actions total. No LLM or reserved confirmation world was used.

## Primary result

Lower is better: sum of absolute tracking error for 20 actions immediately after return to A. Means below pool the three conditions equally within each paired seed.

| Configuration | Mean 20-action error | Candidate improvement vs configuration | Paired 95% interval, control minus candidate |
|---|---:|---:|---|
| Integrated candidate | 0.818803 | — | — |
| no_retrieval | 0.769751 | -6.37% | [-0.157626, 0.042497] |
| adaptive_baseline | 0.775290 | -5.61% | [-0.158642, 0.058302] |
| shuffled | 0.766996 | -6.75% | [-0.112389, 0.009012] |

Success required at least 15% lower error than BOTH adaptive baseline and no-retrieval, with both paired intervals excluding zero in the beneficial direction. The shuffled-memory comparison was diagnostic only. Intervals use 10,000 bootstrap resamples of ten paired seed clusters; the three conditions are not treated as 30 independent seeds.

## Per-condition results (descriptive)

| Condition | Integrated | No retrieval | Simpler controller | Shuffled |
|---|---:|---:|---:|---:|
| variable_delay | 0.826687 | 0.710200 | 0.710200 | 0.722975 |
| sensor_dropout | 0.819870 | 0.938789 | 0.975039 | 0.824102 |
| delay_dropout | 0.809853 | 0.660266 | 0.640633 | 0.753912 |

## What was built

The repaired sensor-membership actor now uses a three-entry context bank to save and restore complete learned regression models. Its original numerical learning and receding-horizon planner are unchanged. Recall leaves current body estimates, action history and world state intact. The no-retrieval actor keeps learning and storing but cannot read memories into its model. Shuffled recall selects a different stored context. The baseline is the existing simpler adaptive controller.

All receive the same observation fields, public noisy cues and action-conditioned sensor laws. Their closed-loop sensor values can differ because actions differ. Identical-input replay and separate common-action world replay check this distinction explicitly.

The test uses A/B/C/A, 192 actions per phase. A has no delay or dropout, B/C apply delays of 1/3 and/or alternating omitted body sensors. The combination contains delay and dropout only, not the older compound world's additional gain/coupling changes.

## Qualification and integrity

- Ten integration qualification checks passed, including calibration/after-recall JSON restart, memory poisoning with recall disabled, memory-driven planner change, shuffled retrieval, repaired membership and exact metric indexing.
- All 13 existing developmental mechanism/pilot regression tests passed (20.789 seconds).
- Independent common-action replay passed for all three conditions: 769 observations per configuration per condition.
- All completed traces have valid hash chains; per-run metric windows were independently recomputed; measured source hashes remained unchanged.
- One initial qualification assertion failed: it incorrectly required different predictions after opposite actions compensated for opposite model weights. The corrected check compares model prediction for a fixed action and separately checks selected-action changes. The failed check and original test source are preserved under qualification_attempt_1. No evaluation outcomes existed at that point.

## Computation time

- Evaluation wall time: 324.587 seconds (5.41 minutes).
- Evaluation process CPU time: 304.219 seconds.
- Passing integration qualification: 16.034 seconds.

## Largest task errors

| Condition | Seed | Configuration | Primary error |
|---|---:|---|---:|
| variable_delay | 17053 | no_retrieval | 1.683045 |
| variable_delay | 17053 | adaptive_baseline | 1.683045 |
| sensor_dropout | 17001 | no_retrieval | 1.488335 |
| sensor_dropout | 17001 | adaptive_baseline | 1.488335 |
| sensor_dropout | 17003 | no_retrieval | 1.437859 |
| sensor_dropout | 17003 | adaptive_baseline | 1.437859 |
| sensor_dropout | 17053 | adaptive_baseline | 1.424504 |
| sensor_dropout | 17047 | no_retrieval | 1.405041 |
| sensor_dropout | 17047 | adaptive_baseline | 1.405041 |
| delay_dropout | 17047 | shuffled | 1.355041 |

Largest candidate errors: variable_delay, seed 17047: 1.262541; sensor_dropout, seed 17003: 1.247859; sensor_dropout, seed 17047: 1.245041.

## Interpretation and limits

The integrated candidate did not improve both required comparisons. Prefer the simpler approach for this milestone; preserve this candidate and its unfavorable outcomes as evidence rather than treating component checks as success.

Public context cues strongly scaffold retrieval. Sensor membership assumes redundant agreeing sensors. The 10-seed sample is small, and family-level intervals are descriptive. Fresh seeds in familiar worlds are development evidence only. No outcome-driven tuning or rerun was performed.

## Reproduce and inspect

From the original project root (Python + NumPy):

```powershell
python -m integration_sprint.sprint qualify --out integration_sprint/new_qualification
python -m integration_sprint.sprint run --out integration_sprint/new_evaluation
```

The measurement command requires the preserved passing qualification at integration_sprint/qualification/qualification.json and verifies the original source freeze. It refuses an existing output directory. The first command is an optional fresh check; it does not overwrite the preserved qualification. Source snapshots include dependencies. Unpack source_before.zip at a clean project root, then copy this integration_sprint directory there to reconstruct the project.

Evidence: PROTOCOL.md; protocol_freeze.json; source_before.zip; evaluation/source_measured.zip; qualification/; qualification_attempt_1/; regression_checks.json; independent_observation_audit.json; postrun_checks.json; evaluation/outcomes.jsonl; evaluation/results.json; evaluation/traces/; evaluation/checkpoints/.

Report generated 2026-10-27T03:24:43.789566+00:00. Elapsed from protocol freeze to report: 553.5 seconds. This excludes initial inspection and is not reported as total sprint duration.