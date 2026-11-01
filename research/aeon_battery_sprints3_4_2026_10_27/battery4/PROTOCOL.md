# Sprint 4 battery — frozen protocol

Frozen before any result on evaluation seeds 37003,37013,37021,37039,37049,37057,37061,37087,37097,37117 exists.
Worlds/tests: unchanged `battery.battery` (11 tests x 3 families). Harness: `battery3.battery3` with v4 configs added.
New controllers (`integration_sprint_v4/`, constants tuned on qualification seeds 19001,19003,19009,19013,19021 only):
- `aeon_v4`: cue-free memory; BOCPD on the sum of member-sensor standardized residuals (lambda 100, lag 8, threshold .3),
  de-duplicated 6-slot bank, retrieval by fit (margin .8). Never reads the cue.
- `aeon_v4_hybrid`: aeon_v4 + MMAC fallback triggered by model error (k=3 x running median), hysteresis (stay on MMAC
  until recovered for 16 ticks) and diverged-model reset.
Comparators: `aeon_v3_hybrid`, `aeon_v2` (cue-driven), `aeon_v2_no_retrieval`, `mmac`, `pid`.
Known from qualification: v4_hybrid spends roughly half its ticks on MMAC; its mean qual return loss (.330) was
between aeon_v2 (.327) and v2_no_retrieval, above MMAC (.273). Report the fraction of ticks on MMAC.
Pre-registered gates:
1. Cue-free memory: on T3_no_cue, aeon_v4 beats aeon_v2_no_retrieval on return loss, 95% CI > 0.
2. Cue robustness: on T2_cue_noise_x10, aeon_v4_hybrid beats aeon_v2 on return loss, CI > 0.
3. Safety: on T6_sensor_noise_x4, aeon_v4_hybrid has 0 loss-of-control runs (max error > 1.0) out of 30.
4. Generalisation of sprint-3 lesson: aeon_v4_hybrid beats aeon_v3_hybrid on return loss in at least 8 of 11 tests (CI > 0).
5. (Expected to fail) aeon_v4_hybrid beats MMAC on whole-run error in at least 6 of 11 tests.
Statistics: paired seed clusters pooled over families, 10,000 bootstrap resamples, RNG 81234. No tuning after results.
