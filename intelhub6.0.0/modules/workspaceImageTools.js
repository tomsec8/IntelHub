import { brw, flashButton, createFileButton } from './utils.js';
import { apiNote, fillToolCards, API_SOURCES, paintToolChrome } from './workspaceToolResults.js';

const IMAGE_ENGINES = [
  { name: 'Google', requiresUpload: true, url: (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img)}` },
  { name: 'Yandex', requiresUpload: true, url: (img) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(img)}` },
  { name: 'TinEye', requiresUpload: true, url: (img) => `https://tineye.com/search/?url=${encodeURIComponent(img)}` },
  { name: 'Bing', requiresUpload: true, url: (img) => `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(img)}&view=detailv2&iss=sbi` },
  { name: 'Lenso.ai (manual)', requiresUpload: false, url: () => 'https://lenso.ai/en' }
];

const SKIP_EXIF = new Set(['Thumbnail', 'Images', 'MakerNote']);

const TOOLS = [
  {
    id: 'reverse',
    name: 'Reverse Image Search',
    blurb: 'Paste or upload a picture and search it on several engines.',
    api: [API_SOURCES.catbox, API_SOURCES.imageEngines]
  },
  { id: 'faces', name: 'Face Comparison', blurb: 'Upload two photos and check if the faces match.' },
  { id: 'meta', name: 'Image Metadata', blurb: 'Read EXIF, GPS, and file details from a picture. Stays on this device.' }
];

let faceModelsReady = false;
let faceModelsTask = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function fileFromBlob(blob, name = 'pasted-image.png') {
  const type = blob.type || 'image/png';
  const ext = type.split('/')[1] || 'png';
  const safeName = name.includes('.') ? name : `pasted-image.${ext}`;
  return new File([blob], safeName, { type });
}

async function readClipboardImage() {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((itemType) => itemType.startsWith('image/'));
    if (!type) continue;
    return fileFromBlob(await item.getType(type));
  }
  return null;
}

function bindDrop(zone, onFile, signal) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-drag');
  }, { signal });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-drag'), { signal });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-drag');
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) onFile(file);
  }, { signal });
}

function hiddenFileInput(onFile, signal) {
  const input = el('input');
  input.type = 'file';
  input.accept = 'image/*';
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

function setPreview(img, file) {
  if (img._url) URL.revokeObjectURL(img._url);
  img._url = URL.createObjectURL(file);
  img.src = img._url;
  img.hidden = false;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function openReverseEngines(imgUrl, btn) {
  const stored = await brw.storage.local.get({ reverseEngines: [] });
  const selected = IMAGE_ENGINES.filter((engine) => stored.reverseEngines.includes(engine.name));
  if (!selected.length) {
    flashButton(btn, 'Select an engine', true);
    return;
  }
  selected.forEach((engine) => {
    const url = engine.url(imgUrl);
    if (url) brw.tabs.create({ url, active: false });
  });
  flashButton(btn, 'Opened searches');
}

async function runReverseSearch({ file, imageUrl }, btn) {
  const publicUrl = isHttpUrl(imageUrl) ? imageUrl.trim() : '';
  if (publicUrl) {
    await openReverseEngines(publicUrl, btn);
    return;
  }
  if (!file) {
    flashButton(btn, 'Add an image or URL', true);
    return;
  }

  const stored = await brw.storage.local.get({
    reverseEngines: [],
    privacyConsentReverseImage: false
  });
  if (!stored.privacyConsentReverseImage) {
    flashButton(btn, 'Accept privacy terms', true);
    return;
  }
  const selected = IMAGE_ENGINES.filter((engine) => stored.reverseEngines.includes(engine.name));
  if (!selected.length) {
    flashButton(btn, 'Select an engine', true);
    return;
  }

  let imgUrl = '';
  const needsUpload = selected.some((engine) => engine.requiresUpload);
  if (needsUpload) {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);
    try {
      const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: formData });
      imgUrl = await res.text();
      if (!imgUrl.startsWith('http')) {
        flashButton(btn, 'Upload failed', true);
        return;
      }
    } catch {
      flashButton(btn, 'Upload error', true);
      return;
    }
  }

  await openReverseEngines(imgUrl, btn);
}

