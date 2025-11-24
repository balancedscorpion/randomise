# Randomisation

A deterministic randomisation and bucketing system for A/B testing.

## Overview

This project provides a robust, deterministic system for assigning users to A/B test buckets. The key feature is that the same user ID with the same seed will always be assigned to the same bucket, ensuring consistency across sessions and systems.

## Features

### API Features
- **⚡ Lightning Fast**: < 1ms response time with XXH3 algorithm
- **🔒 Production Ready**: Comprehensive validation and error handling
- **📊 Interactive Docs**: Built-in Swagger UI and ReDoc
- **🔄 RESTful**: Standard HTTP JSON API
- **📈 Scalable**: Stateless design for horizontal scaling

### Core Features
- **Multiple Hash Algorithms**: MD5, SHA256, MurmurHash3, XXHash, XXH3
- **Distribution Methods**: Modulus and Multiply-Add-Divide (MAD)
- **Flexible Bucketing**: Support for any number of variants with custom proportions
- **Deterministic**: Same input always produces same output
- **Modular Design**: Use as API, library, or individual components
- **Type Safety**: Full Pydantic validation for API requests

## Installation

```bash
poetry install
```

## Usage

### FastAPI Web Service (Recommended for Production)

The project includes a production-ready FastAPI service for high-performance A/B testing randomisation.

#### Starting the Server

```bash
# Using uvicorn directly
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload

# Or using the API module
python -m app.api
```

The API will be available at `http://localhost:8000` with:
- **Interactive docs**: http://localhost:8000/docs (Swagger UI)
- **Alternative docs**: http://localhost:8000/redoc (ReDoc)

#### API Endpoints

##### `POST /randomise` - Assign user to bucket

Deterministically assign a user to a bucket based on weights.

**Request:**
```json
{
  "userid": "user123",
  "seed": "homepage-test",
  "weights": [0.5, 0.5]
}
```

**Response:**
```json
{
  "bucket": 0,
  "userid": "user123",
  "seed": "homepage-test",
  "num_buckets": 2
}
```

**Optional Parameters:**
- `algorithm`: Hash algorithm (`xxh3`, `xxhash`, `murmur32`, `sha256`, `md5`)
- `distribution`: Distribution method (`mad`, `modulus`)
- `table_size`: Table size for distribution (100-1,000,000)

##### `GET /health` - Health check

Returns service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "randomisation-api"
}
```

#### API Usage Examples

**Using cURL:**

```bash
# Simple A/B test (50/50)
curl -X POST "http://localhost:8000/randomise" \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "user123",
    "seed": "homepage-test",
    "weights": [0.5, 0.5]
  }'

# A/B/C test (50/30/20) with custom algorithm
curl -X POST "http://localhost:8000/randomise" \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "user456",
    "seed": "pricing-test",
    "weights": [0.5, 0.3, 0.2],
    "algorithm": "xxh3"
  }'

# 90% control, 10% treatment
curl -X POST "http://localhost:8000/randomise" \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "user789",
    "seed": "risky-feature",
    "weights": [0.9, 0.1]
  }'
```

**Using Python requests:**

```python
import requests

# Make a request to the API
response = requests.post(
    "http://localhost:8000/randomise",
    json={
        "userid": "user123",
        "seed": "homepage-test",
        "weights": [0.5, 0.5]
    }
)

result = response.json()
print(f"User assigned to bucket: {result['bucket']}")

# With optional parameters
response = requests.post(
    "http://localhost:8000/randomise",
    json={
        "userid": "user456",
        "seed": "pricing-test",
        "weights": [0.5, 0.3, 0.2],
        "algorithm": "xxh3",
        "distribution": "mad",
        "table_size": 10000
    }
)
```

**Using JavaScript/TypeScript:**

```javascript
// Using fetch
const response = await fetch('http://localhost:8000/randomise', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userid: 'user123',
    seed: 'homepage-test',
    weights: [0.5, 0.5]
  })
});

const result = await response.json();
console.log(`User assigned to bucket: ${result.bucket}`);
```

### Python Library Usage

You can also use the randomisation system directly as a Python library.

#### Quick Start

```python
from app.randomise import Randomiser, HashAlgorithm, DistributionMethod

