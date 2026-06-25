import { brw, isFirefox, flashButton, createSection, saveViewState, resetViewState } from './utils.js';

let lastMetadata = null;

// Extracted internal core logic for non-UI usages (e.g., Copilot)
export async function extractMetadataFromBuffer(file) {
    const fileName = file.name || "unknown";
    const fileType = file.type || "";
    const sizeStr = `${(file.size / 1024).toFixed(2)} KB`;
    
    // Core fallback output
    const basicInfo = {
        "File Name": { value: fileName },
        "File Size": { value: sizeStr },
        "MIME Type": { value: fileType },
        "Last Modified": { value: file.lastModified ? new Date(file.lastModified).toLocaleString() : "Unknown" }
    };

    try {
        const buffer = await file.arrayBuffer();

        if (fileType.includes("image/")) {
            const tags = ExifReader.load(buffer);
            if (Object.keys(tags).length > 0) {
                const metadata = {};
                for (const tag in tags) {
                    if (tags[tag] && tags[tag].description) {
                        metadata[tag] = { value: tags[tag].description };
                    }
                }
                return metadata;
            }
        } 
        else if (fileName.toLowerCase().endsWith(".pdf") || fileType.includes("pdf")) {
            const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
            const getField = (getter) => {
                try { return { value: getter(), error: null }; }
                catch (e) { return { value: null, error: e.message }; }
            };
            return {
                "Title": getField(() => pdfDoc.getTitle()),
                "Author": getField(() => pdfDoc.getAuthor()),
                "Subject": getField(() => pdfDoc.getSubject()),
                "Keywords": getField(() => pdfDoc.getKeywords()),
                "Creator": getField(() => pdfDoc.getCreator()),
                "Producer": getField(() => pdfDoc.getProducer()),
                "Creation Date": getField(() => pdfDoc.getCreationDate()),
                "Modification Date": getField(() => pdfDoc.getModificationDate())
            };
        }
        else if (fileName.match(/\.(docx|xlsx|pptx)$/i)) {
            const zip = await JSZip.loadAsync(buffer);
            const metadataFiles = ["docProps/core.xml", "docProps/app.xml"];
            const metadata = {};
            for (const path of metadataFiles) {
                if (zip.files[path]) {
                    const content = await zip.files[path].async("string");
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    for (const node of xmlDoc.documentElement.childNodes) {
                        if (node.nodeType === 1) metadata[node.nodeName] = { value: node.textContent };
                    }
                }
            }
            if (Object.keys(metadata).length > 0) return metadata;
        }

        // Return basic info if no specific metadata found
        return basicInfo;
    } catch (e) {
        basicInfo["Error"] = { value: e.message || "Failed to parse deeply." };
        return basicInfo;
    }
}

function renderMetadataTable(file, data) {
    const output = createResultsContainer(`Metadata for: ${file.name}`);
    const table = document.createElement("table");
    for (const key in data) {
        const result = data[key];
        const value = result.value;

        const row = table.insertRow();
        const keyCell = row.insertCell();
        keyCell.textContent = key;
        keyCell.style.fontWeight = 'bold';
        const valueCell = row.insertCell();

        if (value) {
            const displayValue = value instanceof Date ? value.toLocaleString() : value.toString();
            valueCell.textContent = displayValue;
        } else if (result.error) {
            valueCell.textContent = `[Could not read field]`;
            valueCell.title = result.error;
            valueCell.style.color = "#ff7675";
            valueCell.style.fontStyle = 'italic';
        } else {
            valueCell.textContent = ``;
        }
    }
    output.appendChild(table);
}

function openUploadPage(type) {
    brw.tabs.create({
        url: `firefox/metadata-upload.html?type=${type}`
    });
    window.close();
}