function paintReverse(wrap, onToolChange, signal) {
  const panel = toolChrome(wrap, 'Reverse Image Search', onToolChange);
  panel.appendChild(apiNote([API_SOURCES.catbox, API_SOURCES.imageEngines]));
  let currentFile = null;
  panel.appendChild(el(
    'p',
    'ws-image-note',
    'If the picture already has a public URL, paste it below — engines search that link and nothing is uploaded. A file from this device is not a proxy hop: it is posted to catbox.moe (a public host) so those engines can fetch it. Catbox can see the file and usually your IP. The link is public, we cannot reliably delete it, and it may stay on their servers. Google, Yandex, Bing, and TinEye then see it too. Do not upload sensitive photos.'
  ));

  const urlRow = el('div', 'ws-people-row');
  const urlInput = el('input', 'ws-osint-search');
  urlInput.type = 'url';
  urlInput.placeholder = 'https://example.com/photo.jpg';
  const urlBtn = el('button', 'ws-btn', 'Search URL');
  urlBtn.type = 'button';
  urlRow.append(urlInput, urlBtn);

  const drop = el('div', 'ws-image-drop');
  const hint = el('p', 'ws-image-drop-hint', 'Drop an image here, or upload / paste one.');
  const preview = el('img', 'ws-image-preview');
  preview.alt = '';
  preview.hidden = true;
  const fileName = el('p', 'ws-image-file', '');
  drop.append(hint, preview, fileName);

  const input = hiddenFileInput((file) => {
    currentFile = file;
    setPreview(preview, file);
    hint.hidden = true;
    fileName.textContent = file.name;
  }, signal);
  drop.appendChild(input);
  drop.addEventListener('click', () => input.click(), { signal });
  bindDrop(drop, (file) => {
    currentFile = file;
    setPreview(preview, file);
    hint.hidden = true;
    fileName.textContent = file.name;
  }, signal);

  const actions = el('div', 'ws-image-actions');
  const uploadBtn = createFileButton('Choose image');
  uploadBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    input.click();
  });
  const pasteBtn = el('button', 'ws-btn ws-btn-ghost', 'Paste image');
  pasteBtn.type = 'button';
  pasteBtn.addEventListener('click', async () => {
    try {
      const file = await readClipboardImage();
      if (!file) {
        flashButton(pasteBtn, 'No image', true);
        return;
      }
      currentFile = file;
      setPreview(preview, file);
      hint.hidden = true;
      fileName.textContent = file.name;
    } catch {
      flashButton(pasteBtn, 'Paste failed', true);
    }
  });
  const searchBtn = el('button', 'ws-btn', 'Search image');
  searchBtn.type = 'button';
  searchBtn.addEventListener('click', async () => {
    searchBtn.disabled = true;
    try {
      await runReverseSearch({ file: currentFile, imageUrl: urlInput.value }, searchBtn);
    } finally {
      searchBtn.disabled = false;
    }
  });
  urlBtn.addEventListener('click', async () => {
    if (!isHttpUrl(urlInput.value)) {
      flashButton(urlBtn, 'Need a URL', true);
      return;
    }
    urlBtn.disabled = true;
    try {
      await runReverseSearch({ imageUrl: urlInput.value }, urlBtn);
    } finally {
      urlBtn.disabled = false;
    }
  });
  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') urlBtn.click();
  });
  actions.append(uploadBtn, pasteBtn, searchBtn);

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
      ? 'Upload terms accepted. Local files go to catbox.moe (a public host, not a proxy). A public image URL skips the upload. <span class="ws-image-consent-edit">Change</span>'
      : '<b>Upload terms:</b> A file from this device is posted to catbox.moe so search engines can fetch it by URL. That is a public host, not a proxy. Catbox can see the file and usually your IP. The link is public, we cannot reliably delete it, and it may remain after the search. Do not upload sensitive or personal photos. A public URL does not need this checkbox.';
  }

  brw.storage.local.get({ privacyConsentReverseImage: false }, (data) => {
    paintConsent(!!data.privacyConsentReverseImage);
  });
  consentBox.addEventListener('change', () => {
    brw.storage.local.set({ privacyConsentReverseImage: consentBox.checked });
    paintConsent(consentBox.checked);
  });
  consent.addEventListener('click', (event) => {
    if (!event.target.closest('.ws-image-consent-edit')) return;
    event.preventDefault();
    event.stopPropagation();
    consentBox.checked = false;
    brw.storage.local.set({ privacyConsentReverseImage: false });
    paintConsent(false);
  });

  const engines = el('div', 'ws-image-engines');
  const enginesTitle = el('strong', '', 'Search engines');
  const engineList = el('div', 'ws-image-engine-list');
  engines.append(enginesTitle, engineList);

  brw.storage.local.get({ reverseEngines: [] }, (data) => {
    const saved = data.reverseEngines || [];
    IMAGE_ENGINES.forEach((engine) => {
      const label = el('label', 'ws-image-engine');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = saved.includes(engine.name);
      box.addEventListener('change', () => {
        const selected = [...engineList.querySelectorAll('input:checked')].map((item) => item.dataset.engine);
        brw.storage.local.set({ reverseEngines: selected });
      });
      box.dataset.engine = engine.name;
      label.append(box, document.createTextNode(engine.name));
      engineList.appendChild(label);
    });
  });

  document.addEventListener('paste', async (event) => {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const blob = item.getAsFile();
    if (!blob) return;
    event.preventDefault();
    currentFile = fileFromBlob(blob);
    setPreview(preview, currentFile);
    hint.hidden = true;
    fileName.textContent = currentFile.name;
  }, { signal });

  panel.append(urlRow, drop, actions, consent, engines);
}

