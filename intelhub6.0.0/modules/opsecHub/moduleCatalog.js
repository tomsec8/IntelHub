/** Shared OPSEC protection modules (popup + workspace). */

export const SECURITY_MODULES = [
  {
    id: 'cookieGuard',
    name: 'Cookie & Storage Guard',
    desc: 'Auto-delete cookies and site storage when the last tab closes',
    detail:
      'Websites use cookies, LocalStorage, and IndexedDB to track you across sessions. Cookie & Storage Guard clears those traces when you close the last tab for a site.',
    tests: [
      { label: 'SetCookie.net', url: 'https://setcookie.net/' },
      { label: 'MDN Web Storage', url: 'https://mdn.github.io/dom-examples/web-storage/' },
      { label: 'MDN IndexedDB', url: 'https://mdn.github.io/dom-examples/to-do-notifications/' }
    ]
  },
  {
    id: 'forceHttps',
    name: 'Force HTTPS',
    desc: 'Upgrade connections to secure HTTPS',
    detail:
      'Unencrypted HTTP can expose browsing on shared networks. Force HTTPS upgrades requests to encrypted HTTPS so traffic is harder to intercept.',
    tests: [
      { label: 'HTTP BadSSL', url: 'http://http.badssl.com/' },
      { label: 'NeverSSL', url: 'http://neverssl.com/' }
    ]
  },
  {
    id: 'webrtcBlock',
    name: 'WebRTC Leak Guard',
    desc: 'Prevent real IP leakage via WebRTC',
    detail:
      'WebRTC can reveal your real IP even behind a VPN or proxy. This guard hardens WebRTC so local and public addresses stay hidden.',
    tests: [
      { label: 'BrowserLeaks WebRTC', url: 'https://browserleaks.com/webrtc' },
      { label: 'IPLeak', url: 'https://ipleak.net/' }
    ]
  }
];

export const PRIVACY_MODULES = [
  {
    id: 'mediaBlock',
    name: 'Camera & Mic Guard',
    desc: 'Block media API access attempts',
    detail:
      'Sites can request camera and microphone access for tracking or surprise prompts. This guard blocks media device access unless you turn it off.',
    tests: [
      { label: 'Webcam Tests', url: 'https://webcamtests.com/' },
      { label: 'Mic Tests', url: 'https://mictests.com/' }
    ]
  },
  {
    id: 'locationBlock',
    name: 'Location Guard',
    desc: 'Block or spoof geolocation',
    detail:
      'Geolocation APIs can expose where you are. Location Guard blocks (or controls) site access to your position.',
    tests: [
      { label: 'BrowserLeaks Geo', url: 'https://browserleaks.com/geo' }
    ]
  },
  {
    id: 'clipboardGuard',
    name: 'Clipboard Protection',
    desc: 'Prevent silent clipboard reads',
    detail:
      'Pages can try to read your clipboard in the background. Clipboard Protection blocks silent reads so copied secrets stay private.',
    tests: [
      { label: 'Clipboard Inspector', url: 'https://evercoder.github.io/clipboard-inspector/' }
    ]
  },
  {
    id: 'privacyHeaders',
    name: 'Privacy Headers',
    desc: 'Inject Do Not Track and GPC',
    detail:
      'Sends Do Not Track (DNT) and Global Privacy Control (GPC) on requests so sites that honor these signals see your opt-out preference.',
    tests: [
      { label: 'GPC Auditor', url: 'https://global-privacy-control.vercel.app/' },
      { label: 'Cover Your Tracks', url: 'https://coveryourtracks.eff.org/' }
    ]
  },
  {
    id: 'googleTelemetry',
    name: 'Google Telemetry',
    desc: 'Strip Chrome X-Client-Data header',
    detail:
      'Chrome can attach client experiment headers on Google traffic. This module strips those identifiers from requests.',
    tests: [
      { label: 'Google.com', url: 'https://www.google.com/' },
      { label: 'DoubleClick', url: 'https://doubleclick.net/' }
    ]
  },
  {
    id: 'proxyManager',
    name: 'Proxy & Web VPN',
    desc: 'Route traffic through SOCKS5/HTTP',
    detail:
      'Routes browser traffic through a SOCKS5/HTTP proxy you choose — Burp or a saved custom address — so your exit IP follows that path.',
    proxy: true,
    tests: [
      { label: 'BrowserLeaks IP', url: 'https://browserleaks.com/ip' },
      { label: 'IPinfo', url: 'https://ipinfo.io/' }
    ]
  }
];
