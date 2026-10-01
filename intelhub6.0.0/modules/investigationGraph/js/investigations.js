
import { state } from './main.js';
import { createNodeElement, createConnectionFromData, updateAllConnections, renderAllShapes, renderGroups } from './graph.js';
import { initHistory, addToHistory } from './history.js';
import { BUILT_IN_TEMPLATES } from './templates.js';
import { askText, askConfirm, askAlert } from './dialogs.js';

export function getFolderChoices() {
    return workspaceFolders();
}

export async function createNewInvestigation() {
    if (!state.folders.length) {
        const folderName = await askText({
            title: 'New folder',
            label: 'Create a folder first',
            value: 'Cases',
            confirmLabel: 'Create'
        });
        if (!folderName) return;
        const folder = { id: Date.now(), name: typeof folderName === 'string' ? folderName : folderName.name };
        state.folders.push(folder);
        state.activeFolderId = folder.id;
        await saveInvestigations();
    }

    const result = await askText({
        title: 'New investigation',
        label: 'Investigation name',
        value: `Investigation ${state.investigations.length + 1}`,
        confirmLabel: 'Create',
        folderChoices: getFolderChoices(),
        folderValue: state.activeFolderId || state.folders[0]?.id
    });
    if (!result) return;
    const name = typeof result === 'string' ? result : result.name;
    const folderId = typeof result === 'string' ? (state.activeFolderId || state.folders[0]?.id) : result.folderId;
    if (!folderId) {
        await askAlert('Create a folder first.');
        return;
    }
    const newInvestigation = { 
        id: Date.now(), 
        name: name.trim(), 
        folderId,
        created: new Date().toISOString(), 
        modified: new Date().toISOString(), 
        data: { nodes: [], connections: [], shapes: [] } 
    };
    state.activeFolderId = newInvestigation.folderId;
    state.investigations.push(newInvestigation); 
    await saveInvestigations();
    loadInvestigation(newInvestigation);
}

export function loadInvestigation(investigation) {
    if (!investigation) return;
    state.currentInvestigation = investigation;
    state.activeFolderId = folderIdOf(investigation);
    
    chrome.storage.local.set({ 'last_investigation_id': investigation.id });
    
    const canvas = document.getElementById('canvas');
    const svg = document.querySelector('.connection-svg');

    canvas.querySelectorAll('.node, .group-box, .connection-label, .connection-toolbar').forEach(el => el.remove());
    svg.querySelectorAll('.connection-line:not(#preview-line), .connection-hit-area, .connection-drag-point, .shape').forEach(el => el.remove());

    state.nodes = [];
    state.connections = [];
    state.groups = investigation.data.groups || [];
    state.shapes = investigation.data.shapes || [];

    (investigation.data.nodes || []).forEach(nodeData => {
        const node = { ...nodeData };

        if (!node.customData) {
            console.log(`Migrating old format node: ${node.title}`);
            node.customData = {};
            const template = BUILT_IN_TEMPLATES[node.type] || BUILT_IN_TEMPLATES['other'];
            
            if (template) {
                const titleField = template.fields.find(f => f.isTitle);
                const descField = template.fields.find(f => f.type === 'textarea' && !f.isTitle);

                if (titleField && node.title) {
                    node.customData[titleField.id] = node.title;
                }
                if (descField && node.content) {
                    node.customData[descField.id] = node.content;
                }
            }
        }

        if (!node.sources) { 
            node.sources = [];
        }
        state.nodes.push(node);
        createNodeElement(node);
    });
    
    (investigation.data.connections || []).forEach(connData => {
        createConnectionFromData(connData);
    });

    renderGroups();
    
    state.nodeCounter = state.nodes.length > 0 ? Math.max(0, ...state.nodes.map(n => n.id)) + 1 : 1;
    state.connectionCounter = state.connections.length > 0 ? Math.max(0, ...state.connections.map(c => c.id)) + 1 : 1;
    
    const nodesWithImages = state.nodes.filter(n => n.image);
    if (nodesWithImages.length > 0) {
        let loadedCount = 0;
        nodesWithImages.forEach(node => {
            const img = node.element?.querySelector('.node-image');
            if (img) {
                if (img.complete) {
                    loadedCount++;
                    if (loadedCount === nodesWithImages.length) {
                        updateAllConnections();
                    }
                } else {
                    img.onload = () => {
                        loadedCount++;
                        if (loadedCount === nodesWithImages.length) {
                            updateAllConnections();
                        }
                    };
                }
            }
        });
    } else {
        updateAllConnections();
    }
    
    renderInvestigationsList();
    initHistory(state);
    notifyInvestigationChanged();
}

