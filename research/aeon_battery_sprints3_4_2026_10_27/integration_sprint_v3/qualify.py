"""Seed-19001-only two-stage tuning and per-test battery reporting."""

import argparse
import itertools
import json
import time
from pathlib import Path

from battery import battery

from .sprint3 import (
    DETECTOR_HAZARD_LAMBDA,
    DETECTOR_LAG,
    DETECTOR_SIGNAL,
    DETECTOR_SIGNALS,
    DETECTOR_THRESHOLD,
    FALLBACK_ABS_FLOOR,
    FALLBACK_MULTIPLIER,
    RETRIEVAL_IMPROVEMENT,
    V3Actor,
    V3Hybrid,
)

QUALIFICATION_SEED = 19001
HAZARD_LAMBDAS = (100, 250)
LAGS = (8, 16)
THRESHOLDS = (0.3, 0.5)
RETRIEVAL_MARGINS = (0.5, 0.8)
FALLBACK_FLOORS = (0.1, 0.3)
FALLBACK_MULTIPLIERS = (3.0, 5.0)
OUTPUT = Path(__file__).parent / "qualification"
STAGE_A_PATH = OUTPUT / "stage_a_detector_retrieval_grid_retrieval_fix.json"
STAGE_B_PATH = OUTPUT / "stage_b_fallback_grid_retrieval_fix.json"
REPORT_PATH = OUTPUT / "per_test_seed_19001_retrieval_fix.json"


def _switch_metrics(declarations, switches):
    hit_windows = [(switch, switch + 40) for switch in switches]
    hits = sum(
        any(start <= declaration < stop for declaration in declarations)
        for start, stop in hit_windows
    )
    false_alarms = sum(
        not any(start <= declaration < stop for start, stop in hit_windows)
        for declaration in declarations
    )
    return hits, false_alarms


def _run_v3(
    test,
    family,
    actor_type,
    hazard_lambda,
    lag,
    threshold,
    detector_signal=DETECTOR_SIGNAL,
    retrieval_margin=RETRIEVAL_IMPROVEMENT,
    fallback_enabled=True,
    fallback_floor=FALLBACK_ABS_FLOOR,
    fallback_multiplier=FALLBACK_MULTIPLIER,
):
    world = battery.BatteryWorld(QUALIFICATION_SEED, family, **battery.TESTS[test])
    actor_kwargs = {
        "hazard_lambda": hazard_lambda,
        "lag": lag,
        "threshold": threshold,
        "detector_signal": detector_signal,
        "retrieval_margin": retrieval_margin,
    }
    if actor_type is V3Hybrid:
        actor_kwargs.update(
            fallback_enabled=fallback_enabled,
            fallback_floor=fallback_floor,
            fallback_multiplier=fallback_multiplier,
        )
    actor = actor_type(**actor_kwargs)
    errors = []
    started = time.perf_counter()
    for _ in range(world.total()):
        observation = world.observe()
        decision = actor.decide(observation, world.cue())
        world.step(decision["action"])
        actor.learn(world.observe())
        errors.append(abs(world.body - world.target()))
    elapsed = time.perf_counter() - started
    phase_length = world.phase_len
    switches = [phase * phase_length for phase in range(1, len(world.seq))]
    hits, false_alarms = _switch_metrics(actor.declarations, switches)
    return {
        "hits": hits,
        "switches": len(switches),
        "false_alarms": false_alarms,
        "declarations": list(actor.declarations),
        "recalls": [list(recall) for recall in actor.recalls],
        "retrieval_attempted": actor.retrieval_attempts,
        "retrieval_restored": actor.retrieval_restored,
        "fallback_ticks": list(getattr(actor, "fallback_ticks", [])),
        "loss": float(
            sum(
                errors[
                    (len(world.seq) - 1) * phase_length : (len(world.seq) - 1)
                    * phase_length
                    + 20
                ]
            )
        ),
        "us_per_decision": 1e6 * elapsed / len(errors),
    }


