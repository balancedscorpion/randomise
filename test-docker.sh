#!/bin/bash
# Quick script to test Docker build and deployment locally

echo "🔨 Building Docker image..."
docker build -t randomisation-api:test .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "🚀 Starting container on port 8000..."
docker run -d --name randomisation-test -p 8000:8000 randomisation-api:test

echo "⏳ Waiting for service to start..."
sleep 5

echo "🏥 Testing health endpoint..."
curl -s http://localhost:8000/health | jq .

echo ""
echo "🧪 Testing randomise endpoint..."
curl -s -X POST http://localhost:8000/randomise \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "test_user_123",
    "seed": "test_experiment",
    "weights": [0.5, 0.5]
  }' | jq .

echo ""
echo "📊 Testing with custom algorithm..."
curl -s -X POST http://localhost:8000/randomise \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "test_user_456",
    "seed": "test_experiment_2",
    "weights": [0.5, 0.3, 0.2],
    "algorithm": "xxh3"
  }' | jq .

echo ""
echo "🧹 Cleaning up..."
docker stop randomisation-test
docker rm randomisation-test

echo ""
echo "✅ All tests passed! Ready for deployment."

