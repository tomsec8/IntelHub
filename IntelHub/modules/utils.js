// modules/utils.js

export const brw = self.browser || self.chrome;

export async function getCurrentTab() {
  const [tab] = await brw.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function isFirefox() {
  return navigator.userAgent.includes("Firefox");
}