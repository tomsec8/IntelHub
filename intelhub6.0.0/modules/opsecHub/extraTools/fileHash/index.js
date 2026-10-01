// Tool 4: File Hash, Integrity & VirusTotal Lookup
function initFileHashTool() {
    const fileInputA = document.getElementById('input-hash-file-a');
    const fileInputB = document.getElementById('input-hash-file-b');
    const outBoxA = document.getElementById('out-hashes-a');
    const outBoxB = document.getElementById('out-hashes-b');
    const matchEl = document.getElementById('out-hash-compare-match');

    const hashes = { a: {}, b: {} };

    const helperMd5 = (buffer) => {
        const spark = new SparkMD5.ArrayBuffer();
        spark.append(buffer);
        return spark.end();
    };

    const calcHash = async (file, suffix) => {
        if (!file) return;
        const outBox = suffix === 'a' ? outBoxA : outBoxB;
        outBox.style.display = 'block';
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const buffer = e.target.result;
            
            const md5Val = helperMd5(buffer);
            
            const sha1Buffer = await crypto.subtle.digest('SHA-1', buffer);
            const sha1Val = Array.from(new Uint8Array(sha1Buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            
            const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
            const sha256Val = Array.from(new Uint8Array(sha256Buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            hashes[suffix] = { md5: md5Val, sha1: sha1Val, sha256: sha256Val };

            document.getElementById(`hash-md5-${suffix}`).textContent = md5Val;
            document.getElementById(`hash-sha1-${suffix}`).textContent = sha1Val;
            document.getElementById(`hash-sha256-${suffix}`).textContent = sha256Val;

            // Setup VirusTotal button
            const vtBtn = document.getElementById(`btn-vt-lookup-${suffix}`);
            if (vtBtn) {
                vtBtn.style.display = 'inline-block';
                vtBtn.onclick = () => {
                    brw.tabs.create({ url: `https://www.virustotal.com/gui/file/${sha256Val}` }).catch(() => {});
                };
            }

            checkMatch();
        };
        reader.readAsArrayBuffer(file);
    };

    const checkMatch = () => {
        if (!hashes.a.sha256 || !hashes.b.sha256) {
            matchEl.style.display = 'none';
            return;
        }
        matchEl.style.display = 'block';
        if (hashes.a.sha256 === hashes.b.sha256) {
            matchEl.textContent = 'EXACT MATCH: Files are identical byte-for-byte';
            matchEl.style.background = 'rgba(61, 220, 132, 0.15)';
            matchEl.style.border = '1px solid #30d158';
            matchEl.style.color = '#30d158';
        } else {
            matchEl.textContent = 'MISMATCH: Files differ';
            matchEl.style.background = 'rgba(255, 69, 58, 0.15)';
            matchEl.style.border = '1px solid #ff453a';
            matchEl.style.color = '#ff453a';
        }
    };

    if (fileInputA) {
        fileInputA.addEventListener('change', (e) => calcHash(e.target.files[0], 'a'));
    }
    if (fileInputB) {
        fileInputB.addEventListener('change', (e) => calcHash(e.target.files[0], 'b'));
    }
}
