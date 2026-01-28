// Track scrolling state per tab
const tabScrollState = new Map();

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-scroll') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Check if it's a restricted URL
    const restricted = [
      'chrome://',
      'edge://',
      'brave://',
      'about:',
      'view-source:',
      'https://chrome.google.com/webstore',
      'https://chromewebstore.google.com'
    ];

    if (restricted.some(protocol => tab.url?.startsWith(protocol))) {
      return;
    }

    await toggleScroll(tab.id);
  }
});

async function toggleScroll(tabId) {
  const isScrolling = tabScrollState.get(tabId) || false;

  // Try to send message to existing content script
  try {
    if (isScrolling) {
      const response = await chrome.tabs.sendMessage(tabId, { action: "STOP_SCROLL" });
      if (response) {
        tabScrollState.set(tabId, false);
      }
    } else {
      const settings = await chrome.storage.sync.get(['pixelSpeed', 'scrollType', 'stepInterval', 'reverseScroll']);
      const response = await chrome.tabs.sendMessage(tabId, {
        action: "START_SCROLL",
        speed: settings.pixelSpeed || 50,
        scrollType: settings.scrollType || 'continuous',
        stepInterval: settings.stepInterval || 2,
        reverseScroll: settings.reverseScroll || false
      });
      if (response) {
        tabScrollState.set(tabId, true);
      }
    }
  } catch (error) {
    // Content script not injected, inject it first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['scripts/content.js']
      });

      // Now start scrolling
      const settings = await chrome.storage.sync.get(['pixelSpeed', 'scrollType', 'stepInterval', 'reverseScroll']);
      const response = await chrome.tabs.sendMessage(tabId, {
        action: "START_SCROLL",
        speed: settings.pixelSpeed || 50,
        scrollType: settings.scrollType || 'continuous',
        stepInterval: settings.stepInterval || 2,
        reverseScroll: settings.reverseScroll || false
      });
      if (response) {
        tabScrollState.set(tabId, true);
      }
    } catch (injectError) {
      console.log('Failed to inject content script:', injectError);
    }
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "UPDATE_STATE" && sender.tab) {
    tabScrollState.set(sender.tab.id, request.isScrolling);
  } else if (request.action === "GET_TAB_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({ isScrolling: tabScrollState.get(tabs[0].id) || false });
      } else {
        sendResponse({ isScrolling: false });
      }
    });
    return true;
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScrollState.delete(tabId);
});

// Clean up when tab navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabScrollState.set(tabId, false);
  }
});
