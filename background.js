// Background script for managing extension state
let activeTabId = null;

chrome.runtime.onInstalled.addListener(() => {
  // Set default configuration only if values don't exist
  chrome.storage.sync.get(['isActive', 'timestampFormat', 'timeFormat', 'interviewStartTime', 'relativeFormat', 'timerEnabled', 'timerPosition', 'themeMode', 'postCooldown'], (result) => {
    const defaults = {
      isActive: false,
      timestampFormat: 'absolute',
      timeFormat: 'HH:mm:ss',
      interviewStartTime: null,
      relativeFormat: 'mm:ss',
      timerEnabled: true,
      timerPosition: 'top-right',
      themeMode: 'auto',
      postCooldown: 10
    };
    
    // Only set values that don't exist
    const valuesToSet = {};
    Object.keys(defaults).forEach(key => {
      if (result[key] === undefined) {
        valuesToSet[key] = defaults[key];
      }
    });
    
    if (Object.keys(valuesToSet).length > 0) {
      chrome.storage.sync.set(valuesToSet);
    }
  });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    chrome.storage.sync.get(['isActive', 'timestampFormat', 'timeFormat', 'interviewStartTime', 'relativeFormat', 'timerEnabled', 'timerPosition', 'themeMode', 'postCooldown'], (result) => {
      // Check if this tab is the active interview tab (handle cases where sender.tab might be undefined)
      result.isActiveInThisTab = result.isActive && activeTabId === (sender.tab ? sender.tab.id : null);
      
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
        postCooldown: result.postCooldown !== undefined ? result.postCooldown : 10,
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
      activeTabId = sender.tab ? sender.tab.id : null; // Set this tab as the active interview tab
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
