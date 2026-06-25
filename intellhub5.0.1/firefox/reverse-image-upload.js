// firefox/reverse-image-upload.js

const brw = self.browser || self.chrome;

document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('imageInput');
    const statusDiv = document.getElementById('status');
    const engineOptions = [
        { name: "Google", url: (img) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(img)}` },
        { name: "Yandex", url: (img) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(img)}` },
        { name: "TinEye", url: (img) => `https://tineye.com/search/?url=${encodeURIComponent(img)}` },
        { name: "Bing", url: (img) => `https://www.bing.com/images/search?q=imgurl:${encodeURIComponent(img)}&view=detailv2&iss=sbi` },
        { name: "Lenso.ai (manual)", url: () => "https://lenso.ai/en" }
    ];

    imageInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        statusDiv.textContent = `Uploading ${file.name}...`;

        const formData = new FormData();
        formData.append("reqtype", "fileupload");
        formData.append("fileToUpload", file);

        try {
            const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: formData });
            const imgUrl = await res.text();
            if (!imgUrl.startsWith("http")) {
                statusDiv.textContent = "Image upload failed. Please try again.";
                return;
            }

            statusDiv.textContent = `Image uploaded! Opening search tabs...`;
            
            brw.storage.local.get({reverseEngines: []}, (data) => {
                const selected = data.reverseEngines;
                if (selected.length === 0) {
                    statusDiv.textContent = "No search engines selected. Please configure them in the extension popup.";
                    return;
                }
                const enginesToUse = engineOptions.filter(e => selected.includes(e.name));
                enginesToUse.forEach(engine => {
                    brw.tabs.create({ url: engine.url(imgUrl) });
                });
                setTimeout(() => window.close(), 2000);
            });
        } catch (err) {
            statusDiv.textContent = `Upload failed: ${err.message}`;
        }
    });
});