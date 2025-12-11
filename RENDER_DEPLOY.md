# Render Deployment Guide

Quick guide to deploy the WebSocket server on Render.

## 🚀 Quick Deployment (5 minutes)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Click **"Get Started for Free"**
3. Login with GitHub (or email)

### Step 2: Deploy Project

#### Option A: Blueprint (Recommended) ⚡
1. Push this repository to GitHub (if not already)
2. In Render dashboard, click **"New +"**
3. Select **"Blueprint"**
4. Select GitHub repository
5. Click **"Apply"**
6. Deployment starts automatically! 🎉

#### Option B: Manual Setup
1. Render dashboard → **"New +"** → **"Web Service"**
2. Connect GitHub repository
3. Settings:
   ```
   Name: raftel-watch-together
   Root Directory: server  ⚠️ Important!
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   ```
4. Click **"Create Web Service"**

### Step 3: Wait for Deployment
- Build and deployment takes about **2-3 minutes**
- Check progress in Render dashboard

### Step 4: Get Server URL
1. After deployment, click service name
2. Copy the URL (e.g., `https://raftel-watch-together.onrender.com`)
3. **Convert to WebSocket URL**:
   ```
   wss://raftel-watch-together.onrender.com
   ```
   ⚠️ **Important**: Change `https://` to `wss://`!

### Step 5: Configure Chrome Extension
1. Open extension popup
2. Enter WebSocket server URL: `wss://raftel-watch-together.onrender.com`
3. Click "Convert" button if needed
4. Done!

### Step 6: Test
1. Open Laftel player page
2. Click "Create New Room"
3. Share room ID with friend
4. Friend joins with "Join Room"
5. Verify synchronization! 🎉

---

## 💰 Render Free Tier

### Included
- ✅ **1 unlimited web service**
- ✅ **Free SSL/HTTPS** (auto-configured)
- ✅ **Free domain** (`.onrender.com`)
- ✅ **WebSocket support**
- ✅ **GitHub auto-deploy**
- ✅ **Free custom domain** connection

### Limitations
- ⚠️ **Sleep mode after 15min inactivity**
  - First request takes **30-60 seconds** to wake up
  - Frequent use prevents sleep mode
- ⚠️ **CPU/memory limits** (free tier)
- ⚠️ **Monthly usage limits** (usually sufficient)

### Real Usage
- **Small groups (5-10 people)**: Free tier is sufficient
- **Sleep mode**: Only delays first connection, then works normally
- **Stability**: Very stable, auto-restart supported

---

## 🔍 Verify Deployment

### Health Check
Visit in browser:
```
https://raftel-watch-together.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "raftel-watch-together",
  "rooms": 0,
  "timestamp": "2024-12-12T..."
}
```

### Check Logs
Render dashboard → Service → **"Logs"** tab

Normal operation:
```
WebSocket server running on 0.0.0.0:10000
Environment: production
```

---

## 🐛 Troubleshooting

### Connection Issues
1. **Check server URL**: Must start with `wss://`
2. **Check sleep mode**: First connection may take 30-60 seconds (normal)
3. **Check logs**: View error logs in Render dashboard
4. **Check deployment status**: Verify "Live" status in dashboard

### Sleep Mode
- **Symptom**: 30-60 second delay on first connection
- **Cause**: Auto sleep after 15min inactivity
- **Solution**: 
  - Frequent use prevents sleep mode
  - Upgrade to paid plan for no sleep mode

### Root Directory Error
- **Symptom**: Build failure or module not found
- **Cause**: Root Directory not set to `server`
- **Solution**: 
  - Render dashboard → Settings → Root Directory → Set to `server`
  - Redeploy

### WebSocket Connection Failed
- **Symptom**: Extension can't connect
- **Cause**: Using `ws://` or `https://` instead of `wss://`
- **Solution**: Change to `wss://` (WSS required for HTTPS sites)

---

## 🔄 Auto-Deploy

Render auto-deploys on GitHub push:

1. **Auto-deploy enabled** (default)
   - Pushing to GitHub triggers automatic redeploy
   - Render dashboard → Settings → **"Auto-Deploy"** to verify

2. **Manual deploy**
   - Render dashboard → **"Manual Deploy"** button

---

## 📊 Monitoring

### Usage Stats
- Render dashboard → Service → **"Metrics"** tab
- View CPU, memory, network usage

### Notifications
- Render dashboard → Settings → **"Notifications"**
- Email alerts for deployment completion and errors

---

## 💡 Optimization Tips

1. **Prevent sleep mode** (optional)
   - Use external service for periodic pings (e.g., UptimeRobot)
   - Upgrade to paid plan

2. **Custom domain** (optional)
   - Render dashboard → Settings → **"Custom Domains"**
   - Connect custom domain for free

3. **Environment variables**
   - Render dashboard → Environment
   - Add additional settings if needed

---

## 📞 Support

- Render docs: https://render.com/docs
- Render community: https://community.render.com
- Project issues: GitHub Issues

---

**Deployment complete! Start watching Laftel videos together! 🎬**
