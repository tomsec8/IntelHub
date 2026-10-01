import { brw } from '../utils.js';
import { paintToolChrome } from '../workspaceToolResults.js';

const GUIDES = [
  {
    id: 'dns',
    name: 'Secure DNS Guide',
    blurb: 'Turn on DNS-over-HTTPS and copy a trusted resolver URL.'
  },
  {
    id: 'dnt',
    name: 'Do Not Track Guide',
    blurb: 'Open your browser privacy settings and enable tracking signals.'
  },
  {
    id: 'cookies',
    name: 'Third-Party Cookies Guide',
    blurb: 'Tighten cookie settings in Chrome, Firefox, or Edge.'
  }
];

const DNS_PROVIDERS = [
  { name: 'Cloudflare (Default)', tag: 'Fast & Private', url: 'https://chrome.cloudflare-dns.com/dns-query' },
  { name: 'Cloudflare (Security)', tag: 'Malware Block', url: 'https://security.cloudflare-dns.com/dns-query' },
  { name: 'Quad9', tag: 'Malware Block', url: 'https://dns.quad9.net/dns-query' },
  { name: 'AdGuard', tag: 'Ads & Trackers', url: 'https://dns.adguard-dns.com/dns-query' },
  { name: 'Mullvad', tag: 'Swedish Privacy', url: 'https://doh.mullvad.net/dns-query' },
  { name: 'NextDNS', tag: 'Smart Filtering', url: 'https://dns.nextdns.io' },
  { name: 'Google Public DNS', tag: 'Global Speed', url: 'https://dns.google/dns-query' },
  { name: 'DNS.SB', tag: 'EU Privacy', url: 'https://doh.dns.sb/dns-query' }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function html(htmlText) {
  const wrap = document.createElement('div');
  wrap.innerHTML = htmlText.trim();
  return wrap.firstElementChild;
}

function toolChrome(wrap, title, onBack) {
  return paintToolChrome(wrap, title, {
    onBack,
    wrapClass: 'ws-image opsec-guide',
    panelClass: 'ws-image-panel opsec-guide-panel'
  });
}

function openSettings(url) {
  brw.tabs.create({ url }).catch(() => {});
}

function paintCards(wrap, onToolChange, onSectionBack) {
  if (typeof onSectionBack === 'function') {
    wrap.className = 'ws-image';
    wrap.replaceChildren();
    const bar = el('div', 'ws-image-bar');
    const back = el('button', 'ws-btn ws-btn-ghost', 'Back');
    back.type = 'button';
    back.addEventListener('click', onSectionBack);
    bar.append(back, el('h2', '', 'Guides'));
    wrap.appendChild(bar);
    const cards = el('div', 'ws-cards');
    GUIDES.forEach((guide) => {
      const card = el('button', 'ws-tool-card');
      card.type = 'button';
      card.append(el('strong', '', guide.name), el('span', '', guide.blurb));
      card.addEventListener('click', () => onToolChange(guide.id));
      cards.appendChild(card);
    });
    wrap.appendChild(cards);
    return;
  }

  wrap.className = 'ws-cards';
  wrap.replaceChildren();
  GUIDES.forEach((guide) => {
    const card = el('button', 'ws-tool-card');
    card.type = 'button';
    card.append(el('strong', '', guide.name), el('span', '', guide.blurb));
    card.addEventListener('click', () => onToolChange(guide.id));
    wrap.appendChild(card);
  });
}

function browserSetupCard({ title, tone, steps, btnLabel, onOpen }) {
  const card = el('div', `opsec-guide-setup ${tone || ''}`.trim());
  card.appendChild(el('h3', '', title));
  const list = document.createElement('ol');
  steps.forEach((step) => {
    const li = document.createElement('li');
    li.innerHTML = step;
    list.appendChild(li);
  });
  card.appendChild(list);
  const btn = el('button', 'ws-btn', btnLabel);
  btn.type = 'button';
  btn.addEventListener('click', onOpen);
  card.appendChild(btn);
  return card;
}

function infoCard(title, tone, bodyHtml) {
  const card = el('div', `opsec-guide-info ${tone || ''}`.trim());
  card.appendChild(el('h3', '', title));
  const body = el('div', 'opsec-guide-info-body');
  body.innerHTML = bodyHtml;
  card.appendChild(body);
  return card;
}

function paintDns(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Secure DNS (DoH) Guide', onToolChange);
  panel.appendChild(el(
    'p',
    'opsec-guide-intro',
    'DNS over HTTPS (DoH) encrypts your DNS queries, preventing ISPs, network admins, and public Wi-Fi eavesdroppers from tracking which websites you visit or hijacking your DNS requests.'
  ));

  const setup = el('div', 'opsec-guide-setup-grid');
  setup.append(
    browserSetupCard({
      title: 'Google Chrome & Brave',
      tone: 'is-blue',
      steps: [
        'Copy a DoH provider URL below.',
        'Click <strong>Open Chrome Settings</strong> below.',
        'Enable <strong>Use secure DNS</strong>.',
        'Select <strong>With Custom</strong> and paste the URL.'
      ],
      btnLabel: 'Open Chrome Settings →',
      onOpen: () => openSettings('chrome://settings/security')
    }),
    browserSetupCard({
      title: 'Mozilla Firefox',
      tone: 'is-orange',
      steps: [
        'Copy a DoH provider URL below.',
        'Click <strong>Open Firefox Settings</strong> below.',
        'Scroll to <strong>DNS over HTTPS</strong> section.',
        'Select <strong>Max Protection</strong> and paste the URL.'
      ],
      btnLabel: 'Open Firefox Settings →',
      onOpen: () => openSettings('about:preferences#privacy')
    }),
    browserSetupCard({
      title: 'Microsoft Edge',
      tone: 'is-cyan',
      steps: [
        'Copy a DoH provider URL below.',
        'Click <strong>Open Edge Settings</strong> below.',
        'Enable <strong>Use secure DNS to specify how to lookup</strong>.',
        'Select <strong>Choose a service provider</strong> and paste the URL.'
      ],
      btnLabel: 'Open Edge Settings →',
      onOpen: () => openSettings('edge://settings/privacy')
    }),
    browserSetupCard({
      title: 'Opera & Opera GX',
      tone: 'is-red',
      steps: [
        'Copy a DoH provider URL below.',
        'Click <strong>Open Opera Settings</strong> below.',
        'Scroll to <strong>System</strong> section.',
        'Enable <strong>Use Secure DNS</strong> &amp; paste the URL.'
      ],
      btnLabel: 'Open Opera Settings →',
      onOpen: () => openSettings('opera://settings/system')
    })
  );
  panel.appendChild(setup);

  panel.appendChild(el('h3', 'opsec-guide-heading', 'Trusted DoH providers'));
  const list = el('div', 'opsec-dns-providers');
  DNS_PROVIDERS.forEach((p) => {
    const card = el('div', 'opsec-dns-card');
    card.append(el('strong', '', p.name), el('span', '', `${p.tag} — ${p.url}`));
    const copy = el('button', 'ws-btn ws-btn-ghost', 'Copy URL');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(p.url);
        copy.textContent = 'Copied';
        setTimeout(() => {
          copy.textContent = 'Copy URL';
        }, 1500);
      } catch {
        copy.textContent = 'Copy failed';
      }
    });
    card.appendChild(copy);
    list.appendChild(card);
  });
  panel.appendChild(list);
}

