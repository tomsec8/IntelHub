
import { state } from './main.js';
import { saveInvestigations, loadInvestigation } from './investigations.js';
import { askText, askAlert } from './dialogs.js';

export async function exportCanvas() {
    if (!state.currentInvestigation) {
        await askAlert('Select an investigation to export.');
        return;
    }
    
    const dataToExport = {
        nodes: state.nodes.map(n => ({ 
            id: n.id, 
            x: n.x, 
            y: n.y, 
            width: n.element.offsetWidth, 
            height: n.element.offsetHeight, 
            title: n.title, 
            type: n.type,
            customData: n.customData, 
            content: n.content, 
            image: n.image, 
            color: n.color,
            sources: n.sources || [] 
        })),
        connections: state.connections.map(c => ({ 
            id: c.id, 
            from: c.from.id, 
            fromSide: c.fromSide,
            to: c.to.id, 
            toSide: c.toSide,
            label: c.label, 
            color: c.color,
            style: c.style
        })),
        groups: state.groups
    };
    
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = state.currentInvestigation.name.trim().replace(/\s+/g, '_');
    a.download = `${safeName}_investigation.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importCanvas(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonString = e.target.result;
        let importedData;
        
        try {
            importedData = JSON.parse(jsonString);
        } catch (error) {
            await askAlert('Error parsing file. Please make sure it is a valid JSON file.');
            return;
        }
        
        if (!importedData || !Array.isArray(importedData.nodes)) {
            await askAlert('Invalid file format. The file does not appear to be a valid investigation export.');
            return;
        }
        
        if (!importedData.connections) {
            importedData.connections = [];
        }

        if (!state.folders.length) {
            const folder = { id: Date.now(), name: 'Cases' };
            state.folders.push(folder);
            state.activeFolderId = folder.id;
        }

        const result = await askText({
            title: 'Import investigation',
            label: 'Investigation name',
            value: file.name.replace('.json', ''),
            confirmLabel: 'Import',
            folderChoices: state.folders,
            folderValue: state.activeFolderId || state.folders[0].id
        });
        if (!result) return;
        const investigationName = typeof result === 'string' ? result : result.name;
        const folderId = typeof result === 'string' ? (state.activeFolderId || state.folders[0].id) : result.folderId;
        
        const newInvestigation = {
            id: Date.now(),
            name: investigationName.trim(),
            folderId,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            data: importedData
        };
        
        state.investigations.unshift(newInvestigation);
        await saveInvestigations();
        loadInvestigation(newInvestigation);
    };
    
    reader.onerror = () => { 
        askAlert('Error reading the file.'); 
    };
    
    reader.readAsText(file);
    event.target.value = null;
}