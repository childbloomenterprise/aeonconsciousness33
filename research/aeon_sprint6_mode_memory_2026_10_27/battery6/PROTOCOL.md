# Sprint 6 battery: mode memory on top of MMAC, frozen protocol

Frozen before any result on evaluation seeds 43003,43013,43019,43037,43049,43051,43063,43067,43093,43103 exists.
Worlds/tests: unchanged `battery.battery` (11 tests x 3 families). Controllers (`integration_sprint_v6/`, W tuned on
qualification seeds 19001,19003,19009,19013,19021 only):
- `mmac_memory`: textbook MMAC plus a per-mode memory (keyed by the context cue) of its online delay-error estimates,
  stored on leaving a mode and restored on return (AEON's sprint-2 recall idea applied to a classical controller).
- `cued_switch`: MMAC by default; AEON v2 controls for W=40 ticks after a cued recall; AEON always learns from the
  executed action.
Comparators: `mmac`, `aeon_v2`, `pid`.
Pre-registered gates for mmac_memory (the product candidate):
1. Beats MMAC on return loss with 95% CI > 0 in at least 6 of 11 tests.
2. Never reliably worse than MMAC on return loss or whole-run error in any test (including noisy/absent cue).
3. 0 loss-of-control runs (max post-warmup error > 1.0) in every test.
4. Overhead below 2x MMAC per decision.
Secondary: cued_switch beats MMAC on return loss in T5 and T7_phase_64 (CI > 0).
Statistics: paired seed clusters pooled over families, 10,000 bootstrap resamples, RNG 81234. No tuning after results.