def _aggregate(details):
    return {
        "hits": sum(row["hits"] for row in details),
        "switches": sum(row["switches"] for row in details),
        "false_alarms": sum(row["false_alarms"] for row in details),
        "mean_loss": sum(row["loss"] for row in details) / len(details),
        "retrieval_attempted": sum(row["retrieval_attempted"] for row in details),
        "retrieval_restored": sum(row["retrieval_restored"] for row in details),
        "fallback_ticks": sum(len(row["fallback_ticks"]) for row in details),
    }


def _save_grid(path, stage, objective, rows, complete):
    ordered = sorted(
        rows,
        key=lambda row: (row["mean_loss"], row["false_alarms"], -row["hits"]),
    )
    OUTPUT.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "seed": QUALIFICATION_SEED,
                "stage": stage,
                "objective": objective,
                "complete": complete,
                "grid": rows,
                "top_5": ordered[:5],
                "selected": ordered[0] if ordered else None,
            },
            indent=2,
        )
        + "\n"
    )
    return ordered


def run_stage_a():
    rows = []
    combinations = itertools.product(
        DETECTOR_SIGNALS,
        HAZARD_LAMBDAS,
        LAGS,
        THRESHOLDS,
        RETRIEVAL_MARGINS,
    )
    total = (
        len(DETECTOR_SIGNALS)
        * len(HAZARD_LAMBDAS)
        * len(LAGS)
        * len(THRESHOLDS)
        * len(RETRIEVAL_MARGINS)
    )
    for index, (signal, hazard_lambda, lag, threshold, margin) in enumerate(
        combinations, start=1
    ):
        details = []
        for test in battery.TESTS:
            for family in battery.FAMILIES:
                outcome = _run_v3(
                    test,
                    family,
                    V3Actor,
                    hazard_lambda,
                    lag,
                    threshold,
                    detector_signal=signal,
                    retrieval_margin=margin,
                )
                details.append(
                    {
                        "test": test,
                        "family": family,
                        **outcome,
                    }
                )
        rows.append(
            {
                "detector_signal": signal,
                "hazard_lambda": hazard_lambda,
                "lag": lag,
                "threshold": threshold,
                "retrieval_margin": margin,
                **_aggregate(details),
                "per_test_family": details,
            }
        )
        _save_grid(
            STAGE_A_PATH,
            "A",
            "minimum mean V3Actor return-window loss with fallback disabled",
            rows,
            complete=index == total,
        )
        print(
            f"stage A {index}/{total}: signal={signal} λ={hazard_lambda} "
            f"lag={lag} threshold={threshold} margin={margin} "
            f"mean_loss={rows[-1]['mean_loss']:.6f} "
            f"hits={rows[-1]['hits']}/{rows[-1]['switches']} "
            f"false_alarms={rows[-1]['false_alarms']}",
            flush=True,
        )
    return _save_grid(
        STAGE_A_PATH,
        "A",
        "minimum mean V3Actor return-window loss with fallback disabled",
        rows,
        complete=True,
    )[0]


def run_stage_b():
    if not STAGE_A_PATH.exists():
        raise RuntimeError("Run stage A before stage B")
    stage_a = json.loads(STAGE_A_PATH.read_text())
    if stage_a["seed"] != QUALIFICATION_SEED or not stage_a["complete"]:
        raise RuntimeError("Stage-A grid is incomplete or uses the wrong seed")
    detector = {
        key: stage_a["selected"][key]
        for key in (
            "detector_signal",
            "hazard_lambda",
            "lag",
            "threshold",
            "retrieval_margin",
        )
    }

    rows = []
    combinations = list(itertools.product(FALLBACK_FLOORS, FALLBACK_MULTIPLIERS))
    for index, (floor, multiplier) in enumerate(combinations, start=1):
        details = []
        for test in battery.TESTS:
            for family in battery.FAMILIES:
                outcome = _run_v3(
                    test,
                    family,
                    V3Hybrid,
                    detector["hazard_lambda"],
                    detector["lag"],
                    detector["threshold"],
                    detector_signal=detector["detector_signal"],
                    retrieval_margin=detector["retrieval_margin"],
                    fallback_floor=floor,
                    fallback_multiplier=multiplier,
                )
                details.append({"test": test, "family": family, **outcome})
        rows.append(
            {
                **detector,
                "fallback_floor": floor,
                "fallback_multiplier": multiplier,
                **_aggregate(details),
                "per_test_family": details,
            }
        )
        _save_grid(
            STAGE_B_PATH,
            "B",
            "minimum mean V3Hybrid return-window loss",
            rows,
            complete=index == len(combinations),
        )
        print(
            f"stage B {index}/{len(combinations)}: floor={floor} "
            f"multiplier={multiplier} mean_loss={rows[-1]['mean_loss']:.6f} "
            f"hits={rows[-1]['hits']}/{rows[-1]['switches']} "
            f"false_alarms={rows[-1]['false_alarms']} "
            f"fallback_ticks={rows[-1]['fallback_ticks']}",
            flush=True,
        )
    return _save_grid(
        STAGE_B_PATH,
        "B",
        "minimum mean V3Hybrid return-window loss",
        rows,
        complete=True,
    )[0]


