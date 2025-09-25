// Background script for managing extension state
let activeTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  // Set default configuration
  chrome.storage.sync.set({
    isActive: false,
    timestampFormat: 'absolute',
    timeFormat: 'HH:mm:ss',
    interviewStartTime: null,
    relativeFormat: 'mm:ss',
    timerEnabled: true,
    timerPosition: 'top-right',
    themeMode: 'auto'
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    chrome.storage.sync.get(['isActive', 'timestampFormat', 'timeFormat', 'interviewStartTime', 'relativeFormat', 'timerEnabled', 'timerPosition', 'themeMode'], (result) => {
      // Check if this tab is the active interview tab
      result.isActiveInThisTab = result.isActive && activeTabId === sender.tab.id;
      
      // Ensure all values have defaults
      const response = {
        isActive: result.isActive || false,
        timestampFormat: result.timestampFormat || 'absolute',
        timeFormat: result.timeFormat || 'HH:mm:ss',
        interviewStartTime: result.interviewStartTime || null,
        relativeFormat: result.relativeFormat || 'mm:ss',
        timerEnabled: result.timerEnabled !== false,
        timerPosition: result.timerPosition || 'top-right',
        themeMode: result.themeMode || 'auto',
        isActiveInThisTab: result.isActive && activeTabId === sender.tab.id
      };
      
      sendResponse(response);
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'setActive') {
    chrome.storage.sync.set({ isActive: request.isActive });
    if (request.isActive && request.startTime) {
      chrome.storage.sync.set({ interviewStartTime: request.startTime });
      activeTabId = sender.tab.id; // Set this tab as the active interview tab
    } else if (!request.isActive) {
      activeTabId = null; // Clear active tab when interview stops
    }
    sendResponse({ success: true });
  }
  
  if (request.action === 'updateConfig') {
    chrome.storage.sync.set(request.config, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Notify all content scripts when state changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'stateChanged',
          changes: changes,
          isActiveInThisTab: changes.isActive ? activeTabId === tab.id : false
        }).catch(() => {
          // Ignore errors for tabs that don't have content script
        });
      });
    });
  }
});
