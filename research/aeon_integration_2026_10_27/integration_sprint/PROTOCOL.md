# AEON integrated development sprint — frozen before measurement
Date: 2026-10-27. 30-minute budget from first workspace inspection.
Question: does validated sensor membership plus a bounded context-model bank reduce return-to-A error?

## Fixed design
- Development families: variable_delay, sensor_dropout, delay_dropout. No reserved worlds.
- Evaluation seeds: 17001,17003,17009,17011,17021,17027,17033,17041,17047,17053. Qualification seed 19001 only.
- integrated, no_retrieval, adaptive_baseline, shuffled: 120 runs of 768 actions.
- Four phases A/B/C/A, 192 actions each, existing 128-action common excitation.
- A: no delay/dropout. Delay families: B delay 1, C delay 3 using existing delayed-action law. Dropout families: B omits first body sensor, C second, for 19 of each 29 ticks; remaining sensor gets existing .025 degradation noise. Combination is delay plus dropout only. Preserve existing gains, target, noise and action bounds.
- Public context cues A=(.1,.2), B=(.8,.1), C=(.3,.9), existing .012 keyed noise. All actors receive same fields and cue availability, no evaluator labels.
- Equal action-conditioned observation laws/exogenous noise; closed-loop values may differ after different actions. Exact equality checked under common-action replay.

## Candidate
Reuse ValidatedActor and existing regression/MPC unchanged. Adapt MemoryActor's bounded nearest-context bank (3 entries, change threshold .3, match threshold .2) to full per-channel regression states. Save outgoing models on cue change; restore matching models. Never restore body/history/velocity/membership/clock/world. No forced exploration on transitions. First visits have no matched recall.
No-retrieval writes the same bank but never reads it for decisions, retaining current learned parameters. Shuffled recalls the next entry cyclically after nearest, ensuring wrong context when multiple entries exist. Baseline is existing Actor('adaptive_baseline'), receives but ignores cues. No LLM.

## Mandatory qualification
Exact JSON restart including early calibration and after recall; recall restores models and changes predictions/planning; ablation unaffected by poisoned bank; observation/cue equality under common actions; correct qualification membership; pending feedback, finite state and 20-action metric indexing. Use synthetic fixtures/seed 19001 only. Failed checks block evaluation. Fix implementation only before outcomes; retain check logs.

## Endpoint and decision
Primary: sum absolute true-body minus true-target error after actions ticks 576..595. Squared error secondary only.
Pool by averaging three family losses per seed then pair 10 seed clusters. Bootstrap 10000 paired seed-cluster resamples, RNG 81234, percentile 95% interval for control-minus-candidate error. Also report families descriptively.
Success: at least 15% pooled reduction vs BOTH baseline and no-retrieval, each interval lower bound >0, all checks and all 120 runs completed. Shuffled diagnostic only. No post-outcome tuning or second attempt.
Retain if success; revise if improves pooled means against both but misses gate; otherwise simplify. Failure blocks superiority claims.
Preserve failures, per-action errors, traces, checks, checkpoints, source fingerprints, before/after snapshots, wall/CPU timings, worst runs and report. Development evidence, not unfamiliar-world transfer or consciousness evidence.