async function ensureFaceModels(status) {
  if (faceModelsReady) {
    status.textContent = 'Models loaded.';
    status.className = 'ws-image-status is-ok';
    return true;
  }
  if (typeof faceapi === 'undefined') {
    status.textContent = 'Face models are not available.';
    status.className = 'ws-image-status is-bad';
    return false;
  }
  if (!faceModelsTask) {
    faceModelsTask = (async () => {
      const path = './libs/face_libs';
      await faceapi.nets.tinyFaceDetector.loadFromUri(path);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(path);
      await faceapi.nets.faceRecognitionNet.loadFromUri(path);
      faceModelsReady = true;
    })();
  }
  status.textContent = 'Loading face detection models…';
  status.className = 'ws-image-status';
  try {
    await faceModelsTask;
    status.textContent = 'Models loaded.';
    status.className = 'ws-image-status is-ok';
    return true;
  } catch (err) {
    console.error(err);
    faceModelsTask = null;
    status.textContent = 'Failed to load models.';
    status.className = 'ws-image-status is-bad';
    return false;
  }
}

function drawFaces(canvas, img, detections, selectedIdx = 0) {
  const max = 220;
  const scale = Math.min(max / img.width, max / img.height, 1);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  detections.forEach((det, index) => {
    const box = det.detection.box;
    ctx.strokeStyle = index === selectedIdx ? '#34d399' : '#f87171';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`#${index + 1}`, box.x * scale + 3, box.y * scale - 4);
  });
}

async function detectFaces(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const detections = await faceapi
    .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptors();
  URL.revokeObjectURL(url);
  return { img, detections };
}

