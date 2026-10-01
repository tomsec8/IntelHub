export function accountForSite(site, username) {
  let account = site.lowercase ? username.toLowerCase() : username;
  if (site.handle_suffix && !account.includes('.')) {
    account += site.handle_suffix;
  }
  return account;
}

export function fillTemplate(template, account) {
  return template ? template.replaceAll('{account}', account) : '';
}

function readJsonPath(data, path) {
  if (!path) return data;
  let current = data;
  for (const key of path.split('.')) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function isJsonHit(data) {
  if (data === null || data === undefined) return false;
  if (typeof data === 'object') return !Array.isArray(data) || data.length > 0;
  return data !== false && data !== '';
}

export async function checkUsernameSite(site, username, signal) {
  const account = accountForSite(site, username);
  const url = fillTemplate(site.uri, account);
  const profileUrl = fillTemplate(site.display_uri, account) || url;
  try {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const id = setTimeout(() => controller.abort(), 7000);
    const wantsJson = ['json_check', 'json_ok', 'json_array', 'json_path'].includes(site.check_type);
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          Accept: wantsJson ? 'application/json, text/plain, */*' : 'text/html'
        }
      });
    } finally {
      clearTimeout(id);
      signal?.removeEventListener('abort', onAbort);
    }

    if (site.check_type === 'status_ok') {
      if (response.status === 200) {
        return { exists: true, url: profileUrl, details: 'Verified (HTTP 200)' };
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'status_and_content') {
      if (response.status === 200) {
        const text = await response.text();
        const checkString = fillTemplate(site.valid_text, account);
        if (text.toLowerCase().includes(checkString.toLowerCase())) {
          return { exists: true, url: profileUrl, details: 'Verified (Status+Content)' };
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'missing_text') {
      if (response.status === 200) {
        const text = await response.text();
        const checkString = fillTemplate(site.valid_text, account);
        if (!text.toLowerCase().includes(checkString.toLowerCase())) {
          return { exists: true, url: profileUrl, details: 'Verified (Page present)' };
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'header_check') {
      if (response.headers.has(site.valid_header)) {
        return { exists: true, url: profileUrl, details: `Header: ${site.valid_header}` };
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'json_check') {
      if (response.status === 200) {
        try {
          const current = readJsonPath(await response.json(), site.valid_json_path);
          if (current === site.valid_json_value) {
            return { exists: true, url: profileUrl, details: 'Verified (API)' };
          }
        } catch {
          /* ignore */
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'json_ok') {
      if (response.status === 200) {
        try {
          if (isJsonHit(await response.json())) {
            return { exists: true, url: profileUrl, details: 'Verified (API)' };
          }
        } catch {
          /* ignore */
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'json_array') {
      if (response.status === 200) {
        try {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0 && data[0]) {
            return { exists: true, url: profileUrl, details: 'Verified (API)' };
          }
        } catch {
          /* ignore */
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'json_path') {
      if (response.status === 200) {
        try {
          if (isJsonHit(readJsonPath(await response.json(), site.valid_json_path))) {
            return { exists: true, url: profileUrl, details: 'Verified (API)' };
          }
        } catch {
          /* ignore */
        }
      }
      return { exists: false, url: profileUrl };
    }

    if (site.check_type === 'url_match') {
      if (response.status === 200 && response.url.includes(site.valid_match)) {
        return { exists: true, url: response.url, details: 'Verified (URL Match)' };
      }
      return { exists: false, url: profileUrl };
    }
  } catch {
    /* timeout, abort, or network */
  }
  return { exists: false, url: profileUrl };
}
