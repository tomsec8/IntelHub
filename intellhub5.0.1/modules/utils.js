export const brw = self.browser || self.chrome;

export async function getCurrentTab() {
  const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isFirefox() {
  return navigator.userAgent.includes("Firefox");
}

export function flashButton(element, tempText = "", isError = false) {
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

export function createSection(container, title, { id, onToggle } = {}) {
  const btn = document.createElement("button");
  btn.className = "category-button";
  btn.textContent = title;
  const wrapper = document.createElement("div");
  wrapper.className = "tool-list";
  if (id) wrapper.id = id;
  btn.addEventListener("click", () => {
    wrapper.classList.toggle("open");
    if (onToggle) onToggle(wrapper.classList.contains("open"));
  });
  container.appendChild(btn);
  container.appendChild(wrapper);
  return { btn, wrapper };
}

export function saveViewState(view, data = {}) {
  chrome.storage.session.set({ lastState: { view, ...data } });
}

export function resetViewState() {
  chrome.storage.session.set({ lastState: { view: 'home' } });
}