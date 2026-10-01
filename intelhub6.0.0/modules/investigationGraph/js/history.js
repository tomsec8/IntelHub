// js/history.js

const history = [];
let historyIndex = -1;
const MAX_HISTORY_STATES = 50; 

export function initHistory(initialState) {
    history.length = 0;
    historyIndex = -1;
    addToHistory(initialState);
}



export function addToHistory(state) {
    const cleanData = {
        nodes: state.nodes.map(n => ({ 
            id: n.id, 
            x: n.x, 
            y: n.y, 
            width: n.element.offsetWidth, 
            height: n.element.offsetHeight, 
            title: n.title, 
            type: n.type,
            customData: n.customData, 
            image: n.image, 
            color: n.color,
            sources: n.sources || []
        })),
        connections: state.connections.map(c => ({ 
            id: c.id, 
            from: c.from.id, fromSide: c.fromSide,
            to: c.to.id, toSide: c.toSide,
            label: c.label, color: c.color, style: c.style 
        })),
        groups: state.groups,
        shapes: state.shapes || []
    };

    const snapshot = JSON.parse(JSON.stringify(cleanData));

    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }

    history.push(snapshot);
    
    if (history.length > MAX_HISTORY_STATES) {
        history.shift();
    }
    
    historyIndex = history.length - 1;
}

export function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        return JSON.parse(JSON.stringify(history[historyIndex]));
    }
    return null; 
}

export function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        return JSON.parse(JSON.stringify(history[historyIndex]));
    }
    return null; 
}