# Randomisation

A deterministic randomisation system for A/B testing with an interactive visualization frontend.

## Overview

This project provides a robust, deterministic system for assigning users to A/B test variants. The same user ID with the same seed will always be assigned to the same variant, ensuring consistency across sessions and systems.

**Key Features:**
- Deterministic assignment (same input = same output)
- Multiple hash algorithms (MD5, SHA256, MurmurHash3, XXHash, XXH3)
- Flexible variant weights
- Interactive visualization frontend
- Production-ready FastAPI service

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Randomisation.git
cd Randomisation

# Install Python dependencies
poetry install

# Install frontend dependencies (optional, for development)
cd frontend && npm install && cd ..
```

### Running the Server

```bash
# Start the API server
poetry run uvicorn app.api:app --host 0.0.0.0 --port 8000

# Or use the startup script
./start.sh
```

The application will be available at:
- **API**: http://localhost:8000
- **Visualizer**: http://localhost:8000/app
- **API Docs**: http://localhost:8000/docs

## API Reference

### POST /randomise

Assign a user to a variant based on weights.

**Request:**
```json
{
  "userid": "user123",
  "seed": "homepage-experiment",
  "weights": [0.5, 0.5]
}
```

**Response:**
```json
{
  "variant": 0,
  "userid": "user123",
  "seed": "homepage-experiment",
  "num_variants": 2
}
```

**Optional Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `algorithm` | string | `md5` | Hash algorithm: `md5`, `sha256`, `murmur32`, `xxhash`, `xxh3` |
| `distribution` | string | `mad` | Distribution method: `mad`, `modulus` |
| `table_size` | int | `10000` | Table size for distribution precision (100-1,000,000) |

### POST /randomise/details

Returns detailed intermediate values for debugging and visualization.

**Response:**
```json
{
  "userid": "user123",
  "seed": "homepage-experiment",
  "algorithm": "md5",
  "distribution": "mad",
  "hash_value": 2521107074,
  "table_size": 10000,
  "table_index": 1601,
  "boundaries": [5000, 10000],
  "weights": [0.5, 0.5],
  "variant": 0,
  "num_variants": 2
}
```

### GET /health

Health check endpoint for monitoring.

```json
{
  "status": "healthy",
  "service": "randomisation-api"
}
```

## Python Library Usage

```python
from app import randomise, Randomiser

# Simple function API
variant = randomise("user123", "my-experiment", [0.5, 0.5])

# Class-based API for more control
r = Randomiser("my-experiment", [0.5, 0.5], algorithm="xxh3")
variant = r.assign("user123")

# Get detailed assignment info
details = r.assign_with_details("user123")
# {'identifier': 'user123', 'hash': 123456, 'index': 4521, 'variant': 0}
```

## Frontend Visualizer

The interactive visualizer at `/app` demonstrates the randomisation pipeline:

1. **Pipeline View** - Watch data flow through each transformation step
2. **Bucket Visualization** - See how users are distributed across variants
3. **Distribution Simulator** - Run bulk simulations with timing metrics
4. **Hilbert Curve** - Visualize distribution uniformity

All values in the pipeline are interactive and can be edited to see how changes affect the result.

## Hash Algorithms

| Algorithm | Speed | Use Case |
|-----------|-------|----------|
| `xxh3` | Fastest | Production, high throughput |
| `xxhash` | Very Fast | Production |
| `murmur32` | Fast | General purpose |
| `sha256` | Moderate | When cryptographic properties needed |
| `md5` | Moderate | Default, good compatibility |

## Distribution Methods

- **MAD (Multiply-Add-Divide)**: Better distribution properties, recommended
- **Modulus**: Simple modulo operation, slightly faster

## Deployment

### Docker

```bash
# Build the image
docker build -t randomisation-api .

# Run the container
docker run -p 8000:8000 randomisation-api
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

The repository includes `railway.toml` for automatic deployment.

### Fly.io

```bash
fly launch
fly deploy
```

## Configuration

Environment variables:
- `PORT` - Server port (default: 8000)

## Development

```bash
# Install all dependencies
poetry install

# Run with auto-reload
poetry run uvicorn app.api:app --reload

# Build frontend
cd frontend && npm run build

# Run frontend dev server (with API proxy)
cd frontend && npm run dev
```

## Project Structure

```
.
├── app/
│   ├── api.py          # FastAPI application
│   ├── randomise.py    # Core randomisation logic
│   └── __init__.py     # Package exports
├── frontend/
│   ├── src/            # React components
│   └── dist/           # Built frontend (generated)
├── Dockerfile          # Multi-stage Docker build
├── pyproject.toml      # Python dependencies
└── start.sh            # Startup script
```

## License

MIT License
