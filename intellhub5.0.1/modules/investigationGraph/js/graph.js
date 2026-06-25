
import { state } from './main.js';
import { saveCurrentInvestigation } from './investigations.js';
import { editCard, showColorPickerForNode, typeLabels, showLabelModal } from './ui.js';
import { addToHistory } from './history.js';
import { BUILT_IN_TEMPLATES } from './templates.js';

function ensureMarkerForColor(color) {
    if (!color) color = '#6a6a6a';
    const hex = color.replace('#','').toLowerCase();
    const markerId = `arrowhead-${hex}`;
    const svg = document.querySelector('.connection-svg');
    if (!svg) return markerId;
    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }
    if (defs.querySelector(`#${markerId}`)) {
        return markerId;
    }
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '7');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto-start-reverse');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 7 3.5, 0 7');
    polygon.setAttribute('fill', color);
    marker.appendChild(polygon);
    defs.appendChild(marker);
    return markerId;
}

export function isIntersecting(rect1, rect2) {
    return !(rect2.left > rect1.right || rect2.right < rect1.left || rect2.top > rect1.bottom || rect2.bottom < rect1.top);
}

export function clearSelection() {
    state.selectedNodes.forEach(node => { if (node.element) node.element.classList.remove('selected'); });
    state.selectedNodes = [];
}

export function addNodeToSelection(node) {
    if (!state.selectedNodes.includes(node)) {
        state.selectedNodes.push(node);
        if (node.element) node.element.classList.add('selected');
    }
}

export function removeNodeFromSelection(node) {
    const index = state.selectedNodes.indexOf(node);
    if (index > -1) {
        state.selectedNodes.splice(index, 1);
        if (node.element) node.element.classList.remove('selected');
    }
}

export function updateSourceIndicator(node) {
    if (!node || !node.element) return;

    if (node.sources && node.sources.length > 0) {
        node.element.classList.add('has-sources');
    } else {
        node.element.classList.remove('has-sources');
    }
}

export function createNodeElement(node) {
    const canvas = document.getElementById('canvas');
    const div = document.createElement('div');
    div.className = 'node';
    div.style.left = `${node.x}px`;
    div.style.top = `${node.y}px`;
    div.style.width = `${node.width}px`;
    if (node.height) div.style.height = `${node.height}px`;
    if (node.color) div.style.borderColor = node.color;
    div.dataset.nodeId = node.id;


    const toolbar = document.createElement('div');
    toolbar.className = 'node-toolbar';
    toolbar.innerHTML = `
        <button class="toolbar-btn" data-action="edit" title="Edit">✎</button>
        <button class="toolbar-btn" data-action="color" title="Change Color">🎨</button>
        <button class="toolbar-btn" data-action="delete" title="Delete">🗑️</button>
    `;

    // Header
    const header = document.createElement('div');
    header.className = 'node-header';
    const sourceIndicator = document.createElement('div');
    sourceIndicator.className = 'source-indicator';
    sourceIndicator.title = 'This card has sources';
    sourceIndicator.textContent = '📖';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'node-title';
    titleDiv.textContent = node.title;
    const typeDiv = document.createElement('div');
    typeDiv.className = 'node-type';
    typeDiv.textContent = BUILT_IN_TEMPLATES[node.type]?.name || node.type;
    header.append(sourceIndicator, titleDiv, typeDiv);

    // Body
    const body = document.createElement('div');
    body.className = 'node-body';
    const content = document.createElement('div');
    content.className = 'node-content';
    content.appendChild(generateCustomFieldsElement(node)); 
    body.appendChild(content);

    const staticElementsContainer = document.createElement('div');
    staticElementsContainer.innerHTML = `
        <div class="connection-point top" data-side="top"></div>
        <div class="connection-point bottom" data-side="bottom"></div>
        <div class="connection-point left" data-side="left"></div>
        <div class="connection-point right" data-side="right"></div>
        <div class="resize-handle top-left"></div><div class="resize-handle top-right"></div>
        <div class="resize-handle bottom-left"></div><div class="resize-handle bottom-right"></div>
        <div class="resize-handle top"></div><div class="resize-handle bottom"></div>
        <div class="resize-handle left"></div><div class="resize-handle right"></div>
    `;

    div.appendChild(toolbar);
    div.appendChild(header);
    if (node.image) {
        const imageEl = document.createElement('img');
        imageEl.src = node.image;
        imageEl.className = 'node-image';
        div.appendChild(imageEl);
    }
    div.appendChild(body);
    div.append(...staticElementsContainer.childNodes);


    node.element = div;
    canvas.appendChild(div);
    setupNodeInteractions(node);
    updateSourceIndicator(node);
}


