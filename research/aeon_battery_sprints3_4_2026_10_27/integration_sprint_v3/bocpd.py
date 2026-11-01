"""NumPy implementation of streaming Bayesian online changepoint detection."""

import math

import numpy as np


class BOCPD:
    """Stream scalar observations through an online StudentT changepoint model.

    The Normal-Gamma predictive and constant hazard follow Adams and MacKay
    (2007), matching ``OnlineChangepointDetector`` and its online ``StudentT``
    likelihood. ``update`` returns the posterior probability that the current
    run length is strictly less than ``lag``.
    """

    def __init__(
        self,
        hazard_lambda,
        alpha=0.1,
        beta=0.01,
        kappa=1.0,
        mu=0.0,
        max_run_length=300,
        lag=8,
    ):
        if not hazard_lambda >= 1:
            raise ValueError("hazard_lambda must be at least 1")
        if not isinstance(max_run_length, int) or isinstance(max_run_length, bool):
            raise TypeError("max_run_length must be an integer")
        if max_run_length < 1:
            raise ValueError("max_run_length must be at least 1")
        if not isinstance(lag, int) or isinstance(lag, bool):
            raise TypeError("lag must be an integer")
        if lag < 1:
            raise ValueError("lag must be at least 1")
        if alpha <= 0 or beta <= 0 or kappa <= 0:
            raise ValueError("alpha, beta, and kappa must be positive")

        self.hazard_lambda = float(hazard_lambda)
        self.alpha0 = np.float32(alpha)
        self.beta0 = np.float32(beta)
        self.kappa0 = np.float32(kappa)
        self.mu0 = np.float32(mu)
        self.max_run_length = max_run_length
        self.lag = lag
        self.t = 0
        self._posterior = np.ones(1, dtype=np.float32)
        self._mu = np.array([self.mu0], dtype=np.float32)
        self._beta = np.array([self.beta0], dtype=np.float32)

        run_lengths = np.arange(max_run_length + 1, dtype=np.float32)
        self._alpha = self.alpha0 + np.float32(0.5) * run_lengths
        self._kappa = self.kappa0 + run_lengths
        self._df = np.float32(2.0) * self._alpha
        self._log_normalizer = np.asarray(
            [
                math.lgamma(float((df + 1.0) / 2.0))
                - math.lgamma(float(df / 2.0))
                - 0.5 * math.log(math.pi * float(df))
                for df in self._df
            ],
            dtype=np.float32,
        )
        self._hazard = np.float32(1.0 / self.hazard_lambda)

    @property
    def run_length_posterior(self):
        """Return a copy of ``P(run length = r | observations)``."""
        return self._posterior.copy()

    @property
    def posterior(self):
        """Alias for the current run-length posterior."""
        return self.run_length_posterior

    def update(self, x):
        """Consume one finite scalar and return ``P(run length < lag)``."""
        x = np.float32(x)
        if not np.isfinite(x):
            raise ValueError("observation must be finite")

        count = self._posterior.size
        alpha = self._alpha[:count]
        kappa = self._kappa[:count]
        beta = self._beta
        mu = self._mu
        df = self._df[:count]
        scale = np.sqrt(beta * (kappa + np.float32(1.0)) / (alpha * kappa))
        standardized = (x - mu) / scale
        log_predictive = (
            self._log_normalizer[:count]
            - np.log(scale)
            - ((df + np.float32(1.0)) / np.float32(2.0))
            * np.log1p(standardized * standardized / df)
        )
        predictive = np.exp(log_predictive)

        weighted = self._posterior * predictive
        posterior = np.empty(count + 1, dtype=np.float32)
        posterior[0] = np.sum(weighted * self._hazard, dtype=np.float32)
        posterior[1:] = weighted * (np.float32(1.0) - self._hazard)
        total = np.sum(posterior, dtype=np.float32)
        if total > 0:
            posterior /= total

        updated_mu = (kappa * mu + x) / (kappa + np.float32(1.0))
        centered = x - mu
        updated_beta = beta + (kappa * centered * centered) / (
            np.float32(2.0) * (kappa + np.float32(1.0))
        )
        keep = min(count + 1, self.max_run_length + 1)
        self._mu = np.empty(keep, dtype=np.float32)
        self._beta = np.empty(keep, dtype=np.float32)
        self._mu[0] = self.mu0
        self._beta[0] = self.beta0
        if keep > 1:
            self._mu[1:] = updated_mu[: keep - 1]
            self._beta[1:] = updated_beta[: keep - 1]

        if posterior.size > self.max_run_length + 1:
            posterior = posterior[: self.max_run_length + 1]
            total = np.sum(posterior, dtype=np.float32)
            if total > 0:
                posterior /= total

        self._posterior = posterior
        self.t += 1
        return float(np.sum(posterior[: self.lag], dtype=np.float32))
