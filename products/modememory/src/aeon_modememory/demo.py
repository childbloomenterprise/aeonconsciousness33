"""Synthetic changeover demo: DelayMMAC with and without ModeMemory.

Plant (parameters fixed before any result was inspected, and unchanged since):

* First-order integrating body, ``body += gains[mode] @ u[t - delay[mode]]``
  plus external noise with standard deviation 0.001.
* Three modes with mode-dependent gain and pure delay:
  ``A: gains (0.15, -0.12), delay 0``; ``B: gains (0.22, -0.18), delay 2``;
  ``C: gains (0.10, -0.08), delay 4``.
* Mode sequence ``A, B, C, A, B, C``, 192 ticks per phase, 1152 ticks per run.
* Two measurement channels: a precise one (noise sd 0.004) and a coarse one
  (noise sd 0.015); the controller identifies and fuses them itself.
* Mode signal: a 2-vector cue per mode (``A (0.1, 0.2)``, ``B (0.8, 0.1)``,
  ``C (0.3, 0.9)``) with additive noise of scale 0.012.
* Target: ``0.55 sin(0.035 t + 0.13) + 0.18 sin(0.087 t)``.
* Ten fixed seeds, 9001 to 9010.

Reported metrics, both lower-is-better:

* Return error: the sum of absolute errors over the first 20 ticks after each
  return to an already-seen mode (the starts of phases 4, 5 and 6), averaged
  over the three returns.
* Whole-run error: the mean absolute error after the 128-tick warmup.

The paired bootstrap resamples the ten seed-level differences
(baseline minus memory) 10000 times and reports a percentile 95% interval.
"""

import math

import numpy as np

from aeon_modememory.delay_mmac import WARMUP, DelayMMAC
from aeon_modememory.modememory import ModeMemory

SEEDS = (9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009, 9010)
SEQUENCE = ("A", "B", "C", "A", "B", "C")
PHASE = 192
MODE_GAINS = {"A": (0.15, -0.12), "B": (0.22, -0.18), "C": (0.10, -0.08)}
MODE_DELAY = {"A": 0, "B": 2, "C": 4}
MODE_CUE = {"A": (0.1, 0.2), "B": (0.8, 0.1), "C": (0.3, 0.9)}
CUE_NOISE = 0.012
SENSOR_NOISE = (0.004, 0.015)
EXTERNAL_NOISE = 0.001
RETURN_WINDOW = 20
BOOTSTRAP_SAMPLES = 10000
BOOTSTRAP_SEED = 20261027