# Create a randomiser for 50/50 A/B test
randomiser = Randomiser(
    seed="my-experiment-seed",
    proportions=[0.5, 0.5],
    table_size=100,
    hash_algorithm=HashAlgorithm.MD5,
    distribution_method=DistributionMethod.MODULUS
)

# Assign a user to a bucket
user_id = "user12345"
bucket = randomiser.assign(user_id)
print(f"User {user_id} assigned to bucket {bucket}")  # Always deterministic!
```

#### Simple Function API

```python
from app.utils import randomise

# One-liner for quick randomisation (uses optimized defaults)
bucket = randomise(
    userid="user123",
    seed="my-experiment",
    weights=[0.5, 0.5]
)
```

### Running the Demo

```bash
poetry run randomisation
```

Or run directly:

```bash
python -m app.main
```

## Architecture

The system consists of three main components:

### 1. Hasher

Generates deterministic hash values from identifiers and seeds.

```python
from app.randomise import Hasher, HashAlgorithm

hasher = Hasher(seed="my-seed", algorithm=HashAlgorithm.MD5)
hash_value = hasher.hash("user123")
```

**Supported Algorithms:**
- `HashAlgorithm.MD5` - Fast, good distribution
- `HashAlgorithm.SHA256` - Cryptographically secure
- `HashAlgorithm.MURMUR32` - Very fast, non-cryptographic
- `HashAlgorithm.XXHASH` - Extremely fast, excellent distribution

### 2. Distribution

Maps hash values to table indices using different methods.

```python
from app.randomise import Distribution, DistributionMethod

distribution = Distribution(
    table_size=100,
    method=DistributionMethod.MODULUS
)
index = distribution.distribute(hash_value)
```

**Supported Methods:**
- `DistributionMethod.MODULUS` - Simple modulo operation
- `DistributionMethod.MAD` - Multiply-Add-Divide for better distribution

### 3. Bucketing

Allocates table indices to buckets based on specified proportions.

```python
from app.randomise import Bucketing

bucketing = Bucketing(
    proportions=[0.5, 0.3, 0.2],  # 50%, 30%, 20%
    table_size=100
)
bucket = bucketing.get_bucket(index)
```

### Complete System

The `Randomiser` class combines all three components:

```python
from app.randomise import Randomiser, HashAlgorithm, DistributionMethod

# A/B/C test with 50/30/20 split
randomiser = Randomiser(
    seed="experiment-v2",
    proportions=[0.5, 0.3, 0.2],
    table_size=1000,
    hash_algorithm=HashAlgorithm.SHA256,
    distribution_method=DistributionMethod.MAD
)

# Get detailed information
details = randomiser.assign_with_details("user123")
print(details)
# Output: {
#   'identifier': 'user123',
#   'hash': 1234567890,
#   'index': 456,
#   'bucket': 1
# }
```

## Use Cases

### Simple A/B Test (50/50)

```python
randomiser = Randomiser(
    seed="homepage-cta-test",
    proportions=[0.5, 0.5],
    table_size=100
)

bucket = randomiser.assign(user_id)
if bucket == 0:
    show_variant_a()
else:
    show_variant_b()
```

### Multi-variant Test (A/B/C/D)

```python
randomiser = Randomiser(
    seed="pricing-page-test",
    proportions=[0.25, 0.25, 0.25, 0.25],
    table_size=100
)

bucket = randomiser.assign(user_id)
variants = ["control", "variant_a", "variant_b", "variant_c"]
show_variant(variants[bucket])
```

### Unequal Split (90% control, 10% treatment)

```python
randomiser = Randomiser(
    seed="risky-feature-test",
    proportions=[0.9, 0.1],
    table_size=1000
)

bucket = randomiser.assign(user_id)
if bucket == 1:
    enable_new_feature()
```

## Real-World Integration Examples

### Web Application (Node.js/Express)

```javascript
const express = require('express');
const axios = require('axios');

const app = express();

