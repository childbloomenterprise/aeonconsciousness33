# AEON integration sprint 2 — planner lead-bias fix, frozen before measurement
Date: 2026-10-27. Follows integration_sprint (decision SIMPLIFY).
Question: once the planner's lead bias is removed, does the same context-model bank reduce return-to-A error?

## Why
Post-hoc diagnosis of sprint 1 (exploratory, did not change its decision): the shared MPC scored one held action equally over 5 horizons against a moving target, so with a correct model the body led the target by ~2 ticks of target velocity (signed error ~2.0x target velocity, ~90% of steady error). The restored correct A model reproduced this lead; stale delay models partly cancelled it. Retrieval itself restored accurate models (one-step error 0.005 vs 0.045 under delay).

## Single change
LandingActor replaces only the candidate score: each horizon's squared tracking error is weighted by the share of the candidates' model-predicted effect that first arrives at that horizon (uniform if the model predicts no effect). Applied identically to all four configurations, including the adaptive baseline. Everything else is sprint 1 unchanged: sprint.py imported as-is, same worlds, phases, cues, bank (3 entries, .3/.2 thresholds), configurations, 768 actions, endpoint, pooling, bootstrap (10000, RNG 81234).

## Seeds
Fresh evaluation seeds 23001,23003,23009,23011,23021,23027,23033,23041,23047,23053 (each = a sprint-1 seed + 6000, preserving seed%4 and seed%3 and so the gain distribution). Qualification seed 19001 only. The planner fix was developed using seed 19001 only; no evaluation seed was run before freezing.

## Qualification (failed checks block evaluation)
All sprint-1 qualification checks, plus: landing weights uniform for a zero-effect model and concentrated (>0.99) on the true lag for synthetic lag-0..4 effects; and on seed 19001, ticks 150..191, |lead slope| < 1.0 (at least halved from sprint 1's ~2.0) for every family and configuration.

## Endpoint and decision
Primary: sum absolute true-body minus true-target error, ticks 576..595 (unchanged).
Success: at least 15% pooled reduction vs BOTH adaptive_baseline and no_retrieval, each 95% interval lower bound > 0, AND integrated beats shuffled (pooled control-minus-candidate > 0, interval lower bound > 0), all checks and all 120 runs completed.
Retain if success; revise if pooled means improve against both mandatory controls but any gate is missed; otherwise simplify. No post-outcome tuning or second attempt.
Also reported: lead slope per configuration on ticks 150..191 and 576..595; families descriptively.
Development evidence only; not unfamiliar-world transfer or consciousness evidence.
