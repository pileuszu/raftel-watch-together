// Laftel player control and synchronization

let video = null;
let ws = null;
let roomId = null;
let isHost = false;
let isSyncing = false;
let lastSyncTime = 0;
let lastUrl = window.location.href;

// Find video element
function findVideo() {
  const videoSelector = 'video[data-cy="video"]';
  video = document.querySelector(videoSelector);
  
  if (!video) {
    setTimeout(findVideo, 1000);
    return;
  }

  console.log('Video element found:', video);
  setupVideoListeners();
  checkConnection();
}

// Setup video event listeners
function setupVideoListeners() {
  if (!video) return;

  // Play/pause synchronization
  video.addEventListener('play', () => {
    if (!isSyncing && ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'play',
        time: video.currentTime,
        timestamp: Date.now()
      });
    }
  });

  video.addEventListener('pause', () => {
    if (!isSyncing && ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'pause',
        time: video.currentTime,
        timestamp: Date.now()
      });
    }
  });

  // Time update (host only)
  video.addEventListener('timeupdate', () => {
    if (isHost && !isSyncing && ws && ws.readyState === WebSocket.OPEN) {
      const now = Date.now();
      // Send every 1 second to prevent too frequent updates
      if (now - lastSyncTime > 1000) {
        sendMessage({
          type: 'timeupdate',
          time: video.currentTime,
          timestamp: now
        });
        lastSyncTime = now;
      }
    }
  });

  // Volume change
  video.addEventListener('volumechange', () => {
    if (!isSyncing && ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'volume',
        volume: video.volume,
        timestamp: Date.now()
      });
    }
  });
}

// Send WebSocket message
function sendMessage(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      roomId,
      ...data
    }));
  }
}

// Check and setup WebSocket connection
function checkConnection() {
  chrome.storage.local.get(['roomId', 'wsUrl', 'isHost'], (result) => {
    if (result.roomId && result.wsUrl) {
      roomId = result.roomId;
      isHost = result.isHost || false;
      connectWebSocket(result.wsUrl);
    }
  });
}

// Connect to WebSocket
function connectWebSocket(wsUrl) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      sendMessage({
        type: 'join',
        roomId: roomId
      });
      
      showConnectionStatus(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (e) {
        console.error('Message parse error:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      showConnectionStatus(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      showConnectionStatus(false);
      // Reconnect
      setTimeout(() => {
        if (roomId) {
          connectWebSocket(wsUrl);
        }
      }, 3000);
    };
  } catch (e) {
    console.error('WebSocket connection failed:', e);
  }
}

// Handle WebSocket messages
function handleWebSocketMessage(data) {
  if (!video) return;

  switch (data.type) {
    case 'play':
      if (!isHost) {
        isSyncing = true;
        video.currentTime = data.time || video.currentTime;
        video.play().catch(e => console.error('Play failed:', e));
        setTimeout(() => { isSyncing = false; }, 100);
      }
      break;

    case 'pause':
      if (!isHost) {
        isSyncing = true;
        video.currentTime = data.time || video.currentTime;
        video.pause();
        setTimeout(() => { isSyncing = false; }, 100);
      }
      break;

    case 'timeupdate':
      if (!isHost && data.time !== undefined) {
        isSyncing = true;
        const timeDiff = Math.abs(video.currentTime - data.time);
        // Sync if difference is more than 0.5 seconds
        if (timeDiff > 0.5) {
          video.currentTime = data.time;
        }
        setTimeout(() => { isSyncing = false; }, 100);
      }
      break;

    case 'volume':
      if (!isHost && data.volume !== undefined) {
        video.volume = data.volume;
      }
      break;

    case 'sync':
      // Initial synchronization
      if (!isHost && data.time !== undefined) {
        isSyncing = true;
        video.currentTime = data.time;
        if (data.playing) {
          video.play().catch(e => console.error('Play failed:', e));
        } else {
          video.pause();
        }
        setTimeout(() => { isSyncing = false; }, 500);
      }
      break;

    case 'room_info':
      if (data.isHost !== undefined) {
        isHost = data.isHost;
      }
      showConnectionStatus(true);
      break;

    case 'sync_request':
      // Host sends current state when sync is requested
      if (isHost && video) {
        sendMessage({
          type: 'sync_response',
          time: video.currentTime,
          playing: !video.paused,
          volume: video.volume
        });
      }
      break;

    case 'url_change':
      // Host changed page, participants should navigate
      if (!isHost && data.url) {
        const currentUrl = window.location.href;
        if (data.url !== currentUrl) {
          console.log('Host changed page, navigating to:', data.url);
          // Reset video reference and URL tracking
          video = null;
          lastUrl = data.url;
          window.location.href = data.url;
        }
      }
      break;

    case 'participant_joined':
    case 'participant_left':
      // Participant count change notification
      break;
  }
}

// Show connection status UI
function showConnectionStatus(connected) {
  const existing = document.getElementById('raftel-watch-together-status');
  if (existing) {
    existing.remove();
  }

  if (!connected) return;

  const statusDiv = document.createElement('div');
  statusDiv.id = 'raftel-watch-together-status';
  statusDiv.textContent = isHost ? '🔴 Host Mode' : '👥 Watching Together';
  document.body.appendChild(statusDiv);
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.roomId || changes.wsUrl) {
      // Reconnect
      if (ws) {
        ws.close();
      }
      checkConnection();
    }
    if (changes.isHost) {
      isHost = changes.isHost.newValue || false;
      showConnectionStatus(ws && ws.readyState === WebSocket.OPEN);
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'url_changed') {
    // Also handle URL change from background script (backup method)
    lastUrl = message.url;
    if (isHost && ws && ws.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'url_change',
        url: message.url,
        timestamp: Date.now()
      });
    }
  } else if (message.type === 'room_changed') {
    // Room settings changed, reconnect
    if (message.roomId && message.wsUrl) {
      roomId = message.roomId;
      isHost = message.isHost || false;
      lastUrl = window.location.href; // Reset URL tracking
      if (ws) {
        ws.close();
      }
      connectWebSocket(message.wsUrl);
    }
  }
});

// Monitor URL changes (for host)
function monitorUrlChanges() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    // Host should notify participants of URL change
    if (isHost && ws && ws.readyState === WebSocket.OPEN) {
      console.log('URL changed, broadcasting:', currentUrl);
      sendMessage({
        type: 'url_change',
        url: currentUrl,
        timestamp: Date.now()
      });
    }
  }
}

// Check URL changes periodically
setInterval(monitorUrlChanges, 1000);

// Also check on popstate (browser back/forward)
window.addEventListener('popstate', () => {
  setTimeout(monitorUrlChanges, 100);
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', findVideo);
} else {
  findVideo();
}

// MutationObserver for dynamic content
const observer = new MutationObserver(() => {
  if (!video) {
    findVideo();
  }
  // Also check URL when DOM changes (SPA navigation)
  monitorUrlChanges();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
