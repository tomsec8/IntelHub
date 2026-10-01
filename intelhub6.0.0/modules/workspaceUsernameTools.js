import { brw, flashButton } from './utils.js';
import { ensureUsernameScanPermission, searchUsername } from './usernameSearch.js';
import { getToolResult, setToolResult, apiNote, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function addHit(list, hit) {
  const card = el('div', 'ws-people-hit');
  const info = el('div');
  const label = hit.category ? `${hit.name} · ${hit.category}` : hit.name;
  info.append(el('strong', '', label), el('span', '', hit.details));
  const link = el('a', 'ws-btn ws-btn-ghost', 'Open');
  link.href = hit.url;
  link.target = '_blank';
  link.rel = 'noopener';
  card.append(info, link);
  list.appendChild(card);
}

export function renderUsernameTools(wrap, { query, onQueryChange }) {
  wrap.dataset.osintReady = '';
  wrap._peopleAbort?.abort();
  const ac = new AbortController();
  wrap._peopleAbort = ac;

  const panel = paintToolChrome(wrap, 'Username Search', { resultId: 'username' });
  panel.appendChild(apiNote([API_SOURCES.usernameHttp]));
  const note = el('p', 'ws-image-note');
  note.append(
    document.createTextNode('Check a handle across 150+ sites. Only verified hits are shown. Extra checks ported from ')
  );
  const credit = el('a', '', 'user-scanner');
  credit.href = 'https://github.com/kaifcodec/user-scanner';
  credit.target = '_blank';
  credit.rel = 'noopener';
  note.append(credit, document.createTextNode('. Hard platforms keep the existing IntelHub checks.'));
  panel.appendChild(note);

  const consent = el('div', 'ws-image-consent');
  const consentLabel = el('label', 'ws-image-consent-label');
  const consentBox = el('input');
  consentBox.type = 'checkbox';
  const consentText = el('span');
  consentLabel.append(consentBox, consentText);
  consent.appendChild(consentLabel);

  function paintConsent(accepted) {
    consent.classList.toggle('is-ok', accepted);
    consentBox.checked = accepted;
    consentBox.hidden = accepted;
    consentText.innerHTML = accepted
      ? 'Full site access accepted. This search needs permission to reach the platforms it checks. <span class="ws-image-consent-edit">Change</span>'
      : '<b>Full access required:</b> Username search checks 150+ sites. Chrome will ask for permission to access all websites so those lookups can run in the extension. Results stay on this device.';
  }

  brw.storage.local.get({ privacyConsentUsername: false }, (data) => {
    paintConsent(!!data.privacyConsentUsername);
  });
  consentBox.addEventListener('change', () => {
    brw.storage.local.set({ privacyConsentUsername: consentBox.checked });
    paintConsent(consentBox.checked);
  });
  consent.addEventListener('click', (event) => {
    if (!event.target.closest('.ws-image-consent-edit')) return;
    event.preventDefault();
    event.stopPropagation();
    consentBox.checked = false;
    brw.storage.local.set({ privacyConsentUsername: false });
    paintConsent(false);
  });

  const row = el('div', 'ws-people-row');
  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'Enter username (e.g. zuck)';
  input.value = query || '';
  input.addEventListener('input', () => onQueryChange(input.value));

  const searchBtn = el('button', 'ws-btn', 'Search');
  searchBtn.type = 'button';
  row.append(input, searchBtn);

  const status = el('p', 'ws-image-status', '');
  const track = el('div', 'ws-image-bar-track');
  const fill = el('div', 'ws-image-bar-fill');
  track.hidden = true;
  track.appendChild(fill);
  const list = el('div', 'ws-people-hits');

  async function runSearch() {
    if (!consentBox.checked) {
      flashButton(searchBtn, 'Accept access terms', true);
      return;
    }
    const username = input.value.trim();
    if (!username) {
      flashButton(searchBtn, 'Enter a username', true);
      return;
    }
    searchBtn.disabled = true;
    list.replaceChildren();
    track.hidden = false;
    fill.style.width = '0%';
    status.textContent = 'Starting…';
    status.className = 'ws-image-status';
    try {
      const granted = await ensureUsernameScanPermission();
      if (!granted) {
        status.textContent = 'Permission denied.';
        status.className = 'ws-image-status is-bad';
        return;
      }
      const found = await searchUsername(username, {
        signal: ac.signal,
        onProgress({ site, index, total }) {
          status.textContent = `Checking ${site}…`;
          fill.style.width = `${((index + 1) / total) * 100}%`;
        },
        onHit(hit) { addHit(list, hit); }
      });
      if (ac.signal.aborted) return;
      status.textContent = found.length
        ? `Found ${found.length} profile${found.length === 1 ? '' : 's'}.`
        : 'No verified profiles found.';
      status.className = found.length ? 'ws-image-status is-ok' : 'ws-image-status';
      setToolResult('username', {
        query: username,
        hits: found,
        status: status.textContent,
        statusClass: status.className
      });
    } catch (err) {
      if (ac.signal.aborted) return;
      console.error(err);
      status.textContent = 'Search failed.';
      status.className = 'ws-image-status is-bad';
    } finally {
      if (!ac.signal.aborted) searchBtn.disabled = false;
    }
  }

  searchBtn.addEventListener('click', runSearch);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });

  panel.append(consent, row, status, track, list);

  const saved = getToolResult('username');
  if (saved?.hits?.length || saved?.status) {
    if (saved.query && !input.value) input.value = saved.query;
    (saved.hits || []).forEach((hit) => addHit(list, hit));
    status.textContent = saved.status || '';
    status.className = saved.statusClass || 'ws-image-status';
  }
}
