document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('username');

    const closeBtn = document.getElementById('close-main');
    if (closeBtn) closeBtn.addEventListener('click', () => window.close());

    if (!username) {
        document.getElementById('status-text').textContent = "Error: No username provided.";
        document.querySelector('.loader').style.display = 'none';
        return;
    }

    document.getElementById('target-user').textContent = `Target: @${username}`;
    startScan(username);
});

function startScan(username) {
    const statusText = document.getElementById('status-text');
    const targetUrl = `https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3D${username}`;

    chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
        if (!tab) {
            statusText.textContent = "Error: Popup blocked.";
            return;
        }

        statusText.textContent = "Waiting for Telegram...";

        setTimeout(() => {
            statusText.textContent = "Scanning...";

            const scriptToInject = (targetUsername) => {
                return new Promise((resolve) => {
                    let attempts = 0;
                    let searchTriggered = false;
                    
                    let capturedId = null;
                    let capturedStatus = null;
                    let capturedName = null;
                    let successCounter = 0; 

                    const maxAttempts = 80; 

                    const triggerTyping = (element, text) => {
                        element.focus();
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        nativeInputValueSetter.call(element, text);
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    };

                    const interval = setInterval(() => {
                        attempts++;

                        if (!capturedId) {
                            const header = document.querySelector('.chat-header, .ChatInfo, .top');
                            if (header) {
                                const idEl = header.querySelector('[data-peer-id]');
                                if (idEl) {
                                    const pid = idEl.getAttribute('data-peer-id');
                                    if (pid !== '777000') capturedId = pid;
                                }
                                const nameEl = header.querySelector('.user-title, .peer-title, h3, .title');
                                if (nameEl) capturedName = nameEl.innerText.trim();
                            }

                            if (!capturedId) {
                                const middleCol = document.querySelector('.MiddleColumn, .chat-info');
                                if (middleCol) {
                                    const idEl = middleCol.querySelector('[data-peer-id]');
                                    if (idEl) {
                                        const pid = idEl.getAttribute('data-peer-id');
                                        if (pid !== '777000') capturedId = pid;
                                    }
                                }
                            }
                        }

                        if (!capturedStatus) {
                            const statusSelectors = [
                                '.chat-header .user-status', 
                                '.chat-header .subtitle', 
                                '.user-status', 
                                '.chat-status', 
                                '.ChatInfo .status'
                            ];
                            
                            for (const sel of statusSelectors) {
                                const el = document.querySelector(sel);
                                if (el && el.innerText.trim().length > 0) {
                                    const txt = el.innerText.trim();
                                    if (!txt.toLowerCase().includes('connecting') && !txt.toLowerCase().includes('updating')) {
                                        capturedStatus = txt;
                                        break;
                                    }
                                }
                            }
                        }

                        
                        if (capturedId) {
                            successCounter++;

                            if (capturedStatus) {
                                clearInterval(interval);
                                resolveData(capturedId, capturedStatus, capturedName || targetUsername);
                                return;
                            }

                            if (successCounter > 10) {
                                clearInterval(interval);
                                resolveData(capturedId, "", capturedName || targetUsername); 
                                return;
                            }
                        }

                        if (attempts > 15 && !searchTriggered && !capturedId) {
                            const searchInput = document.querySelector('input#telegram-search-input, input[type="text"]');
                            if (searchInput) {
                                searchTriggered = true;
                                triggerTyping(searchInput, "@" + targetUsername);
                                setTimeout(() => {
                                    const firstResult = document.querySelector('.search-group .ListItem, .ListItem-button');
                                    if (firstResult) {
                                        firstResult.click();
                                        const clickable = firstResult.querySelector('[role="button"]') || firstResult;
                                        clickable.click();
                                    }
                                }, 2000);
                            }
                        }

                        if (attempts >= maxAttempts) {
                            clearInterval(interval);
                            if (capturedId) {
                                resolveData(capturedId, "", capturedName || targetUsername);
                            } else {
                                resolve({ success: false, error: "Timeout: ID extraction failed." });
                            }
                        }
                    }, 500);

                    function resolveData(id, status, name) {
                        let type = "Unknown";
                        if (id.startsWith('-')) {
                            if (status && status.toLowerCase().includes('subscribers')) type = "Channel";
                            else type = "Group";
                        } else {
                            if (status && status.toLowerCase().includes('bot')) type = "Bot";
                            else type = "User";
                        }
                        resolve({ success: true, id: id, status: status, name: name, type: type });
                    }
                });
            };

            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: scriptToInject,
                args: [username]
            }, (results) => {
                chrome.tabs.remove(tab.id);

                if (chrome.runtime.lastError || !results || !results[0]?.result) {
                    showError("Scan Failed.");
                } else {
                    const result = results[0].result;
                    if (result.success) {
                        showResult(result);
                    } else {
                        showError(result.error);
                    }
                }
            });

        }, 4000);
    });
}

function showResult(data) {
    document.getElementById('loading-area').style.display = 'none';
    const box = document.getElementById('result-box');
    box.style.display = 'block';
    
    document.getElementById('res-name').textContent = data.name;
    document.getElementById('res-type').textContent = data.type;
    
    const statusRow = document.getElementById('res-status').parentNode;
    if (data.status && data.status !== "") {
        document.getElementById('res-status').textContent = data.status;
        statusRow.style.display = 'flex';
        if (data.status.toLowerCase().includes('online')) {
            document.getElementById('res-status').style.color = '#badc58';
        }
    } else {
        statusRow.style.display = 'none';
    }

    document.getElementById('res-id').textContent = data.id;

    const copyBtn = document.getElementById('copy-btn');
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(data.id);
        flashButton(copyBtn, 'Copied!');
    };
    
    document.getElementById('close-main').style.display = 'inline-block';
}

function showError(msg) {
    document.querySelector('.loader').style.display = 'none';
    const st = document.getElementById('status-text');
    st.textContent = "❌ " + msg;
    st.style.color = "#ff7675";
}

function flashButton(element, tempText = "", isError = false) {
  const btn = typeof element === 'string' ? document.getElementById(element) : element;
  if (!btn) return;
  
  if (btn.dataset.isFlashing === "true") return;
  btn.dataset.isFlashing = "true";

  const originalText = btn.textContent;
  
  if (tempText) {
    btn.textContent = tempText;
  }

  const classToAdd = isError ? 'btn-error' : 'btn-success';
  btn.classList.add(classToAdd);

  setTimeout(() => {
    if (tempText) btn.textContent = originalText;
    btn.classList.remove(classToAdd);
    btn.dataset.isFlashing = "false";
  }, 2000);
}