// firefox/metadata-upload.js

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const resultsDiv = document.getElementById('results');
    const prompt = document.getElementById('prompt');

    const urlParams = new URLSearchParams(window.location.search);
    const fileType = urlParams.get('type');

    if (fileType === 'image') {
        fileInput.accept = 'image/*';
        prompt.textContent = "Select an image file (JPEG, PNG...).";
    } else if (fileType === 'pdf') {
        fileInput.accept = '.pdf';
        prompt.textContent = "Select a PDF file.";
    } else if (fileType === 'office') {
        fileInput.accept = '.docx,.xlsx,.pptx';
        prompt.textContent = "Select an Office file (DOCX, XLSX...).";
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const resultContainer = document.createElement('div');
        resultContainer.className = 'result-card';
        resultsDiv.prepend(resultContainer);
        resultContainer.textContent = `Processing ${file.name}...`;

        let processPromise;
        switch (fileType) {
            case 'image': processPromise = handleImageFile(file); break;
            case 'pdf': processPromise = handlePdfFile(file); break;
            case 'office': processPromise = handleOfficeFile(file); break;
        }

        processPromise.then(resultElements => {
            resultContainer.innerHTML = ''; 
            resultContainer.appendChild(resultElements);
        });
    });
});

async function handleImageFile(file) {
    const buffer = await file.arrayBuffer();
    try {
        const tags = ExifReader.load(buffer);
        const title = `EXIF Data for ${file.name}`;
        const dataObject = {};
        for (const tag in tags) {
            if (tags[tag] && tags[tag].description) {
                dataObject[tag] = tags[tag].description;
            }
        }
        return createResultsTable(title, dataObject, 'Tag', 'Value');
    } catch (e) { 
        const p = document.createElement('p');
        p.textContent = 'Error: Could not read EXIF data.';
        return p;
    }
}

async function handlePdfFile(file) {
    const buffer = await file.arrayBuffer();
    try {
        const pdfDoc = await PDFLib.PDFDocument.load(buffer);
        const title = `Metadata for ${file.name}`;
        const dataObject = {
            "Title": pdfDoc.getTitle(), "Author": pdfDoc.getAuthor(), "Subject": pdfDoc.getSubject(),
            "Creator": pdfDoc.getCreator(), "Producer": pdfDoc.getProducer(),
            "Creation Date": pdfDoc.getCreationDate(), "Modification Date": pdfDoc.getModificationDate()
        };
        return createResultsTable(title, dataObject, 'Field', 'Value');
    } catch (e) {
        const p = document.createElement('p');
        p.textContent = 'Error: Could not read PDF metadata.';
        return p;
    }
}

async function handleOfficeFile(file) {
    const buffer = await file.arrayBuffer();
    try {
        const zip = await JSZip.loadAsync(buffer);
        const title = `Metadata for ${file.name}`;
        const dataObject = {};
        const metadataFiles = ["docProps/core.xml", "docProps/app.xml"];
        for (const path of metadataFiles) {
            if (zip.files[path]) {
                const content = await zip.files[path].async("string");
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(content, "text/xml");
                const children = xmlDoc.documentElement.childNodes;
                for (const node of children) {
                    if (node.nodeType === 1) {
                        dataObject[node.nodeName] = node.textContent;
                    }
                }
            }
        }
        return createResultsTable(title, dataObject, 'Property', 'Value');
    } catch (e) {
        const p = document.createElement('p');
        p.textContent = 'Error: Could not read Office metadata.';
        return p;
    }
}

function createResultsTable(title, data, keyHeader, valueHeader) {
    const fragment = document.createDocumentFragment();
    const h3 = document.createElement('h3');
    h3.textContent = title;
    fragment.appendChild(h3);
    const table = document.createElement('table');
    const headerRow = table.insertRow();
    const th1 = document.createElement('th');
    th1.textContent = keyHeader;
    const th2 = document.createElement('th');
    th2.textContent = valueHeader;
    headerRow.appendChild(th1);
    headerRow.appendChild(th2);

    for(const key in data) {
        if(data[key]) {
            const row = table.insertRow();
            row.insertCell().textContent = key;
            row.insertCell().textContent = data[key].toString();
        }
    }
    fragment.appendChild(table);
    return fragment;
}