export function updateNodeElement(node) {
    const div = node.element;
    div.querySelector('.node-title').textContent = node.title;
    div.querySelector('.node-type').textContent = BUILT_IN_TEMPLATES[node.type]?.name || node.type;
    
    const contentContainer = div.querySelector('.node-content');
    contentContainer.innerHTML = ''; 
    contentContainer.appendChild(generateCustomFieldsElement(node)); 

    if (node.color) div.style.borderColor = node.color;

    let img = div.querySelector('.node-image');
    if (node.image) {
        if (img) img.src = node.image;
        else {
            img = document.createElement('img');
            img.className = 'node-image';
            img.src = node.image;
            div.querySelector('.node-header').after(img);
        }
    } else {
        if (img) img.remove();
    }

    updateAllConnections();
    updateSourceIndicator(node);
}

export async function deleteNode(nodeId) {
    const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex > -1) {
        state.nodes[nodeIndex].element.remove();
        state.nodes.splice(nodeIndex, 1);
    }
    const selectedIndex = state.selectedNodes.findIndex(n => n.id === nodeId);
    if (selectedIndex > -1) {
        state.selectedNodes.splice(selectedIndex, 1);
    }
    state.connections = state.connections.filter(c => {
        if (c.from.id === nodeId || c.to.id === nodeId) {
            if (c.line) c.line.remove();
            if (c.labelElement) c.labelElement.remove();
            return false;
        }
        return true;
    });
    updateAllConnections();
    addToHistory(state);
    await saveCurrentInvestigation();
}

export async function deleteSelected() {
    if (state.selectedNodes.length === 0) return alert("No cards selected to delete.");
    if (!confirm(`Are you sure you want to delete ${state.selectedNodes.length} selected card(s)?`)) return;
    const idsToDelete = new Set(state.selectedNodes.map(n => n.id));
    state.selectedNodes.forEach(node => { if (node.element) node.element.remove(); });
    state.nodes = state.nodes.filter(node => !idsToDelete.has(node.id));
    state.connections = state.connections.filter(c => {
        const shouldDelete = idsToDelete.has(c.from.id) || idsToDelete.has(c.to.id);
        if (shouldDelete && c.line) c.line.remove();
        if (shouldDelete && c.labelElement) c.labelElement.remove();
        return !shouldDelete;
    });
    state.selectedNodes = [];
    updateAllConnections();
    addToHistory(state);
    await saveCurrentInvestigation();
}

export function getCurvePath(start, end, fromSide, toSide) {
    const STRAIGHT_SEGMENT = 30;
    
    let straightStart = { ...start };
    let curveStart = { ...start };
    
    if (fromSide === 'right') {
        curveStart.x = start.x + STRAIGHT_SEGMENT;
    } else if (fromSide === 'left') {
        curveStart.x = start.x - STRAIGHT_SEGMENT;
    } else if (fromSide === 'top') {
        curveStart.y = start.y - STRAIGHT_SEGMENT;
    } else if (fromSide === 'bottom') {
        curveStart.y = start.y + STRAIGHT_SEGMENT;
    }
    
    let curveEnd = { ...end };
    let straightEnd = { ...end };
    
    if (toSide === 'right') {
        curveEnd.x = end.x + STRAIGHT_SEGMENT;
    } else if (toSide === 'left') {
        curveEnd.x = end.x - STRAIGHT_SEGMENT;
    } else if (toSide === 'top') {
        curveEnd.y = end.y - STRAIGHT_SEGMENT;
    } else if (toSide === 'bottom') {
        curveEnd.y = end.y + STRAIGHT_SEGMENT;
    }
    
    const dx = curveEnd.x - curveStart.x;
    const dy = curveEnd.y - curveStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curveFactor = Math.min(distance * 0.4, 150);
    
    let cp1x, cp1y, cp2x, cp2y;
    
    if (fromSide === 'right') {
        cp1x = curveStart.x + curveFactor;
        cp1y = curveStart.y;
    } else if (fromSide === 'left') {
        cp1x = curveStart.x - curveFactor;
        cp1y = curveStart.y;
    } else if (fromSide === 'top') {
        cp1x = curveStart.x;
        cp1y = curveStart.y - curveFactor;
    } else if (fromSide === 'bottom') {
        cp1x = curveStart.x;
        cp1y = curveStart.y + curveFactor;
    } else {
        cp1x = curveStart.x + dx * 0.5;
        cp1y = curveStart.y;
    }
    
    if (toSide === 'right') {
        cp2x = curveEnd.x + curveFactor;
        cp2y = curveEnd.y;
    } else if (toSide === 'left') {
        cp2x = curveEnd.x - curveFactor;
        cp2y = curveEnd.y;
    } else if (toSide === 'top') {
        cp2x = curveEnd.x;
        cp2y = curveEnd.y - curveFactor;
    } else if (toSide === 'bottom') {
        cp2x = curveEnd.x;
        cp2y = curveEnd.y + curveFactor;
    } else {
        cp2x = curveEnd.x - dx * 0.5;
        cp2y = curveEnd.y;
    }
    
    return `M ${start.x} ${start.y} L ${curveStart.x} ${curveStart.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curveEnd.x} ${curveEnd.y} L ${end.x} ${end.y}`;
}

