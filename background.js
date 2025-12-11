// Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Laftel Watch Together extension installed');
});

// Detect tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('laftel.net/player')) {
    chrome.tabs.sendMessage(tabId, { type: 'page_loaded' }).catch(() => {
      // Content script may not be loaded yet
    });
  }
});
