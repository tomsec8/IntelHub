chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "extractPageText") {
    const text = document.body ? document.body.innerText : "";
    sendResponse({ text });
  }
});
