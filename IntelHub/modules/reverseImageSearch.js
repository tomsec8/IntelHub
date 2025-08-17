// modules/reverseImageSearch.js

import { brw, isFirefox } from './utils.js';

function openUploadPage() {
    brw.tabs.create({ url: 'firefox/reverse-image-upload.html' });
    window.close();
}

async function handleReverseSearch(fileOrBlob) {
    const engineOptions = [
        { name: "Google", url: (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img)}` },
        { name: "Yandex", url: (img) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(img)}` },
        { name: "TinEye", url: (img) => `https://tineye.com/search/?url=${encodeURIComponent(img)}` },
        { name: "Bing", url: (img) => `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(img)}&view=detailv2&iss=sbi` },
        { name: "Lenso.ai (manual)", url: () => "https://lenso.ai/en" }
    ];

    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", fileOrBlob);

    try {
        const res = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: formData
        });
        const imgUrl = await res.text();
        if (!imgUrl.startsWith("http")) {
            alert("Image upload failed.");
            return;
        }

        const data = await brw.storage.local.get({ reverseEngines: [] });
        const selected = data.reverseEngines;
        
        const enginesToUse = engineOptions.filter(e => selected.includes(e.name));
        if (enginesToUse.length === 0) {
            alert("No search engines selected.");
            return;
        }
        
        enginesToUse.forEach(engine => {
            const fullUrl = engine.url(imgUrl);
            if (fullUrl) { 
                brw.tabs.create({ url: fullUrl });
            }
        });

    } catch (err) {
        alert("Upload failed: " + err.message);
    }
}


export function initializeReverseImageSearch(container) {
    const reverseBtn = document.createElement("button");
    reverseBtn.className = "category-button";
    reverseBtn.textContent = "Reverse Image Search";

    const reverseWrapper = document.createElement("div");
    reverseWrapper.className = "tool-list";

    reverseBtn.addEventListener("click", () => {
        reverseWrapper.classList.toggle("open");
    });

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
                if(e.target.files[0]) {
                    handleReverseSearch(e.target.files[0])
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
                    handleReverseSearch(file); 
                    return;
                }
            }
            alert("No image found in clipboard.");
        } catch (err) {
            alert("Clipboard access failed: " + err);
        }
    });

    reverseWrapper.appendChild(imageUploadBtn);
    reverseWrapper.appendChild(imagePasteBtn);
    reverseWrapper.appendChild(engineContainer);
    container.appendChild(reverseBtn);
    container.appendChild(reverseWrapper);
}