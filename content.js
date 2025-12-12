// Laftel Watch Together - Content Script
// Handles video synchronization on Laftel player pages

(function() {
  'use strict';

  // State
  let video = null;
  let ws = null;
  let roomId = null;
  let wsUrl = null;
  let isHost = false;
  let isConnected = false;
  let isSyncing = false;
  let lastSyncTime = 0;
  let lastUrl = window.location.href;
  let reconnectTimer = null;
  let videoListenersAttached = false;
  let clientId = null;

  // Constants
  const SYNC_INTERVAL = 1000;
  const RECONNECT_DELAY = 3000;
  const TIME_DIFF_THRESHOLD = 0.5;

  // Initialize
  function init() {
    console.log('[LWT] Initializing...');
    findVideo();
    listenForMessages();
    
    // Load or generate client ID, then check for reconnection
    chrome.storage.local.get(['clientId', 'wsUrl', 'roomId', 'isHost'], (result) => {
      // Get or create persistent client ID
      if (result.clientId) {
        clientId = result.clientId;
      } else {
        clientId = generateClientId();
        chrome.storage.local.set({ clientId });
      }
      console.log('[LWT] Client ID:', clientId);
      
      // Auto-reconnect if we have saved connection info
      if (result.wsUrl && result.roomId) {
        console.log('[LWT] Found saved connection, auto-reconnecting...');
        reconnect(result.wsUrl, result.roomId, result.isHost || false);
      }
    });
  }

  // Generate persistent client ID
  function generateClientId() {
    return 'C_' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Reconnect after page navigation
  function reconnect(url, room, wasHost) {
    wsUrl = url;
    roomId = room;
    isHost = wasHost;

    console.log(`[LWT] Reconnecting to ${url}, room ${room}...`);

    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('[LWT] Reconnected');
        isConnected = true;
        
        // If was host, try create first, if fails, join (include clientId)
        if (wasHost) {
          sendToServer({ type: 'create_room', roomId: room, clientId });
        } else {
          sendToServer({ type: 'join_room', roomId: room, clientId });
        }
        
        updateStatusUI();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle room_created failure (room already exists)
          if (data.type === 'error' && data.message.includes('already exists')) {
            console.log('[LWT] Room exists, joining as participant...');
            sendToServer({ type: 'join_room', roomId: room, clientId });
            return;
          }
          
          handleServerMessage(data);
        } catch (e) {
          console.error('[LWT] Message parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[LWT] WebSocket error');
        isConnected = false;
        updateStatusUI();
      };

      ws.onclose = () => {
        console.log('[LWT] Disconnected');
        isConnected = false;
        updateStatusUI();
        
        // Reconnect if we still have room info
        if (roomId && wsUrl) {
          scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('[LWT] Reconnection failed:', e);
    }
  }

  // Find video element
  function findVideo() {
    video = document.querySelector('video[data-cy="video"]');
    
    if (!video) {
      setTimeout(findVideo, 1000);
      return;
    }

    console.log('[LWT] Video element found');
    
    if (!videoListenersAttached) {
      attachVideoListeners();
      videoListenersAttached = true;
    }
  }

  // Attach video event listeners
  function attachVideoListeners() {
    if (!video) return;

    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);
    video.addEventListener('seeked', onVideoSeeked);
    video.addEventListener('timeupdate', onVideoTimeUpdate);
  }

  // Video event handlers
  function onVideoPlay() {
    if (isSyncing || !isConnected) return;
    
    sendToServer({
      type: 'play',
      time: video.currentTime
    });
  }

  function onVideoPause() {
    if (isSyncing || !isConnected) return;
    
    sendToServer({
      type: 'pause',
      time: video.currentTime
    });
  }

  function onVideoSeeked() {
    if (isSyncing || !isConnected || !isHost) return;
    
    sendToServer({
      type: 'seek',
      time: video.currentTime
    });
  }

  function onVideoTimeUpdate() {
    if (!isHost || isSyncing || !isConnected) return;
    
    const now = Date.now();
    if (now - lastSyncTime < SYNC_INTERVAL) return;
    lastSyncTime = now;
    
    sendToServer({
      type: 'timeupdate',
      time: video.currentTime
    });
  }

  // Connect to WebSocket server
  function connect(url, room, asHost) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      disconnect();
    }

    wsUrl = url;
    roomId = room;
    isHost = asHost;

    console.log(`[LWT] Connecting to ${url}...`);

    try {
      ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('[LWT] Connected');
        isConnected = true;
        
        // Send create or join based on host status (include clientId)
        if (isHost) {
          sendToServer({ type: 'create_room', roomId, clientId });
        } else {
          sendToServer({ type: 'join_room', roomId, clientId });
        }
        
        updateStatusUI();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (e) {
          console.error('[LWT] Message parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[LWT] WebSocket error');
        isConnected = false;
        updateStatusUI();
      };

      ws.onclose = () => {
        console.log('[LWT] Disconnected');
        isConnected = false;
        updateStatusUI();
        
        // Reconnect if we still have room info
        if (roomId && wsUrl) {
          scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('[LWT] Connection failed:', e);
    }
  }

  // Disconnect from server (keepStorage = true means page navigation, false means explicit leave)
  function disconnect(keepStorage = false) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (ws) {
      sendToServer({ type: 'leave_room' });
      ws.close();
      ws = null;
    }
    
    isConnected = false;
    
    // Only clear local state if explicitly leaving (not page navigation)
    if (!keepStorage) {
      roomId = null;
      wsUrl = null;
      isHost = false;
      // Clear storage only on explicit leave
      chrome.storage.local.remove(['roomId', 'isHost']);
    }
    
    updateStatusUI();
    console.log('[LWT] Disconnected', keepStorage ? '(keeping storage for reconnect)' : '(cleared)');
  }

  // Schedule reconnection
  function scheduleReconnect() {
    if (reconnectTimer) return;
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (roomId && wsUrl) {
        console.log('[LWT] Scheduled reconnecting...');
        reconnect(wsUrl, roomId, isHost);
      }
    }, RECONNECT_DELAY);
  }

  // Send message to server
  function sendToServer(data) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(data));
  }

  // Handle messages from server
  function handleServerMessage(data) {
    switch (data.type) {
      case 'room_created':
        console.log(`[LWT] Room created: ${data.roomId}`);
        isHost = true;
        roomId = data.roomId;
        updateStatusUI();
        break;

      case 'room_joined':
        console.log(`[LWT] Joined room: ${data.roomId}`);
        isHost = data.isHost;
        roomId = data.roomId;
        updateStatusUI();
        break;

      case 'room_left':
        console.log('[LWT] Left room');
        roomId = null;
        isHost = false;
        updateStatusUI();
        break;

      case 'host_assigned':
        console.log('[LWT] You are now the host');
        isHost = true;
        updateStatusUI();
        // Notify storage for popup sync
        chrome.storage.local.set({ isHost: true });
        break;

      case 'error':
        console.error('[LWT] Server error:', data.message);
        // Don't show alert for room-related errors during reconnection
        if (data.message.includes('Room not found') || data.message.includes('already exists')) {
          // Room is gone, clear storage
          if (data.message.includes('Room not found')) {
            chrome.storage.local.remove(['roomId', 'isHost']);
            roomId = null;
            isHost = false;
            updateStatusUI();
          }
        } else {
          alert(`Error: ${data.message}`);
        }
        break;

      case 'sync_request':
        if (isHost && video) {
          sendToServer({
            type: 'sync_response',
            time: video.currentTime,
            playing: !video.paused,
            url: window.location.href
          });
        }
        break;

      case 'sync':
        if (!isHost) {
          syncVideo(data);
        }
        break;

      case 'play':
        if (!isHost && video) {
          isSyncing = true;
          if (data.time !== undefined) {
            video.currentTime = data.time;
          }
          video.play().catch(() => {});
          setTimeout(() => { isSyncing = false; }, 100);
        }
        break;

      case 'pause':
        if (!isHost && video) {
          isSyncing = true;
          if (data.time !== undefined) {
            video.currentTime = data.time;
          }
          video.pause();
          setTimeout(() => { isSyncing = false; }, 100);
        }
        break;

      case 'seek':
      case 'timeupdate':
        if (!isHost && video && data.time !== undefined) {
          const diff = Math.abs(video.currentTime - data.time);
          if (diff > TIME_DIFF_THRESHOLD) {
            isSyncing = true;
            video.currentTime = data.time;
            setTimeout(() => { isSyncing = false; }, 100);
          }
        }
        break;

      case 'url_change':
        if (!isHost && data.url && data.url !== window.location.href) {
          console.log('[LWT] Host changed page:', data.url);
          window.location.href = data.url;
        }
        break;

      case 'participant_joined':
      case 'participant_left':
        console.log(`[LWT] Participants: ${data.participants}`);
        break;

      case 'server_shutdown':
        console.log('[LWT] Server is shutting down');
        break;
    }
  }

  // Sync video state
  function syncVideo(data) {
    // Check URL first (even if no video yet)
    if (data.url && data.url !== window.location.href) {
      window.location.href = data.url;
      return;
    }
    
    // Need video for the rest
    if (!video) return;
    
    isSyncing = true;
    
    // Sync time
    if (data.time !== undefined) {
      video.currentTime = data.time;
    }
    
    // Sync play state
    if (data.playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    
    setTimeout(() => { isSyncing = false; }, 500);
  }

  // Monitor URL changes (for host)
  function monitorUrlChanges() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      if (isHost && isConnected) {
        console.log('[LWT] URL changed, broadcasting:', currentUrl);
        sendToServer({
          type: 'url_change',
          url: currentUrl
        });
        
        // Re-find video on new page
        video = null;
        videoListenersAttached = false;
        findVideo();
      }
    }
  }

  // Update status UI
  function updateStatusUI() {
    let statusEl = document.getElementById('lwt-status');
    
    if (!isConnected || !roomId) {
      if (statusEl) statusEl.remove();
      return;
    }
    
    if (!statusEl) {
      statusEl = document.createElement('div');
      statusEl.id = 'lwt-status';
      statusEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      `;
      document.body.appendChild(statusEl);
    }
    
    statusEl.textContent = isHost ? '🔴 Host Mode' : '👥 Watching Together';
  }

  // Listen for messages from popup/background
  function listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[LWT] Received message:', message.type);
      
      switch (message.type) {
        case 'connect':
          connect(message.wsUrl, message.roomId, message.isHost);
          sendResponse({ success: true });
          break;
          
        case 'disconnect':
          // Explicit disconnect from popup - clear everything
          disconnect(false);
          sendResponse({ success: true });
          break;
          
        case 'get_status':
          sendResponse({
            isConnected,
            roomId,
            isHost
          });
          break;
      }
      
      return true; // Keep channel open for async response
    });
  }

  // URL monitoring
  setInterval(monitorUrlChanges, 1000);
  window.addEventListener('popstate', () => setTimeout(monitorUrlChanges, 100));

  // MutationObserver for dynamic content
  const observer = new MutationObserver(() => {
    if (!video) findVideo();
    monitorUrlChanges();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
