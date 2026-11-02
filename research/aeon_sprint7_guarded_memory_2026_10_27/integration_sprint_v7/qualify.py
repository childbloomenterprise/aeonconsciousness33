import argparse
import itertools
import json
import time
from multiprocessing import Pool, cpu_count
from pathlib import Path

import numpy as np

from baseline_benchmark.benchmark import Controller
from battery import battery
from developmental_v0_2.actors import WARMUP
from integration_sprint_v6.sprint6 import MMACMemory
from integration_sprint_v7.sprint7 import (
    DEFAULT_D,
    DEFAULT_N,
    DEFAULT_V,
    GuardedMMACMemory,
)

SEEDS = (19001, 19003, 19009, 19013, 19021)
N_VALUES = (1, 5, 9)
D_VALUES = (1, 3, 6)
V_VALUES = (0, 10, 20)
CONDITIONS = ("guarded", "mmac_memory", "mmac")
ROOT = Path(__file__).resolve().parent
QUALIFICATION = ROOT / "qualification"


def _simulate(test, seed, family, condition, params=None):
    world = battery.BatteryWorld(seed, family, **battery.TESTS[test])
    if condition == "guarded":
        controller = GuardedMMACMemory(**params)
    elif condition == "mmac_memory":
        controller = MMACMemory()
    elif condition == "mmac":
        controller = Controller("mmac", battery.PID, None)
    else:
        raise ValueError(condition)

    errors = []
    start = time.perf_counter()
    for _ in range(world.total()):
        obs = world.observe()
        cue = world.cue()
        if condition == "mmac":
            action = controller.decide(obs)
        else:
            action = controller.decide(obs, cue)["action"]
        world.step(action)
        errors.append(abs(world.body - world.target()))
    elapsed = time.perf_counter() - start

    phase_len = world.phase_len
    phase_count = len(world.seq)
    return {
        "test": test,
        "seed": seed,
        "family": family,
        "condition": condition,
        "params": params,
        "loss": float(
            sum(
                errors[
                    (phase_count - 1) * phase_len : (phase_count - 1) * phase_len + 20
                ]
            )
        ),
        "overall": float(np.mean(errors[WARMUP:])),
        "us_per_decision": float(1e6 * elapsed / len(errors)),
    }


def _job(args):
    return _simulate(*args)


def _paired_ratios(rows, baseline_rows, test=None):
    baseline_by_key = {
        (row["test"], row["seed"], row["family"]): row for row in baseline_rows
    }
    if test is not None:
        rows = [row for row in rows if row["test"] == test]
    ratios = []
    for row in rows:
        key = (row["test"], row["seed"], row["family"])
        baseline = baseline_by_key[key]
        ratios.append(
            (
                row["loss"] / max(baseline["loss"], 1e-12),
                row["overall"] / max(baseline["overall"], 1e-12),
            )
        )
    return ratios


def _grid_row(params, guarded_rows, mmac_rows):
    ratios = _paired_ratios(guarded_rows, mmac_rows)
    row = {
        **params,
        "mean_objective": float(np.mean([loss + overall for loss, overall in ratios])),
        "mean_return_loss_ratio": float(np.mean([loss for loss, _ in ratios])),
        "mean_whole_run_error_ratio": float(
            np.mean([overall for _, overall in ratios])
        ),
        "runs": len(ratios),
    }
    for test, prefix in (
        ("T1_replication", "T1"),
        ("T2_cue_noise_x10", "T2_x10"),
    ):
        test_ratios = _paired_ratios(guarded_rows, mmac_rows, test)
        row[f"{prefix}_objective_ratio"] = float(
            np.mean([loss + overall for loss, overall in test_ratios])
        )
        row[f"{prefix}_return_loss_ratio"] = float(
            np.mean([loss for loss, _ in test_ratios])
        )
        row[f"{prefix}_whole_run_error_ratio"] = float(
            np.mean([overall for _, overall in test_ratios])
        )
    return row


def _per_test_table(rows, selected_params):
    result = {}
    for test in battery.TESTS:
        test_rows = [row for row in rows if row["test"] == test]
        result[test] = {}
        for condition in CONDITIONS:
            selected = [
                row
                for row in test_rows
                if row["condition"] == condition
                and (condition != "guarded" or row["params"] == selected_params)
            ]
            result[test][condition] = {
                "return_loss_mean": float(np.mean([row["loss"] for row in selected])),
                "whole_run_mean_error": float(
                    np.mean([row["overall"] for row in selected])
                ),
                "runs": len(selected),
            }
    return result


def qualify(out=QUALIFICATION):
    out.mkdir(parents=True, exist_ok=True)
    jobs = [
        (test, seed, family, condition, None)
        for condition in ("mmac", "mmac_memory")
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]
    parameter_grid = [
        {"n": n, "d": d, "v": v}
        for n, d, v in itertools.product(N_VALUES, D_VALUES, V_VALUES)
    ]
    jobs.extend(
        (test, seed, family, "guarded", params)
        for params in parameter_grid
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    )

    started = time.perf_counter()
    with Pool(processes=min(cpu_count(), 16)) as pool:
        rows = pool.map(_job, jobs, chunksize=1)
    mmac_rows = [row for row in rows if row["condition"] == "mmac"]
    grid = []
    for params in parameter_grid:
        guarded_rows = [
            row
            for row in rows
            if row["condition"] == "guarded" and row["params"] == params
        ]
        grid.append(_grid_row(params, guarded_rows, mmac_rows))
    ranked = sorted(
        grid,
        key=lambda row: (
            row["mean_objective"],
            row["T2_x10_whole_run_error_ratio"],
            row["n"],
            row["d"],
            row["v"],
        ),
    )
    selected = {key: ranked[0][key] for key in ("n", "d", "v")}
    table = _per_test_table(rows, selected)
    timings = {}
    for condition in CONDITIONS:
        timing_rows = [
            row
            for row in rows
            if row["condition"] == condition and row["test"] == "T1_replication"
        ]
        if condition == "guarded":
            timing_rows = [row for row in timing_rows if row["params"] == selected]
        timings[condition] = float(
            np.mean([row["us_per_decision"] for row in timing_rows])
        )

    grid_artifact = {
        "qualification_seeds": list(SEEDS),
        "tests": list(battery.TESTS),
        "families": list(battery.FAMILIES),
        "grid_values": {"n": list(N_VALUES), "d": list(D_VALUES), "v": list(V_VALUES)},
        "objective": (
            "mean over paired runs of guarded return loss / MMAC return loss "
            "+ guarded whole-run mean error / MMAC whole-run mean error"
        ),
        "tie_break": "lower T2_cue_noise_x10 whole-run error ratio",
        "grid": grid,
    }
    (out / "guard_grid.json").write_text(json.dumps(grid_artifact, indent=2) + "\n")
    report = {
        "qualification_seeds": list(SEEDS),
        "selected": selected,
        "defaults_before_freeze": {"n": DEFAULT_N, "d": DEFAULT_D, "v": DEFAULT_V},
        "top_5": ranked[:5],
        "grid": ranked,
        "per_test": table,
        "us_per_decision_T1_mean_over_15_runs": timings,
        "wall_seconds": time.perf_counter() - started,
        "run_count": len(rows),
    }
    (out / "per_test_five_seeds.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=QUALIFICATION)
    args = parser.parse_args()
    qualify(args.out)


if __name__ == "__main__":
    main()
