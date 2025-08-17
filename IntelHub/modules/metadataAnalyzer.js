// modules/metadataAnalyzer.js

import { brw, isFirefox } from './utils.js';

function openUploadPage(type) {
    brw.tabs.create({
        url: `firefox/metadata-upload.html?type=${type}`
    });
    window.close(); 
}

// --- NEW: Function to display basic file info for unsupported formats ---
function displayBasicFileInfo(file, outputContainer) {
    const table = document.createElement("table");
    const basicInfo = {
        "File Name": file.name,
        "File Size": `${(file.size / 1024).toFixed(2)} KB`,
        "MIME Type": file.type,
        "Last Modified": new Date(file.lastModified).toLocaleString()
    };

    for (const key in basicInfo) {
        const row = table.insertRow();
        const keyCell = row.insertCell();
        keyCell.textContent = key;
        keyCell.style.fontWeight = 'bold';
        const valueCell = row.insertCell();
        valueCell.textContent = basicInfo[key];
    }
    outputContainer.appendChild(table);
    
    const note = document.createElement('p');
    note.textContent = "Note: Full EXIF data is not available for this image format. Displaying basic file information instead.";
    note.style.fontSize = '12px';
    note.style.marginTop = '10px';
    note.style.color = '#ccc';
    outputContainer.appendChild(note);
}


function handleLocalImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const output = createResultsContainer(`Metadata for: ${file.name}`);
    
    // Check if the format is likely supported by ExifReader (JPEG/TIFF)
    if (file.type === 'image/jpeg' || file.type === 'image/tiff') {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const tags = ExifReader.load(e.target.result);
                if (Object.keys(tags).length === 0) {
                    throw new Error("No EXIF data found.");
                }
                const table = document.createElement("table");
                for (const tag in tags) {
                    if (tags[tag] && tags[tag].description) {
                        const row = table.insertRow();
                        const keyCell = row.insertCell();
                        keyCell.textContent = tag;
                        keyCell.style.fontWeight = 'bold';
                        const valueCell = row.insertCell();
                        valueCell.textContent = tags[tag].description;
                    }
                }
                output.appendChild(table);
            } catch (err) { 
                console.error("EXIF Error:", err);
                // Fallback to basic info if EXIF reading fails for any reason
                output.innerHTML = ''; // Clear previous content
                const title = document.createElement("h3");
                title.textContent = `Metadata for: ${file.name}`;
                title.style.margin = "0 0 10px 0";
                title.style.fontSize = "14px";
                output.appendChild(title);
                displayBasicFileInfo(file, output);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        // For other formats like AVIF, PNG, WebP, show basic info directly
        displayBasicFileInfo(file, output);
    }
}

function handlePdfMetadata(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const pdfDoc = await PDFLib.PDFDocument.load(e.target.result, { ignoreEncryption: true });
            const output = createResultsContainer(`PDF Metadata for: ${file.name}`);
            const table = document.createElement("table");
            
            const getField = (getter) => {
                try {
                    return { value: getter(), error: null };
                } catch (e) {
                    console.warn(`Could not read a PDF metadata field: ${e.message}`);
                    return { value: null, error: e.message };
                }
            };
            
            const fields = {
                "Title": getField(() => pdfDoc.getTitle()),
                "Author": getField(() => pdfDoc.getAuthor()),
                "Subject": getField(() => pdfDoc.getSubject()),
                "Keywords": getField(() => pdfDoc.getKeywords()),
                "Creator": getField(() => pdfDoc.getCreator()),
                "Producer": getField(() => pdfDoc.getProducer()),
                "Creation Date": getField(() => pdfDoc.getCreationDate()),
                "Modification Date": getField(() => pdfDoc.getModificationDate())
            };

            for (const key in fields) {
                const result = fields[key];
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
                }
            }
            output.appendChild(table);
        } catch (err) {
            console.error("PDF Error:", err);
            alert("Could not read metadata from this PDF. The file might be corrupted, encrypted, or in an unsupported format.");
        }
    };
    reader.readAsArrayBuffer(file);
}

function handleOfficeMetadata(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const zip = await JSZip.loadAsync(e.target.result);
            const output = createResultsContainer(`Office Metadata for: ${file.name}`);
            const table = document.createElement("table");
            const metadataFiles = ["docProps/core.xml", "docProps/app.xml"];
            const metadata = {};
            for (const path of metadataFiles) {
                if (zip.files[path]) {
                    const content = await zip.files[path].async("string");
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(content, "text/xml");
                    const children = xmlDoc.documentElement.childNodes;
                    for (const node of children) {
                        if (node.nodeType === 1) {
                            metadata[node.nodeName] = node.textContent;
                        }
                    }
                }
            }
            for (const key in metadata) {
                const row = table.insertRow();
                const keyCell = row.insertCell();
                keyCell.textContent = key;
                keyCell.style.fontWeight = 'bold';
                const valueCell = row.insertCell();
                valueCell.textContent = metadata[key];
            }
            output.appendChild(table);
        } catch (err) {
            console.error("Office Error:", err);
            alert("Could not read metadata from this Office file.");
        }
    };
    reader.readAsArrayBuffer(file);
}

function createResultsContainer(titleText) {
    const mainContainer = document.getElementById('categoryButtons');
    const existingOutput = document.getElementById('metadata-output');
    if (existingOutput) existingOutput.remove();

    const output = document.createElement("div");
    output.id = 'metadata-output';
    output.style.padding = "10px";
    output.style.marginTop = "10px";
    output.style.background = "#2c1e3f";
    output.style.color = "#ffcc99";
    output.style.borderRadius = "12px";
    output.style.maxHeight = "250px";
    output.style.overflowY = "auto";
    
    const title = document.createElement("h3");
    title.textContent = titleText;
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "14px";
    output.appendChild(title);

    mainContainer.appendChild(output);
    return output;
}

export function initializeMetadataAnalyzer(container) {
    const metaBtn = document.createElement("button");
    metaBtn.className = "category-button";
    metaBtn.textContent = "Metadata Analyzer";
    const metaWrapper = document.createElement("div");
    metaWrapper.className = "tool-list";
    metaBtn.addEventListener("click", () => {
        metaWrapper.classList.toggle("open");
    });
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const imgBtn = document.createElement("button");
    imgBtn.className = "sub-category-button";
    imgBtn.textContent = "Upload image file";
    imgBtn.addEventListener("click", () => {
        if (isFirefox()) {
            openUploadPage('image');
        } else { 
            fileInput.accept = "image/*";
            fileInput.onchange = handleLocalImageUpload;
            fileInput.click();
        }
    });

    const pdfBtn = document.createElement("button");
    pdfBtn.className = "sub-category-button";
    pdfBtn.textContent = "Upload PDF file";
    pdfBtn.addEventListener("click", () => {
        if (isFirefox()) {
            openUploadPage('pdf');
        } else { 
            fileInput.accept = ".pdf";
            fileInput.onchange = handlePdfMetadata;
            fileInput.click();
        }
    });

    const officeBtn = document.createElement("button");
    officeBtn.className = "sub-category-button";
    officeBtn.textContent = "Upload Office file";
    officeBtn.addEventListener("click", () => {
        if (isFirefox()) {
            openUploadPage('office');
        } else { 
            fileInput.accept = ".docx,.xlsx,.pptx";
            fileInput.onchange = handleOfficeMetadata;
            fileInput.click();
        }
    });

    metaWrapper.appendChild(imgBtn);
    metaWrapper.appendChild(pdfBtn);
    metaWrapper.appendChild(officeBtn);
    container.appendChild(metaBtn);
    container.appendChild(metaWrapper);
}
