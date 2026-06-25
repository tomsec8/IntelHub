
import { state } from './main.js';
import { saveCurrentInvestigation } from './investigations.js';
import { createNodeElement, updateNodeElement, updateAllConnections, updateSourceIndicator } from './graph.js';
import { addToHistory } from './history.js';
import { BUILT_IN_TEMPLATES } from './templates.js';



export const typeLabels = {
    person: 'Person', phone: 'Phone', email: 'Email', address: 'Address', company: 'Company',
    vehicle: 'Vehicle', website: 'Website', social: 'Social Network', document: 'Document',
    location: 'Location', event: 'Event', other: 'Other'
};


export function addNewCard() {
    if (!state.currentInvestigation) return alert('Please create or select an investigation first.');
    state.editingNode = null;
    state.pendingImageData = null;
    state.pendingSources = [];
    document.getElementById('nodeModalTitle').textContent = 'New Card';


    const defaultType = 'person';
    document.getElementById('nodeType').value = defaultType;
    renderDynamicFields(defaultType); 

    document.getElementById('nodeImage').value = '';
    const imagePreview = document.getElementById('imagePreview');
    const removeBtn = document.getElementById('removeImageBtn');
    if(imagePreview) {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
    if(removeBtn) {
        removeBtn.style.display = 'none';
    }
    state.selectedNodeColor = '#6a6a6a';
    updateColorSelection();
    renderSources(state.pendingSources);
    document.getElementById('nodeModal').style.display = 'flex';
}


export function editCard(node) {
    state.editingNode = node;
    state.pendingImageData = node.image;
    document.getElementById('nodeModalTitle').textContent = 'Edit Card';

    document.getElementById('nodeType').value = node.type;

    renderDynamicFields(node.type, node.customData || {});

    const preview = document.getElementById('imagePreview');
    const removeBtn = document.getElementById('removeImageBtn');
    if (node.image) {
        preview.src = node.image;
        preview.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        preview.style.display = 'none';
        removeBtn.style.display = 'none';
    }
    state.selectedNodeColor = node.color;
    updateColorSelection();
    renderSources(node.sources);
    document.getElementById('nodeModal').style.display = 'flex';
}

export function closeNodeModal() {
    document.getElementById('nodeModal').style.display = 'none';
}


export async function saveNode() {
    const type = document.getElementById('nodeType').value;
    const template = BUILT_IN_TEMPLATES[type] || BUILT_IN_TEMPLATES['other'];
    const customData = {};
    let title = 'Untitled';

    for (const field of template.fields) {
        const inputElement = document.getElementById(`field-${field.id}`);
        if (inputElement) {
            const value = inputElement.value.trim();
            customData[field.id] = value;
            if (field.isTitle && value) {
                title = value;
            }
        }
    }

    const nodeData = {
        type: type,
        title: title, 
        customData: customData,
        image: state.pendingImageData,
        color: state.selectedNodeColor,
        sources: state.editingNode ? state.editingNode.sources : state.pendingSources
    };

    if (state.editingNode) {
        Object.assign(state.editingNode, nodeData);
        updateNodeElement(state.editingNode);
    } else {
        const container = document.getElementById('canvas-container');
        const viewCenterX = (container.offsetWidth / 2 - state.offsetX) / state.scale;
        const viewCenterY = (container.offsetHeight / 2 - state.offsetY) / state.scale;
        const nodeWidth = 250;
        const newNode = {
            id: state.nodeCounter++,
            x: viewCenterX - (nodeWidth / 2),
            y: viewCenterY,
            width: nodeWidth,
            ...nodeData
        };
        state.nodes.push(newNode);
        createNodeElement(newNode);
    }
    
    addToHistory(state);
    await saveCurrentInvestigation();
    closeNodeModal();
}

export function updateColorSelection() {
    document.querySelectorAll('#nodeModal .color-option-small').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === state.selectedNodeColor);
    });
}

export function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
        alert('Image is too large (max 10MB).');
        event.target.value = '';
        return;
    }
    const image = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const MAX_WIDTH = 1280;
    const MAX_HEIGHT = 1280;
    image.onload = () => {
        let width = image.width;
        let height = image.height;
        if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        state.pendingImageData = compressedBase64;
        document.getElementById('imagePreview').src = compressedBase64;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('removeImageBtn').style.display = 'inline-block';
        URL.revokeObjectURL(image.src);
    };
    image.onerror = () => {
        alert('Error processing image. The file may be invalid.');
        event.target.value = '';
    };
    image.src = URL.createObjectURL(file);
}

export function removeImage() {
    state.pendingImageData = null;
    const imagePreview = document.getElementById('imagePreview');
    const imageInput = document.getElementById('nodeImage');
    const removeBtn = document.getElementById('removeImageBtn');
    
    if (imagePreview) {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
    if (imageInput) {
        imageInput.value = '';
    }
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
}

export async function applyColorToNode(nodeId, color) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (node) {
        node.color = color;
        node.element.style.borderColor = color;
        addToHistory(state);
        await saveCurrentInvestigation();
        const picker = node.element.querySelector('.inline-color-picker');
        if (picker) picker.remove();
    }
}