export function getConnectionPoint(node, side) {
    if (!node || !node.element) return { x: 0, y: 0 };
    
    const width = node.element.offsetWidth;
    const height = node.element.offsetHeight;
    
    let x = node.x;
    let y = node.y;
    
    switch(side) {
        case 'top': 
            x += width / 2; 
            break;
        case 'bottom': 
            x += width / 2; 
            y += height; 
            break;
        case 'left': 
            y += height / 2; 
            break;
        case 'right': 
            x += width; 
            y += height / 2; 
            break;
    }
    
    return { x, y };
}

export function updateAllConnections() {
    state.connections.forEach(conn => {
        if (!conn.from || !conn.to || !conn.line) return;
        
        const startPoint = getConnectionPoint(conn.from, conn.fromSide);
        const endPoint = getConnectionPoint(conn.to, conn.toSide);
        const pathData = getCurvePath(startPoint, endPoint, conn.fromSide, conn.toSide);
        
        conn.line.setAttribute('d', pathData);
        if (conn.hitArea) conn.hitArea.setAttribute('d', pathData);
        
        if (conn.dragPoint) {
            conn.dragPoint.setAttribute('cx', endPoint.x);
            conn.dragPoint.setAttribute('cy', endPoint.y);
        }
        
        const color = conn.color || '#6a6a6a';
        conn.line.style.stroke = color;
        let strokeDashArray = 'none';
        if (conn.style === 'dashed') {
            strokeDashArray = '10, 5'; 
        } else if (conn.style === 'dotted') {
            strokeDashArray = '2, 4'; 
        }
        conn.line.setAttribute('stroke-dasharray', strokeDashArray);
        const markerId = ensureMarkerForColor(color);
        conn.line.setAttribute('marker-end', `url(#${markerId})`);
        
        if (conn.toolbarElement && conn.toolbarElement.style.display !== 'none') {
            updateConnectionToolbarPosition(conn);
        }
        
        if (conn.label) {
            if (!conn.labelElement) {
                conn.labelElement = document.createElement('div');
                conn.labelElement.className = 'connection-label';
                document.getElementById('canvas').appendChild(conn.labelElement);
            }
            conn.labelElement.textContent = conn.label;
            try {
                if (conn.line.getTotalLength() > 0) {
                    const midPoint = conn.line.getPointAtLength(conn.line.getTotalLength() / 2);
                    conn.labelElement.style.left = `${midPoint.x}px`;
                    conn.labelElement.style.top = `${midPoint.y - 25}px`;
                }
            } catch(e) {
                console.warn('Error calculating label position:', e);
            }
        } else if (conn.labelElement) {
            conn.labelElement.remove();
            conn.labelElement = null;
        }
    });
}

function updateConnectionToolbarPosition(conn) {
    if (!conn.toolbarElement || !conn.line) return;
    try {
        const totalLength = conn.line.getTotalLength();
        if (totalLength > 0) {
            const midPoint = conn.line.getPointAtLength(totalLength / 2);
            conn.toolbarElement.style.left = `${midPoint.x}px`;
            conn.toolbarElement.style.top = `${midPoint.y - 55}px`;
        }
    } catch(e) {
        console.warn('Error updating toolbar position:', e);
    }
}

function createConnectionToolbar(conn) {
    const toolbar = document.createElement('div');
    toolbar.className = 'connection-toolbar';
    toolbar.innerHTML = `
        <button class="toolbar-btn" data-action="edit" title="Edit Label">✎</button>
        <button class="toolbar-btn" data-action="style" title="Change Style">〰️</button> <button class="toolbar-btn" data-action="color" title="Change Color">🎨</button>
        <button class="toolbar-btn" data-action="delete" title="Delete">🗑️</button>
    `;
    
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            
            if (action === 'edit') {
                showLabelModal(conn);
            } else if (action === 'style') {
                const styles = ['solid', 'dashed', 'dotted'];
                const currentIndex = styles.indexOf(conn.style || 'solid');
                conn.style = styles[(currentIndex + 1) % styles.length];
                updateAllConnections();
                saveCurrentInvestigation();
            } else if (action === 'color') {
                showConnectionColorPicker(conn);
            } else if (action === 'delete') {
                if (confirm('Delete this connection?')) {
                    await deleteConnection(conn.id);
                }
            }
        });
    });
    
    document.getElementById('canvas').appendChild(toolbar);
    
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!toolbar.contains(e.target) && !conn.line.contains(e.target)) {
                toolbar.style.display = 'none';
                conn.line.classList.remove('active');
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 0);
    
    return toolbar;
}

