// modules/reverseImageSearch.js

import { brw, isFirefox, flashButton, createSection, saveViewState, resetViewState } from './utils.js';

function openUploadPage() {
    brw.tabs.create({ url: 'firefox/reverse-image-upload.html' });
    window.close();
}

async function handleReverseSearch(fileOrBlob, btnElement = null) {
    const consentBox = document.getElementById('privacy-consent-checkbox');
    if (consentBox && !consentBox.checked) {
        if (btnElement) flashButton(btnElement, "Accept Privacy Terms!", true);
        return;
    }

    const engineOptions = [
        { name: "Google", requiresUpload: true, url: (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img)}` },
        { name: "Yandex", requiresUpload: true, url: (img) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(img)}` },
        { name: "TinEye", requiresUpload: true, url: (img) => `https://tineye.com/search/?url=${encodeURIComponent(img)}` },
        { name: "Bing", requiresUpload: true, url: (img) => `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(img)}&view=detailv2&iss=sbi` },
        { name: "Lenso.ai (manual)", requiresUpload: false, url: () => "https://lenso.ai/en" }
    ];

    const data = await brw.storage.local.get({ reverseEngines: [] });
    const selected = data.reverseEngines;

    const enginesToUse = engineOptions.filter(e => selected.includes(e.name));
    if (enginesToUse.length === 0) {
        if (btnElement) flashButton(btnElement, "Select Engine!", true);
        return;
    }

    let imgUrl = "";
    const needsUpload = enginesToUse.some(e => e.requiresUpload);

    if (needsUpload) {
        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        formData.append("fileToUpload", fileOrBlob);

        try {
            const res = await fetch("https://catbox.moe/user/api.php", {
                method: "POST",
                body: formData
            });
            imgUrl = await res.text();
            if (!imgUrl.startsWith("http")) {
                if (btnElement) flashButton(btnElement, "Upload Failed", true);
                return;
            }
        } catch (err) {
            if (btnElement) flashButton(btnElement, "Error", true);
            return;
        }
    }

    enginesToUse.forEach(engine => {
        const fullUrl = engine.url(imgUrl);
        if (fullUrl) {
            brw.tabs.create({ url: fullUrl, active: false });
        }
    });
}

function saveImageToolsState(isOpen) {
    if (isOpen) saveViewState('reverseImageSearch', { mainOpen: true });
    else resetViewState();
}

export function restoreReverseImageSearchView(container) {
    const reverseBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "Image Tools");
    if (reverseBtn) {
        const reverseWrapper = reverseBtn.nextElementSibling;
        if (reverseWrapper) {
            reverseWrapper.classList.add("open");
        }
    }
}

