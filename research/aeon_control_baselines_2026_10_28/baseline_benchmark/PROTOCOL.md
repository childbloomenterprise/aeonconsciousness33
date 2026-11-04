# AEON vs standard control baselines — frozen protocol

Question: on the sprint-2 worlds, how does AEON's sprint-2 controller (integrated memory, landing planner) compare with standard control methods?

- Worlds, families (variable_delay, sensor_dropout, delay_dropout), phases A/B/C/A, action set (17 single-actuator candidates), 128-tick warmup excitation: identical to integration_sprint_v2.
- Evaluation seeds: 23001,23003,23009,23011,23021,23027,23033,23041,23047,23053 (sprint-2's). AEON integrated and no_retrieval rows are read from the frozen sprint-2 results.json (sha in protocol_freeze.json), not re-run.
- Qualification and PID tuning: seed 19001 only.
- Baselines. All except the oracle get the same observations AEON gets, minus the context cue (no baseline uses cues):
  - `pid`: PID with target-velocity feedforward. It uses warmup least-squares system ID and inverse-variance sensor fusion, then quantizes to the nearest candidate. Gains come from a grid on 19001 and are frozen.
  - `mmac`: textbook multiple-model adaptive control. Gains come from warmup system ID. A bank of pure-delay models (d=0..4) is switched by exponentially weighted prediction error (lambda=0.9). It runs a one-step landing MPC with the chosen model.
  - `mpc_known`: the same MPC, but given the true gains and the true current delay (privileged model, same noisy sensors).
  - `oracle`: a clairvoyant greedy bound. It simulates the true world (dynamics, delay, noise) for each candidate. It is not achievable by any real controller.
- Metrics, lower is better:
  - `loss`: sprint primary, summed |error| over the first 20 actions after returning to A (576..595).
  - `overall`: mean |error| over ticks 128..767.
  - Per-phase means.
- Statistics: paired seed clusters, 10,000 bootstrap resamples, RNG 81234, 95% intervals of control − AEON.
- Interpretation: "AEON better than X" only if the interval lower bound > 0. "AEON worse" only if the upper bound < 0. Otherwise not distinguishable.
- No post-outcome tuning or rerun. Development evidence only; not evidence of consciousness or real-world transfer.