export async function saveCurrentInvestigation() {
    if (!state.currentInvestigation) return;
    state.currentInvestigation.modified = new Date().toISOString();
    state.currentInvestigation.data = {
        nodes: state.nodes.map(n => ({ 
            id: n.id, x: n.x, y: n.y, 
            width: n.element.offsetWidth, 
            height: n.element.offsetHeight, 
            title: n.title, type: n.type, customData: n.customData, 
            image: n.image, color: n.color,
            sources: n.sources || []
        })),
        connections: state.connections.map(c => ({ 
            id: c.id, 
            from: c.from.id, fromSide: c.fromSide,
            to: c.to.id, toSide: c.toSide,
            label: c.label, color: c.color,
            style: c.style 
        })),
        groups: state.groups,
        shapes: state.shapes
    };
    await saveInvestigations();
    renderInvestigationsList();
    notifyInvestigationChanged();
}

let ignoreRemoteStorage = false;

export async function saveInvestigations() {
    try {
        ignoreRemoteStorage = true;
        await chrome.storage.local.set({
            'osint_investigations': state.investigations,
            'osint_folders': state.folders
        });
    } catch (e) {
        console.error("Error saving to chrome.storage.local:", e);
        askAlert('An error occurred while saving the investigation.');
    } finally {
        setTimeout(() => { ignoreRemoteStorage = false; }, 80);
    }
}

export function watchInvestigationStorage() {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || ignoreRemoteStorage) return;
        if (!changes.osint_investigations && !changes.last_investigation_id && !changes.osint_folders) return;

        if (changes.osint_investigations) {
            state.investigations = changes.osint_investigations.newValue || [];
        }
        if (changes.osint_folders) {
            state.folders = changes.osint_folders.newValue || [];
        }

        const wantedId = changes.last_investigation_id?.newValue ?? state.currentInvestigation?.id;
        const next = state.investigations.find((inv) => String(inv.id) === String(wantedId))
            || state.investigations[0]
            || null;

        if (next) loadInvestigation(next);
        else {
            state.currentInvestigation = null;
            renderInvestigationsList();
            notifyInvestigationChanged();
        }
    });
}

export async function loadInvestigations() {
    try {
        const data = await chrome.storage.local.get(['osint_investigations', 'osint_folders', 'last_investigation_id']);
        state.investigations = data.osint_investigations || [];
        state.folders = data.osint_folders || [];
        migrateOrphanInvestigations();
        if (!state.folders.some((folder) => String(folder.id) === String(state.activeFolderId))) {
            state.activeFolderId = state.folders[0]?.id || null;
        }
        
        if (data.last_investigation_id) {
            const lastInvestigation = state.investigations.find(inv => inv.id === data.last_investigation_id);
            if (lastInvestigation) {
                loadInvestigation(lastInvestigation);
                renderInvestigationsList();
                return;
            }
        }
        
        if (state.investigations.length > 0) {
            loadInvestigation(state.investigations[0]);
        } else {
            renderInvestigationsList();
            notifyInvestigationChanged();
        }
    } catch (e) {
        console.error("Error loading from chrome.storage.local:", e);
        state.investigations = [];
        renderInvestigationsList();
        notifyInvestigationChanged();
    }
}
    
export function notifyInvestigationChanged() {
    document.dispatchEvent(new CustomEvent('osint-investigation-changed', {
        detail: state.currentInvestigation
    }));
}

function createPenButton(className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.title = 'Rename';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M11.2 1.6a1.4 1.4 0 0 1 2 0l1.2 1.2a1.4 1.4 0 0 1 0 2L6.3 12.9 3 13.8l.9-3.3z');
    svg.appendChild(path);
    button.appendChild(svg);
    return button;
}

function folderIdOf(inv) {
    const valid = state.folders.find((folder) => String(folder.id) === String(inv.folderId));
    return valid ? valid.id : state.folders[0]?.id;
}

function workspaceFolders() {
    return [...(state.folders || [])];
}

function migrateOrphanInvestigations() {
    if (!state.investigations.length) return;
    if (!state.folders.length) {
        const folder = { id: Date.now(), name: 'Cases' };
        state.folders = [folder];
    }
    const fallback = state.folders[0].id;
    let changed = false;
    state.investigations.forEach((inv) => {
        const valid = state.folders.some((folder) => String(folder.id) === String(inv.folderId));
        if (!valid) {
            inv.folderId = fallback;
            changed = true;
        }
    });
    if (changed) saveInvestigations();
}

