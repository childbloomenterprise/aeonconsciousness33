# Sprint 7 battery: guarded mode memory, frozen protocol

Frozen before any result on evaluation seeds 47017,47041,47057,47059,47087,47093,47111,47119,47123,47129 exists.
`guarded_memory` = `integration_sprint_v7.GuardedMMACMemory(n=1, d=3, v=0)`: sprint-6 MMACMemory where a mode change is
declared only after the cue has stayed > .3 away for 3 consecutive ticks. Selection rule on qualification seeds
19001–19021: best mean objective (return + whole-run ratios vs MMAC) among settings whose T2_cue_noise_x10 return and
whole-run ratios are both <= 1 (the plain objective winner, n=d=1, equals MMACMemory and failed that gate).
Comparators: `mmac_memory` (sprint 6), `mmac`, `pid`.
Gates (guarded_memory):
1. Beats MMAC on return loss with CI > 0 in at least 6 of 11 tests.
2. Never reliably worse than MMAC (return or whole-run) in any test.
3. 0 loss-of-control runs.
4. Compute below 2x MMAC.
Statistics: paired seed clusters pooled over families, 10,000 bootstrap resamples, RNG 81234. No tuning after results.
