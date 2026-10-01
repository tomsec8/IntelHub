import { flashButton, createFileButton } from './utils.js';
import { mountOpsecExtraTool } from './opsecHub/mountExtraTool.js';
import { apiNote, fillToolCards, paintToolChrome } from './workspaceToolResults.js';

const TOOLS = [
  { id: 'pdf', name: 'PDF Metadata', blurb: 'Read title, author, dates, and other properties from a PDF.' },
  { id: 'office', name: 'Office Metadata', blurb: 'Read properties from Word, Excel, or PowerPoint files.' },
  { id: 'tracker', name: 'Document Tracker Remover', blurb: 'Strip canary pixels and remote trackers from PDF / Office / HTML.' },
  { id: 'sanitize', name: 'Metadata Remover', blurb: 'Strip EXIF and document metadata locally, or spoof fields. Covers images and office files.' },
  { id: 'hash', name: 'File Hash & Integrity', blurb: 'MD5 / SHA-1 / SHA-256 checksums, compare two files, open VirusTotal.' },
  { id: 'identify', name: 'Hash Identifier', blurb: 'Paste a hash and see which types it could be.' },
  { id: 'encrypt', name: 'Document Encryptor', blurb: 'AES-256-GCM encrypt or decrypt any file in the browser.' }
];

const HASH_PATTERNS = [
  { name: 'CRC16', regex: /^[a-fA-F0-9]{4}$/, desc: 'Cyclic Redundancy Check 16-bit' },
  { name: 'CRC32', regex: /^[a-fA-F0-9]{8}$/, desc: 'Cyclic Redundancy Check 32-bit' },
  { name: 'Adler-32', regex: /^[a-fA-F0-9]{8}$/, desc: 'Adler-32 checksum' },
  { name: 'MD4', regex: /^[a-fA-F0-9]{32}$/, desc: 'Message Digest 4 (128-bit)' },
  { name: 'MD5', regex: /^[a-fA-F0-9]{32}$/, desc: 'Message Digest 5 (128-bit)' },
  { name: 'NTLM', regex: /^[a-fA-F0-9]{32}$/, desc: 'NT LAN Manager hash' },
  { name: 'SHA-1', regex: /^[a-fA-F0-9]{40}$/, desc: 'Secure Hash Algorithm 1 (160-bit)' },
  { name: 'RIPEMD-160', regex: /^[a-fA-F0-9]{40}$/, desc: 'RACE Integrity Primitives (160-bit)' },
  { name: 'SHA-224', regex: /^[a-fA-F0-9]{56}$/, desc: 'Secure Hash Algorithm 224 (224-bit)' },
  { name: 'SHA-256', regex: /^[a-fA-F0-9]{64}$/, desc: 'Secure Hash Algorithm 256 (256-bit)' },
  { name: 'SHA-384', regex: /^[a-fA-F0-9]{96}$/, desc: 'Secure Hash Algorithm 384 (384-bit)' },
  { name: 'SHA-512', regex: /^[a-fA-F0-9]{128}$/, desc: 'Secure Hash Algorithm 512 (512-bit)' },
  { name: 'SHA-3-256', regex: /^[a-fA-F0-9]{64}$/, desc: 'SHA-3 (256-bit)' },
  { name: 'SHA-3-512', regex: /^[a-fA-F0-9]{128}$/, desc: 'SHA-3 (512-bit)' },
  { name: 'BLAKE2s-256', regex: /^[a-fA-F0-9]{64}$/, desc: 'BLAKE2s (256-bit)' },
  { name: 'BLAKE2b-512', regex: /^[a-fA-F0-9]{128}$/, desc: 'BLAKE2b (512-bit)' },
  { name: 'bcrypt', regex: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, desc: 'Blowfish-based password hash' },
  { name: 'scrypt', regex: /^\$s0\$/, desc: 'scrypt password hash' },
  { name: 'Argon2', regex: /^\$argon2(id|i|d)\$/, desc: 'Argon2 password hash' },
  { name: 'MySQL 4.1+', regex: /^\*[a-fA-F0-9]{40}$/, desc: 'MySQL SHA1 pass hash' },
  { name: 'Base64', regex: /^[A-Za-z0-9+/]+=*$/, desc: 'Base64 encoded (not a hash)' }
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function basicInfo(file) {
  return {
    'File Name': { value: file.name || 'unknown' },
    'File Size': { value: `${(file.size / 1024).toFixed(2)} KB` },
    'MIME Type': { value: file.type || 'unknown' },
    'Last Modified': { value: file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown' }
  };
}

function isPdf(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

function isOffice(file) {
  return /\.(docx|xlsx|pptx)$/i.test(file.name || '');
}

function bindDrop(zone, onFile, signal, acceptFn) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-drag');
  }, { signal });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'), { signal });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-drag');
    const file = event.dataTransfer?.files?.[0];
    if (file && (!acceptFn || acceptFn(file))) onFile(file);
  }, { signal });
}