function closeSidebarMenu() {
    document.querySelectorAll('.ws-ctx-menu:not(.ws-ctx-submenu)').forEach((el) => el.remove());
}

function decorateMenuButton(btn, item) {
    if (item.swatch) {
        const dot = document.createElement('span');
        dot.className = 'ws-ctx-dot';
        dot.style.background = item.swatch;
        btn.prepend(dot);
        btn.classList.add('ws-ctx-swatch');
    }
    if (item.checked) btn.classList.add('is-checked');
}

function appendMenuItems(menu, items) {
    items.forEach((item) => {
        if (item.separator) {
            const line = document.createElement('div');
            line.className = 'ws-ctx-sep';
            menu.appendChild(line);
            return;
        }
        if (item.children?.length) {
            const wrap = document.createElement('div');
            wrap.className = 'ws-ctx-sub';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ws-ctx-parent';
            btn.textContent = item.label;
            decorateMenuButton(btn, item);
            const sub = document.createElement('div');
            sub.className = 'ws-ctx-menu ws-ctx-submenu';
            appendMenuItems(sub, item.children);
            wrap.append(btn, sub);
            menu.appendChild(wrap);
            return;
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item.label;
        decorateMenuButton(btn, item);
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            closeSidebarMenu();
            item.onClick();
        });
        menu.appendChild(btn);
    });
}

function placeContextMenu(menu, clientX, clientY) {
    const pad = 8;
    const gap = 8;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = clientX + gap;
    let top = clientY + gap;

    if (left + width > window.innerWidth - pad) {
        left = clientX - width - gap;
        menu.classList.add('is-flip');
    }
    if (left < pad) left = pad;

    if (top + height > window.innerHeight - pad) {
        top = clientY - height - gap;
        menu.classList.add('is-flip-up');
    }
    if (top < pad) top = pad;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
}

function openSidebarMenu(clientX, clientY, items) {
    closeSidebarMenu();
    const menu = document.createElement('div');
    menu.className = 'ws-ctx-menu';
    appendMenuItems(menu, items);
    const host = document.querySelector('body.is-graph-fullscreen .ws-case') || document.body;
    host.appendChild(menu);
    placeContextMenu(menu, clientX, clientY);

    const onDoc = (event) => {
        if (!menu.contains(event.target)) {
            closeSidebarMenu();
            document.removeEventListener('mousedown', onDoc, true);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', onDoc, true), 0);
}

export { openSidebarMenu as openContextMenu };

export async function moveInvestigationToFolder(id, folderId) {
    const investigation = state.investigations.find((inv) => inv.id === id);
    if (!investigation) return;
    investigation.folderId = folderId || state.folders[0]?.id;
    investigation.modified = new Date().toISOString();
    state.activeFolderId = investigation.folderId;
    await saveInvestigations();
    renderInvestigationsList();
    notifyInvestigationChanged();
}

function createInvestigationRow(inv, index) {
    const workspace = document.documentElement.classList.contains('workspace-page');
    const invDiv = document.createElement('div');
    invDiv.className = workspace ? 'investigation-item ws-inv' : 'investigation-item';
    invDiv.dataset.index = String(index);
    invDiv.dataset.id = String(inv.id);
    invDiv.draggable = true;
    if (state.currentInvestigation && state.currentInvestigation.id === inv.id) {
        invDiv.classList.add('active');
    }

    const dateStr = new Date(inv.modified).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
    const infoDiv = document.createElement('div');
    infoDiv.className = 'investigation-info';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'investigation-name';
    nameDiv.textContent = inv.name;
    const dateDiv = document.createElement('div');
    dateDiv.className = 'investigation-date';
    dateDiv.textContent = dateStr;
    infoDiv.append(nameDiv, dateDiv);
    invDiv.appendChild(infoDiv);

    if (!workspace) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'investigation-actions';
        const renameButton = createPenButton('investigation-rename');
        renameButton.dataset.id = inv.id;
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'investigation-delete';
        deleteButton.dataset.id = inv.id;
        deleteButton.title = 'Delete';
        deleteButton.textContent = '×';
        actionsDiv.append(renameButton, deleteButton);
        invDiv.appendChild(actionsDiv);
    } else {
        invDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const otherFolders = workspaceFolders().filter((folder) => String(folder.id) !== String(folderIdOf(inv)));
            const items = [
                { label: 'Rename', onClick: () => renameInvestigation(inv.id) },
                ...(otherFolders.length ? [{
                    label: 'Move to folder',
                    children: otherFolders.map((folder) => ({
                        label: folder.name,
                        onClick: () => moveInvestigationToFolder(inv.id, folder.id)
                    }))
                }] : []),
                { separator: true },
                { label: 'Delete', onClick: () => deleteInvestigation(inv.id) }
            ];
            openSidebarMenu(e.clientX, e.clientY, items);
        });
    }

    invDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(inv.id));
        e.dataTransfer.setData('application/x-inv-index', String(index));
        setTimeout(() => invDiv.classList.add('dragging'), 0);
    });
    invDiv.addEventListener('dragend', () => invDiv.classList.remove('dragging'));
    invDiv.addEventListener('dragover', (e) => e.preventDefault());
    invDiv.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fromId = Number(e.dataTransfer.getData('text/plain'));
        const toId = inv.id;
        if (fromId === toId) return;
        const fromIndex = state.investigations.findIndex((item) => item.id === fromId);
        const toIndex = state.investigations.findIndex((item) => item.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;
        const [moved] = state.investigations.splice(fromIndex, 1);
        moved.folderId = folderIdOf(inv);
        state.investigations.splice(toIndex, 0, moved);
        await saveInvestigations();
        renderInvestigationsList();
    });

    return invDiv;
}