class ChangeoverPlant:
    """Delayed first-order plant whose gain and delay depend on the mode."""

    def __init__(self, seed):
        self.seed = int(seed)
        self.rng = np.random.default_rng(self.seed)
        self.tick = 0
        self.body = -0.3
        self.history = []

    def mode(self):
        return SEQUENCE[min(self.tick // PHASE, len(SEQUENCE) - 1)]

    def target(self):
        return 0.55 * math.sin(0.035 * self.tick + 0.13) + 0.18 * math.sin(
            0.087 * self.tick
        )

    def cue(self):
        base = MODE_CUE[self.mode()]
        return [value + CUE_NOISE * float(self.rng.standard_normal()) for value in base]

    def measurement(self):
        return {
            "fast": self.body + SENSOR_NOISE[0] * float(self.rng.standard_normal()),
            "slow": self.body + SENSOR_NOISE[1] * float(self.rng.standard_normal()),
        }

    def step(self, action):
        mode = self.mode()
        self.history.append([float(value) for value in action])
        index = len(self.history) - 1 - MODE_DELAY[mode]
        applied = self.history[index] if index >= 0 else [0.0, 0.0]
        gains = MODE_GAINS[mode]
        self.body += sum(
            gains[channel] * applied[channel] for channel in range(2)
        ) + EXTERNAL_NOISE * float(self.rng.standard_normal())
        self.tick += 1
        self.history = self.history[-16:]


def run(seed, with_memory):
    """Run one trial and return its per-tick absolute errors."""
    plant = ChangeoverPlant(seed)
    controller = DelayMMAC()
    memory = ModeMemory(debounce=3) if with_memory else None
    errors = []
    for _ in range(PHASE * len(SEQUENCE)):
        measurement = plant.measurement()
        target = plant.target()
        cue = plant.cue()
        if memory is not None:
            memory.step(cue, controller)
        action = controller.act(measurement, target)
        plant.step(action)
        errors.append(abs(plant.body - plant.target()))
    return np.array(errors)


def metrics(errors):
    returns = [
        float(errors[start * PHASE : start * PHASE + RETURN_WINDOW].sum())
        for start in range(len(SEQUENCE) // 2, len(SEQUENCE))
    ]
    return float(np.mean(returns)), float(np.mean(errors[WARMUP:]))


def paired_bootstrap(baseline, treatment):
    """Percentile 95% interval for the mean paired difference."""
    differences = np.asarray(baseline, dtype=float) - np.asarray(treatment, dtype=float)
    rng = np.random.default_rng(BOOTSTRAP_SEED)
    draws = rng.integers(0, len(differences), (BOOTSTRAP_SAMPLES, len(differences)))
    means = differences[draws].mean(axis=1)
    return (
        float(differences.mean()),
        float(np.percentile(means, 2.5)),
        float(np.percentile(means, 97.5)),
    )


def main():
    rows = []
    for seed in SEEDS:
        base_return, base_overall = metrics(run(seed, with_memory=False))
        memory_return, memory_overall = metrics(run(seed, with_memory=True))
        rows.append(
            {
                "seed": seed,
                "base_return": base_return,
                "memory_return": memory_return,
                "base_overall": base_overall,
                "memory_overall": memory_overall,
            }
        )

    print("aeon-modememory demo: synthetic 3-mode changeover plant")
    print(f"modes {'/'.join(SEQUENCE)}, {PHASE} ticks per phase, {len(SEEDS)} seeds")
    print("return error = sum |error| over 20 ticks after each return (3 returns)")
    print("whole-run error = mean |error| after the 128-tick warmup")
    print()
    header = (
        f"{'seed':>6} {'return MMAC':>12} {'return +mem':>12} {'delta %':>9} "
        f"{'run MMAC':>10} {'run +mem':>10} {'delta %':>9}"
    )
    print(header)
    print("-" * len(header))
    for row in rows:
        return_delta = (
            100.0 * (row["base_return"] - row["memory_return"]) / row["base_return"]
        )
        overall_delta = (
            100.0 * (row["base_overall"] - row["memory_overall"]) / row["base_overall"]
        )
        print(
            f"{row['seed']:>6} {row['base_return']:>12.6f} "
            f"{row['memory_return']:>12.6f} {return_delta:>9.2f} "
            f"{row['base_overall']:>10.6f} {row['memory_overall']:>10.6f} "
            f"{overall_delta:>9.2f}"
        )

    print()
    for label, base_key, memory_key in (
        ("return error", "base_return", "memory_return"),
        ("whole-run error", "base_overall", "memory_overall"),
    ):
        base = [row[base_key] for row in rows]
        treatment = [row[memory_key] for row in rows]
        mean_difference, low, high = paired_bootstrap(base, treatment)
        base_mean = float(np.mean(base))
        print(
            f"{label}: MMAC {base_mean:.6f}, +memory {float(np.mean(treatment)):.6f}, "
            f"mean reduction {mean_difference:.6f} "
            f"({100.0 * mean_difference / base_mean:.2f}%), "
            f"paired bootstrap 95% CI [{low:.6f}, {high:.6f}]"
        )
    print()
    print("A reduction is a win for the memory only if the whole interval is above 0.")


if __name__ == "__main__":
    main()
