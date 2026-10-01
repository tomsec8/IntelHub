// Tool: Document Encryptor & Decryptor (AES-256-GCM Offline)
function initDocEncryptorTool() {
    const fileInput = document.getElementById('input-enc-file');
    const passwordInput = document.getElementById('txt-enc-password');
    const showPasswordChk = document.getElementById('chk-show-enc-password');
    const encryptBtn = document.getElementById('btn-encrypt-file');
    const decryptBtn = document.getElementById('btn-decrypt-file');
    const statusEl = document.getElementById('status-enc-tool');

    if (!fileInput || !encryptBtn || !decryptBtn) return;

    const MAGIC = new TextEncoder().encode('IHEN');
    const VERSION = 1;
    const CURRENT_ITERATIONS = 600000;
    const LEGACY_ITERATIONS = [600000, 100000];
    const HEADER_LEN = 4 + 1 + 4 + 16 + 12;

    if (showPasswordChk && passwordInput) {
        showPasswordChk.addEventListener('change', (e) => {
            passwordInput.type = e.target.checked ? 'text' : 'password';
        });
    }

    function writeUint32BE(value) {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setUint32(0, value, false);
        return out;
    }

    function readUint32BE(bytes, offset) {
        return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
    }

    function startsWithMagic(bytes) {
        if (bytes.length < HEADER_LEN || bytes[4] !== VERSION) return false;
        return MAGIC.every((b, i) => bytes[i] === b);
    }

    async function getCryptoKey(password, salt, mode, iterations) {
        const encoder = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations,
                hash: 'SHA-256'
            },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            [mode]
        );
    }

    async function decryptPayload(password, salt, iv, data, iterations) {
        const key = await getCryptoKey(password, salt, 'decrypt', iterations);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    }

    const processFile = async (mode) => {
        const file = fileInput.files[0];
        const password = passwordInput.value;
        if (!file || !password) {
            statusEl.textContent = 'Please select a file and enter a password.';
            statusEl.style.color = '#ff453a';
            return;
        }

        statusEl.textContent = mode === 'encrypt' ? 'Encrypting...' : 'Decrypting...';
        statusEl.style.color = '#5B9DFF';

        try {
            const fileBytes = new Uint8Array(await file.arrayBuffer());

            if (mode === 'encrypt') {
                const salt = crypto.getRandomValues(new Uint8Array(16));
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const key = await getCryptoKey(password, salt, 'encrypt', CURRENT_ITERATIONS);

                const encryptedContent = await crypto.subtle.encrypt(
                    { name: 'AES-GCM', iv: iv },
                    key,
                    fileBytes
                );

                // Package: IHEN + version + iterations + salt + iv + ciphertext
                const result = new Uint8Array(HEADER_LEN + encryptedContent.byteLength);
                result.set(MAGIC, 0);
                result[4] = VERSION;
                result.set(writeUint32BE(CURRENT_ITERATIONS), 5);
                result.set(salt, 9);
                result.set(iv, 25);
                result.set(new Uint8Array(encryptedContent), HEADER_LEN);

                const blob = new Blob([result], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name + '.enc';
                a.click();
                URL.revokeObjectURL(url);

                statusEl.textContent = 'File Encrypted and Downloaded successfully!';
                statusEl.style.color = '#30d158';
            } else {
                if (fileBytes.length < 28) {
                    throw new Error('File is too short to be a valid encrypted document.');
                }

                let decryptedContent;
                if (startsWithMagic(fileBytes)) {
                    const iterations = readUint32BE(fileBytes, 5);
                    if (!iterations) throw new Error('Encrypted file header is invalid.');
                    const salt = fileBytes.slice(9, 25);
                    const iv = fileBytes.slice(25, 37);
                    const data = fileBytes.slice(HEADER_LEN);
                    try {
                        decryptedContent = await decryptPayload(password, salt, iv, data, iterations);
                    } catch {
                        throw new Error('Incorrect password or corrupted file contents. Decryption failed.');
                    }
                } else {
                    const salt = fileBytes.slice(0, 16);
                    const iv = fileBytes.slice(16, 28);
                    const data = fileBytes.slice(28);
                    let lastErr;
                    for (const iterations of LEGACY_ITERATIONS) {
                        try {
                            decryptedContent = await decryptPayload(password, salt, iv, data, iterations);
                            lastErr = null;
                            break;
                        } catch (err) {
                            lastErr = err;
                        }
                    }
                    if (lastErr) {
                        throw new Error('Incorrect password or corrupted file contents. Decryption failed.');
                    }
                }

                const cleanName = file.name.replace(/\.enc$/i, '');
                const blob = new Blob([decryptedContent], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = cleanName;
                a.click();
                URL.revokeObjectURL(url);

                statusEl.textContent = 'File Decrypted and Downloaded successfully!';
                statusEl.style.color = '#30d158';
            }
        } catch (err) {
            console.error(err);
            statusEl.textContent = err?.message || (mode === 'encrypt'
                ? 'Encryption failed.'
                : 'Decryption failed. Verify that your password is valid and matches the encrypted file.');
            statusEl.style.color = '#ff453a';
        }
    };

    encryptBtn.addEventListener('click', () => processFile('encrypt'));
    decryptBtn.addEventListener('click', () => processFile('decrypt'));
}
