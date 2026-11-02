import argparse
import json
import time
from multiprocessing import Pool, cpu_count
from pathlib import Path

import numpy as np

from baseline_benchmark.benchmark import Controller
from battery import battery
from developmental_v0_2.actors import WARMUP
from integration_sprint import sprint
from integration_sprint_v2 import sprint2
from integration_sprint_v6.sprint6 import (
    DEFAULT_CUED_SWITCH_WINDOW,
    CuedSwitch,
    MMACMemory,
)

sprint2.install()

SEEDS = (19001, 19003, 19009, 19013, 19021)
WINDOWS = (10, 20, 40, 80)
CONDITIONS = ("cued_switch", "mmac_memory", "mmac", "aeon_integrated")
ROOT = Path(__file__).resolve().parent
QUALIFICATION = ROOT / "qualification"


def _simulate(test, seed, family, condition, window=None):
    world = battery.BatteryWorld(seed, family, **battery.TESTS[test])
    if condition == "cued_switch":
        controller = CuedSwitch(window=window)
    elif condition == "mmac_memory":
        controller = MMACMemory()
    elif condition == "mmac":
        controller = Controller("mmac", battery.PID, None)
    elif condition == "aeon_integrated":
        controller = sprint.IntegratedActor("integrated")
    else:
        raise ValueError(condition)

    errors = []
    retrievals = 0
    start = time.perf_counter()
    for _ in range(world.total()):
        obs = world.observe()
        cue = world.cue()
        if condition == "cued_switch":
            decision = controller.decide(obs, cue)
            action = decision["action"]
            retrievals += int(decision["retrieved"])
        elif condition in ("mmac_memory", "aeon_integrated"):
            decision = controller.decide(obs, cue)
            action = decision["action"]
        else:
            action = controller.decide(obs)
        world.step(action)
        if condition in ("cued_switch", "aeon_integrated"):
            controller.learn(world.observe())
        errors.append(abs(world.body - world.target()))
    elapsed = time.perf_counter() - start

    phase_len = world.phase_len
    phase_count = len(world.seq)
    post_warmup = errors[WARMUP:]
    return {
        "test": test,
        "seed": seed,
        "family": family,
        "condition": condition,
        "window": window,
        "loss": float(
            sum(
                errors[
                    (phase_count - 1) * phase_len : (phase_count - 1) * phase_len + 20
                ]
            )
        ),
        "overall": float(np.mean(post_warmup)),
        "max_post_warmup_error": float(max(post_warmup)),
        "loss_of_control": bool(max(post_warmup) > 1.0),
        "retrievals": retrievals,
        "us_per_decision": float(1e6 * elapsed / len(errors)),
    }


def _job(args):
    return _simulate(*args)


def _objective(cued_rows, mmac_rows):
    mmac_by_key = {(row["test"], row["seed"], row["family"]): row for row in mmac_rows}
    scores = []
    loss_ratios = []
    error_ratios = []
    for row in cued_rows:
        baseline = mmac_by_key[(row["test"], row["seed"], row["family"])]
        loss_ratio = row["loss"] / max(baseline["loss"], 1e-12)
        error_ratio = row["overall"] / max(baseline["overall"], 1e-12)
        loss_ratios.append(loss_ratio)
        error_ratios.append(error_ratio)
        scores.append(loss_ratio + error_ratio)
    return {
        "mean_objective": float(np.mean(scores)),
        "mean_return_loss_ratio": float(np.mean(loss_ratios)),
        "mean_whole_run_error_ratio": float(np.mean(error_ratios)),
        "runs": len(scores),
        "loss_of_control_runs": sum(row["loss_of_control"] for row in cued_rows),
    }


def _per_test_table(rows, selected_window):
    result = {}
    for test in battery.TESTS:
        test_rows = [row for row in rows if row["test"] == test]
        result[test] = {}
        for condition in CONDITIONS:
            condition_rows = [row for row in test_rows if row["condition"] == condition]
            if condition == "cued_switch":
                condition_rows = [
                    row for row in condition_rows if row["window"] == selected_window
                ]
            result[test][condition] = {
                "return_loss_mean": float(
                    np.mean([row["loss"] for row in condition_rows])
                ),
                "whole_run_mean_error": float(
                    np.mean([row["overall"] for row in condition_rows])
                ),
                "loss_of_control_runs": sum(
                    row["loss_of_control"] for row in condition_rows
                ),
                "runs": len(condition_rows),
            }
    return result


def qualify(out=QUALIFICATION):
    out.mkdir(parents=True, exist_ok=True)
    jobs = [
        (test, seed, family, "mmac", None)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]
    jobs += [
        (test, seed, family, "aeon_integrated", None)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]
    jobs += [
        (test, seed, family, "mmac_memory", None)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]
    jobs += [
        (test, seed, family, "cued_switch", window)
        for window in WINDOWS
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]

    started = time.perf_counter()
    with Pool(processes=min(cpu_count(), 16)) as pool:
        rows = pool.map(_job, jobs, chunksize=1)
    mmac_rows = [row for row in rows if row["condition"] == "mmac"]
    grid = []
    for window in WINDOWS:
        window_rows = [
            row
            for row in rows
            if row["condition"] == "cued_switch" and row["window"] == window
        ]
        grid.append(
            {
                "window": window,
                **_objective(window_rows, mmac_rows),
            }
        )
    selected_window = min(
        grid, key=lambda candidate: (candidate["mean_objective"], candidate["window"])
    )["window"]
    table = _per_test_table(rows, selected_window)
    timings = {}
    for condition in CONDITIONS:
        condition_rows = [
            row
            for row in rows
            if row["condition"] == condition and row["test"] == "T1_replication"
        ]
        if condition == "cued_switch":
            condition_rows = [
                row for row in condition_rows if row["window"] == selected_window
            ]
        timings[condition] = float(
            np.mean([row["us_per_decision"] for row in condition_rows])
        )

    grid_artifact = {
        "qualification_seeds": list(SEEDS),
        "tests": list(battery.TESTS),
        "families": list(battery.FAMILIES),
        "objective": (
            "mean over paired runs of cued return loss / MMAC return loss "
            "+ cued whole-run mean error / MMAC whole-run mean error"
        ),
        "grid": grid,
    }
    (out / "window_grid.json").write_text(json.dumps(grid_artifact, indent=2) + "\n")
    report = {
        "qualification_seeds": list(SEEDS),
        "selected_window": selected_window,
        "default_window_before_freeze": DEFAULT_CUED_SWITCH_WINDOW,
        "grid": grid,
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
