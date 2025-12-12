// Laftel Watch Together - Popup UI

(function() {
  'use strict';

  // State
  let currentRoomId = null;
  let isHost = false;
  let wsUrl = '';
  let isConnected = false;

  // DOM elements
  const elements = {
    status: document.getElementById('status'),
    roomInfo: document.getElementById('roomInfo'),
    roomIdDisplay: document.getElementById('roomIdDisplay'),
    modeDisplay: document.getElementById('modeDisplay'),
    wsUrlInput: document.getElementById('wsUrl'),
    createRoomBtn: document.getElementById('createRoom'),
    joinRoomBtn: document.getElementById('joinRoom'),
    joinRoomIdInput: document.getElementById('joinRoomId'),
    leaveRoomBtn: document.getElementById('leaveRoom'),
    convertUrlBtn: document.getElementById('convertUrl'),
    showDeployGuideBtn: document.getElementById('showDeployGuide')
  };

  // Initialize
  function init() {
    loadSettings();
    setupEventListeners();
    checkCurrentTabStatus();
  }

  // Load saved settings
  function loadSettings() {
    chrome.storage.local.get(['wsUrl', 'roomId', 'isHost'], (result) => {
      if (result.wsUrl) {
        wsUrl = result.wsUrl;
        elements.wsUrlInput.value = wsUrl;
      }
      
      if (result.roomId) {
        currentRoomId = result.roomId;
        isHost = result.isHost || false;
      }
      
      updateUI();
    });
  }

  // Setup event listeners
  function setupEventListeners() {
    // URL input
    elements.wsUrlInput.addEventListener('change', () => {
      wsUrl = convertToWebSocketUrl(elements.wsUrlInput.value.trim());
      elements.wsUrlInput.value = wsUrl;
      chrome.storage.local.set({ wsUrl });
    });

    // Convert URL button
    elements.convertUrlBtn.addEventListener('click', () => {
      const converted = convertToWebSocketUrl(elements.wsUrlInput.value);
      if (converted !== elements.wsUrlInput.value) {
        elements.wsUrlInput.value = converted;
        wsUrl = converted;
        chrome.storage.local.set({ wsUrl });
      }
    });

    // Create room
    elements.createRoomBtn.addEventListener('click', createRoom);

    // Join room
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.joinRoomIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinRoom();
    });

    // Leave room
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);

    // Deploy guide
    elements.showDeployGuideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Deploy to Render (free):\n\n1. Go to render.com\n2. Connect GitHub repo\n3. Set Root Directory to "server"\n4. Deploy!\n\nSee RENDER_DEPLOY.md for details.');
    });
  }

  // Check current tab connection status
  function checkCurrentTabStatus() {
    getLaftelTab((tab) => {
      if (!tab) {
        updateUI();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'get_status' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script not ready
          updateUI();
          return;
        }

        if (response) {
          isConnected = response.isConnected;
          currentRoomId = response.roomId;
          isHost = response.isHost;
        }
        
        updateUI();
      });
    });
  }

  // Create new room
  function createRoom() {
    wsUrl = elements.wsUrlInput.value.trim();
    
    if (!wsUrl) {
      alert('Please enter WebSocket server URL');
      return;
    }

    wsUrl = convertToWebSocketUrl(wsUrl);
    elements.wsUrlInput.value = wsUrl;
    
    const roomId = generateRoomId();

    getLaftelTab((tab) => {
      if (!tab) {
        alert('Please open a Laftel page first.\n(https://laftel.net)');
        return;
      }

      // Send connect message to content script
      chrome.tabs.sendMessage(tab.id, {
        type: 'connect',
        wsUrl: wsUrl,
        roomId: roomId,
        isHost: true
      }, (response) => {
        if (chrome.runtime.lastError) {
          alert('Failed to connect. Please refresh the Laftel page and try again.');
          return;
        }

        // Save to storage
        currentRoomId = roomId;
        isHost = true;
        chrome.storage.local.set({ wsUrl, roomId, isHost: true });
        
        updateUI();
        copyToClipboard(roomId);
        alert(`Room created!\nRoom ID: ${roomId}\n(Copied to clipboard)`);
      });
    });
  }

  // Join existing room
  function joinRoom() {
    const roomId = elements.joinRoomIdInput.value.trim().toUpperCase();
    wsUrl = elements.wsUrlInput.value.trim();
    
    if (!roomId) {
      alert('Please enter room ID');
      return;
    }
    
    if (!wsUrl) {
      alert('Please enter WebSocket server URL');
      return;
    }

    wsUrl = convertToWebSocketUrl(wsUrl);
    elements.wsUrlInput.value = wsUrl;

    getLaftelTab((tab) => {
      if (!tab) {
        alert('Please open a Laftel page first.\n(https://laftel.net)');
        return;
      }

      // Send connect message to content script
      chrome.tabs.sendMessage(tab.id, {
        type: 'connect',
        wsUrl: wsUrl,
        roomId: roomId,
        isHost: false
      }, (response) => {
        if (chrome.runtime.lastError) {
          alert('Failed to connect. Please refresh the Laftel page and try again.');
          return;
        }

        // Save to storage
        currentRoomId = roomId;
        isHost = false;
        chrome.storage.local.set({ wsUrl, roomId, isHost: false });
        
        updateUI();
        alert('Joined room!');
      });
    });
  }

  // Leave room
  function leaveRoom() {
    getLaftelTab((tab) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'disconnect' }, () => {
          if (chrome.runtime.lastError) {
            // Ignore error
          }
        });
      }

      // Clear storage
      chrome.storage.local.remove(['roomId', 'isHost']);
      currentRoomId = null;
      isHost = false;
      isConnected = false;
      
      updateUI();
      alert('Left room');
    });
  }

  // Update UI based on state
  function updateUI() {
    if (currentRoomId) {
      elements.status.style.display = 'block';
      elements.status.className = 'status connected';
      elements.status.textContent = 'Connected';
      
      elements.roomInfo.style.display = 'block';
      elements.roomIdDisplay.textContent = currentRoomId;
      elements.modeDisplay.textContent = isHost ? 'Host' : 'Participant';
      
      elements.createRoomBtn.disabled = true;
      elements.joinRoomBtn.disabled = true;
      elements.joinRoomIdInput.disabled = true;
      elements.leaveRoomBtn.style.display = 'block';
    } else {
      elements.status.style.display = 'block';
      elements.status.className = 'status disconnected';
      elements.status.textContent = 'Not connected';
      
      elements.roomInfo.style.display = 'none';
      
      elements.createRoomBtn.disabled = false;
      elements.joinRoomBtn.disabled = false;
      elements.joinRoomIdInput.disabled = false;
      elements.leaveRoomBtn.style.display = 'none';
    }
  }

  // Get Laftel tab
  function getLaftelTab(callback) {
    chrome.tabs.query({ url: 'https://laftel.net/*' }, (tabs) => {
      callback(tabs.length > 0 ? tabs[0] : null);
    });
  }

  // Convert URL to WebSocket URL
  function convertToWebSocketUrl(url) {
    if (!url) return '';
    
    url = url.trim();
    
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }
    
    if (url.startsWith('http://')) {
      return url.replace('http://', 'ws://');
    }
    
    if (url.startsWith('https://')) {
      return url.replace('https://', 'wss://');
    }
    
    if (!url.includes('://')) {
      if (url.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(url)) {
        return `ws://${url}`;
      }
      return `wss://${url}`;
    }
    
    return url;
  }

  // Generate room ID
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
  }

  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  // Start
  init();
})();