app.get('/feature', async (req, res) => {
  const userId = req.user.id;
  
  // Call randomisation API
  const response = await axios.post('http://localhost:8000/randomise', {
    userid: userId,
    seed: 'new-checkout-flow-2024',
    weights: [0.5, 0.5]
  });
  
  const bucket = response.data.bucket;
  
  if (bucket === 0) {
    // Show control (old checkout)
    res.render('checkout-old');
  } else {
    // Show variant (new checkout)
    res.render('checkout-new');
  }
});
```

### Python Backend (Flask/Django)

```python
import requests

def get_user_variant(user_id, experiment_name, weights):
    """Get A/B test variant for a user."""
    response = requests.post(
        'http://localhost:8000/randomise',
        json={
            'userid': user_id,
            'seed': experiment_name,
            'weights': weights
        },
        timeout=0.1  # Fast timeout - this should be < 1ms
    )
    return response.json()['bucket']

# Usage in view
def homepage(request):
    user_id = request.user.id
    variant = get_user_variant(user_id, 'homepage-hero-2024', [0.5, 0.5])
    
    template = 'homepage_a.html' if variant == 0 else 'homepage_b.html'
    return render(request, template)
```

### Mobile App (Swift/iOS)

```swift
func assignUserToBucket(userId: String, 
                        seed: String, 
                        weights: [Double], 
                        completion: @escaping (Int?) -> Void) {
    let url = URL(string: "http://api.example.com/randomise")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = [
        "userid": userId,
        "seed": seed,
        "weights": weights
    ] as [String : Any]
    
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        guard let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let bucket = json["bucket"] as? Int else {
            completion(nil)
            return
        }
        completion(bucket)
    }.resume()
}

// Usage
assignUserToBucket(userId: user.id, 
                   seed: "new-feature-2024", 
                   weights: [0.8, 0.2]) { bucket in
    if bucket == 1 {
        // Show new feature
        self.showNewFeature()
    }
}
```

## Why Deterministic?

Deterministic assignment is crucial for:
- **Consistency**: Users see the same experience across sessions
- **Analytics**: Accurate tracking of user behavior over time
- **Debugging**: Reproducible test assignments
- **Distributed Systems**: Same assignment across different servers
- **No Database Required**: Assignment calculated on-the-fly, no state to manage

## Project Structure

```
├── app/
│   ├── __init__.py
│   ├── api.py                 # FastAPI web service
│   ├── main.py                # Demo application
│   ├── randomise.py           # Core randomisation system
│   └── utils.py               # Simple utility functions
├── ab_testing_tutorial.ipynb # Comprehensive tutorial with benchmarks
├── Demo_Usage.ipynb           # Quick usage examples
├── Dockerfile                 # Production-ready Docker image
├── .dockerignore              # Docker build optimization
├── railway.toml               # Railway.app configuration
├── render.yaml                # Render.com configuration
├── fly.toml                   # Fly.io configuration
├── test-docker.sh             # Local Docker testing script
├── DEPLOYMENT.md              # Detailed deployment guide
├── pyproject.toml             # Poetry dependencies
├── poetry.lock                # Dependency lock file
└── README.md                  # This file
```

## Development

### Running Tests

```bash
poetry run pytest
```

### Code Formatting

```bash
poetry run black app/
```

### Linting

```bash
poetry run flake8 app/
```

## Performance

The API is designed for high-throughput production use:
- **Speed**: < 1ms per request (typically ~0.1-0.3ms with XXH3)
- **Throughput**: 10,000+ requests/second on modest hardware
- **Consistency**: Same user + seed always returns same bucket
- **Scalability**: Stateless design allows horizontal scaling

## Deployment

The API is ready for one-click deployment to major cloud platforms. All configuration files are included.

📖 **See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide and troubleshooting.**

### Platform Comparison

| Platform | Free Tier | Deploy Time | Custom Domain | Auto HTTPS | Config File |
|----------|-----------|-------------|---------------|------------|-------------|
| **Railway** | ✅ Yes | ~2 min | ✅ Free | ✅ Auto | `railway.toml` |
| **Render** | ✅ Yes | ~3 min | ✅ Free | ✅ Auto | `render.yaml` |
| **Fly.io** | ✅ Yes | ~2 min | ✅ Free | ✅ Auto | `fly.toml` |
| **Docker** | N/A | ~1 min | Manual | Manual | `Dockerfile` |

### Quick Deploy to Railway (Recommended) 🚂

Railway provides one-click deployment with automatic HTTPS and custom domains.

**Deploy in 3 steps:**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "Start a New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Done!** Railway will:
   - Automatically detect the Dockerfile
   - Build and deploy your API
   - Provide a public URL (e.g., `https://your-app.up.railway.app`)
   - Set up automatic deployments on git push

