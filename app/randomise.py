"""Core randomisation module for deterministic A/B testing.

This module provides a simple, efficient system for assigning users to experiment
variants. The same user ID + seed will always produce the same assignment.

Usage:
    # Simple function API
    from app.randomise import randomise
    variant = randomise("user123", "my-experiment", [0.5, 0.5])
    
    # Class-based API for more control
    from app.randomise import Randomiser
    r = Randomiser("my-experiment", [0.5, 0.5])
    variant = r.assign("user123")
"""

import hashlib
from enum import Enum
from functools import lru_cache
from typing import List, Optional, Dict, Any

import mmh3
import xxhash


class HashAlgorithm(str, Enum):
    """Supported hashing algorithms.
    
    - MD5/SHA256: Built-in, no dependencies, good compatibility
    - MURMUR32: Fast non-cryptographic hash (requires mmh3)
    - XXHASH/XXH3: Fastest option, excellent distribution (requires xxhash)
    """
    MD5 = "md5"
    SHA256 = "sha256"
    MURMUR32 = "murmur32"
    XXHASH = "xxhash"
    XXH3 = "xxh3"


class DistributionMethod(str, Enum):
    """Distribution methods for mapping hashes to table indices.
    
    - MODULUS: Simple modulo operation
    - MAD: Multiply-Add-Divide, better distribution properties
    """
    MODULUS = "modulus"
    MAD = "mad"


# -----------------------------------------------------------------------------
# Helper classes (for educational/debugging purposes)
# -----------------------------------------------------------------------------

class Hasher:
    """Standalone hasher for educational/debugging use.
    
    In production, use Randomiser directly.
    """
    
    def __init__(self, seed: str, algorithm: HashAlgorithm = HashAlgorithm.MD5):
        self.seed = seed
        self.algorithm = algorithm if isinstance(algorithm, HashAlgorithm) else HashAlgorithm(algorithm)
        self._numeric_seed = abs(hash(seed)) % (2**31)
    
    def hash(self, identifier: str) -> int:
        combined = f"{self.seed}:{identifier}"
        
        if self.algorithm == HashAlgorithm.MD5:
            hash_bytes = hashlib.md5(combined.encode()).digest()
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.SHA256:
            hash_bytes = hashlib.sha256(combined.encode()).digest()
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.MURMUR32:
            return mmh3.hash(identifier, seed=self._numeric_seed, signed=False)
        
        elif self.algorithm == HashAlgorithm.XXHASH:
            hasher = xxhash.xxh32(seed=self._numeric_seed)
            hasher.update(combined.encode())
            return hasher.intdigest()
        
        elif self.algorithm == HashAlgorithm.XXH3:
            numeric_seed_64 = abs(hash(self.seed)) % (2**63)
            hasher = xxhash.xxh3_64(seed=numeric_seed_64)
            hasher.update(combined.encode())
            return hasher.intdigest() & 0xFFFFFFFF
        
        raise ValueError(f"Unsupported algorithm: {self.algorithm}")


class Distribution:
    """Standalone distribution mapper for educational/debugging use."""
    
    _MAD_PRIME = 2147483647
    _MAD_A = 2654435761
    _MAD_B = 1103515245
    
    def __init__(self, table_size: int, method: DistributionMethod = DistributionMethod.MAD):
        self.table_size = table_size
        self.method = method if isinstance(method, DistributionMethod) else DistributionMethod(method)
    
    def distribute(self, hash_value: int) -> int:
        if self.method == DistributionMethod.MODULUS:
            return hash_value % self.table_size
        return ((self._MAD_A * hash_value + self._MAD_B) % self._MAD_PRIME) % self.table_size


# -----------------------------------------------------------------------------
# Main Randomiser class
# -----------------------------------------------------------------------------

