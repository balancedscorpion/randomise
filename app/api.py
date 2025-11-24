"""FastAPI application for A/B testing randomisation.

This module provides a lightning-fast API endpoint for randomising users into buckets
based on weights, with comprehensive validation and error handling.
"""

from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from app.utils import randomise
from app.randomise import HashAlgorithm, DistributionMethod


# Initialize FastAPI app
app = FastAPI(
    title="Randomisation API",
    description="Lightning-fast A/B testing randomisation service",
    version="1.0.0"
)


class RandomiseRequest(BaseModel):
    """Request model for randomisation endpoint."""
    
    userid: str = Field(
        ...,
        min_length=1,
        max_length=1000,
        description="User identifier (required, 1-1000 characters)",
        examples=["user123", "abc-def-ghi"]
    )
    
    seed: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Experiment seed for deterministic assignment (required, 1-500 characters)",
        examples=["homepage-test", "pricing-experiment-2024"]
    )
    
    weights: List[float] = Field(
        ...,
        min_length=2,
        max_length=100,
        description="List of proportions for each bucket (must sum to 1.0)",
        examples=[[0.5, 0.5], [0.5, 0.3, 0.2], [0.9, 0.1]]
    )
    
    algorithm: Optional[str] = Field(
        None,
        description="Hash algorithm (xxh3, xxhash, murmur32, sha256, md5). Defaults to xxh3.",
        examples=["xxh3", "murmur32"]
    )
    
    distribution: Optional[str] = Field(
        None,
        description="Distribution method (mad, modulus). Defaults to mad.",
        examples=["mad", "modulus"]
    )
    
    table_size: Optional[int] = Field(
        None,
        ge=100,
        le=1000000,
        description="Distribution table size (100-1000000). Defaults to 10000.",
        examples=[10000, 100000]
    )
    
    @field_validator('weights')
    @classmethod
    def validate_weights(cls, v: List[float]) -> List[float]:
        """Validate that weights are positive and sum to approximately 1.0."""
        if not v:
            raise ValueError("Weights list cannot be empty")
        
        # Check all weights are positive
        if any(w < 0 for w in v):
            raise ValueError("All weights must be non-negative")
        
        if all(w == 0 for w in v):
            raise ValueError("At least one weight must be positive")
        
        # Check sum is approximately 1.0 (allow small floating point errors)
        total = sum(v)
        if not (0.99 <= total <= 1.01):
            raise ValueError(f"Weights must sum to 1.0 (got {total:.6f})")
        
        return v
    
    @field_validator('algorithm')
    @classmethod
    def validate_algorithm(cls, v: Optional[str]) -> Optional[str]:
        """Validate algorithm is supported."""
        if v is None:
            return v
        
        v_lower = v.lower()
        valid_algorithms = {"md5", "sha256", "murmur32", "xxhash", "xxh3"}
        
        if v_lower not in valid_algorithms:
            raise ValueError(
                f"Invalid algorithm '{v}'. Must be one of: {', '.join(sorted(valid_algorithms))}"
            )
        
        return v_lower
    
    @field_validator('distribution')
    @classmethod
    def validate_distribution(cls, v: Optional[str]) -> Optional[str]:
        """Validate distribution method is supported."""
        if v is None:
            return v
        
        v_lower = v.lower()
        valid_methods = {"modulus", "mad"}
        
        if v_lower not in valid_methods:
            raise ValueError(
                f"Invalid distribution method '{v}'. Must be one of: {', '.join(sorted(valid_methods))}"
            )
        
        return v_lower


class RandomiseResponse(BaseModel):
    """Response model for randomisation endpoint."""
    
    bucket: int = Field(
        ...,
        ge=0,
        description="The assigned bucket (0-indexed)",
        examples=[0, 1, 2]
    )
    
    userid: str = Field(
        ...,
        description="The user identifier that was randomised"
    )
    
    seed: str = Field(
        ...,
        description="The experiment seed used"
    )
    
    num_buckets: int = Field(
        ...,
        ge=2,
        description="Total number of buckets available"
    )


