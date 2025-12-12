// Laftel Watch Together - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[LWT] Extension installed');
  
  // Clear any stale room data on install/update
  chrome.storage.local.remove(['roomId', 'isHost']);
});

// Clean up storage when extension is disabled or updated
chrome.runtime.onSuspend?.addListener(() => {
  console.log('[LWT] Extension suspended');
});