class Randomiser:
    """Deterministic randomisation for A/B testing.
    
    Combines hashing, distribution, and variant allocation into a single
    efficient class. Same identifier + seed always produces the same variant.
    
    Example:
        >>> r = Randomiser("experiment-1", [0.5, 0.5])
        >>> r.assign("user123")  # Always returns same result
        0
    """
    
    # MAD (Multiply-Add-Divide) constants for good hash distribution
    _MAD_PRIME = 2147483647   # Mersenne prime (2^31 - 1)
    _MAD_A = 2654435761       # Golden ratio multiplier
    _MAD_B = 1103515245       # LCG constant
    
    def __init__(
        self,
        seed: str,
        proportions: List[float],
        table_size: int = 10000,
        algorithm: HashAlgorithm = HashAlgorithm.MD5,
        distribution: DistributionMethod = DistributionMethod.MAD
    ):
        """Initialize the Randomiser.
        
        Args:
            seed: Experiment identifier for deterministic hashing
            proportions: Variant weights (must sum to ~1.0), e.g. [0.5, 0.5]
            table_size: Distribution table size (higher = more precision)
            algorithm: Hash algorithm to use
            distribution: Distribution method to use
        
        Raises:
            ValueError: If proportions are invalid
        """
        if not proportions:
            raise ValueError("Proportions list cannot be empty")
        
        if table_size <= 0:
            raise ValueError("Table size must be positive")
        
        total = sum(proportions)
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Proportions must sum to 1.0 (got {total})")
        
        self.seed = seed
        self.proportions = proportions
        self.table_size = table_size
        self.algorithm = algorithm if isinstance(algorithm, HashAlgorithm) else HashAlgorithm(algorithm)
        self.distribution = distribution if isinstance(distribution, DistributionMethod) else DistributionMethod(distribution)
        self._numeric_seed = abs(hash(seed)) % (2**31)
        self._boundaries = self._calculate_boundaries()
    
    def _calculate_boundaries(self) -> List[int]:
        """Pre-calculate variant boundaries for efficient lookup."""
        boundaries = []
        cumulative = 0.0
        for proportion in self.proportions:
            cumulative += proportion
            boundaries.append(int(cumulative * self.table_size))
        boundaries[-1] = self.table_size  # Ensure last boundary is exact
        return boundaries
    
    def _hash(self, identifier: str) -> int:
        """Generate a deterministic hash for the identifier."""
        combined = f"{self.seed}:{identifier}"
        
        if self.algorithm == HashAlgorithm.MD5:
            hash_bytes = hashlib.md5(combined.encode()).digest()
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.SHA256:
            hash_bytes = hashlib.sha256(combined.encode()).digest()
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.MURMUR32:
            return mmh3.hash(identifier, seed=self._numeric_seed, signed=False)
        
        elif self.algorithm == HashAlgorithm.XXHASH:
            hasher = xxhash.xxh32(seed=self._numeric_seed)
            hasher.update(combined.encode())
            return hasher.intdigest()
        
        elif self.algorithm == HashAlgorithm.XXH3:
            numeric_seed_64 = abs(hash(self.seed)) % (2**63)
            hasher = xxhash.xxh3_64(seed=numeric_seed_64)
            hasher.update(combined.encode())
            return hasher.intdigest() & 0xFFFFFFFF
        
        raise ValueError(f"Unsupported algorithm: {self.algorithm}")
    
    def _distribute(self, hash_value: int) -> int:
        """Map hash value to table index."""
        if self.distribution == DistributionMethod.MODULUS:
            return hash_value % self.table_size
        
        # MAD: ((a * hash + b) mod prime) mod table_size
        return ((self._MAD_A * hash_value + self._MAD_B) % self._MAD_PRIME) % self.table_size
    
    def _get_variant(self, index: int) -> int:
        """Map table index to variant number."""
        for variant, boundary in enumerate(self._boundaries):
            if index < boundary:
                return variant
        return len(self._boundaries) - 1
    
    def assign(self, identifier: str) -> int:
        """Assign an identifier to a variant.
        
        Args:
            identifier: User ID or other unique identifier
            
        Returns:
            Variant number (0-indexed)
        """
        hash_value = self._hash(identifier)
        index = self._distribute(hash_value)
        return self._get_variant(index)
    
    def assign_with_details(self, identifier: str) -> Dict[str, Any]:
        """Assign with detailed debugging information.
        
        Args:
            identifier: User ID or other unique identifier
            
        Returns:
            Dict with 'identifier', 'hash', 'index', 'variant' keys
        """
        hash_value = self._hash(identifier)
        index = self._distribute(hash_value)
        variant = self._get_variant(index)
        
        return {
            'identifier': identifier,
            'hash': hash_value,
            'index': index,
            'variant': variant
        }


# -----------------------------------------------------------------------------
# Module-level convenience functions with caching
# -----------------------------------------------------------------------------

@lru_cache(maxsize=128)
def _get_randomiser(
    seed: str,
    weights: tuple,
    algorithm: str,
    distribution: str,
    table_size: int
) -> Randomiser:
    """Get or create a cached Randomiser instance."""
    return Randomiser(
        seed=seed,
        proportions=list(weights),
        table_size=table_size,
        algorithm=HashAlgorithm(algorithm),
        distribution=DistributionMethod(distribution)
    )


def randomise(
    userid: str,
    seed: str,
    weights: List[float],
    algorithm: Optional[str] = None,
    distribution: Optional[str] = None,
    table_size: Optional[int] = None
) -> int:
    """Assign a user to a variant based on weights.
    
    This is the simplest API for A/B testing. Same userid + seed always
    returns the same variant.
    
    Args:
        userid: User identifier
        seed: Experiment seed (use different seeds for different experiments)
        weights: Proportions for each variant, e.g. [0.5, 0.5] for 50/50
        algorithm: Hash algorithm (md5, sha256, murmur32, xxhash, xxh3)
        distribution: Distribution method (modulus, mad)
        table_size: Table size for precision (default 10000)
    
    Returns:
        Variant number (0-indexed)
    
    Example:
        >>> variant = randomise("user123", "homepage-test", [0.5, 0.5])
        >>> treatment = "A" if variant == 0 else "B"
    """
    algo = algorithm or "md5"
    dist = distribution or "mad"
    size = table_size or 10000
    
    randomiser = _get_randomiser(seed, tuple(weights), algo, dist, size)
    return randomiser.assign(userid)


def randomise_with_details(
    userid: str,
    seed: str,
    weights: List[float],
    algorithm: Optional[str] = None,
    distribution: Optional[str] = None,
    table_size: Optional[int] = None
) -> Dict[str, Any]:
    """Assign a user to a variant with detailed debugging information.
    
    Same as randomise() but returns hash, index, and variant details.
    
    Returns:
        Dict with 'identifier', 'hash', 'index', 'variant' keys
    """
    algo = algorithm or "md5"
    dist = distribution or "mad"
    size = table_size or 10000
    
    randomiser = _get_randomiser(seed, tuple(weights), algo, dist, size)
    return randomiser.assign_with_details(userid)