function paintFaces(wrap, onToolChange, signal) {
  const panel = toolChrome(wrap, 'Face Comparison', onToolChange);
  const status = el('p', 'ws-image-status', 'Models load on first use.');
  const row = el('div', 'ws-image-slots');
  const picks = { A: null, B: null };
  const images = { A: null, B: null };

  function makeSlot(side) {
    const slot = el('div', 'ws-image-slot');
    const label = el('strong', '', side === 'A' ? 'Image A' : 'Image B');
    const canvas = el('canvas', 'ws-image-face-canvas');
    canvas.hidden = true;
    const empty = el('span', 'ws-image-drop-hint', 'Click, drop, or paste');
    const info = el('p', 'ws-image-file', '');
    const select = el('div', 'ws-image-face-picks');
    const input = hiddenFileInput((file) => handleSlot(side, file), signal);
    slot.append(label, canvas, empty, info, select, input);
    slot.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      input.click();
    });
    bindDrop(slot, (file) => handleSlot(side, file), signal);
    return { slot, canvas, empty, info, select, input };
  }

  const slotA = makeSlot('A');
  const slotB = makeSlot('B');
  row.append(slotA.slot, slotB.slot);
  const slots = { A: slotA, B: slotB };

  async function handleSlot(side, file) {
    const slot = slots[side];
    if (!(await ensureFaceModels(status))) return;
    slot.empty.textContent = 'Detecting…';
    slot.empty.hidden = false;
    slot.canvas.hidden = true;
    slot.info.textContent = '';
    slot.select.replaceChildren();
    try {
      const { img, detections } = await detectFaces(file);
      images[side] = img;
      if (!detections.length) {
        picks[side] = null;
        slot.empty.textContent = 'No face found';
        return;
      }
      picks[side] = detections[0].descriptor;
      slot.empty.hidden = true;
      slot.canvas.hidden = false;
      drawFaces(slot.canvas, img, detections, 0);
      slot.info.textContent = detections.length === 1
        ? '1 face detected'
        : `${detections.length} faces — Face #1 selected`;
      if (detections.length > 1) {
        detections.forEach((det, index) => {
          const btn = el('button', 'ws-btn ws-btn-ghost', `Face #${index + 1}`);
          btn.type = 'button';
          btn.addEventListener('click', (event) => {
            event.stopPropagation();
            picks[side] = det.descriptor;
            drawFaces(slot.canvas, img, detections, index);
            slot.info.textContent = `${detections.length} faces — Face #${index + 1} selected`;
            slot.select.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'));
            btn.classList.add('is-active');
          });
          if (index === 0) btn.classList.add('is-active');
          slot.select.appendChild(btn);
        });
      }
    } catch (err) {
      console.error(err);
      picks[side] = null;
      slot.empty.textContent = 'Could not read this image';
    }
  }

  const actions = el('div', 'ws-image-actions');
  const pasteA = el('button', 'ws-btn ws-btn-ghost', 'Paste into A');
  const pasteB = el('button', 'ws-btn ws-btn-ghost', 'Paste into B');
  const compareBtn = el('button', 'ws-btn', 'Compare faces');
  pasteA.type = pasteB.type = compareBtn.type = 'button';
  async function pasteInto(side, btn) {
    try {
      const file = await readClipboardImage();
      if (!file) {
        flashButton(btn, 'No image', true);
        return;
      }
      await handleSlot(side, file);
    } catch {
      flashButton(btn, 'Paste failed', true);
    }
  }
  pasteA.addEventListener('click', () => pasteInto('A', pasteA));
  pasteB.addEventListener('click', () => pasteInto('B', pasteB));

  const result = el('div', 'ws-image-result');
  result.hidden = true;

  compareBtn.addEventListener('click', () => {
    if (!picks.A || !picks.B) {
      flashButton(compareBtn, 'Need two faces', true);
      return;
    }
    const distance = faceapi.euclideanDistance(picks.A, picks.B);
    const similarity = Math.max(0, Math.min(100, Number(((1 - distance) * 100).toFixed(1))));
    const isMatch = distance < 0.6;
    result.hidden = false;
    result.className = `ws-image-result ${isMatch ? 'is-match' : 'is-nomatch'}`;
    result.replaceChildren();
    result.append(
      el('strong', '', isMatch ? 'Match — same person' : 'No match — different people'),
      el('p', '', `Similarity ${similarity}% · Distance ${distance.toFixed(4)}`)
    );
    const bar = el('div', 'ws-image-bar-track');
    const fill = el('div', 'ws-image-bar-fill');
    fill.style.width = `${similarity}%`;
    bar.appendChild(fill);
    const copyBtn = el('button', 'ws-btn ws-btn-ghost', 'Copy result');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', async () => {
      const text = `Face Comparison Result\nMatch: ${isMatch ? 'YES' : 'NO'}\nSimilarity: ${similarity}%\nDistance: ${distance.toFixed(4)}`;
      await navigator.clipboard.writeText(text);
      flashButton(copyBtn, 'Copied');
    });
    result.append(bar, copyBtn);
  });

  document.addEventListener('paste', async (event) => {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const blob = item.getAsFile();
    if (!blob) return;
    event.preventDefault();
    await handleSlot(picks.A ? 'B' : 'A', fileFromBlob(blob));
  }, { signal });

  actions.append(pasteA, pasteB, compareBtn);
  panel.append(status, row, actions, result);
}

