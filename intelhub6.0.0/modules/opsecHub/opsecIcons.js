const PATHS = {
  security: 'M8 1.2 13.8 3.5v4.4c0 3.4-2.4 5.8-5.8 7C4.6 13.7 2.2 11.3 2.2 7.9V3.5L8 1.2zm0 1.7L3.7 4.4v3.5c0 2.6 1.8 4.6 4.3 5.6 2.5-1 4.3-3 4.3-5.6V4.4L8 2.9z',
  privacy: 'M8 3.1C4.4 3.1 1.8 6.2 1.3 8c.5 1.8 3.1 4.9 6.7 4.9s6.2-3.1 6.7-4.9C14.2 6.2 11.6 3.1 8 3.1zm0 7.6A2.7 2.7 0 1 1 8 5.3a2.7 2.7 0 0 1 0 5.4z',
  cookieGuard: 'M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6zM6 6.1a.85.85 0 1 1 0 1.7A.85.85 0 0 1 6 6.1zm3.4 1.1a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zM6.4 10a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6zm3.7.5a.65.65 0 1 1 0 1.3.65.65 0 0 1 0-1.3z',
  forceHttps: 'M8 1.9A2.6 2.6 0 0 0 5.4 4.5V6H4.3v8.1h7.4V6H10.6V4.5A2.6 2.6 0 0 0 8 1.9zm0 1.5c.6 0 1.1.5 1.1 1.1V6H6.9V4.5c0-.6.5-1.1 1.1-1.1z',
  webrtcBlock: 'M8 12.8a1.15 1.15 0 1 0 0-2.3 1.15 1.15 0 0 0 0 2.3zM4.3 9.2l1.1-1.1A3.6 3.6 0 0 1 8 7.2c.9 0 1.8.3 2.5.9l1.1-1.1A5.2 5.2 0 0 0 8 5.8a5.2 5.2 0 0 0-3.7 1.5zm-2-1.9 1.1-1.1A7 7 0 0 1 8 4.6c1.8 0 3.4.6 4.6 1.6l1.1-1.1A8.5 8.5 0 0 0 8 3.1 8.5 8.5 0 0 0 2.3 7.3z',
  mediaBlock: 'M5.3 4.3 6.1 3.1h3.8l.8 1.2h1.6A1.4 1.4 0 0 1 13.7 5.7v6.5a1.4 1.4 0 0 1-1.4 1.4h-8.6A1.4 1.4 0 0 1 2.3 12.2V5.7A1.4 1.4 0 0 1 3.7 4.3h1.6zM8 11A2.5 2.5 0 1 0 8 6a2.5 2.5 0 0 0 0 5z',
  locationBlock: 'M8 1.7A4.2 4.2 0 0 0 3.8 5.9c0 3 3.2 6.9 3.8 7.7.2.3.6.3.8 0 .6-.8 3.8-4.7 3.8-7.7A4.2 4.2 0 0 0 8 1.7zm0 5.7A1.5 1.5 0 1 1 8 4.4 1.5 1.5 0 0 1 8 7.4z',
  clipboardGuard: 'M6.3 2.3h3.4v1.2H6.3zm-1.4 1.2H6.1V2.2h3.8v1.3h1.2A1.3 1.3 0 0 1 12.4 4.8v8.4a1.3 1.3 0 0 1-1.3 1.3H4.9a1.3 1.3 0 0 1-1.3-1.3V4.8A1.3 1.3 0 0 1 4.9 3.5z',
  privacyHeaders: 'M4.2 1.8h5L12 4.6v9.6H4.2V1.8zm4.8.8v2.2h2.2zM5.5 8h5v1h-5zm0 2.2h5v1h-5z',
  googleTelemetry: 'M2.6 12.7V5.4h2.1v7.3zm4.4 0V3.3h2.1v9.4zm4.3 0V7.5h2.1v5.2z',
  proxyManager: 'M8 1.6a6.4 6.4 0 1 0 0 12.8A6.4 6.4 0 0 0 8 1.6zm0 1.3c.7 0 1.7 1.6 2.1 4.1H5.9C6.3 4.5 7.3 2.9 8 2.9zM4.2 4c-.9.9-1.5 2.3-1.5 4s.6 3.1 1.5 4c.7-.9 1.1-2.4 1.2-4C5.3 6.4 4.9 4.9 4.2 4zm7.6 0c-.7.9-1.1 2.4-1.2 4 .1 1.6.5 3.1 1.2 4 .9-.9 1.5-2.3 1.5-4s-.6-3.1-1.5-4zM5.9 9.6h4.2c-.4 2.5-1.4 4.1-2.1 4.1s-1.7-1.6-2.1-4.1z',
  plus: 'M7.25 3h1.5v4.25H13v1.5H8.75V13h-1.5V8.75H3v-1.5h4.25z',
  close: 'M4.1 3.3 8 7.2l3.9-3.9 1.1 1.1L9.1 8.3l3.9 3.9-1.1 1.1L8 9.4l-3.9 3.9-1.1-1.1 3.9-3.9-3.9-3.9z'
};

export function opsecIcon(name, size = 16) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('opsec-icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', PATHS[name] || PATHS.security);
  svg.appendChild(path);
  return svg;
}