function paintDnt(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Do Not Track (DNT) Guide', onToolChange);
  panel.appendChild(html(`
    <p class="opsec-guide-intro">
      Chrome labels this setting:
      <em>Send a “Do Not Track” request with your browsing traffic</em>
      — with the note that sites use their own discretion when responding.
    </p>
  `));

  const infos = el('div', 'opsec-guide-info-stack');
  infos.append(
    infoCard(
      'What it is',
      'is-blue',
      `Do Not Track (DNT) is a browser signal (the <code>DNT: 1</code> HTTP header) that tells websites
      you prefer not to be tracked across sites for advertising or analytics profiling.
      It is a <strong>request</strong>, not a hard technical block — sites choose whether to honor it.`
    ),
    infoCard(
      'Risks if you leave it off',
      'is-risk',
      `<ul>
        <li>Trackers and ad networks assume consent by default and keep building cross-site profiles.</li>
        <li>You lose a clear privacy preference signal that some privacy-respecting sites do check.</li>
        <li>Combined with third-party cookies, browsing history is easier to stitch together across domains.</li>
        <li>DNT is largely <strong>deprecated</strong> in practice — most of the ad industry ignores it entirely — which is why stronger tools like <strong>GPC</strong> and an ad/tracker blocker are essential, not optional extras.</li>
      </ul>`
    ),
    infoCard(
      'How to protect yourself',
      'is-protect',
      `<p>Still enable DNT in your browser for the sites that honor it, and turn on OPSEC
      <strong>Privacy Headers (DNT &amp; GPC)</strong> in the popup so both signals are sent from the extension.
      Global Privacy Control (GPC) is the stronger modern companion used for opt-out laws in some regions.</p>
      <p class="opsec-guide-muted">DNT alone will not stop tracking. Treat it as one layer — pair it with GPC, cookie controls, and Secure DNS.</p>`
    )
  );
  panel.appendChild(infos);

  panel.appendChild(el('h3', 'opsec-guide-heading', 'Where to turn it on'));
  const setup = el('div', 'opsec-guide-setup-grid');
  setup.append(
    browserSetupCard({
      title: 'Chrome & Brave',
      tone: 'is-blue',
      steps: [
        'Open Privacy and security settings.',
        'Find <strong>Send a “Do Not Track” request with your browsing traffic</strong>.',
        'Enable the toggle (sites may still ignore the request).'
      ],
      btnLabel: 'Open Chrome Privacy Settings →',
      onOpen: () => openSettings('chrome://settings/privacy')
    }),
    browserSetupCard({
      title: 'Firefox',
      tone: 'is-orange',
      steps: [
        'Open Privacy &amp; Security preferences.',
        'Under Website Privacy Preferences, enable <strong>Tell websites not to sell or share my data</strong> / Do Not Track.'
      ],
      btnLabel: 'Open Firefox Privacy Settings →',
      onOpen: () => openSettings('about:preferences#privacy')
    }),
    browserSetupCard({
      title: 'Microsoft Edge',
      tone: 'is-cyan',
      steps: [
        'Open Privacy, search, and services.',
        'Enable <strong>Send “Do Not Track” requests</strong>.'
      ],
      btnLabel: 'Open Edge Privacy Settings →',
      onOpen: () => openSettings('edge://settings/privacy')
    })
  );
  panel.appendChild(setup);
}

