function fillDialog(modal, { title, label, value, confirmLabel, folderChoices, folderValue }) {
    modal.querySelector('[data-dialog-title]').textContent = title;
    const labelEl = modal.querySelector('[data-dialog-label]');
    if (labelEl) labelEl.textContent = label || 'Name';
    const input = modal.querySelector('[data-dialog-input]');
    if (input) {
        input.value = value || '';
        requestAnimationFrame(() => input.focus());
        input.select();
    }
    const saveBtn = modal.querySelector('[data-dialog-save]');
    if (saveBtn && confirmLabel) saveBtn.textContent = confirmLabel;

    const folderWrap = modal.querySelector('[data-dialog-folder-wrap]');
    const folderSelect = modal.querySelector('[data-dialog-folder]');
    if (folderWrap && folderSelect) {
        folderSelect.replaceChildren();
        if (folderChoices?.length) {
            folderWrap.hidden = false;
            folderChoices.forEach((folder) => {
                const opt = document.createElement('option');
                opt.value = String(folder.id);
                opt.textContent = folder.name;
                folderSelect.appendChild(opt);
            });
            folderSelect.value = String(folderValue || folderChoices[0].id);
        } else {
            folderWrap.hidden = true;
        }
    }
}

function openModal(modal) {
    modal.style.display = 'flex';
}

function closeModal(modal) {
    modal.style.display = 'none';
}

export function askText({ title, label = 'Name', value = '', confirmLabel = 'Save', folderChoices, folderValue }) {
    const modal = document.getElementById('namePromptModal');
    if (!modal) {
        const result = window.prompt(title, value);
        return Promise.resolve(result && result.trim() ? result.trim() : null);
    }

    return new Promise((resolve) => {
        fillDialog(modal, { title, label, value, confirmLabel, folderChoices, folderValue });
        openModal(modal);

        const input = modal.querySelector('[data-dialog-input]');
        const saveBtn = modal.querySelector('[data-dialog-save]');
        const cancelBtn = modal.querySelector('[data-dialog-cancel]');
        const folderSelect = modal.querySelector('[data-dialog-folder]');
        let done = false;

        const finish = (result) => {
            if (done) return;
            done = true;
            closeModal(modal);
            input.removeEventListener('keydown', onKey);
            saveBtn.removeEventListener('click', onSave);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onSave = () => {
            const next = input.value.trim();
            if (!next) {
                finish(null);
                return;
            }
            if (folderChoices?.length && folderSelect) {
                finish({ name: next, folderId: folderSelect.value || folderChoices[0]?.id });
                return;
            }
            finish(next);
        };
        const onCancel = () => finish(null);
        const onKey = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                onSave();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };

        saveBtn.addEventListener('click', onSave);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    });
}

export function askAlert(message) {
    return askConfirm(message, { confirmLabel: 'OK', cancelLabel: '' });
}

export function askConfirm(message, { confirmLabel = 'Delete', cancelLabel = 'Cancel' } = {}) {
    const modal = document.getElementById('confirmPromptModal');
    if (!modal) {
        return Promise.resolve(window.confirm(message));
    }

    return new Promise((resolve) => {
        modal.querySelector('[data-dialog-title]').textContent = message;
        const saveBtn = modal.querySelector('[data-dialog-save]');
        const cancelBtn = modal.querySelector('[data-dialog-cancel]');
        saveBtn.textContent = confirmLabel;
        cancelBtn.textContent = cancelLabel || 'Cancel';
        cancelBtn.hidden = !cancelLabel;
        openModal(modal);

        let done = false;
        const finish = (result) => {
            if (done) return;
            done = true;
            closeModal(modal);
            saveBtn.removeEventListener('click', onSave);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onSave = () => finish(true);
        const onCancel = () => finish(false);
        saveBtn.addEventListener('click', onSave);
        cancelBtn.addEventListener('click', onCancel);
    });
}
