# Laftel Watch Together Chrome Extension

A Chrome extension that allows you to watch Laftel videos together with friends in real-time.

## Features

- 🎬 Real-time video synchronization (play/pause/time)
- 👥 Multiple participants support
- 🎮 Host mode (one person controls, others sync)
- 🔄 Auto-reconnect
- 💬 WebSocket-based real-time communication

## Installation

### 1. Install Chrome Extension

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this project folder

### 2. Deploy WebSocket Server (Optional)

#### Option A: Free Hosting (Recommended)

**Render Deployment** - Very simple setup!

**Quick guide: [RENDER_DEPLOY.md](./RENDER_DEPLOY.md)**

Quick steps:
1. Go to [Render](https://render.com) and login with GitHub
2. Click "New +" → "Blueprint"
3. Select GitHub repository → "Apply"
4. Copy the URL after deployment (e.g., `https://raftel-watch-together.onrender.com`)
5. Enter `wss://raftel-watch-together.onrender.com` in Chrome Extension

**Other options**: Railway, Fly.io also supported
- Detailed guide: [DEPLOY.md](./DEPLOY.md)

#### Option B: Local Server

```bash
cd server
npm install
npm start
```

Server runs on `ws://localhost:3001` by default.

Change port:
```bash
PORT=3002 npm start
```

## Usage

### Create Room

1. Open Laftel player page (`https://laftel.net/player/*`)
2. Click extension icon
3. Enter WebSocket server URL (default: `ws://localhost:3001`)
4. Click "Create New Room"
5. Share the room ID with friends

### Join Room

1. Open extension popup
2. Enter WebSocket server URL
3. Enter room ID
4. Click "Join Room"

### Synchronization

- **Host**: Play, pause, and time changes sync to all participants
- **Participants**: Follow host's control (their own controls are ignored)

## Project Structure

```
raftel-watch-together/
├── manifest.json          # Chrome Extension config
├── content.js            # Script injected into Laftel pages
├── content.css           # Styles
├── background.js         # Background Service Worker
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic
├── server/
│   ├── server.js         # WebSocket server
│   └── package.json      # Server dependencies
└── README.md
```

## Tech Stack

- **Extension**: Chrome Extension Manifest V3
- **Communication**: WebSocket (ws library)
- **Server**: Node.js

## Notes

- WebSocket server must be running
- All participants must connect to the same server
- For local server (`localhost`), use actual IP address for other devices on the same network
- **Deployed server**: Use WSS (`wss://`) for HTTPS sites
- **Local server**: Use WS (`ws://`) for HTTP sites

## Development

### Server Development Mode

```bash
cd server
npm run dev
```

### Debugging

1. Chrome Extension: `chrome://extensions/` → "Details" → "Inspect" → "Service Worker"
2. Content Script: F12 → Console on Laftel player page
3. Popup: Right-click popup → "Inspect"

## License

MIT
