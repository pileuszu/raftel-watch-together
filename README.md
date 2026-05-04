# 🎬 Laftel Watch Together

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-blue.svg)](https://developer.chrome.com/docs/extensions/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-green.svg)](https://nodejs.org/)

**Laftel Watch Together** is a powerful Chrome extension designed to sync video playback on [Laftel](https://laftel.net), allowing you and your friends to enjoy anime together in real-time, no matter where you are.

---

## ✨ Key Features

- **🔄 Perfect Synchronization**: Instant sync of Play, Pause, and Seek events across all participants.
- **📺 Episode Tracking**: Automatically navigates all participants to the same episode when the host switches pages.
- **👑 Dynamic Host System**: 
  - The first person to create a room becomes the **Host**.
  - If the host leaves, leadership is automatically transferred to the next participant.
  - Seamless session takeover if the host refreshes or navigates.
- **👥 Member Management**: Real-time participant list and room status tracking via the extension popup.
- **🔌 Robust Connectivity**: 
  - Heartbeat system to keep WebSocket connections alive.
  - Automatic reconnection logic for unstable networks.
  - Session deduplication to handle page refreshes gracefully.
- **🛡️ Status Overlay**: A discrete on-screen indicator shows your current connection status and role (Host/Guest).

---

## 📂 Project Structure

```text
raftel-watch-together/
├── server/                 # WebSocket Backend
│   ├── server.js           # Core server logic
│   ├── package.json        # Node.js dependencies
│   ├── render.yaml         # Render blueprint config
│   └── railway.json        # Railway deployment config
├── background.js           # Extension Service Worker
├── content.js              # Video control & sync logic
├── content.css             # In-page status UI styles
├── popup.html / popup.js   # Extension popup interface
└── manifest.json           # Extension configuration (V3)
```

---

## 🛠️ Architecture

The project consists of two main components:

1.  **Chrome Extension (Frontend)**:
    *   **Content Script**: Injected into Laftel's player pages to monitor and control the `<video>` element.
    *   **Popup UI**: A clean interface for room management and connection settings.
    *   **Background Worker**: Handles persistent state and messaging.
2.  **WebSocket Server (Backend)**:
    *   A Node.js server that manages rooms and broadcasts synchronization events to participants.

---

## 🚀 Getting Started

### 1. Extension Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** in the top right corner.
4.  Click **Load unpacked** and select the project root directory.

### 2. Server Setup (Optional)

You can use the default local server or deploy your own for remote watching.

#### Local Development
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start the server
npm start

# For development (with auto-reload)
npm run dev
```
The server will run on `ws://localhost:3001` by default.

#### Cloud Deployment (Recommended)
This project is optimized for **Render**, **Railway**, or **Fly.io**.

-   **Render**: Use the provided `RENDER_DEPLOY.md` for a quick 1-click-style setup.
-   **Railway**: Use the `railway.json` and `Procfile` for instant deployment.

---

## 📖 How to Use

1.  **Open Laftel**: Navigate to any anime on [Laftel](https://laftel.net).
2.  **Setup Server**: Click the extension icon and enter your WebSocket server URL (e.g., `wss://your-app.onrender.com`).
3.  **Create/Join Room**:
    *   **Host**: Enter a name for the room and click **Create Room**. Copy the Room ID and share it.
    *   **Participant**: Enter the Room ID provided by the host and click **Join Room**.
4.  **Enjoy**: Start the video! The host controls the playback for everyone.

---

## 💻 Tech Stack

-   **Extension**: JavaScript (ES6+), Manifest V3, Chrome Scripting API
-   **Styling**: Vanilla CSS with modern Flexbox/Grid
-   **Backend**: Node.js, `ws` (WebSocket library)
-   **Infrastructure**: Render / Railway ready

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request to improve the synchronization logic or add new features.

---

<p align="center">Made with ❤️ for anime fans.</p>