function showConnectionColorPicker(conn) {
    const existingPicker = document.querySelector('.connection-color-picker');
    if (existingPicker) existingPicker.remove();
    
    const colors = ['#6a6a6a', '#ff4444', '#44ff44', '#ffaa44', '#44aaff', '#ff44ff'];
    const pickerDiv = document.createElement('div');
    pickerDiv.className = 'connection-color-picker';
    pickerDiv.style.cssText = `
        position: absolute;
        background: #2a2a2a;
        border: 1px solid #3a3a3a;
        border-radius: 6px;
        padding: 8px;
        display: flex;
        gap: 4px;
        z-index: 3000;
    `;
    
    try {
        const midPoint = conn.line.getPointAtLength(conn.line.getTotalLength() / 2);
        pickerDiv.style.left = `${midPoint.x}px`;
        pickerDiv.style.top = `${midPoint.y + 30}px`;
    } catch(e) {
        pickerDiv.style.left = '50%';
        pickerDiv.style.top = '50%';
    }
    
    colors.forEach(color => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option-small';
        colorOption.style.background = color;
        colorOption.style.width = '24px';
        colorOption.style.height = '24px';
        colorOption.style.borderRadius = '4px';
        colorOption.style.cursor = 'pointer';
        colorOption.style.border = color === conn.color ? '2px solid #00ff00' : '2px solid transparent';
        
        colorOption.addEventListener('click', async (e) => {
            e.stopPropagation();
            conn.color = color;
            updateAllConnections();
            addToHistory(state);
            await saveCurrentInvestigation();
            pickerDiv.remove();
        });
        
        pickerDiv.appendChild(colorOption);
    });
    
    document.getElementById('canvas').appendChild(pickerDiv);
    
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

export function renderAllShapes() {
    const svg = document.querySelector('.connection-svg');
    if (!svg) return;
    
    svg.querySelectorAll('.shape').forEach(el => el.remove());
    
    state.shapes.forEach(shape => {
        if (shape.type === 'arrow') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add('shape');
            line.setAttribute('x1', shape.x1);
            line.setAttribute('y1', shape.y1);
            line.setAttribute('x2', shape.x2);
            line.setAttribute('y2', shape.y2);
            line.setAttribute('stroke', shape.color || '#6a6a6a');
            line.setAttribute('stroke-width', '2.5');
            
            const markerId = ensureMarkerForColor(shape.color || '#6a6a6a');
            line.setAttribute('marker-end', `url(#${markerId})`);
            
            line.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                if (confirm('Delete this arrow?')) {
                    const index = state.shapes.findIndex(s => s.id === shape.id);
                    if (index > -1) {
                        state.shapes.splice(index, 1);
                        addToHistory(state);
                        await saveCurrentInvestigation();
                        renderAllShapes();
                    }
                }
            });
            
            svg.appendChild(line);
        }
    });
}

async function deleteConnection(connectionId) {
    const connIndex = state.connections.findIndex(c => c.id === connectionId);
    if (connIndex > -1) {
        const connection = state.connections[connIndex];
        if (connection.line) connection.line.remove();
        if (connection.hitArea) connection.hitArea.remove();
        if (connection.dragPoint) connection.dragPoint.remove();
        if (connection.labelElement) connection.labelElement.remove();
        if (connection.toolbarElement) connection.toolbarElement.remove();
        state.connections.splice(connIndex, 1);
        addToHistory(state);
        await saveCurrentInvestigation();
    }
}

export async function createConnectionWithSides(fromNode, fromSide, toNode, toSide) {
    if (fromNode.id === toNode.id) return;
    const connection = { 
        id: state.connectionCounter++, 
        from: fromNode, 
        fromSide, 
        to: toNode, 
        toSide, 
        label: '', 
        color: '#6a6a6a',
        style: 'solid'
    };
    const svg = document.querySelector('.connection-svg');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.classList.add('connection-line');
    line.dataset.connectionId = connection.id;
    
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.classList.add('connection-hit-area');
    hitArea.style.stroke = 'transparent';
    hitArea.style.strokeWidth = '15';
    hitArea.style.fill = 'none';
    hitArea.style.pointerEvents = 'stroke';
    hitArea.dataset.connectionId = connection.id;
    
    const dragPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dragPoint.classList.add('connection-drag-point');
    dragPoint.setAttribute('r', '8');
    dragPoint.setAttribute('fill', '#00aaff');
    dragPoint.setAttribute('opacity', '0');
    dragPoint.style.cursor = 'move';
    dragPoint.dataset.connectionId = connection.id;
    
    dragPoint.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDragArrowHead(connection, e);
    });
    
    const handleClick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.connection-line.active').forEach(el => {
            el.classList.remove('active');
            const connId = Number(el.dataset.connectionId);
            const conn = state.connections.find(c => c.id === connId);
            if (conn && conn.toolbarElement) {
                conn.toolbarElement.style.display = 'none';
            }
        });
        
        line.classList.add('active');
        if (!connection.toolbarElement) {
            connection.toolbarElement = createConnectionToolbar(connection);
        }
        connection.toolbarElement.style.display = 'flex';
        updateConnectionToolbarPosition(connection);
    };
    
    line.addEventListener('click', handleClick);
    hitArea.addEventListener('click', handleClick);
    
    line.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Delete this connection?')) {
            deleteConnection(connection.id);
        }
    });
    
    svg.appendChild(hitArea);
    svg.appendChild(line);
    svg.appendChild(dragPoint);
    connection.line = line;
    connection.hitArea = hitArea;
    connection.dragPoint = dragPoint;
    state.connections.push(connection);
    updateAllConnections();
    addToHistory(state);
    await saveCurrentInvestigation();
}

