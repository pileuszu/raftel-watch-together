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
      const inputVal = elements.wsUrlInput.value.trim();
      const converted = convertToWebSocketUrl(inputVal);

      if (converted) {
        wsUrl = converted;
        elements.wsUrlInput.value = wsUrl;
        chrome.storage.local.set({ wsUrl });
      } else if (inputVal) {
        // If user typed something invalid, revert to last known good URL
        elements.wsUrlInput.value = wsUrl;
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

      ensureContentScript(tab.id, () => {
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
    });
  }

  // Create new room
  function createRoom() {
    const inputUrl = elements.wsUrlInput.value.trim();
    const validatedUrl = convertToWebSocketUrl(inputUrl);

    if (!validatedUrl) {
      alert('올바른 서버 주소를 입력해주세요.');
      elements.wsUrlInput.value = wsUrl; // Revert to last good or empty
      return;
    }

    wsUrl = validatedUrl;
    elements.wsUrlInput.value = wsUrl;

    // Generate room ID early
    const roomId = generateRoomId();

    getLaftelTab((tab) => {
      if (!tab) {
        alert('라프텔 영상 페이지를 먼저 열어주세요.\n(https://laftel.net)');
        return;
      }

      ensureContentScript(tab.id, () => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'connect',
          wsUrl: wsUrl,
          roomId: roomId,
          isHost: true
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('연결에 실패했습니다. 관리자에게 문의하세요.');
            return;
          }

          // Save to storage ONLY after successful message send
          currentRoomId = roomId;
          isHost = true;
          isConnected = true;
          chrome.storage.local.set({ wsUrl, roomId, isHost: true }, () => {
            updateUI(); // Update UI after storage is confirmed
            setTimeout(checkCurrentTabStatus, 500);
            copyToClipboard(roomId);
            showToast();
          });
        });
      });
    });
  }

  // Join existing room
  function joinRoom() {
    const roomId = elements.joinRoomIdInput.value.trim().toUpperCase();
    const inputUrl = elements.wsUrlInput.value.trim();
    const validatedUrl = convertToWebSocketUrl(inputUrl);

    if (!roomId) {
      alert('방 코드를 입력해주세요.');
      return;
    }

    if (!validatedUrl) {
      alert('올바른 서버 주소를 입력해주세요.');
      elements.wsUrlInput.value = wsUrl; // Revert
      return;
    }

    wsUrl = validatedUrl;
    elements.wsUrlInput.value = wsUrl;

    getLaftelTab((tab) => {
      if (!tab) {
        alert('라프텔 영상 페이지를 먼저 열어주세요.\n(https://laftel.net)');
        return;
      }

      ensureContentScript(tab.id, () => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'connect',
          wsUrl: wsUrl,
          roomId: roomId,
          isHost: false
        }, (response) => {
          if (chrome.runtime.lastError) {
            alert('방 입장에 실패했습니다. 코드를 확인해 주세요.');
            return;
          }

          currentRoomId = roomId;
          isHost = false;
          isConnected = true;

          chrome.storage.local.set({ wsUrl, roomId, isHost: false }, () => {
            updateUI(); // Update UI after storage is confirmed
            setTimeout(checkCurrentTabStatus, 500);
          });
        });
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
    const statusText = elements.status.querySelector('.status-text');
    const setupContainer = document.getElementById('setupContainer');

    if (isConnected && currentRoomId) {
      elements.status.className = 'status-badge connected';
      // If we have roomId but checkCurrentTabStatus hasn't confirmed connection yet, show 'CONNECTING'
      statusText.textContent = isConnected ? 'ONLINE' : 'CONNECTING...';

      elements.roomInfo.style.display = 'block';
      if (setupContainer) setupContainer.style.display = 'none';

      elements.roomIdDisplay.textContent = currentRoomId;
      elements.modeDisplay.textContent = isHost ? '호스트' : '참여자';

      // Member list handling
      elements.memberCount.textContent = members.length || (currentRoomId ? '1' : '0');
      elements.memberList.innerHTML = '';

      if (members.length > 0) {
        members.forEach(member => {
          const div = document.createElement('div');
          div.className = 'member-item';

          const id = document.createElement('span');
          id.className = 'member-id';
          id.textContent = member.clientId; // Use full or compact client ID as provided

          const role = document.createElement('span');
          role.className = 'member-role' + (member.isHost ? ' host' : '');
          role.textContent = member.isHost ? 'HOST' : 'GUEST';

          div.appendChild(id);
          div.appendChild(role);
          elements.memberList.appendChild(div);
        });
      }

      // Sync button only for participants
      elements.requestSyncBtn.style.display = isHost ? 'none' : 'flex';

    } else {
      elements.status.className = 'status-badge disconnected';
      statusText.textContent = 'OFFLINE';

      elements.roomInfo.style.display = 'none';
      if (setupContainer) setupContainer.style.display = 'block';
    }
  }

  // Listen for status updates from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'status_update') {
      isConnected = message.isConnected;
      currentRoomId = message.roomId;
      isHost = message.isHost;
      updateUI(message.members);
    }
  });

  // Helper: Get Laftel tab
  function getLaftelTab(callback) {
    chrome.tabs.query({ url: 'https://laftel.net/*' }, (tabs) => {
      callback(tabs.length > 0 ? tabs[0] : null);
    });
  }

  // Helper: Ensure content script is injected
  function ensureContentScript(tabId, callback) {
    chrome.tabs.sendMessage(tabId, { type: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[LWT] Content script not detected, injecting...');
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }).then(() => {
          chrome.scripting.insertCSS({
            target: { tabId },
            files: ['content.css']
          }).then(() => {
            console.log('[LWT] Content script and CSS injected');
            setTimeout(callback, 500); // Give it a moment to initialize
          }).catch(err => {
            console.error('[LWT] CSS injection error:', err);
            setTimeout(callback, 500); // Still try to proceed
          });
        }).catch(err => {
          console.error('[LWT] Script injection error:', err);
          alert('확장 프로그램을 초기화할 수 없습니다. 페이지를 수동으로 새로고침해 주세요.');
        });
      } else {
        callback();
      }
    });
  }

  // Helper: URL conversion
  function convertToWebSocketUrl(url) {
    if (!url) return '';
    url = url.trim();

    // Basic validation: must contain at least one dot to be a domain/host
    // and shouldn't be too short (like a room code)
    if (!url.includes('.') && !url.includes('localhost')) {
      return null;
    }

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
