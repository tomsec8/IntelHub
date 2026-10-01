import { brw } from '../utils.js';

/** OPSEC extra-tool panels that can be mounted inside Files / Image / Web. */
export const OPSEC_EXTRA_TOOLS = {
  'opt-tool-doc-tracker': { script: 'documentTracker', init: 'initDocumentTrackerTool' },
  'opt-tool-metadata': { script: 'metadataRemover', init: 'initMetadataRemoverTool' },
  'opt-tool-file-hash': { script: 'fileHash', init: 'initFileHashTool' },
  'opt-tool-doc-encryptor': { script: 'docEncryptor', init: 'initDocEncryptorTool' },
  'opt-tool-link-tracer': { script: 'linkTracer', init: 'initLinkTracerTool' },
  'opt-tool-virustotal': { script: 'virusTotal', init: 'initVirusTotalTool' },
  'opt-tool-ssl-checker': { script: 'sslChecker', init: 'initSslCheckerTool' },
  'opt-tool-header-analyzer': { script: 'headerAnalyzer', init: 'initHeaderAnalyzerTool' },
  'opt-tool-doh-checker': { script: 'dohChecker', init: 'initDohCheckerTool' }
};

const loadedScripts = new Set();
let panelsDoc = null;

function loadScript(path) {
  if (loadedScripts.has(path)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = brw.runtime.getURL(path);
    script.onload = () => {
      loadedScripts.add(path);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.head.appendChild(script);
  });
}

async function ensurePanels() {
  if (panelsDoc) return panelsDoc;
  const res = await fetch(brw.runtime.getURL('modules/opsecHub/extraTools/panels.html'));
  const html = await res.text();
  panelsDoc = new DOMParser().parseFromString(html, 'text/html');
  return panelsDoc;
}

/**
 * Clone an OPSEC tool panel into `host` and run its init.
 * `host` should already be the workspace panel element (with class opsec-tool-panel).
 */
export async function mountOpsecExtraTool(host, panelId) {
  const meta = OPSEC_EXTRA_TOOLS[panelId];
  if (!meta) throw new Error(`Unknown OPSEC tool: ${panelId}`);

  host.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'ws-image-note';
  loading.textContent = 'Loading…';
  host.appendChild(loading);

  globalThis.brw = brw;
  const doc = await ensurePanels();
  const source = doc.getElementById(`panel-${panelId}`);
  if (!source) throw new Error(`Panel missing: ${panelId}`);

  host.replaceChildren();
  Array.from(source.cloneNode(true).childNodes).forEach((node) => host.appendChild(node));

  await loadScript(`modules/opsecHub/extraTools/${meta.script}/index.js`);
  const init = globalThis[meta.init];
  if (typeof init === 'function') init();
}