function startDragArrowHead(connection, startEvent) {
    state.isDraggingArrowHead = true;
    state.draggingConnection = connection;
    
    const previewLine = document.getElementById('preview-line');
    if (previewLine) {
        previewLine.style.display = 'block';
    }
    
    if (connection.toolbarElement) {
        connection.toolbarElement.style.display = 'none';
    }
    
    connection.line.style.opacity = '0.3';
    
    const docMouseMove = (e) => {
        if (!state.isDraggingArrowHead) return;
        
        const container = document.getElementById('canvas-container');
        const rect = container.getBoundingClientRect();
        
        const mousePos = {
            x: (e.clientX - rect.left - state.offsetX) / state.scale,
            y: (e.clientY - rect.top - state.offsetY) / state.scale
        };
        
        const startPoint = getConnectionPoint(connection.from, connection.fromSide);
        previewLine.setAttribute('d', getCurvePath(startPoint, mousePos, connection.fromSide, null));
        previewLine.removeAttribute('marker-end');
        previewLine.style.stroke = '#00aaff';
    };
    
    const docMouseUp = async (e) => {
        if (!state.isDraggingArrowHead) return;
        
        state.isDraggingArrowHead = false;
        document.removeEventListener('mousemove', docMouseMove);
        document.removeEventListener('mouseup', docMouseUp);
        
        const targetElement = e.target;
        if (previewLine) previewLine.style.display = 'none';
        connection.line.style.opacity = '1';
        
        if (targetElement.classList.contains('connection-point')) {
            const targetNodeId = Number(targetElement.closest('.node')?.dataset.nodeId);
            const targetNode = state.nodes.find(n => n.id === targetNodeId);
            const targetSide = targetElement.dataset.side;
            
            if (targetNode && targetNode.id !== connection.from.id) {
                connection.to = targetNode;
                connection.toSide = targetSide;
                updateAllConnections();
                addToHistory(state);
                await saveCurrentInvestigation();
            }
        }
        
        state.draggingConnection = null;
    };
    
    document.addEventListener('mousemove', docMouseMove);
    document.addEventListener('mouseup', docMouseUp);
}

export function createConnectionFromData(connData) {
    const from = state.nodes.find(n => n.id === connData.from);
    const to = state.nodes.find(n => n.id === connData.to);
    if (from && to) {
        const connection = { ...connData, from, to };
        if (!connection.style) { 
            connection.style = 'solid';
        }
        state.connections.push(connection);
        const svg = document.querySelector('.connection-svg');
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-line');
        line.dataset.connectionId = connection.id;
        
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitArea.classList.add('connection-hit-area');
        hitArea.style.stroke = 'transparent';
        hitArea.style.strokeWidth = '15';
        hitArea.style.fill = 'none';
        hitArea.style.pointerEvents = 'stroke';
        hitArea.dataset.connectionId = connection.id;
        
        const dragPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dragPoint.classList.add('connection-drag-point');
        dragPoint.setAttribute('r', '8');
        dragPoint.setAttribute('fill', '#00aaff');
        dragPoint.setAttribute('opacity', '0');
        dragPoint.style.cursor = 'move';
        dragPoint.dataset.connectionId = connection.id;
        
        dragPoint.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startDragArrowHead(connection, e);
        });
        
        const handleClick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.connection-line.active').forEach(el => {
                el.classList.remove('active');
                const connId = Number(el.dataset.connectionId);
                const conn = state.connections.find(c => c.id === connId);
                if (conn && conn.toolbarElement) {
                    conn.toolbarElement.style.display = 'none';
                }
            });
            
            line.classList.add('active');
            if (!connection.toolbarElement) {
                connection.toolbarElement = createConnectionToolbar(connection);
            }
            connection.toolbarElement.style.display = 'flex';
            updateConnectionToolbarPosition(connection);
        };
        
        line.addEventListener('click', handleClick);
        hitArea.addEventListener('click', handleClick);
        
        line.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Delete this connection?')) {
                deleteConnection(connection.id);
            }
        });
        
        svg.appendChild(hitArea);
        svg.appendChild(line);
        svg.appendChild(dragPoint);
        connection.line = line;
        connection.hitArea = hitArea;
        connection.dragPoint = dragPoint;
    }
}

