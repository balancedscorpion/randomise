"""Simple utility for easy randomisation with minimal configuration.

This module provides a streamlined interface for A/B testing randomisation.
Just provide a user ID, seed, and weights - that's it!
"""

from typing import List, Optional
from app.randomise import (
    Randomiser,
    HashAlgorithm,
    DistributionMethod
)


def randomise(
    userid: str,
    seed: str,
    weights: List[float],
    algorithm: Optional[HashAlgorithm] = None,
    distribution: Optional[DistributionMethod] = None,
    table_size: Optional[int] = None
) -> int:
    """
    Assign a user to a bucket based on weights.
    
    This is a simple, batteries-included function for A/B testing.
    Same userid + seed will always return the same bucket.
    
    Args:
        userid: The user identifier (string)
        seed: The experiment seed (string) - use different seeds for different experiments
        weights: List of proportions for each bucket (e.g., [0.5, 0.5] for 50/50 split)
        algorithm: Hash algorithm (defaults to XXH3 for best speed and distribution)
        distribution: Distribution method (defaults to MAD for best distribution)
        table_size: Size of distribution table (defaults to 10000 for high precision)
    
    Returns:
        Bucket number (0-indexed, e.g., 0 or 1 for A/B test)
    
    Examples:
        >>> # Simple A/B test (50/50)
        >>> bucket = randomise("user123", "homepage-test", [0.5, 0.5])
        >>> variant = "A" if bucket == 0 else "B"
        
        >>> # A/B/C test (50/30/20)
        >>> bucket = randomise("user456", "pricing-test", [0.5, 0.3, 0.2])
        >>> variants = ["control", "variant_a", "variant_b"]
        >>> assigned = variants[bucket]
        
        >>> # 90% control, 10% treatment
        >>> bucket = randomise("user789", "risky-feature", [0.9, 0.1])
        >>> if bucket == 1:
        >>>     enable_new_feature()
    """
    # Set sensible defaults optimized for production use
    if algorithm is None:
        algorithm = HashAlgorithm.XXH3  # Fastest modern algorithm with excellent distribution
    
    if distribution is None:
        distribution = DistributionMethod.MAD  # Better than modulus
    
    if table_size is None:
        table_size = 10000  # High precision for accurate weight distribution
    
    # Create randomiser and assign
    randomiser = Randomiser(
        seed=seed,
        proportions=weights,
        table_size=table_size,
        hash_algorithm=algorithm,
        distribution_method=distribution
    )
    
    return randomiser.assign(userid)


def randomise_with_details(
    userid: str,
    seed: str,
    weights: List[float],
    algorithm: Optional[HashAlgorithm] = None,
    distribution: Optional[DistributionMethod] = None,
    table_size: Optional[int] = None
) -> dict:
    """
    Assign a user to a bucket with detailed debugging information.
    
    Same as randomise() but returns a dictionary with hash, index, and bucket details.
    Useful for debugging or logging.
    
    Args:
        userid: The user identifier (string)
        seed: The experiment seed (string)
        weights: List of proportions for each bucket
        algorithm: Hash algorithm (defaults to XXH3)
        distribution: Distribution method (defaults to MAD)
        table_size: Size of distribution table (defaults to 10000)
    
    Returns:
        Dictionary with keys: 'identifier', 'hash', 'index', 'bucket'
    
    Example:
        >>> details = randomise_with_details("user123", "test-1", [0.5, 0.5])
        >>> print(details)
        {
            'identifier': 'user123',
            'hash': 1234567890,
            'index': 4567,
            'bucket': 0
        }
    """
    # Set defaults
    if algorithm is None:
        algorithm = HashAlgorithm.XXH3
    
    if distribution is None:
        distribution = DistributionMethod.MAD
    
    if table_size is None:
        table_size = 10000
    
    # Create randomiser and get details
    randomiser = Randomiser(
        seed=seed,
        proportions=weights,
        table_size=table_size,
        hash_algorithm=algorithm,
        distribution_method=distribution
    )
    
    return randomiser.assign_with_details(userid)


# Convenience function aliases
assign = randomise
assign_bucket = randomise


