# Server Deployment Guide

Guide to deploy the WebSocket server for free.

## 🌐 Render Deployment (Recommended)

Render provides a free tier with WebSocket support.

### Render Free Tier

**Included:**
- ✅ **1 unlimited web service**
- ✅ **Free SSL/HTTPS** (auto-configured)
- ✅ **Free domain** (`.onrender.com`)
- ✅ **WebSocket support**
- ✅ **GitHub auto-deploy**
- ✅ **Free custom domain** connection

**Limitations:**
- ⚠️ **Sleep mode after 15min inactivity** (wakes up on first request, 30-60 seconds)
- ⚠️ **Monthly usage limits** (free tier)
- ⚠️ **CPU/memory limits** (free tier)

**Why it's good for this project:**
- Perfect WebSocket support
- Very simple setup
- Free domain auto-provided
- Auto-deploy with GitHub

### 1. Create Render Account
1. Go to [Render](https://render.com)
2. Click **"Get Started for Free"**
3. Login with GitHub (or email)

### 2. Deploy Project

#### Option A: Blueprint (Simplest, Recommended)
1. Push this repository to GitHub (if not already)
2. Render dashboard → **"New +"** → **"Blueprint"**
3. Select GitHub repository
4. Click **"Apply"**
5. Settings applied automatically and deployment starts! ⚡

#### Option B: Manual Setup
1. Render dashboard → **"New +"** → **"Web Service"**
2. Connect GitHub repository
3. Settings:
   - **Name**: `raftel-watch-together` (your choice)
   - **Root Directory**: `server` ⚠️ **Important!**
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**
4. Click **"Create Web Service"**

### 3. Environment Variables (Auto-configured)
- Already set in `render.yaml`
- Modify in Render dashboard → **Environment** if needed

### 4. Get Server URL
1. After deployment (takes about 2-3 minutes)
2. Click service name in Render dashboard
3. Copy the URL (e.g., `https://raftel-watch-together.onrender.com`)
4. **WebSocket URL**: `wss://raftel-watch-together.onrender.com`
   - ⚠️ **Important**: Change `https://` to `wss://`!

### 5. Configure Chrome Extension
1. Open extension popup
2. Enter WebSocket server URL: `wss://raftel-watch-together.onrender.com`
3. Click "Convert" button if needed
4. Create or join room

### 6. Handle Sleep Mode
Render enters sleep mode after 15 minutes of inactivity.

**Solutions:**
- First connection may take 30-60 seconds (normal)
- Frequent use prevents sleep mode
- Upgrade to paid plan for no sleep mode

## 🔧 Environment Variables

Optional environment variables:

- `PORT`: Server port (default: 3001, Render uses 10000)
- `HOST`: Server host (default: 0.0.0.0)
- `NODE_ENV`: Environment (production/development)

## 📝 Verify Deployment

After deployment, verify:

1. **Health Check**: Visit `https://your-app-url/health`
   - Should return `{"status":"ok","service":"raftel-watch-together",...}`

2. **WebSocket Connection Test**:
   - Open Chrome Extension popup
   - Enter server URL
   - Test room creation

## ⚠️ Notes

### Free Tier Limitations

1. **Render**:
   - Free tier: 1 unlimited web service
   - Sleep mode after 15min inactivity
   - First request after sleep takes 30-60 seconds

### Recommendations

- **Personal/Small groups**: Render (simple setup, free tier sufficient)
- **Production**: Render paid plan or other services

## 🔄 Update Server URL

Set deployed server URL in Chrome Extension:

1. Open extension popup
2. Enter `wss://your-deployed-url` in "WebSocket Server URL"
3. Auto-saved

Make sure all users use the same server URL!

---

For detailed Render deployment guide, see [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)
