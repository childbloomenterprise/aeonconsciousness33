"""Five-seed detector and fallback qualification for AEON v4."""

import argparse
import json
import multiprocessing
import os
import statistics
import time
from pathlib import Path

from battery import battery
from developmental_v0_2.actors import WARMUP
from integration_sprint_v4 import sprint4
from integration_sprint_v4.sprint4 import V4Actor, V4Hybrid

SEEDS = (19001, 19003, 19009, 19013, 19021)
ROOT = Path(__file__).resolve().parent
OUT = ROOT / "qualification"
DETECTOR_CASES = (
    ("locked_signed", "single"),
    ("member_standardized", "single"),
    ("member_standardized", "per_sensor_or"),
    ("multistep", "single"),
)


def _actor_job(job):
    test, seed, family, kind, signal, combine, hazard, threshold, fallback_k = job
    world = battery.BatteryWorld(seed, family, **battery.TESTS[test])
    options = {
        "hazard_lambda": hazard,
        "threshold": threshold,
        "detector_signal": signal,
        "combine": combine,
        "lag": 8,
        "retrieval_margin": 0.8,
    }
    if kind == "actor":
        actor = V4Actor(**options)
    else:
        actor = V4Hybrid(**options, fallback_enabled=True, fallback_k=fallback_k)

    errors = []
    started = time.perf_counter()
    for _ in range(world.total()):
        obs = world.observe()
        decision = actor.decide(obs, world.cue())
        world.step(decision["action"])
        actor.learn(world.observe())
        errors.append(abs(world.body - world.target()))
    elapsed = time.perf_counter() - started

    switches = [index * world.phase_len for index in range(1, len(world.seq))]
    declarations = list(actor.declarations)
    hits = sum(
        any(switch <= declaration < switch + 40 for declaration in declarations)
        for switch in switches
    )
    false_alarms = sum(
        not any(switch <= declaration < switch + 40 for switch in switches)
        for declaration in declarations
    )
    loss_start = (len(world.seq) - 1) * world.phase_len
    return {
        "test": test,
        "seed": seed,
        "family": family,
        "kind": kind,
        "signal": signal,
        "combine": combine,
        "hazard_lambda": hazard,
        "threshold": threshold,
        "fallback_k": fallback_k,
        "loss": float(sum(errors[loss_start : loss_start + 20])),
        "hits": hits,
        "switches": len(switches),
        "false_alarms": false_alarms,
        "restores": actor.retrieval_restored,
        "fallback_ticks": len(getattr(actor, "fallback_ticks", [])),
        "loss_of_control": max(errors[WARMUP:], default=0.0) > 1.0,
        "max_error_after_warmup": max(errors[WARMUP:], default=0.0),
        "us_per_decision": 1e6 * elapsed / len(errors),
    }


def _baseline_job(job):
    test, seed, family, config = job
    row = battery.run(test, seed, family, config)
    return {
        "test": test,
        "seed": seed,
        "family": family,
        "condition": config,
        "loss": row["loss"],
    }


