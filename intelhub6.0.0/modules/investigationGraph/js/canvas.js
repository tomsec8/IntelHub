
import { state } from './main.js';
import { clearSelection, addNodeToSelection, removeNodeFromSelection, isIntersecting, renderAllShapes, renderGroups, deleteSelected, updateAllConnections } from './graph.js';
import { saveCurrentInvestigation, openContextMenu, loadStateFromHistory } from './investigations.js';
import { addToHistory } from './history.js';
import { undo, redo } from './history.js';

const canvas = document.getElementById('canvas');
const container = document.getElementById('canvas-container');
const gridCanvas = document.getElementById('grid-canvas');
const gridCtx = gridCanvas.getContext('2d');

export function setDrawingMode(isActive, type = null) {
    state.drawingMode.active = isActive;
    state.drawingMode.type = type;
    
    if (isActive) {
        container.classList.add('drawing-cursor');
    } else {
        container.classList.remove('drawing-cursor');
    }
}

export function initCanvas() {
    gridCanvas.width = container.offsetWidth;
    gridCanvas.height = container.offsetHeight;
    drawGrid();
    setupZoomControls();
    
    const svg = document.querySelector('.connection-svg');
    if (svg) {
        svg.style.zIndex = '1';
    }
    
    updateTransform();
    
    window.addEventListener('resize', resizeCanvas);
}

export function resizeCanvas() {
    if (!container || !gridCanvas) return;
    gridCanvas.width = container.offsetWidth;
    gridCanvas.height = container.offsetHeight;
    drawGrid();
    updateAllConnections();
}