function handleLocalImageUpload(event) {
    lastMetadata = null;
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const metadata = { file: { name: file.name } };
        try {
            const tags = ExifReader.load(e.target.result);
            if (Object.keys(tags).length === 0) throw new Error("No EXIF data found.");

            for (const tag in tags) {
                if (tags[tag] && tags[tag].description) {
                    metadata[tag] = { value: tags[tag].description };
                }
            }
        } catch (err) {
            console.error("EXIF Error:", err);
            const basicInfo = {
                "File Name": { value: file.name },
                "File Size": { value: `${(file.size / 1024).toFixed(2)} KB` },
                "MIME Type": { value: file.type },
                "Last Modified": { value: new Date(file.lastModified).toLocaleString() }
            };
            lastMetadata = { file: { name: file.name }, data: basicInfo };
            renderMetadataTable(lastMetadata.file, lastMetadata.data);
            return;
        }
        lastMetadata = { file: { name: file.name }, data: metadata };
        renderMetadataTable(lastMetadata.file, lastMetadata.data);
    };
    reader.onerror = function () {
        console.error("FileReader Error");
        alert("Error reading file.");
    };
    try {
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error("readAsArrayBuffer error:", e);
    }
}

function handlePdfMetadata(event) {
    lastMetadata = null;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const pdfDoc = await PDFLib.PDFDocument.load(e.target.result, { ignoreEncryption: true });

            const getField = (getter) => {
                try { return { value: getter(), error: null }; }
                catch (e) { return { value: null, error: e.message }; }
            };

            const fields = {
                "Title": getField(() => pdfDoc.getTitle()), "Author": getField(() => pdfDoc.getAuthor()),
                "Subject": getField(() => pdfDoc.getSubject()), "Keywords": getField(() => pdfDoc.getKeywords()),
                "Creator": getField(() => pdfDoc.getCreator()), "Producer": getField(() => pdfDoc.getProducer()),
                "Creation Date": getField(() => pdfDoc.getCreationDate()), "Modification Date": getField(() => pdfDoc.getModificationDate())
            };
            lastMetadata = { file: { name: file.name }, data: fields };
            renderMetadataTable(lastMetadata.file, lastMetadata.data);
        } catch (err) {
            console.error("PDF Parsing Error:", err);

            // Comprehensive fallback to basic file info
            const basicInfo = {
                "File Name": { value: file.name },
                "Last Modified": { value: new Date(file.lastModified).toLocaleString() },
                "Size": { value: `${(file.size / 1024).toFixed(2)} KB` },
                "Status": { value: "Could not read internal metadata (Encrypted or Invalid format)" },
                "Error Details": { value: "Parsing failed silently to prevent crash" }
            };
            lastMetadata = { file: { name: file.name }, data: basicInfo };
            renderMetadataTable(lastMetadata.file, lastMetadata.data);
        }
    };
    reader.onerror = function () {
        console.error("FileReader Error");
        alert("Error reading file.");
    };
    try {
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error("readAsArrayBuffer crashe:", e);
    }
}

function handleOfficeMetadata(event) {
    lastMetadata = null;
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const metadataFiles = ["docProps/core.xml", "docProps/app.xml"];
            const metadata = {};
            for (const path of metadataFiles) {
                if (zip.files[path]) {
                    const content = await zip.files[path].async("string");
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    const children = xmlDoc.documentElement.childNodes;
                    for (const node of children) {
                        if (node.nodeType === 1) metadata[node.nodeName] = { value: node.textContent };
                    }
                }
            }
            lastMetadata = { file: { name: file.name }, data: metadata };
            renderMetadataTable(lastMetadata.file, lastMetadata.data);
        } catch (err) {

            const basicInfo = {
                "File Name": { value: file.name },
                "Last Modified": { value: new Date(file.lastModified).toLocaleString() },
                "Size": { value: `${(file.size / 1024).toFixed(2)} KB` },
                "Status": { value: "Could not read internal metadata (Encrypted/Corrupted/Legacy)" },
                "Error Details": { value: err.message || "Unknown error" }
            };
            lastMetadata = { file: { name: file.name }, data: basicInfo };
            renderMetadataTable(lastMetadata.file, lastMetadata.data);
        }
    };
    reader.onerror = function () {
        console.error("FileReader Error");
        alert("Error reading file.");
    };
    try {
        reader.readAsArrayBuffer(file);
    } catch (e) {
        console.error("readAsArrayBuffer error:", e);
    }
}

