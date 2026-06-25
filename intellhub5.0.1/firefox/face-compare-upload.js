// firefox/face-compare-upload.js

document.addEventListener("DOMContentLoaded", async () => {
    const statusDiv = document.getElementById("statusDiv");
    const compareBtn = document.getElementById("compareBtn");
    const resultDiv = document.getElementById("resultDiv");

    let modelsLoaded = false;
    let selectedDescriptorA = null;
    let selectedDescriptorB = null;

    try {
        const modelPath = '../libs/face_libs';
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelPath);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelPath);
        modelsLoaded = true;
        statusDiv.textContent = "✅ Models loaded! You can now upload images.";
    } catch(err) {
        console.error(err);
        statusDiv.textContent = "❌ Error loading face models.";
        statusDiv.style.color = "#ff6b6b";
    }

    function setupSlot(side) {
        const slot = document.getElementById(`slot${side}`);
        const input = document.getElementById(`input${side}`);
        const preview = document.getElementById(`preview${side}`);
        const uploadText = document.getElementById(`uploadText${side}`);
        const faceInfo = document.getElementById(`faceInfo${side}`);
        const faceSelect = document.getElementById(`faceSelect${side}`);

        slot.addEventListener("click", () => {
            if(modelsLoaded) input.click();
        });

        input.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if(!file) return;

            uploadText.textContent = "⏳ Detecting faces...";
            preview.style.display = "none";
            faceInfo.style.display = "none";
            faceSelect.style.display = "none";

            const img = new Image();
            const url = URL.createObjectURL(file);
            img.src = url;
            await new Promise(r => { img.onload = r; });

            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptors();
            URL.revokeObjectURL(url);

            if(detections.length === 0) {
                uploadText.textContent = "❌ No face found";
                uploadText.style.color = "#ff6b6b";
                if(side === "A") selectedDescriptorA = null; else selectedDescriptorB = null;
                checkCompareReady();
                return;
            }

            uploadText.style.display = "none";
            preview.style.display = "block";

            if(side === "A") selectedDescriptorA = detections[0].descriptor;
            else selectedDescriptorB = detections[0].descriptor;

            drawFacesOnCanvas(preview, img, detections, 0);

            if(detections.length > 1) {
                faceInfo.textContent = `${detections.length} faces — Face #1 selected`;
                faceSelect.style.display = "block";
                faceSelect.innerHTML = "";
                detections.forEach((det, i) => {
                    const btn = document.createElement("button");
                    btn.className = "face-btn";
                    btn.textContent = `Face #${i+1}`;
                    if(i===0) btn.style.borderColor = "#badc58";
                    btn.addEventListener("click", (ev) => {
                        ev.stopPropagation();
                        if(side === "A") selectedDescriptorA = det.descriptor;
                        else selectedDescriptorB = det.descriptor;
                        
                        drawFacesOnCanvas(preview, img, detections, i);
                        faceInfo.textContent = `Selected: Face #${i+1}`;
                        
                        Array.from(faceSelect.children).forEach(b => b.style.borderColor = "#555");
                        btn.style.borderColor = "#badc58";
                        checkCompareReady();
                    });
                    faceSelect.appendChild(btn);
                });
            } else {
                faceInfo.textContent = "1 face detected ✓";
            }
            faceInfo.style.display = "block";
            checkCompareReady();
        });
    }

    function drawFacesOnCanvas(canvas, img, detections, selectedIdx) {
        const maxW = 300;
        const maxH = 300;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        detections.forEach((det, i) => {
            const box = det.detection.box;
            ctx.strokeStyle = (i === selectedIdx) ? "#badc58" : "#ff6b6b";
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x * scale, box.y * scale, box.width * scale, box.height * scale);
            ctx.fillStyle = (i === selectedIdx) ? "#badc58" : "#ff6b6b";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText(`#${i + 1}`, box.x * scale + 4, box.y * scale - 4);
        });
    }

    function checkCompareReady() {
        if(selectedDescriptorA && selectedDescriptorB) {
            compareBtn.disabled = false;
        } else {
            compareBtn.disabled = true;
        }
    }

    setupSlot("A");
    setupSlot("B");

    compareBtn.addEventListener("click", () => {
        const distance = faceapi.euclideanDistance(selectedDescriptorA, selectedDescriptorB);
        const similarity = Math.max(0, Math.min(100, ((1 - distance) * 100).toFixed(1)));
        const isMatch = distance < 0.6;

        resultDiv.style.display = "block";
        resultDiv.innerHTML = "";

        const card = document.createElement("div");
        card.style.background = "#1e272e";
        card.style.padding = "20px";
        card.style.borderRadius = "8px";
        card.style.border = `2px solid ${isMatch ? '#badc58' : '#ff6b6b'}`;
        card.style.textAlign = "center";
        card.style.maxWidth = "500px";
        card.style.margin = "0 auto";

        const verdict = document.createElement("div");
        verdict.style.fontSize = "20px";
        verdict.style.fontWeight = "bold";
        verdict.style.marginBottom = "10px";
        verdict.style.color = isMatch ? "#badc58" : "#ff6b6b";
        verdict.textContent = isMatch ? "✅ MATCH — Same Person" : "❌ NO MATCH — Different People";
        card.appendChild(verdict);

        const scoreLine = document.createElement("div");
        scoreLine.style.fontSize = "16px";
        scoreLine.style.color = "#ccc";
        scoreLine.style.marginBottom = "15px";
        scoreLine.textContent = `Similarity: ${similarity}% | Distance: ${distance.toFixed(4)}`;
        card.appendChild(scoreLine);

        const barBg = document.createElement("div");
        barBg.style.background = "#333";
        barBg.style.borderRadius = "6px";
        barBg.style.height = "12px";
        barBg.style.width = "100%";
        
        const bar = document.createElement("div");
        bar.style.height = "100%";
        bar.style.borderRadius = "6px";
        bar.style.width = `${similarity}%`;
        bar.style.background = isMatch ? "linear-gradient(90deg, #badc58, #6ab04c)" : "linear-gradient(90deg, #ff6b6b, #ee5a24)";
        barBg.appendChild(bar);
        card.appendChild(barBg);

        resultDiv.appendChild(card);
    });
});
