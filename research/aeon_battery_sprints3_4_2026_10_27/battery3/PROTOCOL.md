# Sprint 3 (C -> D) battery — frozen protocol

Frozen before any result on evaluation seeds 31001,31013,31019,31033,31039,31051,31063,31069,31079,31081 exists.
Worlds and tests: unchanged `battery.battery` (11 tests x 3 families). New controllers (code: `integration_sprint_v3/`,
detector/retrieval/fallback constants tuned on seed 19001 only):
- `aeon_v3`: sprint-2 planner + cue-free memory. Context switches are detected from AEON's own one-step prediction
  residuals with Bayesian online changepoint detection (Adams & MacKay 2007; NumPy port validated against the MIT
  library hildensia/bayesian_changepoint_detection), a de-duplicated 6-slot bank, and retrieval by predictive fit.
  It never reads the cue.
- `aeon_v3_hybrid`: aeon_v3 + MMAC safety fallback when AEON's estimated tracking error degrades.
Comparators: `aeon_v2` (sprint-2, cue-driven), `aeon_v2_no_retrieval`, `mmac`, `pid` (frozen gains).
Pre-registered expectations (D reached if 1-3 hold):
1. Cue-free memory works: on T3_no_cue, aeon_v3 beats aeon_v2_no_retrieval on return loss with 95% CI > 0.
2. Cue robustness: on T2_cue_noise_x10, aeon_v3_hybrid beats aeon_v2 on return loss with CI > 0.
3. Safety: on T6_sensor_noise_x4, aeon_v3_hybrid has fewer loss-of-control runs (max error > 1.0) than aeon_v2.
4. (Expected to fail) aeon_v3_hybrid still loses to MMAC on whole-run error in most tests.
5. (Expected) with a clean cue (T1), aeon_v2 still beats aeon_v3 on return loss: detection costs latency.
Statistics: paired seed clusters pooled over families, 10,000 bootstrap resamples, RNG 81234. No tuning after results.