export function initializeReverseImageSearch(container) {
    const { wrapper: reverseWrapper } = createSection(container, "Image Tools", {
        onToggle: (isOpen) => saveImageToolsState(isOpen)
    });

    // ============================================================
    // 1. Reverse Image Search (existing)
    // ============================================================

    const engineState = {};
    const engineContainer = document.createElement("div");
    engineContainer.style.margin = "10px auto";
    engineContainer.style.padding = "5px";
    engineContainer.style.textAlign = "left";
    engineContainer.style.background = "#2c1e3f";
    engineContainer.style.borderRadius = "10px";
    engineContainer.style.color = "#ffcc99";
    engineContainer.style.width = "90%";
    engineContainer.innerHTML = `<div style="text-align:center; font-weight:bold; margin-bottom:6px;">Choose Search Engines</div>`;

    const engineOptions = [
        { name: "Google" }, { name: "Yandex" }, { name: "TinEye" }, { name: "Bing" }, { name: "Lenso.ai (manual)" }
    ];

    brw.storage.local.get("reverseEngines", (data) => {
        const saved = data.reverseEngines || [];
        engineOptions.forEach(opt => {
            const label = document.createElement("label");
            label.style.display = "block";
            label.style.margin = "4px";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = saved.includes(opt.name);
            box.style.marginRight = "6px";
            engineState[opt.name] = box;
            label.appendChild(box);
            label.appendChild(document.createTextNode(opt.name));
            engineContainer.appendChild(label);
        });
    });

    setInterval(() => {
        const selected = Object.entries(engineState)
            .filter(([name, el]) => el.checked)
            .map(([name]) => name);
        brw.storage.local.set({ reverseEngines: selected });
    }, 1000);

    const imageUploadBtn = document.createElement("button");
    imageUploadBtn.className = "sub-category-button";
    imageUploadBtn.textContent = "Upload Image from Computer";
    imageUploadBtn.addEventListener("click", () => {
        if (isFirefox()) {
            openUploadPage();
        } else {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.style.display = 'none';
            input.onchange = (e) => {
                if (e.target.files[0]) {
                    handleReverseSearch(e.target.files[0], imageUploadBtn);
                }
            };
            document.body.appendChild(input);
            input.click();
        }
    });

    const imagePasteBtn = document.createElement("button");
    imagePasteBtn.className = "sub-category-button";
    imagePasteBtn.textContent = "Paste Image from Clipboard";
    imagePasteBtn.addEventListener("click", async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const type = item.types.find(t => t.startsWith("image/"));
                if (type) {
                    const blob = await item.getType(type);
                    const file = new File([blob], `pasted-image.png`, { type: blob.type });
                    handleReverseSearch(file, imagePasteBtn);
                    return;
                }
            }
            flashButton(imagePasteBtn, "No Image", true);
        } catch (err) {
            flashButton(imagePasteBtn, "Error", true);
        }
    });

    reverseWrapper.appendChild(imageUploadBtn);
    reverseWrapper.appendChild(imagePasteBtn);

    const consentContainer = document.createElement("div");
    consentContainer.style.margin = "10px auto";
    consentContainer.style.borderRadius = "8px";
    consentContainer.style.width = "90%";
    consentContainer.style.textAlign = "left";
    consentContainer.style.fontSize = "11px";
    consentContainer.style.transition = "all 0.3s ease";
    consentContainer.style.cursor = "pointer";
    
    const consentLabel = document.createElement("label");
    consentLabel.style.display = "flex";
    consentLabel.style.gap = "6px";
    consentLabel.style.cursor = "pointer";

    const consentCheckbox = document.createElement("input");
    consentCheckbox.type = "checkbox";
    consentCheckbox.id = "privacy-consent-checkbox";
    consentCheckbox.style.marginTop = "2px";
    
    const consentText = document.createElement("span");
    
    function setCompactMode(isCompact) {
        if (isCompact) {
            consentContainer.style.background = "rgba(186, 220, 88, 0.1)";
            consentContainer.style.border = "1px solid rgba(186, 220, 88, 0.4)";
            consentContainer.style.color = "#badc58";
            consentContainer.style.padding = "4px 8px";
            consentLabel.style.alignItems = "center";
            consentCheckbox.style.display = "none";
            consentText.innerHTML = "✓ Privacy Terms Accepted <span style='font-size:9px; color:#888;'>(Click to expand)</span>";
        } else {
            consentContainer.style.background = "rgba(255, 107, 107, 0.1)";
            consentContainer.style.border = "1px dashed rgba(255, 107, 107, 0.4)";
            consentContainer.style.color = "#ffcc99";
            consentContainer.style.padding = "8px";
            consentLabel.style.alignItems = "flex-start";
            consentCheckbox.style.display = "block";
            consentText.innerHTML = "<b>Privacy Terms:</b> I understand that uploaded images are sent to a public server (catbox.moe) for search indexing. I will not upload sensitive or PII data.";
        }
    }

    brw.storage.local.get({ privacyConsentReverseImage: false }, (data) => {
        consentCheckbox.checked = data.privacyConsentReverseImage;
        setCompactMode(data.privacyConsentReverseImage);
    });

    consentCheckbox.addEventListener("change", (e) => {
        brw.storage.local.set({ privacyConsentReverseImage: e.target.checked });
        if (e.target.checked) {
            setCompactMode(true);
        }
    });

    consentContainer.addEventListener("click", (e) => {
        if (consentCheckbox.checked && e.target !== consentCheckbox) {
            setCompactMode(false);
        }
    });

    consentLabel.appendChild(consentCheckbox);
    consentLabel.appendChild(consentText);
    consentContainer.appendChild(consentLabel);

    reverseWrapper.appendChild(consentContainer);
    reverseWrapper.appendChild(engineContainer);

    // ============================================================
    // 2. Face Comparison (NEW)
    // ============================================================

    const faceSep = document.createElement('div');
    faceSep.textContent = "Face Comparison";
    faceSep.style.color = "#aaa";
    faceSep.style.fontSize = "11px";
    faceSep.style.marginTop = "12px";
    faceSep.style.marginBottom = "5px";
    faceSep.style.borderBottom = "1px solid #444";
    faceSep.style.paddingBottom = "4px";
    faceSep.style.textAlign = "center";
    reverseWrapper.appendChild(faceSep);

    const faceContainer = document.createElement("div");
    faceContainer.style.padding = "8px";
    faceContainer.style.display = "none";

    const faceToggleBtn = document.createElement("button");
    faceToggleBtn.className = "sub-category-button";
    faceToggleBtn.textContent = "Compare Two Faces";
    faceToggleBtn.addEventListener("click", () => {
        if (faceContainer.style.display === "none") {
            faceContainer.style.display = "block";
            faceToggleBtn.textContent = "Compare Two Faces (Close)";
        } else {
            faceContainer.style.display = "none";
            faceToggleBtn.textContent = "Compare Two Faces";
        }
    });

    reverseWrapper.appendChild(faceToggleBtn);
    reverseWrapper.appendChild(faceContainer);

    // Face comparison state
    let faceFileA = null;
    let faceFileB = null;
    let modelsLoaded = false;

    // Status indicator
    const statusDiv = document.createElement("div");
    statusDiv.style.fontSize = "11px";
    statusDiv.style.color = "#888";
    statusDiv.style.textAlign = "center";
    statusDiv.style.marginBottom = "8px";
    statusDiv.textContent = "Models not loaded yet — will load on first use.";
    faceContainer.appendChild(statusDiv);

    // Image slots
    const imagesRow = document.createElement("div");
    imagesRow.style.display = "flex";
    imagesRow.style.gap = "8px";
    imagesRow.style.marginBottom = "10px";

    function createImageSlot(label) {
        const slot = document.createElement("div");
        slot.style.flex = "1";
        slot.style.background = "#1a1a2e";
        slot.style.border = "1px dashed #555";
        slot.style.borderRadius = "8px";
        slot.style.padding = "8px";
        slot.style.textAlign = "center";
        slot.style.minHeight = "100px";
        slot.style.display = "flex";
        slot.style.flexDirection = "column";
        slot.style.alignItems = "center";
        slot.style.justifyContent = "center";
        slot.style.cursor = "pointer";
        slot.style.transition = "border-color 0.2s";

        const labelDiv = document.createElement("div");
        labelDiv.textContent = label;
        labelDiv.style.fontSize = "12px";
        labelDiv.style.color = "#aaa";
        labelDiv.style.marginBottom = "6px";

        const preview = document.createElement("canvas");
        preview.width = 120;
        preview.height = 120;
        preview.style.borderRadius = "6px";
        preview.style.display = "none";
        preview.style.maxWidth = "100%";

        const uploadText = document.createElement("div");
        uploadText.textContent = "📤 Upload";
        uploadText.style.fontSize = "11px";
        uploadText.style.color = "#666";

        slot.appendChild(labelDiv);
        slot.appendChild(preview);
        slot.appendChild(uploadText);

        // Face selection indicator
        const faceInfo = document.createElement("div");
        faceInfo.style.fontSize = "10px";
        faceInfo.style.color = "#badc58";
        faceInfo.style.marginTop = "4px";
        faceInfo.style.display = "none";
        slot.appendChild(faceInfo);

        return { slot, preview, uploadText, faceInfo };
    }

    const slotA = createImageSlot("Image A");
    const slotB = createImageSlot("Image B");
    imagesRow.appendChild(slotA.slot);
    imagesRow.appendChild(slotB.slot);
    faceContainer.appendChild(imagesRow);

    // Face selection containers (shown when multiple faces detected)
    const faceSelectA = document.createElement("div");
    faceSelectA.style.display = "none";
    faceSelectA.style.marginBottom = "8px";
    faceContainer.appendChild(faceSelectA);

    const faceSelectB = document.createElement("div");
    faceSelectB.style.display = "none";
    faceSelectB.style.marginBottom = "8px";
    faceContainer.appendChild(faceSelectB);

    let selectedDescriptorA = null;
    let selectedDescriptorB = null;
    let detectionsA = [];
    let detectionsB = [];

    async function loadModels() {
        if (modelsLoaded) return;
        statusDiv.textContent = "⏳ Loading face detection models...";
        statusDiv.style.color = "#ffcc99";
        try {
            const modelPath = './libs/face_libs';
            await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath);
            await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
            modelsLoaded = true;
            statusDiv.textContent = "✅ Models loaded";
            statusDiv.style.color = "#badc58";
        } catch (err) {
            console.error("Face-api model load error:", err);
            statusDiv.textContent = "❌ Failed to load models";
            statusDiv.style.color = "#ff6b6b";
        }
    }

    async function detectFaces(file) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await new Promise(r => { img.onload = r; });

        const detections = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceDescriptors();

        URL.revokeObjectURL(url);
        return { img, detections };
    }

    function drawFacesOnCanvas(canvas, img, detections, selectedIdx = -1) {
        const maxW = 120;
        const maxH = 120;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        detections.forEach((det, i) => {
            const box = det.detection.box;
            ctx.strokeStyle = (i === selectedIdx) ? "#badc58" : "#ff6b6b";
            ctx.lineWidth = 2;
            ctx.strokeRect(
                box.x * scale, box.y * scale,
                box.width * scale, box.height * scale
            );
            ctx.fillStyle = (i === selectedIdx) ? "#badc58" : "#ff6b6b";
            ctx.font = "bold 10px sans-serif";
            ctx.fillText(`#${i + 1}`, box.x * scale + 2, box.y * scale - 3);
        });
    }

    function showFaceSelection(selectContainer, detections, img, side) {
        selectContainer.innerHTML = "";
        if (detections.length <= 1) {
            selectContainer.style.display = "none";
            return;
        }

        selectContainer.style.display = "block";
        const label = document.createElement("div");
        label.textContent = `${detections.length} faces detected — select one:`;
        label.style.fontSize = "11px";
        label.style.color = "#ffcc99";
        label.style.marginBottom = "4px";
        selectContainer.appendChild(label);

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.gap = "4px";
        row.style.flexWrap = "wrap";

        detections.forEach((det, i) => {
            const btn = document.createElement("button");
            btn.textContent = `Face #${i + 1}`;
            btn.style.padding = "4px 8px";
            btn.style.fontSize = "11px";
            btn.style.background = "#2c3e50";
            btn.style.color = "#fff";
            btn.style.border = "1px solid #555";
            btn.style.borderRadius = "4px";
            btn.style.cursor = "pointer";

            btn.addEventListener("click", () => {
                if (side === "A") {
                    selectedDescriptorA = det.descriptor;
                    drawFacesOnCanvas(slotA.preview, img, detections, i);
                    slotA.faceInfo.textContent = `Selected: Face #${i + 1}`;
                    slotA.faceInfo.style.display = "block";
                } else {
                    selectedDescriptorB = det.descriptor;
                    drawFacesOnCanvas(slotB.preview, img, detections, i);
                    slotB.faceInfo.textContent = `Selected: Face #${i + 1}`;
                    slotB.faceInfo.style.display = "block";
                }
                // Highlight selected button
                row.querySelectorAll("button").forEach(b => b.style.borderColor = "#555");
                btn.style.borderColor = "#badc58";
            });

            row.appendChild(btn);
        });

        selectContainer.appendChild(row);
    }

    async function handleFaceUpload(file, slot, selectContainer, side) {
        await loadModels();
        if (!modelsLoaded) return;

        slot.uploadText.textContent = "⏳ Detecting...";
        slot.preview.style.display = "none";
        slot.faceInfo.style.display = "none";

        try {
            const { img, detections } = await detectFaces(file);

            if (detections.length === 0) {
                slot.uploadText.textContent = "❌ No face found";
                slot.uploadText.style.color = "#ff6b6b";
                if (side === "A") { selectedDescriptorA = null; detectionsA = []; }
                else { selectedDescriptorB = null; detectionsB = []; }
                return;
            }

            slot.preview.style.display = "block";
            slot.uploadText.style.display = "none";

            if (side === "A") {
                detectionsA = detections;
                selectedDescriptorA = detections[0].descriptor;
            } else {
                detectionsB = detections;
                selectedDescriptorB = detections[0].descriptor;
            }

            drawFacesOnCanvas(slot.preview, img, detections, 0);
            showFaceSelection(selectContainer, detections, img, side);

            if (detections.length === 1) {
                slot.faceInfo.textContent = "1 face detected ✓";
                slot.faceInfo.style.display = "block";
            } else {
                slot.faceInfo.textContent = `${detections.length} faces — Face #1 selected`;
                slot.faceInfo.style.display = "block";
            }

        } catch (err) {
            console.error("Face detection error:", err);
            slot.uploadText.textContent = "❌ Error";
            slot.uploadText.style.color = "#ff6b6b";
        }
    }

    function createFileInput(slot, selectContainer, side) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (side === "A") faceFileA = file;
            else faceFileB = file;
            handleFaceUpload(file, slot, selectContainer, side);
        };
        document.body.appendChild(input);
        return input;
    }

    const inputA = createFileInput(slotA, faceSelectA, "A");
    const inputB = createFileInput(slotB, faceSelectB, "B");

    slotA.slot.addEventListener("click", () => {
        if (isFirefox()) {
            brw.tabs.create({ url: 'firefox/face-compare-upload.html' });
            window.close();
            return;
        }
        inputA.click();
    });
    slotB.slot.addEventListener("click", () => {
        if (isFirefox()) {
            brw.tabs.create({ url: 'firefox/face-compare-upload.html' });
            window.close();
            return;
        }
        inputB.click();
    });

    // Compare button
    const compareBtn = document.createElement("button");
    compareBtn.className = "sub-category-button";
    compareBtn.textContent = "🔍 Compare Faces";
    compareBtn.style.background = "linear-gradient(135deg, #6366f1, #4f46e5)";
    compareBtn.style.color = "#fff";
    compareBtn.style.fontWeight = "bold";

    const resultDiv = document.createElement("div");
    resultDiv.style.marginTop = "10px";
    resultDiv.style.display = "none";

    compareBtn.addEventListener("click", () => {
        if (!selectedDescriptorA || !selectedDescriptorB) {
            flashButton(compareBtn, "Upload 2 images!", true);
            return;
        }

        const distance = faceapi.euclideanDistance(selectedDescriptorA, selectedDescriptorB);
        const similarity = Math.max(0, Math.min(100, ((1 - distance) * 100).toFixed(1)));
        const isMatch = distance < 0.6;

        resultDiv.style.display = "block";
        resultDiv.innerHTML = "";

        const card = document.createElement("div");
        card.style.background = "#1e272e";
        card.style.padding = "12px";
        card.style.borderRadius = "8px";
        card.style.border = `2px solid ${isMatch ? '#badc58' : '#ff6b6b'}`;
        card.style.textAlign = "center";

        const verdict = document.createElement("div");
        verdict.style.fontSize = "16px";
        verdict.style.fontWeight = "bold";
        verdict.style.marginBottom = "6px";
        verdict.style.color = isMatch ? "#badc58" : "#ff6b6b";
        verdict.textContent = isMatch ? "✅ MATCH — Same Person" : "❌ NO MATCH — Different People";
        card.appendChild(verdict);

        const scoreLine = document.createElement("div");
        scoreLine.style.fontSize = "13px";
        scoreLine.style.color = "#ccc";
        scoreLine.style.marginBottom = "8px";
        scoreLine.textContent = `Similarity: ${similarity}% | Distance: ${distance.toFixed(4)}`;
        card.appendChild(scoreLine);

        // Progress bar
        const barBg = document.createElement("div");
        barBg.style.background = "#333";
        barBg.style.borderRadius = "4px";
        barBg.style.height = "8px";
        barBg.style.width = "100%";
        barBg.style.marginBottom = "8px";

        const bar = document.createElement("div");
        bar.style.height = "100%";
        bar.style.borderRadius = "4px";
        bar.style.width = `${similarity}%`;
        bar.style.background = isMatch
            ? "linear-gradient(90deg, #badc58, #6ab04c)"
            : "linear-gradient(90deg, #ff6b6b, #ee5a24)";
        bar.style.transition = "width 0.5s ease";
        barBg.appendChild(bar);
        card.appendChild(barBg);

        const copyBtn = document.createElement("button");
        copyBtn.textContent = "Copy Result";
        copyBtn.style.padding = "4px 10px";
        copyBtn.style.fontSize = "11px";
        copyBtn.style.background = "#2c3e50";
        copyBtn.style.color = "#fff";
        copyBtn.style.border = "1px solid #555";
        copyBtn.style.borderRadius = "4px";
        copyBtn.style.cursor = "pointer";
        copyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const text = `Face Comparison Result\nMatch: ${isMatch ? 'YES' : 'NO'}\nSimilarity: ${similarity}%\nDistance: ${distance.toFixed(4)}`;
            navigator.clipboard.writeText(text).then(() => {
                flashButton(copyBtn, "Copied!");
            });
        });
        card.appendChild(copyBtn);

        resultDiv.appendChild(card);
    });

    faceContainer.appendChild(compareBtn);
    faceContainer.appendChild(resultDiv);
}