function parseGps(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const decimal = Number(text);
  if (Number.isFinite(decimal) && Math.abs(decimal) <= 180) return decimal;
  const match = text.match(/(-?\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)(?:\D+(\d+(?:\.\d+)?))?/);
  if (!match) return null;
  const deg = Number(match[1]);
  const min = Number(match[2] || 0);
  const sec = Number(match[3] || 0);
  if (![deg, min, sec].every(Number.isFinite)) return null;
  const sign = deg < 0 || /[SW]$/i.test(text) ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

async function readImageMeta(file) {
  const basic = {
    'File Name': { value: file.name || 'pasted-image' },
    'File Size': { value: `${(file.size / 1024).toFixed(2)} KB` },
    'MIME Type': { value: file.type || 'unknown' },
    'Last Modified': { value: file.lastModified ? new Date(file.lastModified).toLocaleString() : 'Unknown' }
  };
  try {
    const buffer = await file.arrayBuffer();
    if (typeof ExifReader === 'undefined') return basic;
    const tags = ExifReader.load(buffer);
    const extra = {};
    Object.entries(tags).forEach(([key, tag]) => {
      if (SKIP_EXIF.has(key)) return;
      const value = typeof tag?.description === 'string' ? tag.description.trim() : '';
      if (!value) return;
      extra[key] = { value };
    });
    return { ...basic, ...extra };
  } catch (err) {
    basic.Error = { value: err.message || 'Could not read EXIF data.' };
    return basic;
  }
}

function paintMeta(wrap, onToolChange, signal) {
  const panel = toolChrome(wrap, 'Image Metadata', onToolChange);
  const note = el('p', 'ws-image-note', 'EXIF is read locally. To strip metadata, use Files → Metadata Remover.');
  const drop = el('div', 'ws-image-drop');
  const hint = el('p', 'ws-image-drop-hint', 'Drop an image here, or upload / paste one.');
  const preview = el('img', 'ws-image-preview');
  preview.alt = '';
  preview.hidden = true;
  const fileName = el('p', 'ws-image-file', '');
  const input = hiddenFileInput((file) => showMeta(file), signal);
  drop.append(hint, preview, fileName, input);
  drop.addEventListener('click', () => input.click(), { signal });
  bindDrop(drop, showMeta, signal);

  const actions = el('div', 'ws-image-actions');
  const uploadBtn = createFileButton('Choose image');
  const pasteBtn = el('button', 'ws-btn ws-btn-ghost', 'Paste image');
  const copyBtn = el('button', 'ws-btn ws-btn-ghost', 'Copy metadata');
  pasteBtn.type = copyBtn.type = 'button';
  copyBtn.hidden = true;
  uploadBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    input.click();
  });
  pasteBtn.addEventListener('click', async () => {
    try {
      const file = await readClipboardImage();
      if (!file) {
        flashButton(pasteBtn, 'No image', true);
        return;
      }
      await showMeta(file);
    } catch {
      flashButton(pasteBtn, 'Paste failed', true);
    }
  });

  const tableWrap = el('div', 'ws-image-table-wrap');
  let lastText = '';

  async function showMeta(file) {
    setPreview(preview, file);
    hint.hidden = true;
    fileName.textContent = file.name;
    const data = await readImageMeta(file);
    tableWrap.replaceChildren();
    const table = el('table', 'ws-image-table');
    const rows = [];
    Object.entries(data).forEach(([key, item]) => {
      const row = table.insertRow();
      row.insertCell().textContent = key;
      const cell = row.insertCell();
      const value = item?.value;
      cell.textContent = value instanceof Date ? value.toLocaleString() : (value ?? '');
      rows.push(`${key}: ${cell.textContent}`);
    });
    let lat = parseGps(data.GPSLatitude?.value);
    let lng = parseGps(data.GPSLongitude?.value);
    if (lat != null && /S/i.test(String(data.GPSLatitudeRef?.value || ''))) lat = -Math.abs(lat);
    if (lng != null && /W/i.test(String(data.GPSLongitudeRef?.value || ''))) lng = -Math.abs(lng);
    if (lat != null && lng != null) {
      const maps = el('a', 'ws-image-maps', 'Open GPS in Google Maps');
      maps.href = `https://www.google.com/maps?q=${lat},${lng}`;
      maps.target = '_blank';
      maps.rel = 'noopener';
      tableWrap.append(table, maps);
    } else {
      tableWrap.appendChild(table);
    }
    lastText = `Image metadata for ${file.name}\n${rows.join('\n')}`;
    copyBtn.hidden = false;
  }

  copyBtn.addEventListener('click', async () => {
    if (!lastText) return;
    await navigator.clipboard.writeText(lastText);
    flashButton(copyBtn, 'Copied');
  });

  document.addEventListener('paste', async (event) => {
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'));
    if (!item) return;
    const blob = item.getAsFile();
    if (!blob) return;
    event.preventDefault();
    await showMeta(fileFromBlob(blob));
  }, { signal });

  actions.append(uploadBtn, pasteBtn, copyBtn);
  panel.append(note, drop, actions, tableWrap);
}

function paintCards(wrap, onToolChange) {
  fillToolCards(wrap, TOOLS, onToolChange);
}

export function renderImageTools(wrap, { tool, onToolChange }) {
  wrap.dataset.osintReady = '';
  wrap._imageAbort?.abort();
  const ac = new AbortController();
  wrap._imageAbort = ac;
  if (tool === 'reverse') paintReverse(wrap, onToolChange, ac.signal);
  else if (tool === 'faces') paintFaces(wrap, onToolChange, ac.signal);
  else if (tool === 'meta') paintMeta(wrap, onToolChange, ac.signal);
  else paintCards(wrap, onToolChange);
}
