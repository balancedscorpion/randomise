# Railway Deployment Tutorial

A simple, step-by-step guide to deploy your Randomisation API on Railway.

## Prerequisites

- GitHub account
- Railway account (free tier available at [railway.app](https://railway.app))
- Your code pushed to a GitHub repository

## Step 1: Push Your Code to GitHub

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will automatically detect your `Dockerfile`

## Step 3: Wait for Initial Build

Railway will automatically:
- ✅ Build your Docker image (2-3 minutes)
- ✅ Deploy the container
- ✅ Run health checks
- ✅ Generate a public URL

## Step 4: Configure Networking (IMPORTANT!)

After the first deployment:

1. **Go to Settings → Networking**
2. **Check the Port setting**:
   - If it shows `8000`, change it to `8080`
   - Or add environment variable: `PORT=8080` in Settings → Variables
3. **Verify "Public Networking" is enabled**
4. **Note your public URL**: `https://your-app-name.up.railway.app`

> **Why?** Railway defaults to port 8000, but the app listens on port 8080 (set by Railway's `$PORT` environment variable). The port mismatch causes 502 errors.

## Step 5: Test Your Deployment

```bash
# Replace YOUR_URL with your Railway URL

# 1. Health check
curl https://YOUR_URL/health

# Expected: {"status":"healthy","service":"randomisation-api"}

# 2. Test randomisation
curl -X POST https://YOUR_URL/randomise \
  -H "Content-Type: application/json" \
  -d '{
    "userid": "user_123",
    "seed": "test_experiment",
    "weights": [0.5, 0.5]
  }'

# Expected: {"bucket":0,"userid":"user_123","seed":"test_experiment","num_buckets":2}

# 3. View interactive API docs
open https://YOUR_URL/docs
```

## Step 6: Set Up Automatic Deployments

Railway automatically redeploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Update API"
git push origin main

# Railway automatically builds and deploys!
```

---

## Troubleshooting

### 502 Bad Gateway Error

**Symptom:** `/health` works but other endpoints return 502

**Solution:**
1. Check Railway logs: Settings → Deployments → View Logs
2. Verify port setting: Settings → Networking → Port should be `8080`
3. Check environment variables: Settings → Variables → Add `PORT=8080` if missing

### Health Check Failing

**Symptom:** Deployment shows "Unhealthy" or failing health checks

**Solution:**
1. Increase timeout: Railway uses `railway.toml` (already configured to 300s)
2. Cold starts take 30-60 seconds on free tier - be patient
3. Check logs for import errors or crashes

### Build Failures

**Symptom:** Docker build fails during deployment

**Solution:**
1. Check build logs for compilation errors
2. Verify `pyproject.toml` and `poetry.lock` are committed
3. Ensure Dockerfile is in repository root

### App Crashes on Startup

**Symptom:** Logs show traceback or import errors

**Solution:**
1. Check for missing dependencies in logs
2. Verify all Python modules install correctly
3. Review the startup logs section for specific error messages

---

## Understanding the Logs

Railway shows two types of logs:

### Application Logs (What You Want)
```
==========================================
Starting Randomisation API
==========================================
PORT: 8080
✓ FastAPI 0.104.1
✓ Uvicorn 0.24.0.post1
INFO: Uvicorn running on http://0.0.0.0:8080
INFO: 100.64.0.2:xxxxx - "GET /health HTTP/1.1" 200 OK  ✅ Success!
```

### HTTP Access Logs (Railway's Proxy)
```json
{
  "method": "POST",
  "path": "/randomise",
  "httpStatus": 200,
  "upstreamErrors": []  ✅ No errors
}
```

**If you see `"upstreamErrors": "connection refused"`**, it means Railway can't reach your app (usually a port mismatch).

---

## Configuration Files

Your project includes these Railway-specific files:

### `railway.toml`
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "./start.sh"
healthcheckPath = "/health"
healthcheckTimeout = 300
```

### `Dockerfile`
- Multi-stage build for small image size
- Installs gcc/g++ for compiling hash libraries
- Uses `start.sh` for diagnostic logging

### `start.sh`
- Validates all dependencies load correctly
- Shows detailed startup information
- Helps diagnose issues quickly

---

## Performance & Limits

### Free Tier
- ✅ 500 hours/month execution time
- ✅ 1GB RAM
- ✅ Free HTTPS & custom domains
- ⚠️ Cold starts (30-60s after idle)
- ⚠️ Sleeps after 30 min of inactivity

### Paid Tier (~$5-20/month)
- ✅ Always-on (no cold starts)
- ✅ More RAM/CPU
- ✅ Auto-scaling
- ✅ Better performance

---

## API Endpoints

Once deployed, your API provides:

### Core Endpoints
- `GET /` - Basic info
- `GET /health` - Health check (for Railway)
- `GET /docs` - Interactive Swagger UI
- `POST /randomise` - Main randomisation endpoint

### Example Usage

```bash
# A/B Test (50/50)
curl -X POST https://YOUR_URL/randomise \
  -H "Content-Type: application/json" \
  -d '{"userid":"user_123","seed":"homepage_test","weights":[0.5,0.5]}'

# A/B/C Test (50/30/20)
curl -X POST https://YOUR_URL/randomise \
  -H "Content-Type: application/json" \
  -d '{"userid":"user_456","seed":"pricing_test","weights":[0.5,0.3,0.2]}'

# With specific algorithm
curl -X POST https://YOUR_URL/randomise \
  -H "Content-Type: application/json" \
  -d '{
    "userid":"user_789",
    "seed":"feature_test",
    "weights":[0.9,0.1],
    "algorithm":"md5"
  }'
```

---

## Next Steps

Once deployed successfully:

1. **Add a custom domain** (Settings → Networking → Custom Domain)
2. **Set up monitoring** (Railway provides basic metrics)
3. **Review logs regularly** (Deployments → View Logs)
4. **Scale if needed** (Upgrade to paid tier for always-on service)

---

## Support

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Railway Discord**: Join for community support
- **Project Issues**: Open an issue on your GitHub repository

---

## Quick Reference

```bash
# View Railway status
railway status

# View logs
railway logs

# Open dashboard
railway open

# Redeploy
git push origin main  # Automatic deployment
```

**🎉 That's it! Your API is now live on Railway!**
