# AEON integration sprint 2 — decision report

**Decision: RETAIN.** Frozen success criterion: MET (all three gates).

Completed 120/120 trials, 0 runtime failures, 92,160 actions. Evaluation wall time 231.3 s. No LLM, no reserved world, no post-outcome tuning or rerun.

## What changed from sprint 1
One thing: the shared planner's candidate score (`LandingActor` in `sprint2.py`). Sprint 1's planner scored one held action equally over 5 future steps against a moving target, so with a correct model it steered the body about 2 ticks of target velocity *ahead* of the target. Sprint 2 weights each step by when the model predicts the action's effect actually lands. The fix applies to all four configurations, baseline included. `sprint.py` is imported unchanged; worlds, cues, memory bank, configurations, endpoint and statistics are identical. Evaluation seeds are fresh (23001…23053 = sprint-1 seeds + 6000, same gain distribution); the fix was developed on qualification seed 19001 only. Protocol frozen 2026-10-27T04:25:10Z, before any evaluation seed ran.

## Primary result (lower is better: summed |error| over the first 20 actions after returning to A)

| Configuration | Mean error | Candidate improvement | Paired 95% interval, control − candidate |
|---|---:|---:|---|
| Integrated candidate | 0.2177 | — | — |
| no_retrieval | 0.6106 | 64.4% | [0.289, 0.515] |
| adaptive_baseline | 0.5980 | 63.6% | [0.280, 0.504] |
| shuffled (now a required gate) | 0.4528 | 51.9% | [0.189, 0.288] |

The candidate had lower error than no_retrieval and shuffled in **10 of 10 seeds**.

## Per condition (descriptive)

| Condition | Integrated | No retrieval | Simpler controller | Shuffled |
|---|---:|---:|---:|---:|
| variable_delay | 0.222 | 0.747 | 0.747 | 0.599 |
| sensor_dropout | 0.210 | 0.493 | 0.427 | 0.240 |
| delay_dropout | 0.221 | 0.592 | 0.619 | 0.520 |

Under sensor_dropout the advantage over shuffled is small (12.4%, interval [0.003, 0.059]): B's memory of the main sensor is nearly correct, because that sensor was missing but clean during B.

## Recovery over the whole return (pooled, per 20 actions)

| Window | Integrated | No retrieval | Simpler controller | Shuffled |
|---|---:|---:|---:|---:|
| End of first A visit (172–191) | 0.218 | 0.218 | 0.218 | 0.218 |
| End of C (556–575) | 0.533 | 0.533 | 0.553 | 0.533 |
| Return 576–595 (primary) | 0.218 | 0.611 | 0.598 | 0.453 |
| 596–615 | 0.212 | 0.480 | 0.474 | 0.399 |
| 616–675 | 0.225 | 0.417 | 0.414 | 0.371 |
| 676–767 | 0.238 | 0.393 | 0.387 | 0.351 |

With memory, AEON is back to its pre-departure error on its first action in A. Without memory it is still about 65% worse 192 actions later.

## Planner bias (signed error ÷ target velocity; 0 = no lead)
Sprint 1: about 2.0 for every configuration. Sprint 2, ticks 150–191: 0.18 for all. Return window: integrated 0.19, no_retrieval 0.35, baseline 0.31, shuffled 0.49. On its own, the fix cut steady tracking error in the first A visit from 0.599 to 0.218 (−64%) for every configuration.

## Qualification and integrity
All 10 sprint-1 qualification checks passed (restarts, poisoned-bank ablation, recall changes planning, shuffled picks the wrong context, metric indexing), plus two new ones: synthetic landing weights, and lead slope < 1.0 on seed 19001 (measured 0.435). Every trace hash chain verified. Each run's signed-error replay matched its measured errors exactly. Every integrated run retrieved exactly once, at tick 576, from context A.

## Limits
- This is the second attempt at the question. The fix was designed after looking at sprint-1 outcomes; only sprint-2's seeds are fresh. Sprint 1's SIMPLIFY decision stands for sprint 1.
- Not independently replicated. It ran on Linux, Python 3.12, NumPy 2.2.6; the original ran on Windows with NumPy 2.4.6. Re-run on the original machine before relying on it.
- Public context cues tell the actor when the context changes, which strongly scaffolds retrieval. The worlds are familiar development families, with 10 seeds.
- no_retrieval and the simpler controller are the same algorithm in 26 of 30 runs (sensor-pair selection almost always agrees).
- The 13 developmental regression tests were not re-run (dependencies unchanged, not in this environment's test set).
- Development evidence only: not evidence of unfamiliar-world transfer or consciousness.

## Reproduce
From a project root containing `aeon_developmental`, `developmental_v0_2`, `developmental_cases` and `integration_sprint/sprint.py`:
```
python -m integration_sprint_v2.sprint2 qualify --out integration_sprint_v2/new_qualification
python -m integration_sprint_v2.sprint2 run --out integration_sprint_v2/new_evaluation
```
`run` requires the passing qualification at `integration_sprint_v2/qualification/qualification.json` and the source hashes in `protocol_freeze.json`. Windows line endings change those hashes, so regenerate the freeze for a CRLF checkout. `postmortem_sprint1/` contains the exploratory sprint-1 diagnostics that motivated the fix.