function hiddenFileInput(onFile, accept, signal) {
  const input = el('input');
  input.type = 'file';
  if (accept) input.accept = accept;
  input.hidden = true;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) onFile(file);
  }, { signal });
  return input;
}

function toolChrome(wrap, title, onBack) {
  return paintToolChrome(wrap, title, { onBack });
}

function paintOpsecTool(wrap, title, panelId, onBack, apis) {
  const panel = toolChrome(wrap, title, onBack);
  panel.classList.add('opsec-tool-panel');
  mountOpsecExtraTool(panel, panelId)
    .then(() => {
      if (apis?.length) panel.prepend(apiNote(apis));
    })
    .catch((err) => {
      console.error('[OPSEC] tool mount failed:', err);
      panel.replaceChildren(el('p', 'ws-image-note', 'Could not open this tool. Reload the workspace and try again.'));
    });
}

function renderMetaTable(host, data) {
  host.replaceChildren();
  const table = el('table', 'ws-image-table');
  const lines = [];
  Object.entries(data).forEach(([key, item]) => {
    const row = table.insertRow();
    row.insertCell().textContent = key;
    const cell = row.insertCell();
    if (item?.value instanceof Date) cell.textContent = item.value.toLocaleString();
    else if (item?.value != null && item.value !== '') cell.textContent = String(item.value);
    else if (item?.error) {
      cell.textContent = 'Could not read field';
      cell.title = item.error;
    } else {
      cell.textContent = '';
    }
    lines.push(`${key}: ${cell.textContent}`);
  });
  host.appendChild(table);
  return lines.join('\n');
}

async function readPdfMeta(file) {
  const info = basicInfo(file);
  try {
    const buffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const field = (getter) => {
      try { return { value: getter() }; }
      catch (err) { return { value: null, error: err.message }; }
    };
    return {
      ...info,
      Title: field(() => pdfDoc.getTitle()),
      Author: field(() => pdfDoc.getAuthor()),
      Subject: field(() => pdfDoc.getSubject()),
      Keywords: field(() => pdfDoc.getKeywords()),
      Creator: field(() => pdfDoc.getCreator()),
      Producer: field(() => pdfDoc.getProducer()),
      'Creation Date': field(() => pdfDoc.getCreationDate()),
      'Modification Date': field(() => pdfDoc.getModificationDate())
    };
  } catch (err) {
    info.Status = { value: 'Could not read internal metadata (encrypted or invalid format)' };
    info.Error = { value: err.message || 'PDF parse failed' };
    return info;
  }
}

async function readOfficeMeta(file) {
  const info = basicInfo(file);
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const extra = {};
    for (const path of ['docProps/core.xml', 'docProps/app.xml']) {
      if (!zip.files[path]) continue;
      const xmlDoc = new DOMParser().parseFromString(await zip.files[path].async('string'), 'text/xml');
      for (const node of xmlDoc.documentElement.childNodes) {
        if (node.nodeType === 1) extra[node.nodeName] = { value: node.textContent };
      }
    }
    if (!Object.keys(extra).length) {
      info.Status = { value: 'No document properties found' };
      return info;
    }
    return { ...info, ...extra };
  } catch (err) {
    info.Status = { value: 'Could not read internal metadata (encrypted, corrupted, or legacy format)' };
    info.Error = { value: err.message || 'Office parse failed' };
    return info;
  }
}

