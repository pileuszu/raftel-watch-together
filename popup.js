// Popup UI logic

let currentRoomId = null;
let isHost = false;
let wsUrl = 'ws://localhost:3001';

// DOM elements
const statusDiv = document.getElementById('status');
const roomInfoDiv = document.getElementById('roomInfo');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const modeDisplay = document.getElementById('modeDisplay');
const wsUrlInput = document.getElementById('wsUrl');
const createRoomBtn = document.getElementById('createRoom');
const joinRoomBtn = document.getElementById('joinRoom');
const joinRoomIdInput = document.getElementById('joinRoomId');
const leaveRoomBtn = document.getElementById('leaveRoom');

// Load saved settings
chrome.storage.local.get(['roomId', 'wsUrl', 'isHost'], (result) => {
  if (result.roomId) {
    currentRoomId = result.roomId;
    isHost = result.isHost || false;
    updateUI();
  }
  if (result.wsUrl) {
    wsUrl = result.wsUrl;
    wsUrlInput.value = wsUrl;
  }
});

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
    if (url.includes('localhost') || url.match(/^\d+\.\d+\.\d+\.\d+/)) {
      return `ws://${url}`;
    } else {
      return `wss://${url}`;
    }
  }
  
  return url;
}

// URL convert button
document.getElementById('convertUrl').addEventListener('click', () => {
  const inputUrl = wsUrlInput.value;
  const convertedUrl = convertToWebSocketUrl(inputUrl);
  if (convertedUrl && convertedUrl !== inputUrl) {
    wsUrlInput.value = convertedUrl;
    wsUrl = convertedUrl;
    chrome.storage.local.set({ wsUrl });
  }
});

// Save and auto-convert WebSocket URL
wsUrlInput.addEventListener('change', () => {
  const inputUrl = wsUrlInput.value.trim();
  const convertedUrl = convertToWebSocketUrl(inputUrl);
  wsUrl = convertedUrl || inputUrl;
  if (wsUrl !== inputUrl) {
    wsUrlInput.value = wsUrl;
  }
  chrome.storage.local.set({ wsUrl });
});

// Deploy guide link
document.getElementById('showDeployGuide').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'https://github.com/your-repo#deployment' }).catch(() => {
    alert('See DEPLOY.md in the project repository for deployment guide.\n\nRender: https://render.com');
  });
});

// Create room
createRoomBtn.addEventListener('click', () => {
  const roomId = generateRoomId();
  wsUrl = wsUrlInput.value;
  
  if (!wsUrl) {
    alert('Please enter WebSocket server URL');
    return;
  }

  chrome.storage.local.set({
    roomId: roomId,
    wsUrl: wsUrl,
    isHost: true
  }, () => {
    currentRoomId = roomId;
    isHost = true;
    updateUI();
    
    notifyContentScript();
    
    copyToClipboard(roomId);
    alert(`Room created!\nRoom ID: ${roomId}\n(Copied to clipboard)`);
  });
});

// Join room
joinRoomBtn.addEventListener('click', () => {
  const roomId = joinRoomIdInput.value.trim();
  wsUrl = wsUrlInput.value;
  
  if (!roomId) {
    alert('Please enter room ID');
    return;
  }
  
  if (!wsUrl) {
    alert('Please enter WebSocket server URL');
    return;
  }

  chrome.storage.local.set({
    roomId: roomId,
    wsUrl: wsUrl,
    isHost: false
  }, () => {
    currentRoomId = roomId;
    isHost = false;
    updateUI();
    
    notifyContentScript();
    
    alert('Joined room!');
  });
});

// Leave room
leaveRoomBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['roomId', 'isHost'], () => {
    currentRoomId = null;
    isHost = false;
    updateUI();
    
    notifyContentScript();
    
    alert('Left room');
  });
});

// Update UI
function updateUI() {
  if (currentRoomId) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status connected';
    statusDiv.textContent = 'Connected';
    
    roomInfoDiv.style.display = 'block';
    roomIdDisplay.textContent = currentRoomId;
    modeDisplay.textContent = isHost ? 'Host' : 'Participant';
    
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    leaveRoomBtn.style.display = 'block';
  } else {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status disconnected';
    statusDiv.textContent = 'Disconnected';
    
    roomInfoDiv.style.display = 'none';
    
    createRoomBtn.disabled = false;
    joinRoomBtn.disabled = false;
    leaveRoomBtn.style.display = 'none';
  }
}

// Notify content script
function notifyContentScript() {
  chrome.tabs.query({ url: 'https://laftel.net/player/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'room_changed',
        roomId: currentRoomId,
        wsUrl: wsUrl,
        isHost: isHost
      }).catch(() => {
        // Content script may not be loaded yet
      });
    });
  });
}

// Generate room ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

// Copy to clipboard
function copyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// Enter key to join room
joinRoomIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinRoomBtn.click();
  }
});
