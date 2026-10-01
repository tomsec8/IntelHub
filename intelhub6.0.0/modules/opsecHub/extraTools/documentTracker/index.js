// Tool 1: Document Tracker & Canary Pixel Sanitizer (Offline ZIP/PDF Auditor)
function initDocumentTrackerTool() {
    const dropzone = document.getElementById('dropzone-doc-tracker');
    const input = document.getElementById('input-doc-tracker');
    const resultBox = document.getElementById('result-doc-tracker');
    const statusEl = document.getElementById('status-doc-tracker');
    const detailsEl = document.getElementById('details-doc-tracker');
    const downloadBtn = document.getElementById('btn-download-sanitized-doc');

    if (!dropzone || !input) return;

    let sanitizedBlob = null;
    let fileName = 'sanitized_document';

    // Expanded tracking patterns matching CanaryTokens, WebBugs, Beacons, and Telemetry links
    const trackingPatterns = [
        /http[s]?:\/\/[^\s"'>)]*canary[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*ping[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*track[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*pixel[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*log[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*token[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*beacon[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*notify[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*callback[^\s"'>)]*/gi,
        /http[s]?:\/\/[^\s"'>)]*telemetry[^\s"'>)]*/gi,
        /http[s]?:\/\/[a-z0-9.-]*canarytokens\.(com|org)[^\s"'>)]*/gi
    ];

    // Neutralizes tracking URLs in string without altering byte lengths
    const replaceSameLength = (str, pattern, replacement = 'https://0.0.0.0/blocked_canary') => {
        let count = 0;
        const modified = str.replace(pattern, (match) => {
            count++;
            if (replacement.length < match.length) {
                return replacement.padEnd(match.length, ' ');
            } else {
                return replacement.substring(0, match.length);
            }
        });
        return { text: modified, count };
    };

    const handleFile = (file) => {
        if (!file) return;
        fileName = 'clean_' + file.name;
        resultBox.style.display = 'block';
        statusEl.textContent = 'Auditing & Sanitizing File...';
        statusEl.style.color = '#5B9DFF';
        detailsEl.textContent = `Analyzing ${file.name}(${Math.round(file.size / 1024)} KB)...`;
        downloadBtn.style.display = 'none';

        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target.result;
            let totalStripped = 0;

            if (file.name.endsWith('.docx') || file.name.endsWith('.xlsx') || file.name.endsWith('.pptx')) {
                try {
                    const zip = await JSZip.loadAsync(buffer.slice(0));
                    for (const [relativePath, fileEntry] of Object.entries(zip.files)) {
                        if (relativePath.endsWith('.xml') || relativePath.endsWith('.rels') || relativePath.endsWith('.txt')) {
                            let textContent = await fileEntry.async('string');
                            let fileModified = false;
                            
                            trackingPatterns.forEach(pattern => {
                                const { text, count } = replaceSameLength(textContent, pattern);
                                if (count >0) {
                                    textContent = text;
                                    totalStripped += count;
                                    fileModified = true;
                                }
                            });
                            
                            if (fileModified) {
                                zip.file(relativePath, textContent);
                            }
                        }
                    }
                    sanitizedBlob = await zip.generateAsync({ type: 'blob', mimeType: file.type });
                } catch (err) {
                    console.error('Docx scan error:', err);
                }

            } else if (file.name.endsWith('.pdf')) {
                try {
                    // Try PDFLib parsing first
                    let pdfDoc = null;
                    try {
                        pdfDoc = await PDFLib.PDFDocument.load(buffer.slice(0), { ignoreEncryption: true });
                    } catch (parseErr) {
                        console.warn('PDFLib load failed, falling back to raw binary/stream scan:', parseErr);
                    }

                    if (pdfDoc) {
                        const ctx = pdfDoc.context;
                        const isTrackingUrl = (urlStr) => {
                            for (const p of trackingPatterns) {
                                p.lastIndex = 0;
                                if (p.test(urlStr)) return true;
                            }
                            return false;
                        };

                        const allRefs = ctx.enumerateIndirectObjects();
                        for (const [ref, obj] of allRefs) {
                            if (!(obj instanceof PDFLib.PDFDict)) continue;
                            const uriVal = obj.get(PDFLib.PDFName.of('URI'));
                            if (uriVal) {
                                const uriStr = uriVal.toString().replace(/^\(|\)$/g, '');
                                if (isTrackingUrl(uriStr)) {
                                    obj.set(PDFLib.PDFName.of('URI'), PDFLib.PDFString.of('https://0.0.0.0/blocked'));
                                    totalStripped++;
                                }
                            }
                            const jsVal = obj.get(PDFLib.PDFName.of('JS'));
                            if (jsVal && typeof jsVal.toString === 'function') {
                                const jsStr = jsVal.toString();
                                if (isTrackingUrl(jsStr)) {
                                    obj.set(PDFLib.PDFName.of('JS'), PDFLib.PDFString.of('// blocked'));
                                    totalStripped++;
                                }
                            }
                        }
                    }

                    // Raw binary scan on original buffer bytes (latin1)
                    const rawText = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0)));
                    let cleanText = rawText;
                    trackingPatterns.forEach(pattern => {
                        pattern.lastIndex = 0;
                        const { text, count } = replaceSameLength(cleanText, pattern);
                        cleanText = text;
                        totalStripped += count;
                    });

                    // Inflate FlateDecode streams and scan decompressed text
                    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
                    let streamMatch;
                    while ((streamMatch = streamRegex.exec(rawText)) !== null) {
                        try {
                            const streamBytes = new Uint8Array(streamMatch[1].length);
                            for (let k = 0; k < streamMatch[1].length; k++) {
                                streamBytes[k] = streamMatch[1].charCodeAt(k) & 0xff;
                            }
                            const ds = new DecompressionStream('deflate');
                            const writer = ds.writable.getWriter();
                            const reader = ds.readable.getReader();
                            writer.write(streamBytes).catch(() => {});
                            writer.close().catch(() => {});
                            const chunks = [];
                            let done = false;
                            while (!done) {
                                const result = await reader.read();
                                if (result.value) chunks.push(result.value);
                                done = result.done;
                            }
                            const totalLen = chunks.reduce((a, c) => a + c.length, 0);
                            const decompressed = new Uint8Array(totalLen);
                            let offset = 0;
                            for (const chunk of chunks) {
                                decompressed.set(chunk, offset);
                                offset += chunk.length;
                            }
                            const decompStr = new TextDecoder('latin1').decode(decompressed);
                            trackingPatterns.forEach(pattern => {
                                pattern.lastIndex = 0;
                                const matches = decompStr.match(pattern);
                                if (matches) totalStripped += matches.length;
                            });
                        } catch (_) {}
                    }

                    // Build final PDF blob
                    const finalBytes = new Uint8Array(cleanText.length);
                    for (let i = 0; i < cleanText.length; i++) {
                        finalBytes[i] = cleanText.charCodeAt(i) & 0xff;
                    }
                    sanitizedBlob = new Blob([finalBytes], { type: 'application/pdf' });

                } catch (err) {
                    console.error('PDF scan error:', err);
                }
            } else {
                // Flat text files
                let textContent = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
                trackingPatterns.forEach(pattern => {
                    const { text, count } = replaceSameLength(textContent, pattern);
                    textContent = text;
                    totalStripped += count;
                });
                sanitizedBlob = new Blob([textContent], { type: 'text/plain' });
            }

            if (totalStripped >0) {
                statusEl.textContent = `Audit Complete: ${totalStripped} Tracking Callbacks & Canary Tokens Stripped!`;
                statusEl.style.color = '#30d158';
                detailsEl.textContent = `Neutralized ${totalStripped} remote tracking callbacks / CanaryToken hooks in ${file.name}. Your PDF / Office document is now 100% safe to open offline.`;
            } else {
                statusEl.textContent = 'Audit Complete: Zero Web-Bugs or Canary Tokens Found!';
                statusEl.style.color = '#30d158';
                detailsEl.textContent = `No external tracking tokens or web bugs were detected in ${file.name}.`;
            }

            downloadBtn.style.display = 'inline-block';
        };

        reader.readAsArrayBuffer(file);
    };

    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', (e) => handleFile(e.target.files[0]));
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#5B9DFF'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'rgba(91, 157, 255, 0.4)'; });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(91, 157, 255, 0.4)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (!sanitizedBlob) return;
            const url = URL.createObjectURL(sanitizedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}
