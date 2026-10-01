/**
 * OPSEC content script — toasts for MAIN-world guard injects.
 */
const brw = typeof browser !== 'undefined' ? browser : chrome;

brw.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === 'toggleModule' || message?.action === 'injectModule') {
    sendResponse({ success: true });
  }
  return true;
});

window.addEventListener('pagehide', () => {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  brw.runtime.sendMessage({ action: 'cookieGuardPagehide', origin: location.origin }).catch(() => {});
});

(async function init() {
  try {
    const data = await brw.storage.local.get({ moduleStates: {}, locationMode: 'block' });
    const locMode = data.locationMode || 'block';
    if (document.documentElement) {
      document.documentElement.setAttribute('data-opsechub-location-mode', locMode);
    }
  } catch {
    /* ignore */
  }
})();

const BLOCK_TITLES = {
  mediaBlock: 'Camera & Mic Guard',
  clipboardGuard: 'Clipboard Guard',
  locationBlock: 'Location Guard',
  webrtcBlock: 'WebRTC Leak Block'
};

const BLOCK_ACTION_COPY = {
  'access camera/microphone': 'Blocked camera & microphone access.',
  'access camera/microphone (legacy)': 'Blocked camera & microphone access.',
  'access geolocation location': 'Blocked location access.',
  'read clipboard text': 'Blocked a clipboard read attempt.',
  'read clipboard data': 'Blocked a clipboard read attempt.',
  'paste text': 'Blocked a paste attempt.',
  'leak IP address via WebRTC': 'Blocked attempt to leak IP address via WebRTC.'
};

const KNOWN_BLOCK_MODULES = new Set(Object.keys(BLOCK_TITLES));
const KNOWN_BLOCK_ACTIONS = new Set(Object.keys(BLOCK_ACTION_COPY));

let toastContainer = null;

function showToast(moduleName, actionText) {
  if (!toastContainer) {
    const div = document.createElement('div');
    div.id = 'opsechub-toast-container';
    (document.body || document.documentElement).appendChild(div);
    const shadow = div.attachShadow({ mode: 'closed' });
    const container = document.createElement('div');
    container.id = 'toast-container';
    shadow.appendChild(container);
    const style = document.createElement('style');
    style.textContent = `
      #toast-container {
        position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
        display: flex; flex-direction: column; gap: 10px;
        font-family: system-ui, -apple-system, sans-serif; pointer-events: none;
      }
      .toast {
        pointer-events: auto; background: rgba(10, 14, 23, 0.95);
        border: 1px solid rgba(91, 157, 255, 0.3); border-radius: 8px;
        padding: 12px 20px; color: #fff; width: 280px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
        display: flex; align-items: center; gap: 12px;
        transform: translateX(120%); opacity: 0;
        transition: transform 0.3s ease, opacity 0.3s;
      }
      .toast.show { transform: translateX(0); opacity: 1; }
      .toast.hide { transform: translateY(20px); opacity: 0; }
      .accent { width: 3px; align-self: stretch; border-radius: 2px; background: #5B9DFF; }
      .title { font-size: 13px; font-weight: 700; color: #5B9DFF; display: block; }
      .desc { font-size: 11px; color: #b0bec5; line-height: 1.3; display: block; }
    `;
    shadow.appendChild(style);
    toastContainer = container;
  }

  const title = BLOCK_TITLES[moduleName];
  const desc = BLOCK_ACTION_COPY[actionText];
  if (!title || !desc) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="accent"></span><div><span class="title"></span><span class="desc"></span></div>`;
  toast.querySelector('.title').textContent = title;
  toast.querySelector('.desc').textContent = desc;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Any page can fire this event, so only the module/action pairs that the OPSEC
// inject scripts actually emit are accepted. Unknown values are ignored so a
// site cannot spoof a protection toast or spam the block counters.
window.addEventListener('opsechub-block-event', (e) => {
  const module = e.detail?.module;
  const action = e.detail?.action;
  if (!KNOWN_BLOCK_MODULES.has(module) || !KNOWN_BLOCK_ACTIONS.has(action)) return;
  showToast(module, action);
  brw.runtime.sendMessage({
    action: 'registerBlock',
    module,
    detail: action
  }).catch(() => {});
});
