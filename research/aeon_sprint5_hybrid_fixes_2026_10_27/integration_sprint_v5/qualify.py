"""Five-seed fallback-only qualification for the fixed hybrid controllers."""

import argparse
import json
import multiprocessing
import os
import statistics
import time
from pathlib import Path

from battery import battery
from developmental_v0_2.actors import WARMUP
from integration_sprint_v3 import sprint3
from integration_sprint_v4 import sprint4
from integration_sprint_v5.sprint5 import V3HybridFixed, V4HybridFixed

SEEDS = (19001, 19003, 19009, 19013, 19021)
OUT = Path(__file__).resolve().parent / "qualification"
V3_GRID = OUT / "v3_fallback_grid.json"
V4_GRID = OUT / "v4_fallback_grid.json"
REPORT = OUT / "per_test_five_seeds.json"


def _hybrid_job(job):
    variant, test, seed, family, floor, multiplier, fallback_k = job
    world = battery.BatteryWorld(seed, family, **battery.TESTS[test])
    if variant in ("v3_fixed", "v3_unfixed"):
        actor_class = V3HybridFixed if variant == "v3_fixed" else sprint3.V3Hybrid
        actor = actor_class(
            hazard_lambda=sprint3.DETECTOR_HAZARD_LAMBDA,
            lag=sprint3.DETECTOR_LAG,
            threshold=sprint3.DETECTOR_THRESHOLD,
            detector_signal=sprint3.DETECTOR_SIGNAL,
            retrieval_margin=sprint3.RETRIEVAL_IMPROVEMENT,
            fallback_enabled=True,
            fallback_floor=floor,
            fallback_multiplier=multiplier,
        )
    else:
        actor_class = V4HybridFixed if variant == "v4_fixed" else sprint4.V4Hybrid
        actor = actor_class(
            hazard_lambda=sprint4.DETECTOR_HAZARD_LAMBDA,
            threshold=sprint4.DETECTOR_THRESHOLD,
            detector_signal=sprint4.DETECTOR_SIGNAL,
            combine=sprint4.DETECTOR_COMBINE,
            lag=sprint4.DETECTOR_LAG,
            retrieval_margin=sprint4.RETRIEVAL_MARGIN,
            fallback_enabled=True,
            fallback_k=fallback_k,
        )

    errors = []
    started = time.perf_counter()
    for _ in range(world.total()):
        obs = world.observe()
        decision = actor.decide(obs, world.cue())
        world.step(decision["action"])
        actor.learn(world.observe())
        errors.append(abs(world.body - world.target()))
    elapsed = time.perf_counter() - started
    start = (len(world.seq) - 1) * world.phase_len
    return {
        "variant": variant,
        "test": test,
        "seed": seed,
        "family": family,
        "loss": float(sum(errors[start : start + 20])),
        "fallback_ticks": len(actor.fallback_ticks),
        "loss_of_control": max(errors[WARMUP:], default=0.0) > 1.0,
        "max_error_after_warmup": max(errors[WARMUP:], default=0.0),
        "us_per_decision": 1e6 * elapsed / len(errors),
    }


def _baseline_job(job):
    test, seed, family, condition = job
    row = battery.run(test, seed, family, condition)
    return {
        "variant": condition,
        "test": test,
        "seed": seed,
        "family": family,
        "loss": row["loss"],
        "fallback_ticks": 0,
        "loss_of_control": max(row["absolute_errors"][WARMUP:], default=0.0) > 1.0,
        "max_error_after_warmup": max(row["absolute_errors"][WARMUP:], default=0.0),
        "us_per_decision": row["us_per_decision"],
    }


