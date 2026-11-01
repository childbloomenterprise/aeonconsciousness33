# Sprint 5 battery: hybrid bug fixes, frozen protocol

Frozen before any result on evaluation seeds 41011,41023,41039,41047,41051,41057,41077,41081,41113,41117 exists.
Worlds/tests: unchanged `battery.battery` (11 tests x 3 families). Harness: `battery4.battery4` with fixed configs.
Fixes (`integration_sprint_v5/`, found by Devin Review on PR #3):
1. On fallback ticks the hybrids now learn from, and record in history, the action that MMAC actually executed
   (previously AEON's unexecuted action).
2. v4: locked-sensor dropout no longer ends an active fallback.
3. v4: multistep forecasts use executed actions (option not selected; included for completeness).
Fallback parameters were re-tuned on qualification seeds 19001,19003,19009,19013,19021 only (detectors unchanged):
v3 fixed floor .3, multiplier 3; v4 fixed k=3.
Configs: `aeon_v4_hybrid_fixed`, `aeon_v4_hybrid` (published, buggy), `aeon_v3_hybrid_fixed`, `aeon_v3_hybrid`
(published, buggy), `aeon_v2`, `mmac`, `pid`.
Pre-registered gates:
1. The fix matters: v4 hybrid fixed beats v4 hybrid on return loss with CI > 0 in at least 3 of 11 tests and is
   reliably worse in none.
2. Safety: v4 hybrid fixed has 0 loss-of-control runs (max error > 1.0 after warmup) on T6_sensor_noise_x4.
3. v4 hybrid fixed beats MMAC on return loss with CI > 0 in at least 1 test.
4. (Expected to fail) v4 hybrid fixed beats MMAC on whole-run error in at least 6 of 11 tests.
Statistics: paired seed clusters pooled over families, 10,000 bootstrap resamples, RNG 81234. No tuning after results.