function setupNodeInteractions(node) {
    const div = node.element;
    const previewLine = document.getElementById('preview-line');
    if (!previewLine) {
        console.error("CRITICAL ERROR: The 'preview-line' SVG path element was not found.");
        return;
    }
    let isDragging = false, isResizing = false, isConnecting = false;
    let dragStartPositions = new Map();
    let resizeHandle, startWidth, startHeight, startX, startY;
    let minResizeHeight;
    
    const docMouseMove = (e) => {
        if (isConnecting) {
            const container = document.getElementById('canvas-container');
            const rect = container.getBoundingClientRect();
            
            const mouseX = (e.clientX - rect.left - state.offsetX) / state.scale;
            const mouseY = (e.clientY - rect.top - state.offsetY) / state.scale;
            const mousePos = { x: mouseX, y: mouseY };
            
            const startPoint = getConnectionPoint(state.connectionStartPoint.node, state.connectionStartPoint.side);
            
            const pathData = getCurvePath(startPoint, mousePos, state.connectionStartPoint.side, null);
            previewLine.setAttribute('d', pathData);
            previewLine.removeAttribute('marker-end');
            previewLine.style.stroke = '#00aaff';
            previewLine.style.display = 'block';
        } else if (isDragging) {
            const currentMousePos = {
                x: (e.clientX - state.offsetX) / state.scale,
                y: (e.clientY - state.offsetY) / state.scale
            };
            const dx = currentMousePos.x - dragStartPositions.get('mouse').x;
            const dy = currentMousePos.y - dragStartPositions.get('mouse').y;
            
            const MIN_X = 0;
            const MAX_X = 14500;
            const MIN_Y = 0;
            const MAX_Y = 14500;
            
            state.selectedNodes.forEach(selectedNode => {
                const startPos = dragStartPositions.get(selectedNode.id);
                if (startPos) {
                    let newX = startPos.x + dx;
                    let newY = startPos.y + dy;
                    
                    const nodeWidth = selectedNode.element.offsetWidth;
                    const nodeHeight = selectedNode.element.offsetHeight;
                    
                    newX = Math.max(MIN_X, Math.min(MAX_X - nodeWidth, newX));
                    newY = Math.max(MIN_Y, Math.min(MAX_Y - nodeHeight, newY));
                    
                    selectedNode.x = newX;
                    selectedNode.y = newY;
                    selectedNode.element.style.left = `${selectedNode.x}px`;
                    selectedNode.element.style.top = `${selectedNode.y}px`;
                }
            });
            
            updateConnectionsForNodes(state.selectedNodes);
        } else if (isResizing) {
            const dx = (e.clientX - dragStartPositions.get('mouse').x) / state.scale;
            const dy = (e.clientY - dragStartPositions.get('mouse').y) / state.scale;
            const classList = resizeHandle.classList;
            
            if (classList.contains('right') || classList.contains('top-right') || classList.contains('bottom-right')) {
                node.width = Math.max(150, startWidth + dx);
            }
            if (classList.contains('left') || classList.contains('top-left') || classList.contains('bottom-left')) {
                node.width = Math.max(150, startWidth - dx);
                node.x = startX + dx;  
            }
            if (classList.contains('bottom') || classList.contains('bottom-left') || classList.contains('bottom-right')) {
                node.height = Math.max(minResizeHeight, startHeight + dy); 
            }
            if (classList.contains('top') || classList.contains('top-left') || classList.contains('top-right')) {
                node.height = Math.max(minResizeHeight, startHeight - dy); 
                node.y = startY + dy;
            }
            
            div.style.width = `${node.width}px`;
            div.style.height = `${node.height}px`;
            div.style.left = `${node.x}px`;
            div.style.top = `${node.y}px`;
            
            updateConnectionsForNodes([node]);
        }
    };

    const docMouseUp = async (e) => {
        const wasConnecting = isConnecting;
        const wasDragging = isDragging;
        const wasResizing = isResizing;
        
        isDragging = isResizing = isConnecting = false;
        document.removeEventListener('mousemove', docMouseMove);
        document.removeEventListener('mouseup', docMouseUp);
        
        if (wasConnecting) {
            const targetElement = e.target;
            previewLine.style.display = 'none';
            if (targetElement.classList.contains('connection-point')) {
                const targetNodeId = Number(targetElement.closest('.node')?.dataset.nodeId);
                const targetNode = state.nodes.find(n => n.id === targetNodeId);
                if (targetNode && state.connectionStartPoint?.node && targetNode.id !== state.connectionStartPoint.node.id) {
                    await createConnectionWithSides(
                        state.connectionStartPoint.node, 
                        state.connectionStartPoint.side, 
                        targetNode, 
                        targetElement.dataset.side
                    );
                }
            }
        }
        if (wasDragging || wasResizing) {
            if (wasResizing) {
                node.height = div.offsetHeight;
            }
            addToHistory(state);
            await saveCurrentInvestigation();
        }
        state.connectionStartPoint = null;
    };

    div.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const target = e.target;
        const isResizeHandle = target.classList.contains('resize-handle');
        const isConnectionPoint = target.classList.contains('connection-point');
        const isToolbar = target.closest('.node-toolbar');

        if (isToolbar) return;

        if (isConnectionPoint) {
            e.preventDefault();
            e.stopPropagation();
            isConnecting = true;
            state.connectionStartPoint = { node, side: target.dataset.side };
        } else if (isResizeHandle) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            resizeHandle = target;
            startWidth = div.offsetWidth; 
            startHeight = div.offsetHeight;
            startX = node.x; 
            startY = node.y;
            dragStartPositions.set('mouse', { x: e.clientX, y: e.clientY });
            const headerElement = div.querySelector('.node-header');
            const imageElement = div.querySelector('.node-image');
            const bodyElement = div.querySelector('.node-body');

            let calculatedMinHeight = 0;
            if (headerElement) {
                calculatedMinHeight += headerElement.offsetHeight;
            }
            if (imageElement) {
                calculatedMinHeight += 100; 
            }
            if (bodyElement) {
                calculatedMinHeight += bodyElement.scrollHeight;
            }

            const nodeStyle = window.getComputedStyle(div);
            calculatedMinHeight += parseFloat(nodeStyle.borderTopWidth) + parseFloat(nodeStyle.borderBottomWidth);

            minResizeHeight = calculatedMinHeight;
        } else {
            e.preventDefault();
            e.stopPropagation();
            if (!node.element.classList.contains('selected') && !e.shiftKey) {
                clearSelection();
                addNodeToSelection(node);
            }
            isDragging = true;
            dragStartPositions.clear();
            dragStartPositions.set('mouse', { 
                x: (e.clientX - state.offsetX) / state.scale, 
                y: (e.clientY - state.offsetY) / state.scale 
            });
            state.selectedNodes.forEach(n => {
                dragStartPositions.set(n.id, { x: n.x, y: n.y });
            });
            div.classList.remove('active');
        }
        document.addEventListener('mousemove', docMouseMove);
        document.addEventListener('mouseup', docMouseUp);
    });
        
    div.addEventListener('click', (e) => {
        if (e.target.closest('.node-toolbar, .resize-handle, .connection-point')) return;
        if (e.shiftKey) {
            e.stopPropagation();
            if (node.element.classList.contains('selected')) {
                removeNodeFromSelection(node);
            } else {
                addNodeToSelection(node);
            }
        } else {
            if (!div.classList.contains('active')) {
                document.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
            }
            div.classList.toggle('active');
        }
    });

    div.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            if (action === 'edit') editCard(node);
            else if (action === 'color') showColorPickerForNode(node);
            else if (action === 'delete') {
                if (confirm('Delete card?')) deleteNode(node.id);
            }
        });
    });
}