function createResultsContainer(titleText) {
    const wrapper = document.getElementById('metadata-wrapper-inner');
    if (!wrapper) return null;

    const existingOutput = document.getElementById('metadata-output');
    if (existingOutput) existingOutput.remove();

    const output = document.createElement("div");
    output.id = 'metadata-output';
    output.style.padding = "10px"; output.style.marginTop = "10px";
    output.style.background = "#2c1e3f"; output.style.color = "#ffcc99";
    output.style.borderRadius = "12px"; output.style.maxHeight = "250px";
    output.style.overflowY = "auto";

    const title = document.createElement("h3");
    title.textContent = titleText;
    title.style.margin = "0 0 10px 0"; title.style.fontSize = "14px";
    output.appendChild(title);

    wrapper.appendChild(output);
    return output;
}

export function restoreMetadataView(container, state) {
    if (state.mainOpen) {
        const metaBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "File Analyzer");
        if (metaBtn) {
            const metaWrapper = metaBtn.nextElementSibling;
            if (metaWrapper) metaWrapper.classList.add("open");
        }
    }
    if (state.metadata) {
        lastMetadata = state.metadata;
        renderMetadataTable(lastMetadata.file, lastMetadata.data);
    }
}

export function initializeMetadataAnalyzer(container) {
    function saveMetadataState() {
        const isMainOpen = metaWrapper.classList.contains("open");
        if (!isMainOpen) {
            resetViewState();
            return;
        }
        saveViewState('metadataAnalyzer', {
            mainOpen: isMainOpen,
            metadata: lastMetadata
        });
    }

    const { wrapper: metaWrapper } = createSection(container, "File Analyzer", {
        id: "metadata-wrapper-inner",
        onToggle: (isOpen) => {
            if (!isOpen) {
                const existing = document.getElementById("metadata-output");
                if (existing) existing.remove();
                lastMetadata = null;
            }
            saveMetadataState();
        }
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const createBtn = (text, accept, handler) => {
        const btn = document.createElement("button");
        btn.className = "sub-category-button";
        btn.textContent = text;
        btn.addEventListener("click", () => {
            if (isFirefox()) {
                let type = accept.replace(/[^a-zA-Z]/g, '');
                if (accept.includes('.docx')) type = 'office';
                openUploadPage(type);
            } else {
                fileInput.accept = accept;
                fileInput.onchange = (e) => { handler(e); setTimeout(saveMetadataState, 100); };
                fileInput.click();
            }
        });
        return btn;
    };

    metaWrapper.appendChild(createBtn("Upload image file", "image/*", handleLocalImageUpload));
    metaWrapper.appendChild(createBtn("Upload PDF file", ".pdf", handlePdfMetadata));
    metaWrapper.appendChild(createBtn("Upload Office file", ".docx,.xlsx,.pptx", handleOfficeMetadata));

    // ============================================================
    // 2. File Hashing (NEW)
    // ============================================================

    const hashSep = document.createElement('div');
    hashSep.textContent = "File Hashing";
    hashSep.style.color = "#aaa";
    hashSep.style.fontSize = "11px";
    hashSep.style.marginTop = "12px";
    hashSep.style.marginBottom = "5px";
    hashSep.style.borderBottom = "1px solid #444";
    hashSep.style.paddingBottom = "4px";
    hashSep.style.textAlign = "center";
    metaWrapper.appendChild(hashSep);

    const hashBtn = document.createElement("button");
    hashBtn.className = "sub-category-button";
    hashBtn.textContent = "Hash a File";

    const hashContainer = document.createElement("div");
    hashContainer.style.display = "none";
    hashContainer.style.padding = "8px";

    hashBtn.addEventListener("click", () => {
        if (hashContainer.style.display === "none") {
            hashContainer.style.display = "block";
            hashBtn.textContent = "Hash a File (Close)";
        } else {
            hashContainer.style.display = "none";
            hashBtn.textContent = "Hash a File";
        }
    });

    const hashUploadBtn = document.createElement("button");
    hashUploadBtn.className = "sub-category-button";
    hashUploadBtn.textContent = "📂 Select File to Hash";
    hashUploadBtn.style.background = "linear-gradient(135deg, #6366f1, #4f46e5)";
    hashUploadBtn.style.color = "#fff";
    hashUploadBtn.style.fontWeight = "bold";

    const hashResultDiv = document.createElement("div");
    hashResultDiv.style.marginTop = "10px";

    const hashCompareDiv = document.createElement("div");
    hashCompareDiv.style.marginTop = "10px";

    async function computeHash(algorithm, buffer) {
        const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function computeMD5(buffer) {
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(buffer);
        return spark.end();
    }

    async function hashFile(file) {
        const buffer = await file.arrayBuffer();
        const [md5, sha1, sha256, sha512] = await Promise.all([
            Promise.resolve(computeMD5(buffer)),
            computeHash('SHA-1', buffer),
            computeHash('SHA-256', buffer),
            computeHash('SHA-512', buffer)
        ]);
        return { md5, sha1, sha256, sha512 };
    }

    function renderHashResults(fileName, fileSize, hashes) {
        hashResultDiv.innerHTML = "";

        const card = document.createElement("div");
        card.style.background = "#1e272e";
        card.style.padding = "12px";
        card.style.borderRadius = "8px";
        card.style.border = "1px solid #555";

        const title = document.createElement("div");
        title.style.fontWeight = "bold";
        title.style.fontSize = "13px";
        title.style.marginBottom = "4px";
        title.style.color = "#fff";
        title.textContent = fileName;
        card.appendChild(title);

        const sizeDiv = document.createElement("div");
        sizeDiv.style.fontSize = "11px";
        sizeDiv.style.color = "#888";
        sizeDiv.style.marginBottom = "10px";
        sizeDiv.textContent = `Size: ${(fileSize / 1024).toFixed(2)} KB`;
        card.appendChild(sizeDiv);

        const hashTypes = [
            { name: "MD5", value: hashes.md5 },
            { name: "SHA-1", value: hashes.sha1 },
            { name: "SHA-256", value: hashes.sha256 },
            { name: "SHA-512", value: hashes.sha512 }
        ];

        hashTypes.forEach(h => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.style.padding = "4px 0";
            row.style.borderBottom = "1px solid #333";

            const label = document.createElement("div");
            label.style.color = "#60a5fa";
            label.style.fontWeight = "bold";
            label.style.fontSize = "11px";
            label.style.minWidth = "60px";
            label.textContent = h.name;

            const val = document.createElement("div");
            val.style.fontFamily = "monospace";
            val.style.fontSize = "10px";
            val.style.color = "#ccc";
            val.style.wordBreak = "break-all";
            val.style.flex = "1";
            val.style.margin = "0 8px";
            val.textContent = h.value;

            const copyBtn = document.createElement("button");
            copyBtn.textContent = "📋";
            copyBtn.style.background = "transparent";
            copyBtn.style.border = "none";
            copyBtn.style.cursor = "pointer";
            copyBtn.style.fontSize = "12px";
            copyBtn.title = "Copy";
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(h.value).then(() => {
                    copyBtn.textContent = "✅";
                    setTimeout(() => { copyBtn.textContent = "📋"; }, 1500);
                });
            });

            row.appendChild(label);
            row.appendChild(val);
            row.appendChild(copyBtn);
            card.appendChild(row);
        });

        // Copy All button
        const copyAllBtn = document.createElement("button");
        copyAllBtn.className = "sub-category-button";
        copyAllBtn.textContent = "Copy All Hashes";
        copyAllBtn.style.marginTop = "8px";
        copyAllBtn.addEventListener("click", () => {
            const text = hashTypes.map(h => `${h.name}: ${h.value}`).join("\n");
            navigator.clipboard.writeText(text).then(() => {
                flashButton(copyAllBtn, "Copied!");
            });
        });
        card.appendChild(copyAllBtn);

        // Compare input
        hashCompareDiv.innerHTML = "";
        const compareLabel = document.createElement("div");
        compareLabel.textContent = "Compare with known hash:";
        compareLabel.style.fontSize = "11px";
        compareLabel.style.color = "#aaa";
        compareLabel.style.marginTop = "8px";
        compareLabel.style.marginBottom = "4px";

        const compareInput = document.createElement("input");
        compareInput.type = "text";
        compareInput.placeholder = "Paste a hash to compare...";
        compareInput.style.width = "90%";
        compareInput.style.padding = "6px";
        compareInput.style.borderRadius = "6px";
        compareInput.style.border = "1px solid #555";
        compareInput.style.background = "#1a1a2e";
        compareInput.style.color = "#fff";
        compareInput.style.fontFamily = "monospace";
        compareInput.style.fontSize = "11px";

        const compareResult = document.createElement("div");
        compareResult.style.fontSize = "12px";
        compareResult.style.marginTop = "4px";

        compareInput.addEventListener("input", () => {
            const val = compareInput.value.trim().toLowerCase();
            if (!val) { compareResult.textContent = ""; return; }

            let matchFound = false;
            for (const h of hashTypes) {
                if (h.value.toLowerCase() === val) {
                    compareResult.textContent = `✅ Match! (${h.name})`;
                    compareResult.style.color = "#badc58";
                    matchFound = true;
                    break;
                }
            }
            if (!matchFound) {
                compareResult.textContent = "❌ No match";
                compareResult.style.color = "#ff6b6b";
            }
        });

        hashCompareDiv.appendChild(compareLabel);
        hashCompareDiv.appendChild(compareInput);
        hashCompareDiv.appendChild(compareResult);
        card.appendChild(hashCompareDiv);

        hashResultDiv.appendChild(card);
    }

    hashUploadBtn.addEventListener("click", () => {
        if (isFirefox()) {
            brw.tabs.create({ url: 'firefox/metadata-upload.html?type=hash' });
            window.close();
            return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.style.display = "none";
        input.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            hashUploadBtn.textContent = "⏳ Hashing...";
            hashUploadBtn.disabled = true;
            try {
                const hashes = await hashFile(file);
                renderHashResults(file.name, file.size, hashes);
            } catch (err) {
                console.error("Hashing error:", err);
                hashResultDiv.innerHTML = '<div style="color: #ff6b6b;">❌ Error hashing file</div>';
            } finally {
                hashUploadBtn.textContent = "📂 Select File to Hash";
                hashUploadBtn.disabled = false;
            }
        });
        document.body.appendChild(input);
        input.click();
    });

    hashContainer.appendChild(hashUploadBtn);
    hashContainer.appendChild(hashResultDiv);

    metaWrapper.appendChild(hashBtn);
    metaWrapper.appendChild(hashContainer);

    // ============================================================
    // 3. Hash Identifier (NEW)
    // ============================================================

    const idSep = document.createElement('div');
    idSep.textContent = "Hash Identifier";
    idSep.style.color = "#aaa";
    idSep.style.fontSize = "11px";
    idSep.style.marginTop = "12px";
    idSep.style.marginBottom = "5px";
    idSep.style.borderBottom = "1px solid #444";
    idSep.style.paddingBottom = "4px";
    idSep.style.textAlign = "center";
    metaWrapper.appendChild(idSep);

    const idToggleBtn = document.createElement("button");
    idToggleBtn.className = "sub-category-button";
    idToggleBtn.textContent = "Identify Hash Type";

    const idContainer = document.createElement("div");
    idContainer.style.display = "none";
    idContainer.style.padding = "8px";

    idToggleBtn.addEventListener("click", () => {
        if (idContainer.style.display === "none") {
            idContainer.style.display = "block";
            idToggleBtn.textContent = "Identify Hash Type (Close)";
        } else {
            idContainer.style.display = "none";
            idToggleBtn.textContent = "Identify Hash Type";
        }
    });

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.placeholder = "Paste a hash to identify...";
    idInput.style.width = "90%";
    idInput.style.padding = "8px";
    idInput.style.borderRadius = "6px";
    idInput.style.border = "1px solid #555";
    idInput.style.background = "#1a1a2e";
    idInput.style.color = "#fff";
    idInput.style.fontFamily = "monospace";
    idInput.style.fontSize = "12px";
    idInput.style.marginBottom = "8px";

    const idResultDiv = document.createElement("div");

    const hashPatterns = [
        { name: "CRC16", regex: /^[a-fA-F0-9]{4}$/, desc: "Cyclic Redundancy Check 16-bit" },
        { name: "CRC32", regex: /^[a-fA-F0-9]{8}$/, desc: "Cyclic Redundancy Check 32-bit" },
        { name: "Adler-32", regex: /^[a-fA-F0-9]{8}$/, desc: "Adler-32 checksum" },
        { name: "MD4", regex: /^[a-fA-F0-9]{32}$/, desc: "Message Digest 4 (128-bit)" },
        { name: "MD5", regex: /^[a-fA-F0-9]{32}$/, desc: "Message Digest 5 (128-bit)" },
        { name: "NTLM", regex: /^[a-fA-F0-9]{32}$/, desc: "NT LAN Manager hash" },
        { name: "SHA-1", regex: /^[a-fA-F0-9]{40}$/, desc: "Secure Hash Algorithm 1 (160-bit)" },
        { name: "RIPEMD-160", regex: /^[a-fA-F0-9]{40}$/, desc: "RACE Integrity Primitives (160-bit)" },
        { name: "SHA-224", regex: /^[a-fA-F0-9]{56}$/, desc: "Secure Hash Algorithm 224 (224-bit)" },
        { name: "SHA-256", regex: /^[a-fA-F0-9]{64}$/, desc: "Secure Hash Algorithm 256 (256-bit)" },
        { name: "SHA-384", regex: /^[a-fA-F0-9]{96}$/, desc: "Secure Hash Algorithm 384 (384-bit)" },
        { name: "SHA-512", regex: /^[a-fA-F0-9]{128}$/, desc: "Secure Hash Algorithm 512 (512-bit)" },
        { name: "SHA-3-256", regex: /^[a-fA-F0-9]{64}$/, desc: "SHA-3 (256-bit)" },
        { name: "SHA-3-512", regex: /^[a-fA-F0-9]{128}$/, desc: "SHA-3 (512-bit)" },
        { name: "BLAKE2s-256", regex: /^[a-fA-F0-9]{64}$/, desc: "BLAKE2s (256-bit)" },
        { name: "BLAKE2b-512", regex: /^[a-fA-F0-9]{128}$/, desc: "BLAKE2b (512-bit)" },
        { name: "bcrypt", regex: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, desc: "Blowfish-based password hash" },
        { name: "scrypt", regex: /^\$s0\$/, desc: "scrypt password hash" },
        { name: "Argon2", regex: /^\$argon2(id|i|d)\$/, desc: "Argon2 password hash" },
        { name: "MySQL 4.1+", regex: /^\*[a-fA-F0-9]{40}$/, desc: "MySQL SHA1 pass hash" },
        { name: "Base64", regex: /^[A-Za-z0-9+/]+=*$/, desc: "Base64 encoded (not a hash)" }
    ];

    function identifyHash(input) {
        const trimmed = input.trim();
        if (!trimmed) return [];
        const matches = [];
        for (const pattern of hashPatterns) {
            if (pattern.regex.test(trimmed)) {
                matches.push(pattern);
            }
        }
        return matches;
    }

    function renderHashIdentification(matches, inputVal) {
        idResultDiv.innerHTML = "";

        if (matches.length === 0) {
            const noResult = document.createElement("div");
            noResult.style.color = "#ff6b6b";
            noResult.style.fontSize = "12px";
            noResult.style.textAlign = "center";
            noResult.style.padding = "8px";
            noResult.textContent = "❌ Unknown hash type";
            idResultDiv.appendChild(noResult);
            return;
        }

        const lengthInfo = document.createElement("div");
        lengthInfo.style.fontSize = "11px";
        lengthInfo.style.color = "#888";
        lengthInfo.style.marginBottom = "6px";
        lengthInfo.textContent = `Length: ${inputVal.trim().length} chars | ${matches.length} possible type(s)`;
        idResultDiv.appendChild(lengthInfo);

        matches.forEach(m => {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.padding = "6px 8px";
            row.style.marginBottom = "4px";
            row.style.background = "#1e272e";
            row.style.borderRadius = "6px";
            row.style.border = "1px solid #333";

            const nameSpan = document.createElement("span");
            nameSpan.style.fontWeight = "bold";
            nameSpan.style.color = "#60a5fa";
            nameSpan.style.fontSize = "12px";
            nameSpan.textContent = m.name;

            const descSpan = document.createElement("span");
            descSpan.style.color = "#aaa";
            descSpan.style.fontSize = "10px";
            descSpan.textContent = m.desc;

            row.appendChild(nameSpan);
            row.appendChild(descSpan);
            idResultDiv.appendChild(row);
        });
    }

    idInput.addEventListener("input", () => {
        const val = idInput.value;
        if (!val.trim()) { idResultDiv.innerHTML = ""; return; }
        const matches = identifyHash(val);
        renderHashIdentification(matches, val);
    });

    idContainer.appendChild(idInput);
    idContainer.appendChild(idResultDiv);

    metaWrapper.appendChild(idToggleBtn);
    metaWrapper.appendChild(idContainer);
}