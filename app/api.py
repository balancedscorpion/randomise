"""FastAPI application for A/B testing randomisation.

Provides a high-performance API endpoint for deterministic user assignment
to experiment variants.
"""

from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from app.randomise import randomise, randomise_with_details, HashAlgorithm, DistributionMethod


app = FastAPI(
    title="Randomisation API",
    description="Lightning-fast A/B testing randomisation service",
    version="1.0.0"
)


# -----------------------------------------------------------------------------
# Request/Response Models
# -----------------------------------------------------------------------------

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
        description="Experiment seed for deterministic assignment",
        examples=["homepage-test", "pricing-experiment-2024"]
    )
    
    weights: List[float] = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Proportions for each variant (must sum to 1.0)",
        examples=[[0.5, 0.5], [0.5, 0.3, 0.2], [0.9, 0.1]]
    )
    
    algorithm: Optional[str] = Field(
        None,
        description="Hash algorithm: xxh3, xxhash, murmur32, sha256, md5",
        examples=["xxh3", "murmur32"]
    )
    
    distribution: Optional[str] = Field(
        None,
        description="Distribution method: mad, modulus",
        examples=["mad", "modulus"]
    )
    
    table_size: Optional[int] = Field(
        None,
        ge=100,
        le=1000000,
        description="Hash table size for distribution precision (100-1000000)",
        examples=[10000, 100000]
    )
    
    @field_validator('weights')
    @classmethod
    def validate_weights(cls, v: List[float]) -> List[float]:
        """Validate weights are positive and sum to ~1.0."""
        if any(w < 0 for w in v):
            raise ValueError("All weights must be non-negative")
        
        if all(w == 0 for w in v):
            raise ValueError("At least one weight must be positive")
        
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
        valid = {a.value for a in HashAlgorithm}
        
        if v_lower not in valid:
            raise ValueError(f"Invalid algorithm '{v}'. Must be one of: {', '.join(sorted(valid))}")
        
        return v_lower
    
    @field_validator('distribution')
    @classmethod
    def validate_distribution(cls, v: Optional[str]) -> Optional[str]:
        """Validate distribution method is supported."""
        if v is None:
            return v
        
        v_lower = v.lower()
        valid = {d.value for d in DistributionMethod}
        
        if v_lower not in valid:
            raise ValueError(f"Invalid distribution '{v}'. Must be one of: {', '.join(sorted(valid))}")
        
        return v_lower


class RandomiseResponse(BaseModel):
    """Response model for randomisation endpoint."""
    
    variant: int = Field(..., ge=0, description="Assigned variant (0-indexed)")
    userid: str = Field(..., description="User identifier")
    seed: str = Field(..., description="Experiment seed used")
    num_variants: int = Field(..., ge=2, description="Total number of variants")


class ErrorResponse(BaseModel):
    """Error response model."""
    detail: str = Field(..., description="Error description")


class RandomiseDetailsResponse(BaseModel):
    """Detailed response model with intermediate calculation values."""
    
    userid: str = Field(..., description="User identifier")
    seed: str = Field(..., description="Experiment seed used")
    algorithm: str = Field(..., description="Hash algorithm used")
    distribution: str = Field(..., description="Distribution method used")
    hash_value: int = Field(..., description="Raw hash value from algorithm")
    table_size: int = Field(..., description="Distribution table size")
    table_index: int = Field(..., description="Index in distribution table")
    boundaries: List[int] = Field(..., description="Variant boundary indices")
    weights: List[float] = Field(..., description="Variant weights/proportions")
    variant: int = Field(..., ge=0, description="Assigned variant (0-indexed)")
    num_variants: int = Field(..., ge=2, description="Total number of variants")


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - service info."""
    return {
        "service": "Randomisation API",
        "status": "healthy",
        "version": "1.0.0"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "randomisation-api"}


@app.post(
    "/randomise",
    response_model=RandomiseResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    tags=["Randomisation"]
)
async def randomise_endpoint(request: RandomiseRequest) -> RandomiseResponse:
    """
    Assign a user to a variant based on weights.
    
    Deterministic: same userid + seed always returns the same variant.
    
    ## Examples
    
    ### A/B test (50/50):
    ```json
    {"userid": "user123", "seed": "homepage-test", "weights": [0.5, 0.5]}
    ```
    
    ### A/B/C test (50/30/20):
    ```json
    {"userid": "user456", "seed": "pricing-test", "weights": [0.5, 0.3, 0.2]}
    ```
    
    ### 90% control, 10% treatment:
    ```json
    {"userid": "user789", "seed": "risky-feature", "weights": [0.9, 0.1]}
    ```
    """
    try:
        variant = randomise(
            userid=request.userid,
            seed=request.seed,
            weights=request.weights,
            algorithm=request.algorithm,
            distribution=request.distribution,
            table_size=request.table_size
        )
        
        return RandomiseResponse(
            variant=variant,
            userid=request.userid,
            seed=request.seed,
            num_variants=len(request.weights)
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        )


@app.post(
    "/randomise/details",
    response_model=RandomiseDetailsResponse,
    status_code=status.HTTP_200_OK,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Server error"}
    },
    tags=["Randomisation"]
)
async def randomise_details_endpoint(request: RandomiseRequest) -> RandomiseDetailsResponse:
    """
    Assign a user to a variant with detailed intermediate calculation values.
    
    Returns all intermediate values for educational/debugging purposes:
    - hash_value: The raw hash produced by the algorithm
    - table_index: The index in the distribution table
    - boundaries: The variant boundary indices
    - variant: The final assigned variant
    """
    try:
        algo = request.algorithm or "md5"
        dist = request.distribution or "mad"
        size = request.table_size or 10000
        
        details = randomise_with_details(
            userid=request.userid,
            seed=request.seed,
            weights=request.weights,
            algorithm=algo,
            distribution=dist,
            table_size=size
        )
        
        # Calculate boundaries for the response
        boundaries = []
        cumulative = 0.0
        for proportion in request.weights:
            cumulative += proportion
            boundaries.append(int(cumulative * size))
        boundaries[-1] = size
        
        return RandomiseDetailsResponse(
            userid=request.userid,
            seed=request.seed,
            algorithm=algo,
            distribution=dist,
            hash_value=details['hash'],
            table_size=size,
            table_index=details['index'],
            boundaries=boundaries,
            weights=request.weights,
            variant=details['variant'],
            num_variants=len(request.weights)
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {str(e)}"
        )


# -----------------------------------------------------------------------------
# Static file serving for frontend
# -----------------------------------------------------------------------------

# Serve frontend static files if the dist directory exists
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@app.get("/app", include_in_schema=False)
@app.get("/app/{path:path}", include_in_schema=False)
async def serve_frontend(path: str = ""):
    """Serve the React frontend application."""
    if not FRONTEND_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail="Frontend not built. Run 'npm run build' in frontend directory."
        )
    
    # Handle assets directory specially
    if path.startswith("assets/"):
        file_path = FRONTEND_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Try to serve the requested file
    file_path = FRONTEND_DIR / path
    if file_path.is_file():
        return FileResponse(file_path)
    
    # For SPA routing, serve index.html for non-file paths
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    
    raise HTTPException(status_code=404, detail="File not found")


# -----------------------------------------------------------------------------
# Main entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)