function paintFileMeta(wrap, onToolChange, signal, options) {
  const panel = toolChrome(wrap, options.title, onToolChange);
  panel.appendChild(el('p', 'ws-image-note', options.note));

  const drop = el('div', 'ws-image-drop');
  const hint = el('p', 'ws-image-drop-hint', options.dropHint);
  const fileName = el('p', 'ws-image-file', '');
  const input = hiddenFileInput(handleFile, options.accept, signal);
  drop.append(hint, fileName, input);
  drop.addEventListener('click', () => input.click(), { signal });
  bindDrop(drop, handleFile, signal, options.acceptFn);

  const actions = el('div', 'ws-image-actions');
  const uploadBtn = createFileButton(options.uploadLabel);
  const copyBtn = el('button', 'ws-btn ws-btn-ghost', 'Copy metadata');
  copyBtn.type = 'button';
  copyBtn.hidden = true;
  uploadBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    input.click();
  });

  const tableWrap = el('div', 'ws-image-table-wrap');
  let lastText = '';

  async function handleFile(file) {
    if (!options.acceptFn(file)) {
      flashButton(uploadBtn, options.badType, true);
      return;
    }
    fileName.textContent = file.name;
    hint.hidden = true;
    const data = await options.read(file);
    lastText = `${options.title} for ${file.name}\n${renderMetaTable(tableWrap, data)}`;
    copyBtn.hidden = false;
  }

  copyBtn.addEventListener('click', async () => {
    if (!lastText) return;
    await navigator.clipboard.writeText(lastText);
    flashButton(copyBtn, 'Copied');
  });

  actions.append(uploadBtn, copyBtn);
  panel.append(drop, actions, tableWrap);
}

function identifyHash(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return HASH_PATTERNS.filter((pattern) => pattern.regex.test(trimmed));
}

function paintIdentify(wrap, onToolChange) {
  const panel = toolChrome(wrap, 'Hash Identifier', onToolChange);
  panel.appendChild(el('p', 'ws-image-note', 'This is a length and pattern guess. Several types can share the same shape.'));

  const input = el('input', 'ws-osint-search');
  input.type = 'text';
  input.placeholder = 'Paste a hash to identify…';
  const out = el('div', 'ws-id-list');

  input.addEventListener('input', () => {
    const value = input.value;
    out.replaceChildren();
    if (!value.trim()) return;
    const matches = identifyHash(value);
    if (!matches.length) {
      out.appendChild(el('p', 'ws-image-status is-bad', 'Unknown hash type'));
      return;
    }
    out.appendChild(el('p', 'ws-image-note', `Length: ${value.trim().length} chars · ${matches.length} possible type(s)`));
    matches.forEach((item) => {
      const row = el('div', 'ws-id-item');
      row.append(el('strong', '', item.name), el('span', '', item.desc));
      out.appendChild(row);
    });
  });

  panel.append(input, out);
}

function paintCards(wrap, onToolChange) {
  fillToolCards(wrap, TOOLS, onToolChange);
}

export function renderFileTools(wrap, { tool, onToolChange }) {
  wrap.dataset.osintReady = '';
  wrap._fileAbort?.abort();
  const ac = new AbortController();
  wrap._fileAbort = ac;

  if (tool === 'pdf') {
    paintFileMeta(wrap, onToolChange, ac.signal, {
      title: 'PDF Metadata',
      note: 'PDF properties are read locally. Nothing is uploaded.',
      dropHint: 'Drop a PDF here, or upload one.',
      uploadLabel: 'Choose PDF',
      accept: '.pdf,application/pdf',
      acceptFn: isPdf,
      badType: 'Need a PDF',
      read: readPdfMeta
    });
    return;
  }
  if (tool === 'office') {
    paintFileMeta(wrap, onToolChange, ac.signal, {
      title: 'Office Metadata',
      note: 'Document properties are read locally. Legacy .doc / .xls / .ppt files are not supported.',
      dropHint: 'Drop a .docx, .xlsx, or .pptx file here.',
      uploadLabel: 'Choose Office file',
      accept: '.docx,.xlsx,.pptx',
      acceptFn: isOffice,
      badType: 'Need Office file',
      read: readOfficeMeta
    });
    return;
  }
  if (tool === 'tracker') {
    paintOpsecTool(wrap, 'Document Tracker Remover', 'opt-tool-doc-tracker', onToolChange);
    return;
  }
  if (tool === 'sanitize') {
    paintOpsecTool(wrap, 'Metadata Remover', 'opt-tool-metadata', onToolChange);
    return;
  }
  if (tool === 'hash') {
    paintOpsecTool(wrap, 'File Hash & Integrity', 'opt-tool-file-hash', onToolChange);
    return;
  }
  if (tool === 'encrypt') {
    paintOpsecTool(wrap, 'Document Encryptor', 'opt-tool-doc-encryptor', onToolChange);
    return;
  }
  if (tool === 'identify') {
    paintIdentify(wrap, onToolChange);
    return;
  }
  paintCards(wrap, onToolChange);
}
