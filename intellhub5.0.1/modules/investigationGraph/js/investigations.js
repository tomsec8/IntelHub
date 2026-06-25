
import { state } from './main.js';
import { createNodeElement, createConnectionFromData, updateAllConnections, renderAllShapes, renderGroups } from './graph.js';
import { initHistory, addToHistory } from './history.js';
import { BUILT_IN_TEMPLATES } from './templates.js';

export async function createNewInvestigation() {
    const name = prompt('Investigation Name:', `Investigation ${state.investigations.length + 1}`);
    if (!name || !name.trim()) return;
    const newInvestigation = { 
        id: Date.now(), 
        name: name.trim(), 
        created: new Date().toISOString(), 
        modified: new Date().toISOString(), 
        data: { nodes: [], connections: [], shapes: [] } 
    };
    state.investigations.push(newInvestigation); 
    await saveInvestigations();
    loadInvestigation(newInvestigation);
}

export function loadInvestigation(investigation) {
    if (!investigation) return;
    state.currentInvestigation = investigation;
    
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
}

export async function saveInvestigations() {
    try {
        await chrome.storage.local.set({ 'osint_investigations': state.investigations });
    } catch (e) {
        console.error("Error saving to chrome.storage.local:", e);
        alert('An error occurred while saving the investigation.');
    }
}

export async function loadInvestigations() {
    try {
        const data = await chrome.storage.local.get(['osint_investigations', 'last_investigation_id']);
        state.investigations = data.osint_investigations || [];
        
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
        }
    } catch (e) {
        console.error("Error loading from chrome.storage.local:", e);
        state.investigations = [];
        renderInvestigationsList();
    }
}
    
export function renderInvestigationsList() {
    const list = document.getElementById('investigationsList');
    list.innerHTML = ''; 

    state.investigations.forEach((inv, index) => {
        const invDiv = document.createElement('div');
        invDiv.className = 'investigation-item';
        invDiv.dataset.index = index;
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

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(dateDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'investigation-actions';

        const renameButton = document.createElement('button');
        renameButton.className = 'investigation-rename';
        renameButton.dataset.id = inv.id;
        renameButton.title = 'Rename';
        renameButton.textContent = '✏️';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'investigation-delete';
        deleteButton.dataset.id = inv.id;
        deleteButton.title = 'Delete';
        deleteButton.textContent = '×';

        actionsDiv.appendChild(renameButton);
        actionsDiv.appendChild(deleteButton);

        invDiv.appendChild(infoDiv);
        invDiv.appendChild(actionsDiv);
        

        list.appendChild(invDiv);

        invDiv.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', e.target.dataset.index); setTimeout(() => invDiv.classList.add('dragging'), 0); });
        invDiv.addEventListener('dragend', () => invDiv.classList.remove('dragging'));
        invDiv.addEventListener('dragover', (e) => e.preventDefault());
        invDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            invDiv.classList.remove('dragging');
            const fromIndex = Number(e.dataTransfer.getData('text/plain'));
            const toIndex = Number(e.currentTarget.dataset.index);
            if (fromIndex === toIndex) return;
            const [movedItem] = state.investigations.splice(fromIndex, 1);
            state.investigations.splice(toIndex, 0, movedItem);
            await saveInvestigations();
            renderInvestigationsList();
        });
    });

    list.querySelectorAll('.investigation-info').forEach(item => {
        item.addEventListener('click', (e) => {
            const invId = Number(e.currentTarget.parentElement.querySelector('.investigation-delete').dataset.id);
            if (state.currentInvestigation && state.currentInvestigation.id === invId) return;
            loadInvestigation(state.investigations.find(i => i.id === invId));
        });
    });

    list.querySelectorAll('.investigation-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const invId = Number(button.dataset.id);
            deleteInvestigation(invId);
        });
    });

    list.querySelectorAll('.investigation-rename').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const invId = Number(button.dataset.id);
            renameInvestigation(invId);
        });
    });
}

export async function renameInvestigation(id) {
    const investigation = state.investigations.find(inv => inv.id === id);
    if (!investigation) return;

    const newName = prompt('Enter new name for the investigation:', investigation.name);

    if (newName && newName.trim() !== '' && newName.trim() !== investigation.name) {
        investigation.name = newName.trim();
        investigation.modified = new Date().toISOString();
        await saveInvestigations();
        renderInvestigationsList();
    }
}

export async function deleteInvestigation(id) {
    if (!confirm('Permanently delete this investigation?')) return;
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