def _pool_map(function, jobs):
    workers = min(16, os.cpu_count() or 1)
    with multiprocessing.Pool(processes=workers) as pool:
        return pool.map(function, jobs, chunksize=max(1, len(jobs) // (workers * 8)))


def _save(name, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def _aggregate(rows):
    return {
        "mean_loss": statistics.fmean(row["loss"] for row in rows),
        "hits": sum(row["hits"] for row in rows),
        "switches": sum(row["switches"] for row in rows),
        "false_alarms": sum(row["false_alarms"] for row in rows),
        "restores": sum(row["restores"] for row in rows),
        "fallback_ticks": sum(row["fallback_ticks"] for row in rows),
        "loss_of_control_runs": sum(row["loss_of_control"] for row in rows),
        "mean_us_per_decision": statistics.fmean(
            row["us_per_decision"] for row in rows
        ),
        "runs": len(rows),
    }


def _actor_jobs(kind, signal, combine, hazard, threshold, fallback_k=3):
    return [
        (
            test,
            seed,
            family,
            kind,
            signal,
            combine,
            hazard,
            threshold,
            fallback_k,
        )
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
    ]


def stage_a():
    rows = []
    for signal, combine in DETECTOR_CASES:
        for hazard in (100, 250):
            for threshold in (0.3, 0.5):
                run_rows = _pool_map(
                    _actor_job,
                    _actor_jobs("actor", signal, combine, hazard, threshold),
                )
                row = {
                    "signal": signal,
                    "combine": combine,
                    "hazard_lambda": hazard,
                    "threshold": threshold,
                    **_aggregate(run_rows),
                    "per_run": run_rows,
                }
                rows.append(row)
                print(
                    "stage A",
                    signal,
                    combine,
                    hazard,
                    threshold,
                    round(row["mean_loss"], 6),
                    flush=True,
                )
                _save("stage_a_detector_grid.json", {"complete": False, "rows": rows})

    ranked = sorted(
        rows,
        key=lambda row: (
            row["mean_loss"],
            row["false_alarms"],
            -row["hits"],
        ),
    )
    result = {
        "complete": True,
        "seeds": SEEDS,
        "objective": "minimum mean V4Actor return-window loss, fallback disabled",
        "selected": {
            key: ranked[0][key]
            for key in ("signal", "combine", "hazard_lambda", "threshold")
        },
        "top_5": ranked[:5],
        "rows": rows,
    }
    _save("stage_a_detector_grid.json", result)
    print("stage A selected:", result["selected"])


def stage_b():
    stage_a_path = OUT / "stage_a_detector_grid.json"
    selected = json.loads(stage_a_path.read_text())["selected"]
    rows = []
    for fallback_k in (3, 5):
        run_rows = _pool_map(
            _actor_job,
            _actor_jobs(
                "hybrid",
                selected["signal"],
                selected["combine"],
                selected["hazard_lambda"],
                selected["threshold"],
                fallback_k,
            ),
        )
        row = {
            **selected,
            "fallback_k": fallback_k,
            **_aggregate(run_rows),
            "per_run": run_rows,
        }
        rows.append(row)
        print("stage B", fallback_k, round(row["mean_loss"], 6), flush=True)
    ranked = sorted(
        rows,
        key=lambda row: (
            row["mean_loss"],
            row["false_alarms"],
            -row["hits"],
        ),
    )
    _save(
        "stage_b_fallback_grid.json",
        {
            "complete": True,
            "seeds": SEEDS,
            "objective": "minimum mean V4Hybrid return-window loss",
            "selected": {
                key: ranked[0][key]
                for key in (
                    "signal",
                    "combine",
                    "hazard_lambda",
                    "threshold",
                    "fallback_k",
                )
            },
            "top_5": ranked[:5],
            "rows": rows,
        },
    )
    print("stage B selected:", ranked[0])


def full_grid():
    rows = []
    for signal, combine in DETECTOR_CASES:
        for hazard in (100, 250):
            for threshold in (0.3, 0.5):
                for fallback_k in (3, 5):
                    run_rows = _pool_map(
                        _actor_job,
                        _actor_jobs(
                            "hybrid",
                            signal,
                            combine,
                            hazard,
                            threshold,
                            fallback_k,
                        ),
                    )
                    row = {
                        "signal": signal,
                        "combine": combine,
                        "hazard_lambda": hazard,
                        "threshold": threshold,
                        "lag": 8,
                        "retrieval_margin": 0.8,
                        "fallback_k": fallback_k,
                        **_aggregate(run_rows),
                        "per_run": run_rows,
                    }
                    rows.append(row)
                    print(
                        "full grid",
                        signal,
                        combine,
                        hazard,
                        threshold,
                        fallback_k,
                        round(row["mean_loss"], 6),
                        flush=True,
                    )
                    _save(
                        "full_grid.json",
                        {"complete": False, "seeds": SEEDS, "rows": rows},
                    )
    ranked = sorted(
        rows,
        key=lambda row: (
            row["mean_loss"],
            row["false_alarms"],
            -row["hits"],
        ),
    )
    _save(
        "full_grid.json",
        {
            "complete": True,
            "seeds": SEEDS,
            "objective": "minimum mean V4Hybrid return-window loss",
            "selected": {
                key: ranked[0][key]
                for key in (
                    "signal",
                    "combine",
                    "hazard_lambda",
                    "threshold",
                    "fallback_k",
                )
            },
            "top_5": ranked[:5],
            "rows": rows,
        },
    )
    print("full grid selected:", ranked[0])


def report():
    jobs = []
    for test in battery.TESTS:
        for seed in SEEDS:
            for family in battery.FAMILIES:
                for kind in ("actor", "hybrid"):
                    jobs.append(
                        (
                            test,
                            seed,
                            family,
                            kind,
                            sprint4.DETECTOR_SIGNAL,
                            sprint4.DETECTOR_COMBINE,
                            sprint4.DETECTOR_HAZARD_LAMBDA,
                            sprint4.DETECTOR_THRESHOLD,
                            sprint4.FALLBACK_K,
                        )
                    )
    v4_rows = _pool_map(_actor_job, jobs)
    baseline_jobs = [
        (test, seed, family, config)
        for test in battery.TESTS
        for seed in SEEDS
        for family in battery.FAMILIES
        for config in ("aeon_integrated", "aeon_no_retrieval", "mmac")
    ]
    baseline_rows = _pool_map(_baseline_job, baseline_jobs)

    per_test = {}
    for test in battery.TESTS:
        per_test[test] = {}
        for kind in ("actor", "hybrid"):
            selected = [
                row for row in v4_rows if row["test"] == test and row["kind"] == kind
            ]
            per_test[test][f"v4_{kind}"] = {
                **_aggregate(selected),
                "mean_loss": statistics.fmean(row["loss"] for row in selected),
            }
        for config in ("aeon_integrated", "aeon_no_retrieval", "mmac"):
            selected = [
                row
                for row in baseline_rows
                if row["test"] == test and row["condition"] == config
            ]
            per_test[test][config] = {
                "mean_loss": statistics.fmean(row["loss"] for row in selected)
            }

    payload = {
        "seeds": SEEDS,
        "constants": {
            "signal": sprint4.DETECTOR_SIGNAL,
            "combine": sprint4.DETECTOR_COMBINE,
            "hazard_lambda": sprint4.DETECTOR_HAZARD_LAMBDA,
            "threshold": sprint4.DETECTOR_THRESHOLD,
            "lag": sprint4.DETECTOR_LAG,
            "retrieval_margin": sprint4.RETRIEVAL_MARGIN,
            "fallback_k": sprint4.FALLBACK_K,
        },
        "per_test": per_test,
        "v4_runs": v4_rows,
        "baseline_runs": baseline_rows,
    }
    _save("per_test_five_seeds.json", payload)
    print(json.dumps(per_test, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("stage-a", "stage-b", "full", "report"))
    args = parser.parse_args()
    if args.mode == "stage-a":
        stage_a()
    elif args.mode == "stage-b":
        stage_b()
    elif args.mode == "full":
        full_grid()
    else:
        report()


if __name__ == "__main__":
    main()
