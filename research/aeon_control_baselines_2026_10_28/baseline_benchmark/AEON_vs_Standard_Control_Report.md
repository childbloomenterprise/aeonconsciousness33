# AEON vs standard control methods — benchmark report

Frozen protocol: [PROTOCOL.md](PROTOCOL.md). 120 new baseline runs plus 60 AEON rows read from the frozen sprint-2 results; 0 failures. Seeds are sprint-2's 10 evaluation seeds; PID gains were tuned on qualification seed 19001 only. No post-outcome tuning.

**Verdict:** AEON wins only in the moment it returns to a familiar situation; over the whole run, the standard methods beat it.
- **Return to A:** AEON beats PID and textbook multiple-model switching, but not an MPC that is given the true model.
- **Whole run:** every standard method has less error than AEON, mainly because AEON re-learns slowly in each new situation (B and C).

Percentages are AEON's error relative to the baseline's: negative means AEON has less error. Intervals are 95% paired bootstraps of baseline − AEON (> 0 means AEON better).

## Return to A (first 20 actions, sprint primary metric; lower is better)

| Controller | Error | AEON vs it | 95% interval | AEON lower in |
|---|---:|---:|---|---:|
| AEON sprint 2 (integrated memory) | 0.218 | — | — | — |
| AEON without retrieval | 0.611 | −64% | [0.289, 0.515] | 10/10 seeds |
| PID + feedforward | 0.298 | −27% | [0.053, 0.104] | 26/30 runs |
| Multiple-model adaptive control (MMAC) | 0.239 | −9% | [0.003, 0.037] | 17/30 runs |
| MPC given the true model | 0.192 | +13% (worse) | [−0.041, −0.009] | 7/30 runs |
| Clairvoyant oracle (bound) | 0.169 | +29% (worse) | [−0.071, −0.027] | — |

## Whole run (mean error per action, ticks 128–767)

| Controller | Error | AEON vs it | 95% interval |
|---|---:|---:|---|
| AEON sprint 2 | 0.0236 | — | — |
| PID + feedforward | 0.0201 | +17% (worse) | [−0.0043, −0.0026] |
| MMAC | 0.0164 | +44% (worse) | [−0.0076, −0.0068] |
| MPC given the true model | 0.0161 | +47% (worse) | [−0.0079, −0.0071] |
| Clairvoyant oracle | 0.0091 | +160% (worse) | [−0.0150, −0.0141] |

Over the whole run AEON had less error than MMAC and than the true-model MPC in 0/30 runs, and than PID in 7/30.

## Per phase (mean error per action)

| Phase | AEON | PID | MMAC | True-model MPC | Oracle |
|---|---:|---:|---:|---:|---:|
| A, first visit (128–191) | 0.0180 | 0.0372 | 0.0172 | 0.0172 | 0.0156 |
| B (delay 1 / sensor 1 lost) | 0.0266 | 0.0168 | 0.0173 | 0.0168 | 0.0083 |
| C (delay 3 / sensor 2 lost) | 0.0346 | 0.0247 | 0.0217 | 0.0214 | 0.0085 |
| A, return (576–767) | 0.0114 | 0.0131 | 0.0101 | 0.0098 | 0.0083 |

By condition, the return-window win over MMAC holds only for delay_dropout (+19%, interval > 0). Under variable_delay and sensor_dropout it is not distinguishable.

## What this means
- AEON's memory gives it a real edge at the instant a known situation comes back. The edge comes from restoring a model already learned for that situation, and the context cue tells AEON when to do it. None of the baselines use the cue.
- In new situations AEON is 40–60% worse than MMAC: its generic 36-feature learned model takes much longer to re-adapt than a 5-model delay bank does.
- The MMAC and MPC baselines are given the right model structure (linear gains plus a pure delay), which is exactly how this world works. AEON has to learn a generic model. That is a real advantage for the baselines, and it is also how engineers actually solve problems like this one.

## Limits
- One simulated 1-D tracking world, three conditions, 10 seeds; no real hardware.
- AEON's rows come from sprint 2, run in the same environment (Linux, NumPy 2.2.6), not yet replicated on the original Windows setup.
- The oracle sees the true state, the future noise and the delay, so it is a bound, not a competitor.
- Development evidence only; not evidence of consciousness or of real-world transfer.

## Reproduce
From the project root (with the dependency packages, `integration_sprint/` and `integration_sprint_v2/`):
```
python -m baseline_benchmark.benchmark qualify --out baseline_benchmark/new_qualification
python -m baseline_benchmark.benchmark run --out baseline_benchmark/new_evaluation
```