**Configuration:**
The included `railway.toml` file provides optimal settings. Railway automatically:
- Sets the `$PORT` environment variable
- Monitors the `/health` endpoint
- Restarts on failures
- Provides free HTTPS

### Deploy to Render

1. Create a new Web Service at [render.com](https://render.com)
2. Connect your GitHub repository
3. Use these settings:
   - **Environment:** Docker
   - **Health Check Path:** `/health`
   - **Auto-Deploy:** Yes

### Deploy to Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Launch your app
fly launch

# Deploy
fly deploy
```

### Docker Deployment (Self-Hosted)

Build and run:

```bash
docker build -t randomisation-api .
docker run -p 8000:8000 randomisation-api
```

Or with custom port:

```bash
docker run -p 3000:3000 -e PORT=3000 randomisation-api
```

### Production Considerations

1. **Use a production ASGI server**: The API uses Uvicorn, which is production-ready
2. **Enable multiple workers**: `uvicorn app.api:app --workers 4`
3. **Add monitoring**: Use `/health` endpoint for health checks
4. **Rate limiting**: Consider adding rate limiting middleware
5. **HTTPS**: Use a reverse proxy (nginx, Traefik) for SSL termination
6. **Caching**: Consider caching for frequently requested user/seed combinations

## Troubleshooting Deployment

### Health Check Failures

If your deployment health checks are failing:

1. **Check the logs** - Look for startup errors:
   ```
   # Railway: Click "View Logs" in the deployment
   # Render: Check the "Logs" tab
   # Fly.io: fly logs
   ```

2. **Verify dependencies installed** - Ensure xxhash and mmh3 compiled:
   ```
   Look for: "Installing xxhash (3.6.0)" in build logs
   ```

3. **Check port binding** - The app should show:
   ```
   INFO: Uvicorn running on http://0.0.0.0:XXXX
   ```

4. **Test locally** - Run the included test script:
   ```bash
   ./test-docker.sh
   ```

### Common Issues

**"Service Unavailable" during health checks:**
- Solution: Increase `healthcheckTimeout` in `railway.toml` (already set to 300s)
- Cause: Cold starts can take 30-60 seconds on free tiers

**Build failures with xxhash/mmh3:**
- Solution: The Dockerfile includes gcc/g++ - no action needed
- If persists: Check platform build logs for compilation errors

**Port conflicts:**
- Railway/Render automatically set `$PORT` - no configuration needed
- For Docker: Use `-e PORT=3000` to override

### Environment Variables

The API automatically adapts to platform environment variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port (auto-set by Railway/Render/Fly) | `8000` | No |
| `HOST` | Server host | `0.0.0.0` | No |

**For Railway/Render/Fly.io:** No configuration needed - they set `PORT` automatically.

**For manual deployment:**

```bash
export PORT=3000
uvicorn app.api:app --host 0.0.0.0 --port $PORT

# Or with workers
uvicorn app.api:app --host 0.0.0.0 --port $PORT --workers 4
```

## Dependencies

### Core Dependencies
- Python 3.8+
- FastAPI - Modern web framework
- Uvicorn - ASGI server
- Pydantic - Data validation

### Optional Hash Libraries
- mmh3 - For Murmur3 hashing (fast, non-cryptographic)
- xxhash - For XXHash/XXH3 algorithms (fastest, recommended)

**Note**: MD5 and SHA256 are included in Python's standard library, but non-cryptographic hashes (xxhash, mmh3) are much faster for A/B testing use cases.

## License

MIT License
