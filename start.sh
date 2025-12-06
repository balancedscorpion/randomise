#!/bin/sh
# Startup script with error handling and logging

set -e  # Exit on error

echo "=========================================="
echo "Starting Randomisation API"
echo "=========================================="
echo "PORT: ${PORT:-8000}"
echo "Python version: $(python --version)"
echo "PWD: $(pwd)"
echo ""

# Build frontend only if source exists and dist doesn't (or npm is available for dev)
if [ -d "frontend/src" ] && command -v npm >/dev/null 2>&1; then
    echo "Building frontend..."
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install --silent
    fi
    npm run build --silent
    cd ..
    echo "✓ Frontend built successfully"
    echo ""
elif [ -d "frontend/dist" ]; then
    echo "✓ Frontend already built"
    echo ""
fi

echo "Checking Python modules..."
python -c "import fastapi; print(f'✓ FastAPI {fastapi.__version__}')" || echo "✗ FastAPI not found"
python -c "import uvicorn; print(f'✓ Uvicorn {uvicorn.__version__}')" || echo "✗ Uvicorn not found"
python -c "import xxhash; print(f'✓ xxhash {xxhash.VERSION}')" || echo "✗ xxhash not found"
python -c "import mmh3; print('✓ mmh3')" || echo "✗ mmh3 not found"
echo ""

echo "Checking app module..."
python -c "from app.api import app; print('✓ App imports successfully')" || {
    echo "✗ Failed to import app"
    exit 1
}
echo ""

echo "Starting Uvicorn..."
exec uvicorn app.api:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
