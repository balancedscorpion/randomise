"""Module for randomisation functionality in A/B testing.

This module provides deterministic hashing, distribution, and bucketing
mechanisms for consistent A/B test assignment.
"""

import hashlib
from enum import Enum
from typing import List
import mmh3
import xxhash

HAS_MURMUR = True
HAS_XXHASH = True


class HashAlgorithm(Enum):
    """Supported hashing algorithms."""
    MD5 = "md5"
    SHA256 = "sha256"
    MURMUR32 = "murmur32"
    XXHASH = "xxhash"
    XXH3 = "xxh3"


class DistributionMethod(Enum):
    """Supported distribution methods."""
    MODULUS = "modulus"
    MAD = "mad"  # Multiply-Add-Divide


class Hasher:
    """
    Hasher class for generating deterministic hashes from identifiers and seeds.
    
    This ensures that the same identifier and seed always produce the same hash,
    which is essential for consistent A/B test assignments.
    """
    
    def __init__(self, seed: str, algorithm: HashAlgorithm = HashAlgorithm.XXHASH):
        """
        Initialize the Hasher.
        
        Args:
            seed: The seed value for deterministic hashing
            algorithm: The hashing algorithm to use
        """
        self.seed = seed
        self.algorithm = algorithm
        
        # Validate algorithm availability
        if algorithm == HashAlgorithm.MURMUR32 and not HAS_MURMUR:
            raise ImportError("mmh3 library is required for Murmur32. Install with: pip install mmh3")
        if algorithm in (HashAlgorithm.XXHASH, HashAlgorithm.XXH3) and not HAS_XXHASH:
            raise ImportError("xxhash library is required for XXHASH/XXH3. Install with: pip install xxhash")
    
    def hash(self, identifier: str) -> int:
        """
        Generate a deterministic hash for the given identifier.
        
        Args:
            identifier: The identifier to hash
            
        Returns:
            An integer hash value
        """
        # Combine seed and identifier for deterministic hashing
        combined = f"{self.seed}:{identifier}"
        
        if self.algorithm == HashAlgorithm.MD5:
            hash_bytes = hashlib.md5(combined.encode()).digest()
            # Convert first 4 bytes to unsigned int
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.SHA256:
            hash_bytes = hashlib.sha256(combined.encode()).digest()
            # Convert first 4 bytes to unsigned int
            return int.from_bytes(hash_bytes[:4], byteorder='big', signed=False)
        
        elif self.algorithm == HashAlgorithm.MURMUR32:
            # MurmurHash3 32-bit
            # Use the seed string's hash as the numeric seed
            numeric_seed = abs(hash(self.seed)) % (2**31)
            hash_value = mmh3.hash(identifier, seed=numeric_seed, signed=False)
            return hash_value
        
        elif self.algorithm == HashAlgorithm.XXHASH:
            # XXHash 32-bit
            numeric_seed = abs(hash(self.seed)) % (2**31)
            hasher = xxhash.xxh32(seed=numeric_seed)
            hasher.update(combined.encode())
            return hasher.intdigest()
        
        elif self.algorithm == HashAlgorithm.XXH3:
            # XXH3 64-bit (fastest, modern algorithm)
            numeric_seed = abs(hash(self.seed)) % (2**63)
            hasher = xxhash.xxh3_64(seed=numeric_seed)
            hasher.update(combined.encode())
            # Return as 32-bit unsigned int for consistency
            return hasher.intdigest() & 0xFFFFFFFF
        
        else:
            raise ValueError(f"Unsupported algorithm: {self.algorithm}")


class Distribution:
    """
    Distribution class for mapping hash values to table indices.
    
    This provides different methods for distributing hash values across
    a table of a given size.
    """
    
    def __init__(self, table_size: int, method: DistributionMethod = DistributionMethod.MODULUS):
        """
        Initialize the Distribution.
        
        Args:
            table_size: The size of the distribution table
            method: The distribution method to use
        """
        if table_size <= 0:
            raise ValueError("Table size must be positive")
        
        self.table_size = table_size
        self.method = method
        
        # MAD parameters (a, b) where index = ((a * hash + b) % p) % table_size
        # Using values commonly found in production hash functions for good distribution
        self._mad_prime = 2147483647  # Mersenne prime (2^31 - 1), fast modulo operation
        self._mad_a = 2654435761      # Golden ratio multiplier: floor(2^32 / φ), excellent distribution
        self._mad_b = 1103515245      # From Linear Congruential Generator, well-tested value
    
    def distribute(self, hash_value: int) -> int:
        """
        Distribute a hash value to a table index.
        
        Args:
            hash_value: The hash value to distribute
            
        Returns:
            An index in the range [0, table_size)
        """
        if self.method == DistributionMethod.MODULUS:
            return hash_value % self.table_size
        
        elif self.method == DistributionMethod.MAD:
            # Multiply-Add-Divide method for better distribution
            # index = ((a * hash + b) mod p) mod table_size
            mad_result = ((self._mad_a * hash_value + self._mad_b) % self._mad_prime) % self.table_size
            return mad_result
        
        else:
            raise ValueError(f"Unsupported distribution method: {self.method}")
    
    def set_mad_parameters(self, a: int, b: int, prime: int = None):
        """
        Set custom MAD parameters.
        
        Args:
            a: Multiplier (should be non-zero)
            b: Addend
            prime: Prime modulus (optional, uses default if not provided)
        """
        if a == 0:
            raise ValueError("MAD parameter 'a' must be non-zero")
        
        self._mad_a = a
        self._mad_b = b
        if prime is not None:
            self._mad_prime = prime