function updateConnectionsForNodes(nodes) {
    const nodeIds = new Set(nodes.map(n => n.id));
    
    state.connections.forEach(conn => {
        if (!nodeIds.has(conn.from.id) && !nodeIds.has(conn.to.id)) return;
        if (!conn.from || !conn.to || !conn.line) return;
        
        const startPoint = getConnectionPoint(conn.from, conn.fromSide);
        const endPoint = getConnectionPoint(conn.to, conn.toSide);
        const pathData = getCurvePath(startPoint, endPoint, conn.fromSide, conn.toSide);
        
        conn.line.setAttribute('d', pathData);
        if (conn.hitArea) conn.hitArea.setAttribute('d', pathData);
        
        if (conn.dragPoint) {
            conn.dragPoint.setAttribute('cx', endPoint.x);
            conn.dragPoint.setAttribute('cy', endPoint.y);
        }
        
        if (conn.label && conn.labelElement) {
            try {
                if (conn.line.getTotalLength() > 0) {
                    const midPoint = conn.line.getPointAtLength(conn.line.getTotalLength() / 2);
                    conn.labelElement.style.left = `${midPoint.x}px`;
                    conn.labelElement.style.top = `${midPoint.y - 25}px`;
                }
            } catch(e) {
                
            }
        }
    });
}


