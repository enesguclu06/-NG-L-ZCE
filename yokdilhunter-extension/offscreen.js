// Offscreen document — only purpose is clipboard access for MV3 service workers.
// Receives a 'read-clipboard' message, reads the clipboard, sends it back.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'read-clipboard') {
    navigator.clipboard.readText()
      .then(text => sendResponse({ text }))
      .catch(() => sendResponse({ text: '' }));
    return true; // keep channel open for async response
  }
});
