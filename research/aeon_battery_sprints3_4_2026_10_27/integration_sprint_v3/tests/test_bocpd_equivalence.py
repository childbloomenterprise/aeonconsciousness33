"""Equivalence checks for the NumPy online detector."""

import json
from functools import partial
from pathlib import Path

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("bayesian_changepoint_detection")

from bayesian_changepoint_detection.generate_data import generate_normal_time_series
from bayesian_changepoint_detection.hazard_functions import constant_hazard
from bayesian_changepoint_detection.online_likelihoods import StudentT
from bayesian_changepoint_detection.streaming import OnlineChangepointDetector

from integration_sprint_v3.bocpd import BOCPD


def _assert_matches_library(values, lag, max_run_length):
    hazard_lambda = 100
    reference = OnlineChangepointDetector(
        partial(constant_hazard, hazard_lambda),
        StudentT(alpha=0.1, beta=0.01, kappa=1.0, mu=0.0),
        max_run_length=max_run_length,
        device="cpu",
    )
    port = BOCPD(
        hazard_lambda,
        alpha=0.1,
        beta=0.01,
        kappa=1.0,
        mu=0.0,
        max_run_length=max_run_length,
        lag=lag,
    )
    for value in values:
        expected = reference.update(torch.tensor(float(value), dtype=torch.float32))
        probability = port.update(float(value))
        actual = port.run_length_posterior
        assert actual.shape == tuple(expected.shape)
        assert np.max(np.abs(actual - expected.cpu().numpy())) <= 1e-4
        assert probability == pytest.approx(float(expected[:lag].sum()), abs=1e-4)


@pytest.mark.math
def test_numpy_port_matches_synthetic_mean_shift_series():
    _, data = generate_normal_time_series(
        num_segments=3, min_length=64, max_length=64, seed=19001, device="cpu"
    )
    _assert_matches_library(data.squeeze(1).tolist(), lag=8, max_run_length=64)


@pytest.mark.math
def test_numpy_port_matches_recorded_aeon_residual_stream():
    fixture_path = Path(__file__).parent / "fixtures" / "aeon_residual_stream.json"
    stream = json.loads(fixture_path.read_text())["z"]
    _assert_matches_library(stream, lag=8, max_run_length=64)
