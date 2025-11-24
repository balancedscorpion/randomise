# Deployment Guide

## What Was Fixed for Railway/Platform Deployment

### 1. Dockerfile CMD Fix
**Problem:** The original CMD wasn't properly expanding the `$PORT` environment variable.

**Before:**
```dockerfile
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

**After:**
```dockerfile
CMD sh -c "uvicorn app.api:app --host 0.0.0.0 --port ${PORT:-8000} --log-level info"
```

**Why:** 
- Shell form (`sh -c`) properly expands environment variables
- `${PORT:-8000}` provides fallback if PORT not set
- `--log-level info` helps with debugging during deployment

### 2. Railway Configuration
**Updated `railway.toml`:**
- Increased `healthcheckTimeout` from 100s to 300s
- Added explicit logging with `--log-level info`
- Accounts for cold start times on free tier

### 3. Multi-Platform Support
All deployment configs now use consistent command:
- **Railway:** Uses Dockerfile CMD + railway.toml override
- **Render:** Uses `dockerCommand` in render.yaml
- **Fly.io:** Uses `processes` in fly.toml
- **Docker:** Works with `-e PORT=XXXX` override

## Quick Deployment Checklist

### Before Deploying:

- [ ] All changes committed to git
- [ ] `.dockerignore` excludes unnecessary files
- [ ] `pyproject.toml` has correct dependencies
- [ ] Local Docker build succeeds: `docker build -t test .`

### Railway Deployment:

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Connect Railway:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository
   - Railway auto-detects Dockerfile

3. **Wait for deployment:**
   - Build: ~2-3 minutes
   - Health check: 30-60 seconds
   - Total: ~3-4 minutes

4. **Test your API:**
   ```bash
   curl https://your-app.up.railway.app/health
   
   curl -X POST https://your-app.up.railway.app/randomise \
     -H "Content-Type: application/json" \
     -d '{"userid":"test","seed":"exp1","weights":[0.5,0.5]}'
   ```

### Render Deployment:

1. Connect repository at [render.com](https://render.com)
2. Select "New Web Service"
3. Configure:
   - Environment: Docker
   - Branch: main
   - Health Check Path: `/health`
4. Deploy (takes ~3-4 minutes)

### Fly.io Deployment:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (uses fly.toml)
fly launch --no-deploy

# Deploy
fly deploy

# Test
curl https://your-app.fly.dev/health
```

## Testing Your Deployment

### 1. Health Check
```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "randomisation-api"
}
```

### 2. Test Randomisation
```bash
curl -X POST https://your-domain.com/randomise \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "user_12345",
    "seed": "homepage_test",
    "weights": [0.5, 0.5]
  }'
```

Expected response:
```json
{
  "bucket": 0,
  "userid": "user_12345",
  "seed": "homepage_test",
  "num_buckets": 2
}
```

### 3. Test API Docs
Visit: `https://your-domain.com/docs`

You should see interactive Swagger UI documentation.

## Monitoring

### Railway
- View logs: Railway Dashboard → Deployments → View Logs
- Metrics: Railway Dashboard → Metrics tab
- Custom domain: Settings → Networking

### Render
- View logs: Service → Logs tab
- Metrics: Service → Metrics tab
- Custom domain: Settings → Custom Domain

### Fly.io
```bash
# View logs
fly logs

# Check status
fly status

# View metrics
fly dashboard
```

## Performance Expectations

### Free Tier Performance:
- **Cold start:** 30-60 seconds (first request after idle)
- **Warm response:** < 100ms per request
- **Throughput:** 100-1000 req/min (depending on platform)

### Paid Tier Performance:
- **Cold start:** N/A (always-on)
- **Response time:** < 10ms per request
- **Throughput:** 10,000+ req/min with auto-scaling

## Environment Variables

All platforms automatically set:
- `PORT` - The port your app should listen on
- `RAILWAY_ENVIRONMENT` / `RENDER` / `FLY_APP_NAME` - Platform identifiers

No additional configuration required!

## Rollback

### Railway
1. Go to Deployments
2. Click on previous successful deployment
3. Click "Redeploy"

### Render
1. Go to Deploys
2. Select previous deploy
3. Click "Rollback to this version"

### Fly.io
```bash
fly releases
fly rollback
```

## Cost Estimates

### Free Tier (All Platforms)
- **Railway:** 500 hours/month, 1GB RAM
- **Render:** 750 hours/month, 512MB RAM
- **Fly.io:** 3 shared-cpu-1x VMs, 160GB bandwidth

### Paid Tier (Monthly)
- **Railway:** ~$5-20 (usage-based)
- **Render:** $7+ (fixed tiers)
- **Fly.io:** $3+ (usage-based)

All offer free HTTPS, custom domains, and auto-deployments on git push!