export function setupCanvasEventListeners() {
    const selectionBox = document.getElementById('selection-box');
    let isMarqueeSelecting = false;
    let marqueeStartX, marqueeStartY;
    let initialShiftState = false;

    let isDrawingGroup = false;

    let isDrawingShape = false;
    let shapeStartX, shapeStartY;
    let previewShapeEl = null;

    container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.group-box')) {
                return;
            }
        if (state.drawingMode.active && state.drawingMode.type === 'group' && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            isDrawingGroup = true;
            const rect = container.getBoundingClientRect();
            marqueeStartX = e.clientX - rect.left;
            marqueeStartY = e.clientY - rect.top;
            selectionBox.style.left = `${marqueeStartX}px`;
            selectionBox.style.top = `${marqueeStartY}px`;
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            selectionBox.style.display = 'block';
            return;
        }

        if (state.drawingMode.active && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            isDrawingShape = true;
            
            shapeStartX = (e.clientX - state.offsetX) / state.scale;
            shapeStartY = (e.clientY - state.offsetY) / state.scale;
            
            const svg = document.querySelector('.connection-svg');
            if (state.drawingMode.type === 'arrow' && svg) {
                previewShapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                previewShapeEl.setAttribute('stroke', '#00aaff');
                previewShapeEl.setAttribute('stroke-width', '2.5');
                previewShapeEl.setAttribute('stroke-dasharray', '5,5');
                svg.appendChild(previewShapeEl);
            }
            return;
        }

        if (e.button === 1) { 
            e.preventDefault();
            state.isPanning = true;
            state.panStartX = e.clientX - state.offsetX;
            state.panStartY = e.clientY - state.offsetY;
            container.classList.add('panning');
        } 
        else if (e.button === 0 && (e.target === container || e.target === gridCanvas)) {
            e.preventDefault();
            document.querySelectorAll('.node.active').forEach(n => n.classList.remove('active')); 
            isMarqueeSelecting = true;
            initialShiftState = e.shiftKey;
            const rect = container.getBoundingClientRect();
            marqueeStartX = e.clientX - rect.left;
            marqueeStartY = e.clientY - rect.top;
            selectionBox.style.left = `${marqueeStartX}px`;
            selectionBox.style.top = `${marqueeStartY}px`;
            selectionBox.style.width = '0px';
            selectionBox.style.height = '0px';
            selectionBox.style.display = 'block';
            if (!initialShiftState) {
                clearSelection();
            }
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (isDrawingGroup) {
            const rect = container.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const boxLeft = Math.min(marqueeStartX, currentX);
            const boxTop = Math.min(marqueeStartY, currentY);
            const boxWidth = Math.abs(currentX - marqueeStartX);
            const boxHeight = Math.abs(currentY - marqueeStartY);
            
            selectionBox.style.left = `${boxLeft}px`;
            selectionBox.style.top = `${boxTop}px`;
            selectionBox.style.width = `${boxWidth}px`;
            selectionBox.style.height = `${boxHeight}px`;
            return;
        }
        
        if (isDrawingShape) {
            const currentX = (e.clientX - state.offsetX) / state.scale;
            const currentY = (e.clientY - state.offsetY) / state.scale;
            
            if (previewShapeEl) {
                previewShapeEl.setAttribute('x1', shapeStartX);
                previewShapeEl.setAttribute('y1', shapeStartY);
                previewShapeEl.setAttribute('x2', currentX);
                previewShapeEl.setAttribute('y2', currentY);
            }
            return;
        }
        
        if (state.isPanning) {
            state.offsetX = e.clientX - state.panStartX;
            state.offsetY = e.clientY - state.panStartY;
            updateTransform();
        } else if (isMarqueeSelecting) {
            const rect = container.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const boxLeft = Math.min(marqueeStartX, currentX);
            const boxTop = Math.min(marqueeStartY, currentY);
            const boxWidth = Math.abs(currentX - marqueeStartX);
            const boxHeight = Math.abs(currentY - marqueeStartY);
            
            selectionBox.style.left = `${boxLeft}px`;
            selectionBox.style.top = `${boxTop}px`;
            selectionBox.style.width = `${boxWidth}px`;
            selectionBox.style.height = `${boxHeight}px`;
            
            const selectionRect = {
                left: (boxLeft - state.offsetX) / state.scale,
                top: (boxTop - state.offsetY) / state.scale,
                right: (boxLeft + boxWidth - state.offsetX) / state.scale,
                bottom: (boxTop + boxHeight - state.offsetY) / state.scale
            };
            
            state.nodes.forEach(node => {
                if (!node.element) return;
                const nodeRect = {
                    left: node.x,
                    top: node.y,
                    right: node.x + node.element.offsetWidth,
                    bottom: node.y + node.element.offsetHeight
                };
                
                const intersects = isIntersecting(selectionRect, nodeRect);
                
                if (intersects && !node.element.classList.contains('selected')) {
                    addNodeToSelection(node);
                } else if (!intersects && !initialShiftState && node.element.classList.contains('selected')) {
                    removeNodeFromSelection(node);
                }
            });
        }
    });

    container.addEventListener('mouseup', async (e) => {
        if (isDrawingGroup) {
            isDrawingGroup = false;
            selectionBox.style.display = 'none';

            const name = state.pendingGroupName;
            if (name && name.trim() !== '') {
                const rect = container.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;

                const startWorldX = (Math.min(marqueeStartX, endX) - state.offsetX) / state.scale;
                const startWorldY = (Math.min(marqueeStartY, endY) - state.offsetY) / state.scale;
                const worldWidth = Math.abs(endX - marqueeStartX) / state.scale;
                const worldHeight = Math.abs(endY - marqueeStartY) / state.scale;

                if (worldWidth < 16 || worldHeight < 16) {
                    return;
                }

                state.pendingGroupName = null;

                const newGroup = {
                    id: state.groupCounter++,
                    x: startWorldX,
                    y: startWorldY,
                    width: worldWidth,
                    height: worldHeight,
                    name: name.trim(),
                    color: 'rgba(136, 136, 136, 0.1)'
                };

                state.groups.push(newGroup);
                renderGroups();
                addToHistory(state);
                await saveCurrentInvestigation();
            }

            setDrawingMode(false, null);
            document.getElementById('group-mode-btn').classList.remove('active');
            return;
        }

        if (isDrawingShape) {
            isDrawingShape = false;
            if (previewShapeEl) {
                previewShapeEl.remove();
                previewShapeEl = null;
            }

            const endX = (e.clientX - state.offsetX) / state.scale;
            const endY = (e.clientY - state.offsetY) / state.scale;

            if (shapeStartX === endX && shapeStartY === endY) {
                setDrawingMode(false);
                return;
            }

            const newShape = {
                id: `shape_${state.shapeCounter++}`,
                type: state.drawingMode.type,
                x1: shapeStartX,
                y1: shapeStartY,
                x2: endX,
                y2: endY,
                color: '#6a6a6a'
            };
            state.shapes.push(newShape);
            renderAllShapes();
            await saveCurrentInvestigation();
            
            setDrawingMode(false);
            return;
        }

        if (state.isPanning) {
            state.isPanning = false;
            container.classList.remove('panning');
        } else if (isMarqueeSelecting) {
            isMarqueeSelecting = false;
            selectionBox.style.display = 'none';
        }
    });

    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoom(delta, mouseX, mouseY);
    }, { passive: false });

    container.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.node, .group-box, .ws-ctx-menu, .connection-label')) return;
        if (e.target.closest('.connection-line, .connection-hit-area, .connection-drag-point, .shape')) return;
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const point = {
            x: (e.clientX - rect.left - state.offsetX) / state.scale,
            y: (e.clientY - rect.top - state.offsetY) / state.scale
        };
        const selected = state.selectedNodes.length;
        openContextMenu(e.clientX, e.clientY, [
            {
                label: 'New card',
                onClick: () => {
                    state.pendingCardPos = point;
                    document.getElementById('add-card-btn')?.click();
                }
            },
            { label: 'Draw group', onClick: () => document.getElementById('group-mode-btn')?.click() },
            ...(selected ? [{
                label: selected === 1 ? 'Delete selected card' : `Delete ${selected} selected cards`,
                onClick: () => deleteSelected()
            }] : []),
            { separator: true },
            {
                label: 'Undo',
                onClick: () => {
                    const prev = undo();
                    if (prev) loadStateFromHistory(prev);
                }
            },
            {
                label: 'Redo',
                onClick: () => {
                    const next = redo();
                    if (next) loadStateFromHistory(next);
                }
            }
        ]);
    });

    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
        });
    }
}

