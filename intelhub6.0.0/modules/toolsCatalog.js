export const AWESOME_OSINT_URL = 'https://raw.githubusercontent.com/jivoi/awesome-osint/master/README.md';
export const AWESOME_OSINT_REPO = 'https://github.com/jivoi/awesome-osint';
export const TOOLS_SOURCE = 'awesome-osint';

const SKIP_HEADINGS = new Set([
  'table of contents',
  'contributing',
  'credits',
  'license',
  'related awesome lists'
]);

export function validateToolsData(data) {
  if (!data || typeof data !== 'object') return {};
  const validCategories = {};
  for (const [category, toolsArray] of Object.entries(data)) {
    if (!Array.isArray(toolsArray)) continue;
    validCategories[category] = toolsArray.filter((tool) => {
      if (!tool || typeof tool !== 'object') return false;
      if (typeof tool.name !== 'string' || !tool.name.trim()) return false;
      if (typeof tool.url !== 'string') return false;
      try {
        if (new URL(tool.url).protocol !== 'https:') return false;
      } catch {
        return false;
      }
      if (tool.description && typeof tool.description !== 'string') return false;
      return true;
    });
    if (validCategories[category].length === 0) delete validCategories[category];
  }
  return validCategories;
}

function cleanHeading(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim();
}

export function parseAwesomeOsint(markdown) {
  const categories = {};
  let current = null;
  const headingRe = /^(#{2,3})\s+(?:\[↑\]\([^)]+\)\s*)?(.+?)\s*$/;
  const itemRe = /^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(?:\s*[-—–:]\s*(.+))?/;

  for (const line of String(markdown || '').split(/\r?\n/)) {
    const heading = line.match(headingRe);
    if (heading) {
      const title = cleanHeading(heading[2]);
      if (!title || SKIP_HEADINGS.has(title.toLowerCase())) {
        current = null;
        continue;
      }
      current = title;
      if (!categories[current]) categories[current] = [];
      continue;
    }
    if (!current) continue;

    const item = line.match(itemRe);
    if (!item) continue;
    const name = item[1].trim();
    const description = (item[3] || '').replace(/\s+/g, ' ').trim();
    let url = item[2].trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') continue;
      url = parsed.href;
    } catch {
      continue;
    }
    if (!name) continue;
    if (categories[current].some((tool) => tool.url === url)) continue;
    categories[current].push({ name, url, description });
  }

  return validateToolsData(categories);
}

export async function fetchAwesomeOsintTools() {
  const response = await fetch(AWESOME_OSINT_URL);
  if (!response.ok) throw new Error('Failed to fetch awesome-osint');
  return parseAwesomeOsint(await response.text());
}

export function loadToolsData({ force = false } = {}) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['toolsData', 'toolsSource', 'lastUpdated'], (result) => {
      const fresh = result.toolsSource === TOOLS_SOURCE && result.toolsData && !force;
      if (fresh) {
        resolve(result.toolsData);
        return;
      }
      fetchAwesomeOsintTools()
        .then((tools) => {
          chrome.storage.local.set({
            toolsData: tools,
            toolsSource: TOOLS_SOURCE,
            lastUpdated: Date.now()
          });
          resolve(tools);
        })
          .catch(() => resolve(result.toolsData || null));
    });
  });
}