class ErrorResponse(BaseModel):
    """Error response model."""
    
    detail: str = Field(
        ...,
        description="Error message describing what went wrong"
    )


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - health check."""
    return {
        "service": "Randomisation API",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.post(
    "/randomise",
    response_model=RandomiseResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input parameters"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    },
    tags=["Randomisation"]
)
async def randomise_endpoint(request: RandomiseRequest) -> RandomiseResponse:
    """
    Assign a user to a bucket based on weights.
    
    This endpoint provides deterministic A/B testing randomisation:
    - Same userid + seed will always return the same bucket
    - Lightning-fast performance with xxh3 hash algorithm
    - High precision distribution with MAD method
    
    ## Examples
    
    ### Simple A/B test (50/50):
    ```json
    {
      "userid": "user123",
      "seed": "homepage-test",
      "weights": [0.5, 0.5]
    }
    ```
    
    ### A/B/C test (50/30/20):
    ```json
    {
      "userid": "user456",
      "seed": "pricing-test",
      "weights": [0.5, 0.3, 0.2]
    }
    ```
    
    ### 90% control, 10% treatment:
    ```json
    {
      "userid": "user789",
      "seed": "risky-feature",
      "weights": [0.9, 0.1]
    }
    ```
    """
    try:
        # Convert algorithm string to enum if provided
        algorithm = None
        if request.algorithm:
            algorithm_map = {
                "md5": HashAlgorithm.MD5,
                "sha256": HashAlgorithm.SHA256,
                "murmur32": HashAlgorithm.MURMUR32,
                "xxhash": HashAlgorithm.XXHASH,
                "xxh3": HashAlgorithm.XXH3
            }
            algorithm = algorithm_map.get(request.algorithm)
        
        # Convert distribution string to enum if provided
        distribution = None
        if request.distribution:
            distribution_map = {
                "modulus": DistributionMethod.MODULUS,
                "mad": DistributionMethod.MAD
            }
            distribution = distribution_map.get(request.distribution)
        
        # Call the randomise function
        bucket = randomise(
            userid=request.userid,
            seed=request.seed,
            weights=request.weights,
            algorithm=algorithm,
            distribution=distribution,
            table_size=request.table_size
        )
        
        # Return successful response
        return RandomiseResponse(
            bucket=bucket,
            userid=request.userid,
            seed=request.seed,
            num_buckets=len(request.weights)
        )
        
    except ImportError as e:
        # Handle missing optional dependencies
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Missing required library: {str(e)}"
        )
    
    except ValueError as e:
        # Handle validation errors from the randomise function
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parameters: {str(e)}"
        )
    
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "service": "randomisation-api"
    }


@app.get("/test-imports", tags=["Health"])
async def test_imports():
    """Test if all imports and functions work."""
    results = {}
    
    # Test imports
    try:
        from app.randomise import HashAlgorithm, Randomiser
        results["import_randomise"] = "✓ OK"
    except Exception as e:
        results["import_randomise"] = f"✗ FAILED: {str(e)}"
        return {"status": "error", "results": results}
    
    try:
        from app.utils import randomise
        results["import_utils"] = "✓ OK"
    except Exception as e:
        results["import_utils"] = f"✗ FAILED: {str(e)}"
        return {"status": "error", "results": results}
    
    # Test actual randomisation with MD5 (no external deps)
    try:
        from app.utils import randomise
        result = randomise("test_user", "test_seed", [0.5, 0.5], algorithm=HashAlgorithm.MD5)
        results["randomise_md5"] = f"✓ OK (bucket={result})"
    except Exception as e:
        results["randomise_md5"] = f"✗ FAILED: {str(e)}"
        return {"status": "error", "results": results}
    
    # Test with XXH3 (requires xxhash)
    try:
        result = randomise("test_user", "test_seed", [0.5, 0.5], algorithm=HashAlgorithm.XXH3)
        results["randomise_xxh3"] = f"✓ OK (bucket={result})"
    except Exception as e:
        results["randomise_xxh3"] = f"✗ FAILED: {str(e)}"
    
    # Test with MurmurHash3 (requires mmh3)
    try:
        result = randomise("test_user", "test_seed", [0.5, 0.5], algorithm=HashAlgorithm.MURMUR32)
        results["randomise_murmur"] = f"✓ OK (bucket={result})"
    except Exception as e:
        results["randomise_murmur"] = f"✗ FAILED: {str(e)}"
    
    return {
        "status": "success",
        "results": results
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run the server
    uvicorn.run(
        "app.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

