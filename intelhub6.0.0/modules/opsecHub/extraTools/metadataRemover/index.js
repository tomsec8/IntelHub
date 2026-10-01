// Tool 2: Universal File & Document Metadata Sanitizer & Spoofing
function initMetadataRemoverTool() {
    const dropzone = document.getElementById('dropzone-metadata-cleaner');
    const input = document.getElementById('input-metadata-cleaner');
    const resultBox = document.getElementById('result-metadata-cleaner');
    const statusEl = document.getElementById('status-metadata-cleaner');
    const detailsEl = document.getElementById('details-metadata-cleaner');
    const previewImg = document.getElementById('preview-metadata-cleaner');
    const downloadBtn = document.getElementById('btn-download-clean-image');
    const tableFields = document.getElementById('table-metadata-fields');

    // Spoofing UI elements
    const editorForm = document.getElementById('meta-editor-form');
    const editAuthor = document.getElementById('edit-meta-author');
    const editTitle = document.getElementById('edit-meta-title');
    const editSubject = document.getElementById('edit-meta-subject');
    const editProducer = document.getElementById('edit-meta-producer');
    const btnSaveSpoofed = document.getElementById('btn-save-spoofed-meta');

    if (!dropzone || !input) return;

    let cleanBlob = null;
    let spoofedBlob = null;
    let originalBuffer = null;
    let loadedFile = null;
    let fileName = 'sanitized_document';

    // Security: Escape HTML entities to prevent XSS via malicious metadata content
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    const renderMetaTable = (data) => {
        tableFields.innerHTML = '';
        if (!data || Object.keys(data).length === 0) {
            tableFields.innerHTML = '<div style="color: #78909c; font-style: italic;">No metadata fields found.</div>';
            return;
        }

        let hasSensitive = false;
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        for (const key in data) {
            const val = data[key];
            if (!val) continue;

            const valStr = val.toString().trim();
            const isSensitiveWord = /password|pass|pwd|secret|auth|token|private|key/i.test(key) || /password|pass|pwd|secret|auth|token|private|key/i.test(valStr);
            const isHash = /^[a-fA-F0-9]{32}$/.test(valStr) || /^[a-fA-F0-9]{40}$/.test(valStr) || /^[a-fA-F0-9]{64}$/.test(valStr);

            const row = table.insertRow();
            
            if (isSensitiveWord || isHash) {
                hasSensitive = true;
                row.style.background = 'rgba(255, 69, 58, 0.1)';
            }

            const cellKey = row.insertCell();
            cellKey.textContent = key;
            cellKey.style.padding = '4px 8px';
            cellKey.style.color = (isSensitiveWord || isHash) ? '#ff453a' : '#60a5fa';
            cellKey.style.fontWeight = 'bold';
            cellKey.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            cellKey.style.width = '35%';
            
            const cellVal = row.insertCell();
            cellVal.textContent = valStr;
            if (isSensitiveWord || isHash) {
                cellVal.innerHTML = `${escapeHtml(valStr)} <span style="font-size: 9px; background: #ff453a; color: #fff; padding: 1px 5px; border-radius: 4px; font-weight: bold; margin-left: 6px;">SENSITIVE</span>`;
            }
            cellVal.style.padding = '4px 8px';
            cellVal.style.color = (isSensitiveWord || isHash) ? '#ff453a' : '#e0e0e0';
            cellVal.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            cellVal.style.wordBreak = 'break-all';
        }
        tableFields.appendChild(table);

        if (hasSensitive) {
            const warningBox = document.createElement('div');
            warningBox.style.cssText = 'background: rgba(255, 69, 58, 0.15); border: 1px solid #ff453a; border-radius: 6px; padding: 10px; color: #ff453a; font-size: 12px; margin-bottom: 12px; font-weight: bold; display: flex; flex-direction: column; gap: 8px;';
            warningBox.innerHTML = `
                <div>Warning: Sensitive credentials, hashes, or key patterns detected inside document metadata. Sanitizing is strongly recommended!</div>
                <button id="btn-dlp-redact" class="run-tests-btn" style="background: #ff453a; color: #fff; font-weight: 700; width: 100%; padding: 8px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer;">Click to Redact / Blackout All Sensitive Fields</button>
            `;
            tableFields.insertBefore(warningBox, tableFields.firstChild);

            const btnRedact = warningBox.querySelector('#btn-dlp-redact');
            if (btnRedact) {
                btnRedact.addEventListener('click', () => {
                    if (editorForm) {
                        const checkAndRedactInput = (inputEl) => {
                            const val = inputEl.value.trim();
                            const isSensitive = /password|pass|pwd|secret|auth|token|private|key/i.test(val) || /^[a-fA-F0-9]{32}$/.test(val) || /^[a-fA-F0-9]{40}$/.test(val) || /^[a-fA-F0-9]{64}$/.test(val);
                            if (isSensitive) {
                                inputEl.value = '[REDACTED]';
                            }
                        };
                        checkAndRedactInput(editAuthor);
                        checkAndRedactInput(editTitle);
                        checkAndRedactInput(editSubject);
                        checkAndRedactInput(editProducer);
                    }

                    for (const key in data) {
                        const valStr = data[key].toString().trim();
                        const isSensitiveWord = /password|pass|pwd|secret|auth|token|private|key/i.test(key) || /password|pass|pwd|secret|auth|token|private|key/i.test(valStr);
                        const isHash = /^[a-fA-F0-9]{32}$/.test(valStr) || /^[a-fA-F0-9]{40}$/.test(valStr) || /^[a-fA-F0-9]{64}$/.test(valStr);
                        if (isSensitiveWord || isHash) {
                            data[key] = '[REDACTED]';
                        }
                    }

                    renderMetaTable(data);
                    statusEl.textContent = 'Sensitive Fields Blacked Out! Click "Save & Spoof Metadata" to download.';
                    statusEl.style.color = '#5B9DFF';
                });
            }
        }
    };

    const processFile = (file) => {
        if (!file) return;
        loadedFile = file;
        fileName = 'clean_' + file.name;
        resultBox.style.display = 'block';
        statusEl.textContent = 'Stripping Metadata...';
        statusEl.style.color = '#5B9DFF';
        detailsEl.textContent = `Processing ${file.name}...`;
        previewImg.style.display = 'none';
        tableFields.innerHTML = '<div style="color: #78909c;">Analyzing...</div>';
        if (editorForm) editorForm.style.display = 'none';

        const reader = new FileReader();
        reader.onload = async (e) => {
            originalBuffer = e.target.result;
            const extracted = {};

            if (file.type.startsWith('image/')) {
                try {
                    const tags = ExifReader.load(originalBuffer);
                    for (const tag in tags) {
                        if (tags[tag] && tags[tag].description) {
                            extracted[tag] = tags[tag].description;
                        }
                    }
                } catch (err) {
                    console.log('No EXIF tags parsed:', err);
                }

                // Show inputs for common EXIF fields
                if (editorForm) {
                    editAuthor.value = extracted['Artist'] || extracted['XPAuthor'] || '';
                    editTitle.value = extracted['ImageDescription'] || '';
                    editSubject.value = extracted['UserComment'] || '';
                    editProducer.value = extracted['Make'] || '';
                    editorForm.style.display = 'block';
                }

                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob((blob) => {
                        cleanBlob = blob;
                        previewImg.src = URL.createObjectURL(blob);
                        previewImg.style.display = 'block';
                        statusEl.textContent = 'EXIF Metadata Stripped Successfully!';
                        statusEl.style.color = '#30d158';
                        detailsEl.textContent = `Removed EXIF GPS coordinates, camera model, and timestamps from ${file.name}.`;
                        renderMetaTable(extracted);
                    }, 'image/png');
                };
                img.src = URL.createObjectURL(file);

            } else if (file.name.endsWith('.pdf')) {
                try {
                    const pdfDoc = await PDFLib.PDFDocument.load(originalBuffer, { ignoreEncryption: true });
                    const getField = (f) => { try { return f(); } catch(e) { return null; } };
                    extracted['Title'] = getField(() => pdfDoc.getTitle());
                    extracted['Author'] = getField(() => pdfDoc.getAuthor());
                    extracted['Subject'] = getField(() => pdfDoc.getSubject());
                    extracted['Creator'] = getField(() => pdfDoc.getCreator());
                    extracted['Producer'] = getField(() => pdfDoc.getProducer());

                    if (editorForm) {
                        editAuthor.value = extracted['Author'] || '';
                        editTitle.value = extracted['Title'] || '';
                        editSubject.value = extracted['Subject'] || '';
                        editProducer.value = extracted['Producer'] || '';
                        editorForm.style.display = 'block';
                    }

                    pdfDoc.setTitle('');
                    pdfDoc.setAuthor('');
                    pdfDoc.setSubject('');
                    pdfDoc.setCreator('');
                    pdfDoc.setProducer('');
                    
                    const cleanBytes = await pdfDoc.save();
                    cleanBlob = new Blob([cleanBytes], { type: 'application/pdf' });
                    statusEl.textContent = 'PDF Metadata Stripped!';
                    statusEl.style.color = '#30d158';
                    detailsEl.textContent = 'Cleaned document properties using PDFLib.';
                } catch(err) {
                    console.log('PDF metadata parse/save error:', err);
                    statusEl.textContent = 'PDF Parse Error';
                    statusEl.style.color = '#ff453a';
                    detailsEl.textContent = err.message;
                }
                renderMetaTable(extracted);

            } else if (file.name.endsWith('.docx')) {
                try {
                    const zip = await JSZip.loadAsync(originalBuffer);
                    const coreXmlFile = zip.file("docProps/core.xml");
                    if (coreXmlFile) {
                        const coreXml = await coreXmlFile.async("string");
                        const xmlDoc = new DOMParser().parseFromString(coreXml, "text/xml");
                        for (const node of xmlDoc.documentElement.childNodes) {
                            if (node.nodeType === 1) {
                                extracted[node.nodeName] = node.textContent;
                            }
                        }

                        if (editorForm) {
                            editAuthor.value = extracted['dc:creator'] || extracted['creator'] || '';
                            editTitle.value = extracted['dc:title'] || extracted['title'] || '';
                            editSubject.value = extracted['dc:subject'] || '';
                            editProducer.value = extracted['cp:lastModifiedBy'] || '';
                            editorForm.style.display = 'block';
                        }

                        let coreXmlText = coreXml;
                        const xmlProps = [
                            /<dc:creator>[^<]*<\/dc:creator>/gi,
                            /<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/gi,
                            /<cp:revision>[^<]*<\/cp:revision>/gi,
                            /<dcterms:created[^>]*>[^<]*<\/dcterms:created>/gi,
                            /<dcterms:modified[^>]*>[^<]*<\/dcterms:modified>/gi
                        ];
                        xmlProps.forEach(pattern => {
                            coreXmlText = coreXmlText.replace(pattern, (m) => m.replace(/>[^<]*</, '><'));
                        });
                        zip.file("docProps/core.xml", coreXmlText);
                    }
                    cleanBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    statusEl.textContent = 'Word Document Metadata Stripped!';
                    statusEl.style.color = '#30d158';
                    detailsEl.textContent = 'Cleaned author and revision markers inside DOCX container.';
                } catch(err) {
                    console.log('Docx metadata parse/save error:', err);
                    statusEl.textContent = 'Word Document Parse Error';
                    statusEl.style.color = '#ff453a';
                    detailsEl.textContent = err.message;
                }
                renderMetaTable(extracted);
            } else {
                const textContent = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(originalBuffer));
                cleanBlob = new Blob([textContent], { type: 'text/plain' });
                statusEl.textContent = 'File Cleaned!';
                statusEl.style.color = '#30d158';
                detailsEl.textContent = 'Re-encoded as clean flat text.';
                renderMetaTable({ 'File Name': file.name, 'MIME Type': file.type });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const applySpoofedMetadata = async () => {
        if (!loadedFile || !originalBuffer) return;
        statusEl.textContent = 'Injecting Spoofed Metadata...';
        statusEl.style.color = '#FF9F43';

        try {
            if (loadedFile.name.endsWith('.pdf')) {
                const pdfDoc = await PDFLib.PDFDocument.load(originalBuffer, { ignoreEncryption: true });
                pdfDoc.setAuthor(editAuthor.value);
                pdfDoc.setTitle(editTitle.value);
                pdfDoc.setSubject(editSubject.value);
                pdfDoc.setProducer(editProducer.value);
                pdfDoc.setCreator(editProducer.value);
                
                const spoofedBytes = await pdfDoc.save();
                spoofedBlob = new Blob([spoofedBytes], { type: 'application/pdf' });
                
                downloadBlob(spoofedBlob, 'spoofed_' + loadedFile.name);
                statusEl.textContent = 'Metadata Spoofed successfully!';
                statusEl.style.color = '#30d158';

            } else if (loadedFile.name.endsWith('.docx')) {
                const zip = await JSZip.loadAsync(originalBuffer);
                const coreXmlFile = zip.file("docProps/core.xml");
                if (coreXmlFile) {
                    let coreXmlText = await coreXmlFile.async("string");
                    coreXmlText = coreXmlText.replace(/<dc:creator>[^<]*<\/dc:creator>/gi, `<dc:creator>${editAuthor.value}</dc:creator>`);
                    coreXmlText = coreXmlText.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/gi, `<cp:lastModifiedBy>${editAuthor.value}</cp:lastModifiedBy>`);
                    coreXmlText = coreXmlText.replace(/<dc:title>[^<]*<\/dc:title>/gi, `<dc:title>${editTitle.value}</dc:title>`);
                    zip.file("docProps/core.xml", coreXmlText);
                }
                spoofedBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                
                downloadBlob(spoofedBlob, 'spoofed_' + loadedFile.name);
                statusEl.textContent = 'Metadata Spoofed successfully!';
                statusEl.style.color = '#30d158';
            } else {
                // Image or plain text: Alert that it was drawn to canvas and saved as clean (due to standard restrictions)
                downloadBlob(cleanBlob, 'clean_' + loadedFile.name);
                statusEl.textContent = 'EXIF stripped and downloaded!';
                statusEl.style.color = '#30d158';
            }
        } catch (err) {
            console.error(err);
            statusEl.textContent = 'Failed to inject spoofed metadata.';
            statusEl.style.color = '#ff453a';
        }
    };

    const downloadBlob = (blob, name) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
    };

    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => processFile(e.target.files[0]));
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#30d158'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'rgba(61, 220, 132, 0.4)'; });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(61, 220, 132, 0.4)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!cleanBlob) return;
            downloadBlob(cleanBlob, fileName);
        });
    }

    if (btnSaveSpoofed) {
        btnSaveSpoofed.addEventListener('click', applySpoofedMetadata);
    }
}