class Bucketing:
    """
    Bucketing class for allocating table indices to buckets based on proportions.
    
    This assigns indices to buckets according to specified proportions,
    useful for A/B testing with multiple variants.
    """
    
    def __init__(self, proportions: List[float], table_size: int):
        """
        Initialize the Bucketing.
        
        Args:
            proportions: List of proportions for each bucket (should sum to 1.0)
            table_size: The size of the distribution table
            
        Raises:
            ValueError: If proportions don't sum to approximately 1.0
        """
        if not proportions:
            raise ValueError("Proportions list cannot be empty")
        
        if table_size <= 0:
            raise ValueError("Table size must be positive")
        
        total = sum(proportions)
        if not (0.99 <= total <= 1.01):  # Allow small floating point errors
            raise ValueError(f"Proportions must sum to 1.0 (got {total})")
        
        self.proportions = proportions
        self.table_size = table_size
        self.num_buckets = len(proportions)
        
        # Pre-calculate bucket boundaries for efficiency
        self._calculate_boundaries()
    
    def _calculate_boundaries(self):
        """Calculate the boundary indices for each bucket."""
        self.boundaries = []
        cumulative = 0.0
        
        for proportion in self.proportions:
            cumulative += proportion
            boundary = int(cumulative * self.table_size)
            self.boundaries.append(boundary)
        
        # Ensure the last boundary is exactly table_size
        self.boundaries[-1] = self.table_size
    
    def get_bucket(self, index: int) -> int:
        """
        Get the bucket number for a given table index.
        
        Args:
            index: The table index (0 to table_size-1)
            
        Returns:
            The bucket number (0 to num_buckets-1)
            
        Raises:
            ValueError: If index is out of range
        """
        if index < 0 or index >= self.table_size:
            raise ValueError(f"Index {index} out of range [0, {self.table_size})")
        
        # Find which bucket this index falls into
        for bucket_num, boundary in enumerate(self.boundaries):
            if index < boundary:
                return bucket_num
        
        # Should never reach here, but return last bucket as fallback
        return self.num_buckets - 1


class Randomiser:
    """
    Complete randomisation system combining hashing, distribution, and bucketing.
    
    This provides a convenient interface for the entire A/B testing flow.
    """
    
    def __init__(
        self,
        seed: str,
        proportions: List[float],
        table_size: int = 1000,
        hash_algorithm: HashAlgorithm = HashAlgorithm.MD5,
        distribution_method: DistributionMethod = DistributionMethod.MODULUS
    ):
        """
        Initialize the Randomiser.
        
        Args:
            seed: The seed value for deterministic hashing
            proportions: List of proportions for each bucket
            table_size: The size of the distribution table
            hash_algorithm: The hashing algorithm to use
            distribution_method: The distribution method to use
        """
        self.hasher = Hasher(seed, hash_algorithm)
        self.distribution = Distribution(table_size, distribution_method)
        self.bucketing = Bucketing(proportions, table_size)
    
    def assign(self, identifier: str) -> int:
        """
        Assign an identifier to a bucket.
        
        Args:
            identifier: The identifier to assign
            
        Returns:
            The bucket number (0 to num_buckets-1)
        """
        # Step 1: Hash the identifier
        hash_value = self.hasher.hash(identifier)
        
        # Step 2: Distribute to table index
        index = self.distribution.distribute(hash_value)
        
        # Step 3: Map to bucket
        bucket = self.bucketing.get_bucket(index)
        
        return bucket
    
    def assign_with_details(self, identifier: str) -> dict:
        """
        Assign an identifier to a bucket with detailed information.
        
        Args:
            identifier: The identifier to assign
            
        Returns:
            Dictionary with hash, index, and bucket information
        """
        hash_value = self.hasher.hash(identifier)
        index = self.distribution.distribute(hash_value)
        bucket = self.bucketing.get_bucket(index)
        
        return {
            'identifier': identifier,
            'hash': hash_value,
            'index': index,
            'bucket': bucket
        }
