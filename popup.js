// Laftel Watch Together - Popup UI

(function () {
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
    setupSection: document.getElementById('setupSection'),
    joinSection: document.getElementById('joinSection'),
    roomIdDisplay: document.getElementById('roomIdDisplay'),
    modeDisplay: document.getElementById('modeDisplay'),
    memberCount: document.getElementById('memberCount'),
    memberList: document.getElementById('memberList'),
    wsUrlInput: document.getElementById('wsUrl'),
    createRoomBtn: document.getElementById('createRoom'),
    joinRoomBtn: document.getElementById('joinRoom'),
    joinRoomIdInput: document.getElementById('joinRoomId'),
    leaveRoomBtn: document.getElementById('leaveRoom'),
    requestSyncBtn: document.getElementById('requestSync'),
    copyRoomIdBtn: document.getElementById('copyRoomId'),
    copyToast: document.getElementById('copyToast'),
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

    // Create room
    elements.createRoomBtn.addEventListener('click', createRoom);

    // Join room
    elements.joinRoomBtn.addEventListener('click', joinRoom);
    elements.joinRoomIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinRoom();
    });

    // Leave room
    elements.leaveRoomBtn.addEventListener('click', leaveRoom);

    // Request Sync
    elements.requestSyncBtn.addEventListener('click', requestSync);

    // Copy Room ID
    elements.copyRoomIdBtn.addEventListener('click', () => {
      if (currentRoomId) {
        copyToClipboard(currentRoomId);
        showToast();
      }
    });

    // Deploy guide
    elements.showDeployGuideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('서버 배포 가이드 (Render 무료 티어):\n\n1. render.com 가입\n2. GitHub 저장소 연결\n3. Root Directory를 "server"로 설정\n4. 빌드 및 배포!\n\n자세한 내용은 RENDER_DEPLOY.md를 참조하세요.');
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
          isConnected = false;
          updateUI();
          return;
        }

        if (response) {
          isConnected = response.isConnected;
          currentRoomId = response.roomId;
          isHost = response.isHost;
          updateUI(response.members);
        } else {
          isConnected = false;
          updateUI();
        }
      });
    });
  }

  // Create new room
  function createRoom() {
    wsUrl = elements.wsUrlInput.value.trim();

    if (!wsUrl) {
      alert('서버 주소를 입력해주세요.');
      return;
    }

    wsUrl = convertToWebSocketUrl(wsUrl);
    elements.wsUrlInput.value = wsUrl;

    const roomId = generateRoomId();

    getLaftelTab((tab) => {
      if (!tab) {
        alert('라프텔 영상 페이지를 먼저 열어주세요.\n(https://laftel.net)');
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: 'connect',
        wsUrl: wsUrl,
        roomId: roomId,
        isHost: true
      }, (response) => {
        if (chrome.runtime.lastError) {
          alert('연결에 실패했습니다. 페이지를 새로고침하고 다시 시도해 주세요.');
          return;
        }

        currentRoomId = roomId;
        isHost = true;
        isConnected = true;
        chrome.storage.local.set({ wsUrl, roomId, isHost: true });

        setTimeout(checkCurrentTabStatus, 500);
        copyToClipboard(roomId);
        showToast();
      });
    });
  }

  // Join existing room
  function joinRoom() {
    const roomId = elements.joinRoomIdInput.value.trim().toUpperCase();
    wsUrl = elements.wsUrlInput.value.trim();

    if (!roomId) {
      alert('방 코드를 입력해주세요.');
      return;
    }

    if (!wsUrl) {
      alert('서버 주소를 입력해주세요.');
      return;
    }

    wsUrl = convertToWebSocketUrl(wsUrl);
    elements.wsUrlInput.value = wsUrl;

    getLaftelTab((tab) => {
      if (!tab) {
        alert('라프텔 영상 페이지를 먼저 열어주세요.\n(https://laftel.net)');
        return;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: 'connect',
        wsUrl: wsUrl,
        roomId: roomId,
        isHost: false
      }, (response) => {
        if (chrome.runtime.lastError) {
          alert('연결에 실패했습니다. 페이지를 새로고침하고 다시 시도해 주세요.');
          return;
        }

        currentRoomId = roomId;
        isHost = false;
        isConnected = true;
        chrome.storage.local.set({ wsUrl, roomId, isHost: false });

        setTimeout(checkCurrentTabStatus, 500);
      });
    });
  }

  // Leave room
  function leaveRoom() {
    getLaftelTab((tab) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'disconnect' }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
      }

      chrome.storage.local.remove(['roomId', 'isHost']);
      currentRoomId = null;
      isHost = false;
      isConnected = false;

      updateUI();
    });
  }

  // Request Sync
  function requestSync() {
    getLaftelTab((tab) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'request_sync' }, (response) => {
          if (chrome.runtime.lastError) {
            alert('영상 동기화 요청에 실패했습니다.');
          }
        });
      }
    });
  }

  // Update UI logic
  function updateUI(members = []) {
    if (isConnected && currentRoomId) {
      elements.status.className = 'status-badge connected';
      elements.status.innerHTML = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg> 서버 연결됨';

      elements.roomInfo.style.display = 'block';
      elements.setupSection.style.display = 'none';
      elements.joinSection.style.display = 'none';
      elements.leaveRoomBtn.style.display = 'block';

      elements.roomIdDisplay.textContent = currentRoomId;
      elements.modeDisplay.textContent = isHost ? '호스트' : '참여자';

      // Member list handling
      elements.memberCount.textContent = members.length || (currentRoomId ? '1' : '0');
      if (members.length > 0) {
        elements.memberList.innerHTML = '';
        members.forEach(member => {
          const div = document.createElement('div');
          div.className = 'member-item';

          const id = document.createElement('span');
          id.className = 'member-id';
          id.textContent = member.clientId;

          const role = document.createElement('span');
          role.className = 'member-role' + (member.isHost ? ' host' : '');
          role.textContent = member.isHost ? 'HOST' : 'GUEST';

          div.appendChild(id);
          div.appendChild(role);
          elements.memberList.appendChild(div);
        });
      }

      // Request sync only for participants
      elements.requestSyncBtn.style.display = isHost ? 'none' : 'flex';

    } else {
      elements.status.className = 'status-badge disconnected';
      elements.status.innerHTML = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg> 서버 연결 안 됨';

      elements.roomInfo.style.display = 'none';
      elements.setupSection.style.display = 'block';
      elements.joinSection.style.display = 'block';
      elements.leaveRoomBtn.style.display = 'none';
    }
  }

  // Helper: Get Laftel tab
  function getLaftelTab(callback) {
    chrome.tabs.query({ url: 'https://laftel.net/*' }, (tabs) => {
      callback(tabs.length > 0 ? tabs[0] : null);
    });
  }

  // Helper: URL conversion
  function convertToWebSocketUrl(url) {
    if (!url) return '';
    url = url.trim();
    if (url.startsWith('ws://') || url.startsWith('wss://')) return url;
    if (url.startsWith('http://')) return url.replace('http://', 'ws://');
    if (url.startsWith('https://')) return url.replace('https://', 'wss://');
    if (!url.includes('://')) {
      if (url.includes('localhost')) return `ws://${url}`;
      return `wss://${url}`;
    }
    return url;
  }

  // Helper: Room ID generation
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
  }

  // Helper: Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  // Helper: Show toast
  function showToast() {
    elements.copyToast.style.opacity = '1';
    setTimeout(() => {
      elements.copyToast.style.opacity = '0';
    }, 2000);
  }

  init();
})();