function paintCookies(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Third-Party Cookies Guide', onToolChange);
  panel.appendChild(el(
    'p',
    'opsec-guide-intro',
    'Third-party cookies are small files set by domains other than the site you are visiting — commonly used by ad networks, analytics vendors, and social widgets embedded on pages.'
  ));

  const infos = el('div', 'opsec-guide-info-stack');
  infos.append(
    infoCard(
      'What they are',
      'is-orange',
      `A <strong>first-party cookie</strong> belongs to the site in your address bar (for login, language, cart).
      A <strong>third-party cookie</strong> belongs to another company loaded inside that page (ads, pixels, embeds).
      Because the same third party appears on many sites, it can recognize you across the web.`
    ),
    infoCard(
      'Risks',
      'is-risk',
      `<ul>
        <li><strong>Cross-site tracking</strong> — advertisers link your activity from news sites, shops, and social networks into one profile.</li>
        <li><strong>Retargeting</strong> — products you viewed follow you around the internet.</li>
        <li><strong>Fingerprinting helpers</strong> — cookies combine with device signals to keep identifying you even after partial clears.</li>
        <li><strong>Data brokers</strong> — browsing and interest data can be sold or shared beyond the site you intended to use.</li>
      </ul>`
    ),
    infoCard(
      'How to protect yourself',
      'is-protect',
      `<p>Block third-party cookies in the browser and keep OPSEC <strong>Cookie &amp; Storage Guard</strong>
      enabled so site storage can wipe when tabs close.</p>
      <p class="opsec-guide-muted">Note: some “Log in with Google/Facebook” flows or embedded payment widgets may break when third-party cookies are blocked. Allow exceptions only for sites you trust.</p>`
    )
  );
  panel.appendChild(infos);

  panel.appendChild(el('h3', 'opsec-guide-heading', 'Where to turn it on'));
  const setup = el('div', 'opsec-guide-setup-grid');
  setup.append(
    browserSetupCard({
      title: 'Chrome & Brave',
      tone: 'is-blue',
      steps: [
        'Open Third-party cookies / site settings for cookies.',
        'In Chrome, choose <strong>Block third-party cookies</strong> (or the strongest available option).',
        'In Brave, third-party cookies are blocked by default, but ensure Shields remain up for maximum protection.'
      ],
      btnLabel: 'Open Cookie Settings →',
      onOpen: () => openSettings('chrome://settings/cookies')
    }),
    browserSetupCard({
      title: 'Firefox',
      tone: 'is-orange',
      steps: [
        'Open Privacy &amp; Security.',
        'Set Enhanced Tracking Protection to <strong>Strict</strong> (or Custom and block cross-site cookies).'
      ],
      btnLabel: 'Open Firefox Privacy Settings →',
      onOpen: () => openSettings('about:preferences#privacy')
    }),
    browserSetupCard({
      title: 'Microsoft Edge',
      tone: 'is-cyan',
      steps: [
        'Open Privacy, search, and services → Tracking prevention.',
        'Use <strong>Balanced</strong> or <strong>Strict</strong>, and block third-party cookies under Cookies section.'
      ],
      btnLabel: 'Open Edge Privacy Settings →',
      onOpen: () => openSettings('edge://settings/privacy')
    })
  );
  panel.appendChild(setup);
}

export function renderOpsecGuides(wrap, { tool = '', onToolChange, onSectionBack }) {
  if (!tool) {
    paintCards(wrap, onToolChange, onSectionBack);
    return;
  }
  if (tool === 'dns') paintDns(wrap, onToolChange);
  else if (tool === 'dnt') paintDnt(wrap, onToolChange);
  else if (tool === 'cookies') paintCookies(wrap, onToolChange);
  else paintCards(wrap, onToolChange, onSectionBack);
}