function setupZoomControls() {
    document.addEventListener('zoomIn', () => {
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        zoom(1.2, centerX, centerY);
    });

    document.addEventListener('zoomOut', () => {
        const centerX = container.offsetWidth / 2;
        const centerY = container.offsetHeight / 2;
        zoom(0.8, centerX, centerY);
    });

    document.addEventListener('resetZoom', () => {
        state.scale = 1;
        state.offsetX = 0;
        state.offsetY = 0;
        updateTransform();
    });
}

function drawGrid() {
    const width = gridCanvas.width;
    const height = gridCanvas.height;
    const workspace = document.documentElement.classList.contains('workspace-page');
    
    gridCtx.clearRect(0, 0, width, height);
    gridCtx.strokeStyle = workspace ? 'rgba(255, 255, 255, 0.06)' : '#2a2a2a';
    gridCtx.lineWidth = 1;
    
    const gridSize = (workspace ? 24 : 20) * state.scale;
    const offsetX = state.offsetX % gridSize;
    const offsetY = state.offsetY % gridSize;
    
    gridCtx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(width, y);
    }
    gridCtx.stroke();
}

const CAMERA_KEY = 'wsGraphCamera';
let cameraTimer = 0;
let cameraInvestigationId = null;

function saveGraphCamera() {
    const id = state.currentInvestigation?.id;
    if (!id) return;
    window.clearTimeout(cameraTimer);
    cameraTimer = window.setTimeout(() => {
        try {
            const all = JSON.parse(localStorage.getItem(CAMERA_KEY) || '{}');
            all[id] = { scale: state.scale, offsetX: state.offsetX, offsetY: state.offsetY };
            localStorage.setItem(CAMERA_KEY, JSON.stringify(all));
        } catch (error) {
            console.warn('Could not save graph camera', error);
        }
    }, 160);
}

export function restoreGraphCamera() {
    const id = state.currentInvestigation?.id;
    if (!id || cameraInvestigationId === id) return;
    cameraInvestigationId = id;
    try {
        const all = JSON.parse(localStorage.getItem(CAMERA_KEY) || '{}');
        const cam = all[id];
        if (cam && Number.isFinite(cam.scale)) {
            state.scale = Math.max(0.1, Math.min(3, cam.scale));
            state.offsetX = Number.isFinite(cam.offsetX) ? cam.offsetX : 0;
            state.offsetY = Number.isFinite(cam.offsetY) ? cam.offsetY : 0;
        } else {
            state.scale = 1;
            state.offsetX = 0;
            state.offsetY = 0;
        }
    } catch {
        state.scale = 1;
        state.offsetX = 0;
        state.offsetY = 0;
    }
    updateTransform();
}

function updateTransform() {
    const transformStr = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
    const canvas = document.getElementById('canvas');
    const svg = document.querySelector('.connection-svg');
    
    canvas.style.transform = transformStr;
    canvas.style.zIndex = '10';
    
    if (svg) {
        svg.style.transform = `translate(${state.offsetX + 5000}px, ${state.offsetY + 5000}px) scale(${state.scale})`;
        svg.style.transformOrigin = '0 0';
        svg.style.zIndex = '1';
    }
    
    document.getElementById('zoom-level').textContent = Math.round(state.scale * 100) + '%';
    drawGrid();
    saveGraphCamera();
}

function zoom(factor, mouseX, mouseY) {
    const oldScale = state.scale;
    const newScale = Math.max(0.1, Math.min(3, state.scale * factor));
    
    const worldX = (mouseX - state.offsetX) / oldScale;
    const worldY = (mouseY - state.offsetY) / oldScale;
    
    state.scale = newScale;
    
    state.offsetX = mouseX - worldX * newScale;
    state.offsetY = mouseY - worldY * newScale;
    
    updateTransform();
}