function bindInvestigationRowEvents(root) {
    root.querySelectorAll('.investigation-info').forEach((item) => {
        item.addEventListener('click', () => {
            const invId = Number(item.parentElement.dataset.id);
            if (state.currentInvestigation && state.currentInvestigation.id === invId) return;
            loadInvestigation(state.investigations.find((i) => i.id === invId));
        });
    });
    root.querySelectorAll('.investigation-delete').forEach((button) => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteInvestigation(Number(button.dataset.id));
        });
    });
    root.querySelectorAll('.investigation-rename').forEach((button) => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            renameInvestigation(Number(button.dataset.id));
        });
    });
}

export async function createNewFolder() {
    const name = await askText({
        title: 'New folder',
        label: 'Folder name',
        value: 'New folder',
        confirmLabel: 'Create'
    });
    if (!name) return;
    const folder = { id: Date.now(), name };
    state.folders.push(folder);
    state.activeFolderId = folder.id;
    await saveInvestigations();
    renderInvestigationsList();
}

export async function renameFolder(id) {
    const folder = state.folders.find((item) => String(item.id) === String(id));
    if (!folder) return;
    const name = await askText({
        title: 'Rename folder',
        label: 'Folder name',
        value: folder.name,
        confirmLabel: 'Save'
    });
    if (!name || name === folder.name) return;
    folder.name = name;
    await saveInvestigations();
    renderInvestigationsList();
}

export async function deleteFolder(id) {
    const folder = state.folders.find((item) => String(item.id) === String(id));
    if (!folder) return;
    if (state.folders.length <= 1) {
        await askAlert('Create another folder before deleting this one.');
        return;
    }
    const ok = await askConfirm(`Delete folder "${folder.name}"? Investigations move to another folder.`);
    if (!ok) return;
    const fallback = state.folders.find((item) => String(item.id) !== String(id));
    state.investigations.forEach((inv) => {
        if (String(folderIdOf(inv)) === String(id)) inv.folderId = fallback.id;
    });
    state.folders = state.folders.filter((item) => String(item.id) !== String(id));
    if (String(state.activeFolderId) === String(id)) state.activeFolderId = fallback.id;
    await saveInvestigations();
    renderInvestigationsList();
}

