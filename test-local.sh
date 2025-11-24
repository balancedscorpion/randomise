#!/bin/bash
# Quick local test of the Docker image

set -e

echo "🧹 Cleaning up any existing containers..."
docker stop randomisation-test 2>/dev/null || true
docker rm randomisation-test 2>/dev/null || true

echo ""
echo "🔨 Building Docker image..."
docker build -t randomisation-api:test .

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "🚀 Starting container..."
docker run -d --name randomisation-test -p 8000:8000 -e PORT=8000 randomisation-api:test

echo ""
echo "📋 Container logs:"
sleep 3
docker logs randomisation-test

echo ""
echo "⏳ Waiting for service to be ready..."
sleep 5

echo ""
echo "🏥 Testing health endpoint..."
response=$(curl -s http://localhost:8000/health)
echo "Response: $response"

if echo "$response" | grep -q "healthy"; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    echo ""
    echo "Full logs:"
    docker logs randomisation-test
    docker stop randomisation-test
    docker rm randomisation-test
    exit 1
fi

echo ""
echo "🧪 Testing randomise endpoint..."
curl -s -X POST http://localhost:8000/randomise \
  -H "Content-Type: application/json" \
  -d '{"userid":"test_user","seed":"test","weights":[0.5,0.5]}' | python3 -m json.tool

echo ""
echo "🧹 Cleaning up..."
docker stop randomisation-test
docker rm randomisation-test

echo ""
echo "✅ All tests passed! Ready to deploy to Railway."

