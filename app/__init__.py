"""Randomisation - Deterministic A/B testing library.

Simple usage:
    from app import randomise
    variant = randomise("user123", "experiment-1", [0.5, 0.5])

Class-based usage:
    from app import Randomiser
    r = Randomiser("experiment-1", [0.5, 0.5])
    variant = r.assign("user123")
"""

__version__ = "1.0.0"

from app.randomise import (
    Randomiser,
    HashAlgorithm,
    DistributionMethod,
    Hasher,
    Distribution,
    randomise,
    randomise_with_details,
)

__all__ = [
    "Randomiser",
    "HashAlgorithm",
    "DistributionMethod",
    "Hasher",
    "Distribution",
    "randomise",
    "randomise_with_details",
]