export function renderGroups() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;

    canvas.querySelectorAll('.group-box').forEach(el => el.remove());

    state.groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-box';
        groupDiv.dataset.groupId = group.id;
        group.element = groupDiv;
        groupDiv.style.left = `${group.x}px`;
        groupDiv.style.top = `${group.y}px`;
        groupDiv.style.width = `${group.width}px`;
        groupDiv.style.height = `${group.height}px`;
        if (group.color) { groupDiv.style.backgroundColor = group.color; }

        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'group-box-name';
        nameDiv.textContent = group.name; 

        const toolbar = document.createElement('div');
        toolbar.className = 'group-toolbar';
        toolbar.innerHTML = `
            <button class="toolbar-btn" data-action="move" title="Move Group">⤧</button>
            <button class="toolbar-btn" data-action="resize" title="Redraw/Resize">⬜</button>
            <button class="toolbar-btn" data-action="rename" title="Rename">✏️</button>
            <button class="toolbar-btn" data-action="delete" title="Delete">🗑️</button>
        `;
        
        groupDiv.appendChild(nameDiv);
        groupDiv.appendChild(toolbar);
        

        canvas.appendChild(groupDiv);

        nameDiv.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const isVisible = toolbar.style.display === 'flex';
            document.querySelectorAll('.group-toolbar').forEach(tb => tb.style.display = 'none');
            if (!isVisible) { toolbar.style.display = 'flex'; }

            const closeHandler = (event) => {
                if (!toolbar.contains(event.target)) {
                    toolbar.style.display = 'none';
                    document.removeEventListener('mousedown', closeHandler, true);
                }
            };
            setTimeout(() => document.addEventListener('mousedown', closeHandler, true), 0);
        });

        toolbar.addEventListener('mousedown', async (e) => {
            e.stopPropagation();
            const action = e.target.closest('button')?.dataset.action;
            if (!action) return;

            toolbar.style.display = 'none'; 

            switch (action) {
                case 'move':
                    groupDiv.style.cursor = 'move';
                    groupDiv.style.pointerEvents = 'auto'; 
                    alert('Move mode activated. Click and drag the group to move it. Click on the background to exit.');
                    state.activeGroupAction = { type: 'move', groupId: group.id };
                    break;
                case 'resize':
                    if (confirm(`This will delete the group "${group.name}" and let you redraw it. Continue?`)) {
                        state.groups = state.groups.filter(g => g.id !== group.id);
                        renderGroups();
                        addToHistory(state);
                        await saveCurrentInvestigation();
                        document.getElementById('group-mode-btn').click();
                    }
                    break;
                case 'rename':
                    const newName = prompt("Enter the new name:", group.name);
                    if (newName && newName.trim() !== '') {
                        group.name = newName.trim();
                        nameDiv.textContent = group.name; 
                        addToHistory(state);
                        await saveCurrentInvestigation();
                    }
                    break;
                case 'delete':
                    if (confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
                        state.groups = state.groups.filter(g => g.id !== group.id);
                        renderGroups();
                        addToHistory(state);
                        await saveCurrentInvestigation();
                    }
                    break;
            }
        });

        let isDragging = false;
        let dragStartX, dragStartY, startX, startY;

        groupDiv.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !state.activeGroupAction || state.activeGroupAction.groupId !== group.id || state.activeGroupAction.type !== 'move') {
                return;
            }
            e.stopPropagation();
            isDragging = true;
            startX = group.x;
            startY = group.y;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            const docMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = (moveEvent.clientX - dragStartX) / state.scale;
                const dy = (moveEvent.clientY - dragStartY) / state.scale;
                group.x = startX + dx;
                group.y = startY + dy;
                groupDiv.style.left = `${group.x}px`;
                groupDiv.style.top = `${group.y}px`;
            };

            const docMouseUp = async () => {
                isDragging = false;
                groupDiv.style.cursor = '';
                groupDiv.style.pointerEvents = 'none';
                state.activeGroupAction = null;
                
                addToHistory(state);
                await saveCurrentInvestigation();

                document.removeEventListener('mousemove', docMouseMove);
                document.removeEventListener('mouseup', docMouseUp);
            };

            document.addEventListener('mousemove', docMouseMove);
            document.addEventListener('mouseup', docMouseUp);
        });
    });
}

export function setupGroupInteractions() {
    const canvas = document.getElementById('canvas');

    canvas.addEventListener('click', async (e) => {
        const nameDiv = e.target.closest('.group-box-name');
        const toolbarBtn = e.target.closest('.group-toolbar .toolbar-btn');

        if (toolbarBtn) {
            e.stopPropagation();
            const groupDiv = toolbarBtn.closest('.group-box');
            const groupId = Number(groupDiv.dataset.groupId);
            const group = state.groups.find(g => g.id === groupId);
            const action = toolbarBtn.dataset.action;

            switch (action) {
                case 'rename':
                    const newName = prompt("Enter the new name:", group.name);
                    if (newName && newName.trim() !== '') {
                        group.name = newName.trim();
                        groupDiv.querySelector('.group-box-name').textContent = group.name;
                        addToHistory(state);
                        await saveCurrentInvestigation();
                    }
                    break;
                case 'delete':
                    if (confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
                        state.groups = state.groups.filter(g => g.id !== group.id);
                        renderGroups();
                        addToHistory(state);
                        await saveCurrentInvestigation();
                    }
                    break;
                case 'resize':
                    alert("Resize functionality will be added in the next step.");
                    break;
            }
            document.querySelectorAll('.group-toolbar').forEach(tb => tb.classList.remove('visible'));
            return;
        }

        if (nameDiv) {
            e.stopPropagation();
            const groupDiv = nameDiv.closest('.group-box');
            const toolbar = groupDiv.querySelector('.group-toolbar');
            const isVisible = toolbar.classList.contains('visible');

            document.querySelectorAll('.group-toolbar').forEach(tb => tb.classList.remove('visible'));
            
            if (!isVisible) {
                toolbar.classList.add('visible');
            }
            return;
        }

        document.querySelectorAll('.group-toolbar.visible').forEach(tb => tb.classList.remove('visible'));
    });
}



function generateCustomFieldsElement(node) {
    const template = BUILT_IN_TEMPLATES[node.type] || BUILT_IN_TEMPLATES['other'];
    let descriptionValue = '';

    const descriptionField = template.fields.find(field => field.type === 'textarea' && !field.isTitle);

    if (descriptionField && node.customData[descriptionField.id]) {
        descriptionValue = node.customData[descriptionField.id];
    }

    const contentElement = document.createElement('div');
    if (descriptionValue) {
        contentElement.className = 'field-value';
        contentElement.textContent = descriptionValue;
    } else {
        contentElement.style.color = '#888';
        contentElement.style.padding = '12px';
        contentElement.textContent = 'No description';
    }
    return contentElement;
}