def run_report():
    rows = []
    for test in battery.TESTS:
        for family in battery.FAMILIES:
            actor = _run_v3(
                test,
                family,
                V3Actor,
                DETECTOR_HAZARD_LAMBDA,
                DETECTOR_LAG,
                DETECTOR_THRESHOLD,
                detector_signal=DETECTOR_SIGNAL,
                retrieval_margin=RETRIEVAL_IMPROVEMENT,
            )
            hybrid = _run_v3(
                test,
                family,
                V3Hybrid,
                DETECTOR_HAZARD_LAMBDA,
                DETECTOR_LAG,
                DETECTOR_THRESHOLD,
                detector_signal=DETECTOR_SIGNAL,
                retrieval_margin=RETRIEVAL_IMPROVEMENT,
                fallback_floor=FALLBACK_ABS_FLOOR,
                fallback_multiplier=FALLBACK_MULTIPLIER,
            )
            aeon = battery.run(test, QUALIFICATION_SEED, family, "aeon_integrated")
            no_retrieval = battery.run(
                test, QUALIFICATION_SEED, family, "aeon_no_retrieval"
            )
            mmac = battery.run(test, QUALIFICATION_SEED, family, "mmac")
            rows.append(
                {
                    "test": test,
                    "family": family,
                    "v3_actor": actor,
                    "v3_hybrid": hybrid,
                    "aeon_integrated": {"loss": aeon["loss"]},
                    "aeon_no_retrieval": {"loss": no_retrieval["loss"]},
                    "mmac": {"loss": mmac["loss"]},
                }
            )
            print(f"reported {test}/{family}", flush=True)

    t1_rows = [row for row in rows if row["test"] == "T1_replication"]
    timing = {
        "V3Actor_mean_us_per_decision": sum(
            row["v3_actor"]["us_per_decision"] for row in t1_rows
        )
        / len(t1_rows),
        "V3Hybrid_mean_us_per_decision": sum(
            row["v3_hybrid"]["us_per_decision"] for row in t1_rows
        )
        / len(t1_rows),
    }
    report = {
        "seed": QUALIFICATION_SEED,
        "detector": {
            "signal": DETECTOR_SIGNAL,
            "hazard_lambda": DETECTOR_HAZARD_LAMBDA,
            "lag": DETECTOR_LAG,
            "threshold": DETECTOR_THRESHOLD,
            "retrieval_margin": RETRIEVAL_IMPROVEMENT,
        },
        "fallback": {
            "absolute_floor": FALLBACK_ABS_FLOOR,
            "median_multiplier": FALLBACK_MULTIPLIER,
        },
        "t1_timing": timing,
        "mean_v3_hybrid_return_window_loss": sum(
            row["v3_hybrid"]["loss"] for row in rows
        )
        / len(rows),
        "rows": rows,
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"t1_timing": timing}, indent=2), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode", choices=("stage-a", "stage-b", "report"), default="stage-a"
    )
    args = parser.parse_args()
    if args.mode == "stage-a":
        selected = run_stage_a()
    elif args.mode == "stage-b":
        selected = run_stage_b()
    else:
        run_report()
        return
    print(
        json.dumps(
            {key: value for key, value in selected.items() if key != "per_test_family"},
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