export function renderInvestigationsList() {
    const list = document.getElementById('investigationsList');
    if (!list) return;
    list.replaceChildren();
    const workspace = document.documentElement.classList.contains('workspace-page');

    if (!workspace) {
        state.investigations.forEach((inv, index) => {
            list.appendChild(createInvestigationRow(inv, index));
        });
        bindInvestigationRowEvents(list);
        return;
    }

    const query = document.getElementById('sidebarSearch')?.value.trim().toLowerCase() || '';
    let shown = 0;

    workspaceFolders().forEach((folder) => {
        const folderMatch = !query || folder.name.toLowerCase().includes(query);
        const cases = state.investigations.filter((inv) => {
            if (String(folderIdOf(inv)) !== String(folder.id)) return false;
            if (!query || folderMatch) return true;
            return inv.name.toLowerCase().includes(query);
        });
        if (query && !folderMatch && !cases.length) return;
        shown += 1;

        const wrap = document.createElement('div');
        const isOpen = String(state.activeFolderId) === String(folder.id) || Boolean(query);
        wrap.className = isOpen ? 'ws-folder is-open' : 'ws-folder';
        wrap.dataset.folderId = String(folder.id);

        const head = document.createElement('div');
        head.className = 'ws-folder-head';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'ws-folder-toggle';
        toggle.textContent = folder.name;

        head.appendChild(toggle);
        head.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSidebarMenu(e.clientX, e.clientY, [
                { label: 'Rename', onClick: () => renameFolder(folder.id) },
                { label: 'Delete', onClick: () => deleteFolder(folder.id) }
            ]);
        });
        const pages = document.createElement('div');
        pages.className = 'ws-folder-pages';

        cases.forEach((inv) => {
            const index = state.investigations.indexOf(inv);
            pages.appendChild(createInvestigationRow(inv, index));
        });

        toggle.addEventListener('click', () => {
            wrap.classList.toggle('is-open');
            if (wrap.classList.contains('is-open')) state.activeFolderId = folder.id;
        });

        const allowDrop = (e) => e.preventDefault();
        const onDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fromId = Number(e.dataTransfer.getData('text/plain'));
            const moved = state.investigations.find((item) => item.id === fromId);
            if (!moved) return;
            moved.folderId = folder.id;
            state.activeFolderId = folder.id;
            await saveInvestigations();
            renderInvestigationsList();
        };
        wrap.addEventListener('dragover', allowDrop);
        wrap.addEventListener('drop', onDrop);

        wrap.append(head, pages);
        list.appendChild(wrap);
    });

    if (!shown) {
        const empty = document.createElement('p');
        empty.className = 'ws-sidebar-empty';
        empty.textContent = query ? 'No matching cases.' : 'No investigations yet.';
        list.appendChild(empty);
    }

    bindInvestigationRowEvents(list);
}

export async function renameInvestigation(id) {
    const investigation = state.investigations.find(inv => inv.id === id);
    if (!investigation) return;

    const newName = await askText({
        title: 'Rename investigation',
        label: 'Investigation name',
        value: investigation.name,
        confirmLabel: 'Save'
    });

    if (newName && newName !== investigation.name) {
        investigation.name = newName.trim();
        investigation.modified = new Date().toISOString();
        await saveInvestigations();
        renderInvestigationsList();
        notifyInvestigationChanged();
    }
}

export async function deleteInvestigation(id) {
    const ok = await askConfirm('Permanently delete this investigation?');
    if (!ok) return;
    state.investigations = state.investigations.filter(inv => inv.id !== id);
    await saveInvestigations();
    if (state.currentInvestigation && state.currentInvestigation.id === id) {
        if (state.investigations.length > 0) {
            loadInvestigation(state.investigations[0]);
        } else {
            state.currentInvestigation = null;
            const canvas = document.getElementById('canvas');
            const svg = document.querySelector('.connection-svg');

            canvas.querySelectorAll('.node, .group-box').forEach(el => el.remove());

            canvas.querySelectorAll('.connection-label, .connection-toolbar').forEach(el => el.remove());

            if (svg) {
                const svgElements = svg.querySelectorAll('.connection-line:not(#preview-line), .connection-hit-area, .connection-drag-point');
                svgElements.forEach(el => el.remove());
            }

            state.nodes = [];
            state.connections = [];
            state.shapes = [];

            renderInvestigationsList();
            notifyInvestigationChanged();
        }
    } else {
        renderInvestigationsList();
    }
}


export function loadStateFromHistory(historyData) {
    if (!historyData) return;

    const canvas = document.getElementById('canvas');
    const svg = document.querySelector('.connection-svg');

    canvas.querySelectorAll('.node, .connection-label, .connection-toolbar').forEach(el => el.remove());
    if (svg) {
        svg.querySelectorAll('.connection-line:not(#preview-line), .connection-hit-area, .connection-drag-point, .shape').forEach(el => el.remove());
    }
    
    state.nodes = [];
    state.connections = [];
    
    state.shapes = historyData.shapes || [];

    (historyData.nodes || []).forEach(nodeData => {
        const node = { ...nodeData };
        state.nodes.push(node);
        createNodeElement(node);
    });
    
    (historyData.connections || []).forEach(connData => {
        createConnectionFromData(connData); 
    });
    
    renderAllShapes();
    updateAllConnections();
}