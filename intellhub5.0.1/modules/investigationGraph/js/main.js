
import { initCanvas, setupCanvasEventListeners, setDrawingMode} from './canvas.js';
import { loadInvestigations, createNewInvestigation, renderInvestigationsList, loadStateFromHistory } from './investigations.js';
import { addNewCard, saveNode, closeNodeModal, previewImage, removeImage, updateColorSelection, closeLabelModal, saveLabelModal, addSource, renderDynamicFields } from './ui.js';
import { exportCanvas, importCanvas } from './utils.js';
import { deleteSelected } from './graph.js';
import { undo, redo, addToHistory, initHistory } from './history.js';
import { exportToImage } from './export.js';
import { BUILT_IN_TEMPLATES } from './templates.js';



export const state = {
    investigations: [],
    currentInvestigation: null,
    nodes: [],
    selectedNodes: [],
    selectedGroups: [],
    activeGroupAction: null,
    connections: [],
    groups: [],
    shapes: [],
    drawingMode: { active: false, type: null, step: 0, startPoint: null },
    nodeCounter: 1,
    connectionCounter: 1,
    groupCounter: 1,
    shapeCounter: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    editingNode: null,
    pendingImageData: null,
    pendingSources: [],
    selectedNodeColor: '#262626',
    connectionStartPoint: null,
    editingConnection: null,
    isDraggingArrowHead: false,
    draggingConnection: null
};

document.addEventListener('DOMContentLoaded', async () => {
    initCanvas();
    setupCanvasEventListeners();
    await loadInvestigations();

    document.getElementById('new-investigation-btn').addEventListener('click', createNewInvestigation);
    document.getElementById('add-card-btn').addEventListener('click', addNewCard);
    document.getElementById('add-source-btn').addEventListener('click', addSource);

    await loadInvestigations();
    
    const deleteBtn = document.getElementById('delete-selected-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteSelected);
    }

    document.getElementById('nodeType').addEventListener('change', (e) => {
         renderDynamicFields(e.target.value);
    });


    document.getElementById('export-json-btn').addEventListener('click', (e) => {
        e.preventDefault();
        exportCanvas(); 
    });

    document.getElementById('export-image-btn').addEventListener('click', (e) => {
        e.preventDefault();
        exportToImage(); 
    });
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', importCanvas);
    
    document.getElementById('zoom-in-btn').addEventListener('click', () => document.dispatchEvent(new CustomEvent('zoomIn')));
    document.getElementById('zoom-out-btn').addEventListener('click', () => document.dispatchEvent(new CustomEvent('zoomOut')));
    document.getElementById('reset-zoom-btn').addEventListener('click', () => document.dispatchEvent(new CustomEvent('resetZoom')));

    document.getElementById('undo-btn').addEventListener('click', () => {
        const prevState = undo();
        if (prevState) {
            loadStateFromHistory(prevState);
        }
    });

    document.getElementById('redo-btn').addEventListener('click', () => {
        const nextState = redo();
        if (nextState) {
            loadStateFromHistory(nextState);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            document.getElementById('undo-btn').click();
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            document.getElementById('redo-btn').click();
        }
    });

    document.getElementById('save-node-btn').addEventListener('click', saveNode);
    document.getElementById('cancel-node-modal-btn').addEventListener('click', closeNodeModal);
    document.getElementById('nodeImage').addEventListener('change', previewImage);
    document.getElementById('removeImageBtn').addEventListener('click', removeImage);  


    document.getElementById('save-label-btn').addEventListener('click', saveLabelModal);
    document.getElementById('cancel-label-modal-btn').addEventListener('click', closeLabelModal);

    document.querySelectorAll('#nodeModal .color-option-small').forEach(el => {
        el.addEventListener('click', () => {
            state.selectedNodeColor = el.dataset.color;
            updateColorSelection();
        });
    });
    
    document.querySelectorAll('#labelModal .color-option-small').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('#labelModal .color-option-small').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
        });
    });

    document.getElementById('group-mode-btn').addEventListener('click', (e) => {
        const isActive = state.drawingMode.active && state.drawingMode.type === 'group';
        setDrawingMode(!isActive, 'group');
        e.currentTarget.classList.toggle('active', !isActive);
    });

    document.getElementById('canvas-container').addEventListener('click', (e) => {
        if (e.target.id === 'canvas-container' || e.target.id === 'canvas' || e.target.id === 'grid-canvas') {
            document.querySelectorAll('.connection-line.active').forEach(el => {
                el.classList.remove('active');
                const connId = Number(el.dataset.connectionId);
                const conn = state.connections.find(c => c.id === connId);
                if (conn && conn.toolbarElement) {
                    conn.toolbarElement.style.display = 'none';
                }
            });
        }
    });
});