export function showColorPickerForNode(node) {
    const existingPicker = node.element.querySelector('.inline-color-picker');
    if (existingPicker) return existingPicker.remove();
    const colors = ['#6a6a6a', '#1e3a5f', '#2d4a2d', '#5a2d2d', '#5a4a2d', '#4a2d5a'];  
    const pickerDiv = document.createElement('div');
    pickerDiv.className = 'inline-color-picker';
    pickerDiv.style.cssText = `position: absolute; top: 40px; left: 50%; transform: translateX(-50%); background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 6px; padding: 8px; display: flex; gap: 4px; z-index: 2000;`;
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option-small';
        colorOption.style.background = color;
        colorOption.addEventListener('click', (e) => {
            e.stopPropagation();
            applyColorToNode(node.id, color);
        });
        pickerDiv.appendChild(colorOption);
    });
    node.element.appendChild(pickerDiv);
    setTimeout(() => {
        const docClickHandler = (event) => {
            if (!pickerDiv.contains(event.target)) {
                pickerDiv.remove();
                document.removeEventListener('click', docClickHandler, true);
            }
        };
        document.addEventListener('click', docClickHandler, true);
    }, 0);
}

export function showLabelModal(connection) {
    state.editingConnection = connection;
    const modal = document.getElementById('labelModal');
    const labelInput = document.getElementById('labelInput');
    
    labelInput.value = connection.label || '';
    
    const currentColor = connection.color || '#6a6a6a';
    document.querySelectorAll('#labelModal .color-option-small').forEach(el => {
        el.classList.toggle('selected', el.dataset.color === currentColor);
    });
    
    modal.style.display = 'flex';
    labelInput.focus();
    labelInput.select();
}

export function closeLabelModal() {
    const modal = document.getElementById('labelModal');
    if(modal) modal.style.display = 'none';
    state.editingConnection = null;
}

export async function saveLabelModal() {
    if (!state.editingConnection) return;

    const connection = state.editingConnection;
    const labelInput = document.getElementById('labelInput');
    const selectedColorEl = document.querySelector('#labelModal .color-option-small.selected');

    connection.label = labelInput.value.trim();
    connection.color = selectedColorEl ? selectedColorEl.dataset.color : connection.color;

    updateAllConnections();

    addToHistory(state);
    await saveCurrentInvestigation();
    closeLabelModal();
}

function renderSources(sourcesArray) {
    const list = document.getElementById('sourcesList');
    list.innerHTML = ''; 
    sourcesArray.forEach((source, index) => {
        const item = document.createElement('div');
        item.className = 'source-item';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';

        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'url';
        link.textContent = source.url; 

        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'desc';
        descriptionDiv.textContent = source.description || ''; 

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-source-btn';
        deleteButton.dataset.index = index;
        deleteButton.title = 'Delete Source';
        deleteButton.textContent = '×';

        infoDiv.appendChild(link);
        infoDiv.appendChild(descriptionDiv);
        item.appendChild(infoDiv);
        item.appendChild(deleteButton);

        list.appendChild(item);
    });

    list.querySelectorAll('.delete-source-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const indexToRemove = parseInt(btn.dataset.index, 10);
            sourcesArray.splice(indexToRemove, 1);
            renderSources(sourcesArray);
        });
    });

    if (state.editingNode) {
        updateSourceIndicator(state.editingNode);
    }
}

export function addSource() {
    const urlInput = document.getElementById('sourceUrl');
    const descInput = document.getElementById('sourceDesc');
    const url = urlInput.value.trim();

    if (!url) {
        alert('Please enter a URL or reference for the source.');
        return;
    }

    const newSource = {
        id: Date.now(),
        url: url,
        description: descInput.value.trim()
    };
    
    const targetArray = state.editingNode ? state.editingNode.sources : state.pendingSources;
    targetArray.push(newSource);
    
    renderSources(targetArray); 

    urlInput.value = '';
    descInput.value = '';
    urlInput.focus();
}


export function renderDynamicFields(type, nodeData = {}) {
    const container = document.getElementById('dynamic-fields-container');
    container.innerHTML = ''; 

    const template = BUILT_IN_TEMPLATES[type] || BUILT_IN_TEMPLATES['other'];

    template.fields.forEach(field => {
        const value = nodeData[field.id] || '';
        const fieldId = `field-${field.id}`;

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.setAttribute('for', fieldId);
        label.textContent = `${field.label}:`; 

        formGroup.appendChild(label);

        let inputElement;
        if (field.type === 'textarea') {
            inputElement = document.createElement('textarea');
            inputElement.textContent = value; 
        } else {
            inputElement = document.createElement('input');
            inputElement.type = field.type;
            inputElement.value = value; 
        }

        inputElement.id = fieldId;
        inputElement.dataset.fieldId = field.id;

        formGroup.appendChild(inputElement);
        container.appendChild(formGroup);
    });
}