def _pool_map(function, jobs):
    workers = min(16, os.cpu_count() or 1)
    with multiprocessing.Pool(workers) as pool:
        return pool.map(function, jobs, chunksize=max(1, len(jobs) // (workers * 8)))


def _jobs(variant, floor=0.1, multiplier=3.0, fallback_k=3.0):
    return [
        (variant, test, seed, family, floor, multiplier, fallback_k)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]


def _aggregate(rows):
    return {
        "mean_loss": statistics.fmean(row["loss"] for row in rows),
        "fallback_ticks": sum(row["fallback_ticks"] for row in rows),
        "loss_of_control_runs": sum(row["loss_of_control"] for row in rows),
        "runs": len(rows),
    }


def _save(path, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def run_grids():
    v3_rows = []
    for floor in (0.1, 0.3):
        for multiplier in (3.0, 5.0):
            per_run = _pool_map(
                _hybrid_job,
                _jobs("v3_fixed", floor=floor, multiplier=multiplier),
            )
            row = {
                "fallback_floor": floor,
                "fallback_multiplier": multiplier,
                **_aggregate(per_run),
                "per_run": per_run,
            }
            v3_rows.append(row)
            _save(V3_GRID, {"complete": False, "rows": v3_rows})
            print("v3", floor, multiplier, row["mean_loss"], flush=True)
    v3_ranked = sorted(
        v3_rows,
        key=lambda row: (
            row["mean_loss"],
            row["loss_of_control_runs"],
            row["fallback_ticks"],
        ),
    )
    _save(
        V3_GRID,
        {
            "complete": True,
            "seeds": SEEDS,
            "objective": "minimum mean V3HybridFixed return-window loss",
            "selected": {
                "fallback_floor": v3_ranked[0]["fallback_floor"],
                "fallback_multiplier": v3_ranked[0]["fallback_multiplier"],
            },
            "rows": v3_rows,
        },
    )

    v4_rows = []
    for fallback_k in (3.0, 5.0):
        per_run = _pool_map(
            _hybrid_job,
            _jobs("v4_fixed", fallback_k=fallback_k),
        )
        row = {
            "fallback_k": fallback_k,
            **_aggregate(per_run),
            "per_run": per_run,
        }
        v4_rows.append(row)
        _save(V4_GRID, {"complete": False, "rows": v4_rows})
        print("v4", fallback_k, row["mean_loss"], flush=True)
    v4_ranked = sorted(
        v4_rows,
        key=lambda row: (
            row["mean_loss"],
            row["loss_of_control_runs"],
            row["fallback_ticks"],
        ),
    )
    _save(
        V4_GRID,
        {
            "complete": True,
            "seeds": SEEDS,
            "objective": "minimum mean V4HybridFixed return-window loss",
            "selected": {"fallback_k": v4_ranked[0]["fallback_k"]},
            "rows": v4_rows,
        },
    )


def run_report():
    v3_selected = json.loads(V3_GRID.read_text())["selected"]
    v4_selected = json.loads(V4_GRID.read_text())["selected"]
    hybrid_jobs = []
    for variant in ("v3_fixed", "v3_unfixed"):
        hybrid_jobs.extend(
            _jobs(
                variant,
                floor=v3_selected["fallback_floor"],
                multiplier=v3_selected["fallback_multiplier"],
            )
        )
    for variant in ("v4_fixed", "v4_unfixed"):
        hybrid_jobs.extend(_jobs(variant, fallback_k=v4_selected["fallback_k"]))
    hybrid_rows = _pool_map(_hybrid_job, hybrid_jobs)
    baseline_jobs = [
        (test, seed, family, condition)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
        for condition in ("mmac", "aeon_integrated")
    ]
    baseline_rows = _pool_map(_baseline_job, baseline_jobs)
    rows = hybrid_rows + baseline_rows

    per_test = {}
    for test in battery.TESTS:
        per_test[test] = {}
        for variant in (
            "v3_fixed",
            "v3_unfixed",
            "v4_fixed",
            "v4_unfixed",
            "mmac",
            "aeon_integrated",
        ):
            selected = [
                row for row in rows if row["test"] == test and row["variant"] == variant
            ]
            per_test[test][variant] = {
                "mean_loss": statistics.fmean(row["loss"] for row in selected),
                "fallback_ticks": sum(row["fallback_ticks"] for row in selected),
                "loss_of_control_runs": sum(row["loss_of_control"] for row in selected),
                "runs": len(selected),
            }

    timing = {}
    for variant, floor, multiplier, fallback_k in (
        (
            "v3_fixed",
            v3_selected["fallback_floor"],
            v3_selected["fallback_multiplier"],
            3.0,
        ),
        ("v4_fixed", 0.1, 3.0, v4_selected["fallback_k"]),
    ):
        measurements = [
            _hybrid_job(
                (
                    variant,
                    "T1_replication",
                    19001,
                    "variable_delay",
                    floor,
                    multiplier,
                    fallback_k,
                )
            )["us_per_decision"]
            for _ in range(3)
        ]
        timing[variant] = {
            "measurements": measurements,
            "mean_us_per_decision": statistics.fmean(measurements),
        }

    _save(
        REPORT,
        {
            "seeds": SEEDS,
            "v3_selected": v3_selected,
            "v4_selected": v4_selected,
            "unfixed_hybrids_use_selected_fixed_fallback_parameters": True,
            "per_test": per_test,
            "timing": timing,
            "per_run": rows,
        },
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("grids", "report", "all"))
    args = parser.parse_args()
    if args.mode in ("grids", "all"):
        run_grids()
    if args.mode in ("report", "all"):
        run_report()


if __name__ == "__main__":
    main()
