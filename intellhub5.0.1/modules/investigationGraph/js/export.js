// js/export.js
import { state } from './main.js';

export async function exportToImage() {
    if (!state.currentInvestigation) {
        return alert("Please select an investigation to export.");
    }
    
    const container = document.getElementById('canvas-container');
    const svg = container.querySelector('.connection-svg'); 
    
    const originalCursor = container.style.cursor;
    const originalSvgStyle = svg.style.cssText; 

    container.style.cursor = 'progress';

    try {
        svg.style.top = '0px';
        svg.style.left = '0px';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;

        const options = {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scrollX: -window.scrollX, 
            scrollY: -window.scrollY
        };

        const canvas = await html2canvas(container, options);

        const imageUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        const safeName = state.currentInvestigation.name.trim().replace(/\s+/g, '_');
        a.href = imageUrl;
        a.download = `${safeName}_${new Date().toISOString().slice(0, 10)}.png`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (error) {
        console.error('Oops, something went wrong!', error);
        alert('Could not export the image. Please check the console for errors.');
    } finally {
        svg.style.cssText = originalSvgStyle;
        container.style.cursor = originalCursor;
    }
}