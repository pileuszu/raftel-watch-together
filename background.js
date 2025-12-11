// Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Laftel Watch Together extension installed');
});

// Track URL changes for host synchronization
let lastUrl = new Map(); // tabId -> last URL

// Detect tab updates and URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || !tab.url.includes('laftel.net/player')) {
    return;
  }

  // Page loaded
  if (changeInfo.status === 'complete') {
    chrome.tabs.sendMessage(tabId, { type: 'page_loaded' }).catch(() => {
      // Content script may not be loaded yet
    });
  }
  
  // URL changed (host should notify participants)
  const currentUrl = tab.url;
  const previousUrl = lastUrl.get(tabId);
  
  if (currentUrl && currentUrl !== previousUrl) {
    lastUrl.set(tabId, currentUrl);
    
    // Small delay to ensure content script is ready
    setTimeout(() => {
      // Check if this tab is host
      chrome.storage.local.get(['roomId', 'isHost'], (result) => {
        if (result.roomId && result.isHost) {
          // Notify content script to send URL change
          chrome.tabs.sendMessage(tabId, {
            type: 'url_changed',
            url: currentUrl
          }).catch(() => {
            // Content script may not be loaded yet
          });
        }
      });
    }, 500);
  }
});
