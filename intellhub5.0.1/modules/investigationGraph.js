import { brw, createSection, saveViewState, resetViewState, flashButton } from './utils.js';
import { BUILT_IN_TEMPLATES } from './investigationGraph/js/templates.js';

export function restoreInvestigationGraphView(container, state) {
    if (state.mainOpen) {
        const btn = Array.from(container.querySelectorAll('.category-button')).find(b => b.textContent === "Investigation Graph");
        if (btn) {
            const wrapper = btn.nextElementSibling;
            if (wrapper) wrapper.classList.add("open");
        }
    }
}

export function initializeInvestigationGraph(container) {
    let investigations = [];
    
    // UI Elements
    let invSelect;

    const { wrapper } = createSection(container, "Investigation Graph", {
        onToggle: (isOpen) => {
            if (isOpen) {
                saveViewState('investigationGraph', { mainOpen: true });
                loadInvestigationsForDropdown();
            } else {
                resetViewState();
            }
        }
    });

    // Populate data regardless of toggle state, so it's ready when the popup restores
    loadInvestigationsForDropdown();

    // 1. Open Full Graph Button
    const openGraphBtn = document.createElement("button");
    openGraphBtn.className = "sub-category-button";
    openGraphBtn.textContent = "🗺️ Open Full Graph";
    openGraphBtn.style.background = "linear-gradient(135deg, #ff8c42, #ff5e62)";
    openGraphBtn.style.color = "#fff";
    openGraphBtn.style.fontWeight = "bold";
    openGraphBtn.addEventListener("click", () => {
        brw.tabs.create({ url: 'modules/investigationGraph/index.html' });
    });
    wrapper.appendChild(openGraphBtn);

    const divider1 = document.createElement("div");
    divider1.style.borderBottom = "1px solid #444";
    divider1.style.margin = "12px 0 8px 0";
    wrapper.appendChild(divider1);

    // 2. Active Investigation Selection
    const selectionRow = document.createElement("div");
    selectionRow.style.display = "flex";
    selectionRow.style.gap = "8px";
    selectionRow.style.marginBottom = "10px";

    invSelect = document.createElement("select");
    invSelect.style.flex = "1";
    invSelect.style.padding = "6px";
    invSelect.style.borderRadius = "4px";
    invSelect.style.background = "#1a1a2e";
    invSelect.style.color = "#fff";
    invSelect.style.border = "1px solid #555";
    invSelect.innerHTML = `<option value="">Select Investigation...</option>`;

    const newInvBtn = document.createElement("button");
    newInvBtn.textContent = "➕ New";
    newInvBtn.title = "Create new investigation";
    newInvBtn.style.padding = "4px 8px";
    newInvBtn.style.background = "#2c3e50";
    newInvBtn.style.color = "#fff";
    newInvBtn.style.border = "1px solid #555";
    newInvBtn.style.borderRadius = "4px";
    newInvBtn.style.cursor = "pointer";

    // Inline UI Container for New Investigation
    const newInvContainer = document.createElement("div");
    newInvContainer.style.display = "none";
    newInvContainer.style.gap = "6px";
    newInvContainer.style.marginBottom = "10px";
    newInvContainer.style.width = "100%";
    
    const newInvInput = document.createElement("input");
    newInvInput.type = "text";
    newInvInput.placeholder = "Investigation Name...";
    newInvInput.style.flex = "1";
    newInvInput.style.padding = "6px";
    newInvInput.style.borderRadius = "4px";
    newInvInput.style.background = "#1a1a2e";
    newInvInput.style.color = "#fff";
    newInvInput.style.border = "1px solid #555";
    
    const newInvSaveBtn = document.createElement("button");
    newInvSaveBtn.textContent = "✓";
    newInvSaveBtn.style.padding = "4px 8px";
    newInvSaveBtn.style.background = "#27ae60";
    newInvSaveBtn.style.color = "#fff";
    newInvSaveBtn.style.border = "none";
    newInvSaveBtn.style.borderRadius = "4px";
    newInvSaveBtn.style.cursor = "pointer";

    const newInvCancelBtn = document.createElement("button");
    newInvCancelBtn.textContent = "✕";
    newInvCancelBtn.style.padding = "4px 8px";
    newInvCancelBtn.style.background = "#ff6b6b";
    newInvCancelBtn.style.color = "#fff";
    newInvCancelBtn.style.border = "none";
    newInvCancelBtn.style.borderRadius = "4px";
    newInvCancelBtn.style.cursor = "pointer";

    newInvContainer.appendChild(newInvInput);
    newInvContainer.appendChild(newInvSaveBtn);
    newInvContainer.appendChild(newInvCancelBtn);
    
    selectionRow.appendChild(invSelect);
    selectionRow.appendChild(newInvBtn);
    
    wrapper.appendChild(selectionRow);
    wrapper.appendChild(newInvContainer);

    // 2.5 Active Investigation Cards Viewer
    const cardsListContainer = document.createElement("div");
    cardsListContainer.style.background = "#150d1f";
    cardsListContainer.style.padding = "8px";
    cardsListContainer.style.borderRadius = "8px";
    cardsListContainer.style.border = "1px solid #444";
    cardsListContainer.style.marginBottom = "10px";
    cardsListContainer.style.maxHeight = "350px";
    cardsListContainer.style.overflowY = "auto";
    cardsListContainer.style.display = "none"; // hidden until investigation is selected
    wrapper.appendChild(cardsListContainer);

    // 3. Quick Add Card Form
    const addCardContainer = document.createElement("div");
    addCardContainer.style.background = "#1e272e";
    addCardContainer.style.padding = "10px";
    addCardContainer.style.borderRadius = "8px";
    addCardContainer.style.border = "1px solid #444";
    
    const cardTitle = document.createElement("div");
    cardTitle.textContent = "Quick-Add Card to Active Investigation";
    cardTitle.style.color = "#ffcc99";
    cardTitle.style.fontSize = "12px";
    cardTitle.style.fontWeight = "bold";
    cardTitle.style.marginBottom = "8px";
    addCardContainer.appendChild(cardTitle);

    const typeSelect = document.createElement("select");
    typeSelect.style.width = "90%";
    typeSelect.style.padding = "6px";
    typeSelect.style.marginBottom = "8px";
    typeSelect.style.borderRadius = "4px";
    typeSelect.style.background = "#1a1a2e";
    typeSelect.style.color = "#fff";
    typeSelect.style.border = "1px solid #555";
    Object.keys(BUILT_IN_TEMPLATES).forEach(key => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = BUILT_IN_TEMPLATES[key].name;
        typeSelect.appendChild(opt);
    });
    if(BUILT_IN_TEMPLATES['person']) typeSelect.value = 'person';
    addCardContainer.appendChild(typeSelect);

    const inputTitle = document.createElement("input");
    inputTitle.type = "text";
    inputTitle.placeholder = "Card Title / Primary Info...";
    inputTitle.style.width = "90%";
    inputTitle.style.padding = "6px";
    inputTitle.style.marginBottom = "8px";
    inputTitle.style.borderRadius = "4px";
    inputTitle.style.background = "#1a1a2e";
    inputTitle.style.color = "#fff";
    inputTitle.style.border = "1px solid #555";
    addCardContainer.appendChild(inputTitle);

    const inputContent = document.createElement("textarea");
    inputContent.placeholder = "Notes or Additional Details...";
    inputContent.style.width = "90%";
    inputContent.style.height = "50px";
    inputContent.style.padding = "6px";
    inputContent.style.marginBottom = "8px";
    inputContent.style.borderRadius = "4px";
    inputContent.style.background = "#1a1a2e";
    inputContent.style.color = "#fff";
    inputContent.style.border = "1px solid #555";
    inputContent.style.resize = "vertical";
    addCardContainer.appendChild(inputContent);

    // URL checkbox removed by user request

    const captureBtn = document.createElement("button");
    captureBtn.className = "sub-category-button";
    captureBtn.textContent = "➕ Create Card";
    captureBtn.style.marginTop = "0";
    addCardContainer.appendChild(captureBtn);

    wrapper.appendChild(addCardContainer);

    // --- Logic ---
    async function loadInvestigationsForDropdown() {
        const data = await brw.storage.local.get(['osint_investigations', 'last_investigation_id']);
        investigations = data.osint_investigations || [];
        
        invSelect.innerHTML = `<option value="">Select Investigation...</option>`;
        investigations.forEach(inv => {
            const opt = document.createElement("option");
            opt.value = inv.id;
            opt.textContent = inv.name;
            invSelect.appendChild(opt);
        });

        const lastIdStr = String(data.last_investigation_id);
        if (data.last_investigation_id && investigations.find(i => String(i.id) === lastIdStr)) {
            invSelect.value = lastIdStr;
        } else if (investigations.length > 0) {
            invSelect.value = String(investigations[0].id);
        }
        renderCardsList();
    }

    function renderCardsList() {
        const activeId = Number(invSelect.value);
        if (!activeId) {
            cardsListContainer.style.display = "none";
            return;
        }
        
        cardsListContainer.style.display = "block";
        cardsListContainer.innerHTML = "";
        
        const activeInvIndex = investigations.findIndex(i => i.id === activeId);
        if (activeInvIndex === -1) return;
        const activeInv = investigations[activeInvIndex];

        const titleDiv = document.createElement("div");
        titleDiv.textContent = `Cards in "${activeInv.name}" (${activeInv.data.nodes?.length || 0}):`;
        titleDiv.style.color = "#ffcc99";
        titleDiv.style.fontSize = "11px";
        titleDiv.style.marginBottom = "8px";
        titleDiv.style.borderBottom = "1px solid #333";
        titleDiv.style.paddingBottom = "4px";
        cardsListContainer.appendChild(titleDiv);

        if (!activeInv.data.nodes || activeInv.data.nodes.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.textContent = "No cards yet.";
            emptyDiv.style.color = "#888";
            emptyDiv.style.fontSize = "11px";
            emptyDiv.style.fontStyle = "italic";
            cardsListContainer.appendChild(emptyDiv);
            return;
        }

        const iconsMap = {
            person: '👤', phone: '📱', email: '📧', address: '🏠',
            company: '🏢', vehicle: '🚗', website: '🌐', social: '💬',
            document: '📄', location: '📍', event: '📅', other: '📝'
        };

        [...activeInv.data.nodes].reverse().forEach(node => {
            const cardItem = document.createElement("div");
            cardItem.style.background = "#2c1e3f";
            cardItem.style.marginBottom = "4px";
            cardItem.style.borderRadius = "4px";
            cardItem.style.borderLeft = `3px solid ${node.color || '#badc58'}`;
            cardItem.style.overflow = "hidden";

            // Header part
            const header = document.createElement("div");
            header.style.padding = "6px";
            header.style.fontSize = "12px";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";
            header.style.cursor = "pointer";
            header.title = "Click to expand/edit";
            
            const leftPart = document.createElement("div");
            leftPart.style.overflow = "hidden";
            leftPart.style.textOverflow = "ellipsis";
            leftPart.style.whiteSpace = "nowrap";

            const icon = iconsMap[node.type] || '📝';
            leftPart.textContent = `${icon} ${node.title || 'Untitled'}`;
            header.appendChild(leftPart);

            const rightPart = document.createElement("div");
            
            const expandIcon = document.createElement("span");
            expandIcon.textContent = "▼";
            expandIcon.style.fontSize = "10px";
            expandIcon.style.marginRight = "6px";
            expandIcon.style.opacity = "0.7";
            rightPart.appendChild(expandIcon);

            const delBtn = document.createElement("span");
            delBtn.textContent = "×";
            delBtn.style.color = "#ff6b6b";
            delBtn.style.fontWeight = "bold";
            delBtn.title = "Delete Card";
            let deleteConfirmMode = false;
            let deleteTimeout;
            
            delBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                
                if (!deleteConfirmMode) {
                    deleteConfirmMode = true;
                    delBtn.textContent = "Sure?";
                    delBtn.style.background = "#c0392b";
                    delBtn.style.color = "#fff";
                    delBtn.style.borderRadius = "3px";
                    delBtn.style.padding = "2px 4px";
                    delBtn.style.fontSize = "10px";
                    
                    deleteTimeout = setTimeout(() => {
                        deleteConfirmMode = false;
                        delBtn.textContent = "🗑️";
                        delBtn.style.background = "transparent";
                        delBtn.style.color = "#ff6b6b";
                        delBtn.style.padding = "0";
                        delBtn.style.fontSize = "inherit";
                    }, 3000);
                    return;
                }
                
                clearTimeout(deleteTimeout);
                activeInv.data.nodes = activeInv.data.nodes.filter(n => n.id !== node.id);
                activeInv.modified = new Date().toISOString();
                investigations[activeInvIndex] = activeInv;
                await brw.storage.local.set({ 'osint_investigations': investigations });
                renderCardsList();
            });
            rightPart.appendChild(delBtn);

            header.appendChild(rightPart);
            cardItem.appendChild(header);

            // Expansion Details Panel
            const detailsPanel = document.createElement("div");
            detailsPanel.style.display = "none";
            detailsPanel.style.padding = "8px";
            detailsPanel.style.background = "#1a1225";
            detailsPanel.style.borderTop = "1px solid #3d2956";
            detailsPanel.style.fontSize = "11px";

            // Form Fields defined by Template
            const template = BUILT_IN_TEMPLATES[node.type] || BUILT_IN_TEMPLATES['other'];
            const inputsMap = {};

            template.fields.forEach(field => {
                const fDiv = document.createElement("div");
                fDiv.style.marginBottom = "6px";
                const lbl = document.createElement("div");
                lbl.textContent = field.label;
                lbl.style.color = "#aaa";
                lbl.style.marginBottom = "2px";
                fDiv.appendChild(lbl);

                let inp;
                if (field.type === 'textarea') {
                    inp = document.createElement("textarea");
                    inp.style.height = "40px";
                    inp.style.resize = "vertical";
                } else {
                    inp = document.createElement("input");
                    inp.type = field.type === 'date' ? 'date' : 'text';
                }
                inp.style.width = "100%";
                inp.style.boxSizing = "border-box";
                inp.style.background = "#2c1e3f";
                inp.style.color = "#fff";
                inp.style.border = "1px solid #555";
                inp.style.padding = "4px";
                inp.style.borderRadius = "3px";
                
                // Pre-fill
                if (node.customData && node.customData[field.id]) {
                    inp.value = node.customData[field.id];
                }
                
                inputsMap[field.id] = { input: inp, isTitle: field.isTitle };
                fDiv.appendChild(inp);
                detailsPanel.appendChild(fDiv);
            });

            // Sources List
            if (node.sources && node.sources.length > 0) {
                const srcDiv = document.createElement("div");
                srcDiv.style.marginTop = "8px";
                
                const srcHeaderRow = document.createElement("div");
                srcHeaderRow.style.display = "flex";
                srcHeaderRow.style.justifyContent = "space-between";
                srcHeaderRow.style.alignItems = "center";
                srcHeaderRow.style.marginBottom = "2px";
                const srcLbl = document.createElement("div");
                srcLbl.textContent = "Sources:";
                srcLbl.style.color = "#aaa";
                srcHeaderRow.appendChild(srcLbl);
                srcDiv.appendChild(srcHeaderRow);
                
                node.sources.forEach((s, idx) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.justifyContent = "space-between";
                    row.style.background = "#2c1e3f";
                    row.style.padding = "3px 6px";
                    row.style.borderRadius = "3px";
                    row.style.marginBottom = "2px";
                    
                    const la = document.createElement("a");
                    la.href = s.url;
                    la.target = "_blank";
                    la.textContent = s.title ? (s.title.length > 25 ? s.title.substring(0,25) + "..." : s.title) : "Link";
                    la.style.color = "#82ccdd";
                    la.style.textDecoration = "none";
                    row.appendChild(la);
                    
                    const rmx = document.createElement("span");
                    rmx.textContent = "×";
                    rmx.style.color = "#ff6b6b";
                    rmx.style.cursor = "pointer";
                    rmx.title = "Remove URL";
                    rmx.addEventListener("click", () => {
                        row.remove();
                        node.sources.splice(idx, 1);
                    });
                    row.appendChild(rmx);
                    srcDiv.appendChild(row);
                });
                detailsPanel.appendChild(srcDiv);
            }

            // Add URL Button Removed By Request

            // Save Button
            const saveBtn = document.createElement("button");
            saveBtn.textContent = "💾 Save Changes";
            saveBtn.style.width = "100%";
            saveBtn.style.background = "#27ae60";
            saveBtn.style.color = "#fff";
            saveBtn.style.border = "none";
            saveBtn.style.padding = "6px";
            saveBtn.style.borderRadius = "4px";
            saveBtn.style.marginTop = "8px";
            saveBtn.style.cursor = "pointer";
            
            const saveNodeChanges = async () => {
                if(!node.customData) node.customData = {};
                for (const [fId, obj] of Object.entries(inputsMap)) {
                    node.customData[fId] = obj.input.value;
                    if (obj.isTitle) {
                        node.title = obj.input.value;
                    }
                }
                
                const nodeIndex = activeInv.data.nodes.findIndex(n => n.id === node.id);
                if (nodeIndex !== -1) {
                    activeInv.data.nodes[nodeIndex] = node;
                }
                
                activeInv.modified = new Date().toISOString();
                investigations[activeInvIndex] = activeInv;
                await brw.storage.local.set({ 'osint_investigations': investigations });
                
                leftPart.textContent = `${icon} ${node.title || 'Untitled'}`;
                flashButton(saveBtn, "✅ Saved!", false);
            };

            saveBtn.addEventListener("click", saveNodeChanges);
            detailsPanel.appendChild(saveBtn);
            cardItem.appendChild(detailsPanel);

            // Toggle logic
            header.addEventListener("click", () => {
                const isOpen = detailsPanel.style.display === "block";
                detailsPanel.style.display = isOpen ? "none" : "block";
                expandIcon.textContent = isOpen ? "▼" : "▲";
            });

            cardsListContainer.appendChild(cardItem);
        });
    }

    invSelect.addEventListener("change", () => {
        if (invSelect.value) {
            brw.storage.local.set({ 'last_investigation_id': Number(invSelect.value) });
        }
        renderCardsList();
    });

    const closeNewInvUI = () => {
        selectionRow.style.display = "flex";
        newInvContainer.style.display = "none";
        newInvInput.value = "";
    };

    newInvCancelBtn.addEventListener("click", closeNewInvUI);

    newInvBtn.addEventListener("click", () => {
        selectionRow.style.display = "none";
        newInvContainer.style.display = "flex";
        newInvInput.focus();
    });

    newInvSaveBtn.addEventListener("click", async () => {
        const name = newInvInput.value.trim();
        if (!name) return closeNewInvUI();

        const newInvestigation = { 
            id: Date.now(), 
            name: name, 
            created: new Date().toISOString(), 
            modified: new Date().toISOString(), 
            data: { nodes: [], connections: [], shapes: [] } 
        };
        
        investigations.push(newInvestigation);
        await brw.storage.local.set({ 
            'osint_investigations': investigations,
            'last_investigation_id': newInvestigation.id
        });
        
        closeNewInvUI();
        await loadInvestigationsForDropdown();
    });

    captureBtn.addEventListener("click", async () => {
        const activeId = Number(invSelect.value);
        if (!activeId) {
            flashButton(captureBtn, "Select Investigation!", true);
            return;
        }
        if (!inputTitle.value.trim()) {
            flashButton(captureBtn, "Enter Title!", true);
            return;
        }

        const invIndex = investigations.findIndex(i => i.id === activeId);
        if (invIndex === -1) return;
        
        const activeInv = investigations[invIndex];
        
        let sources = []; // User requested to stop capturing URLs from this button

        const selType = typeSelect.value;
        const template = BUILT_IN_TEMPLATES[selType];
        const customData = {};
        
        if (template) {
            const titleField = template.fields.find(f => f.isTitle);
            const descFields = template.fields.filter(f => f.type === 'textarea' && !f.isTitle);
            
            if (titleField) customData[titleField.id] = inputTitle.value.trim();
            if (descFields.length > 0 && inputContent.value.trim()) {
                customData[descFields[0].id] = inputContent.value.trim();
            }
        }

        const randomX = Math.floor(Math.random() * 200) + 100;
        const randomY = Math.floor(Math.random() * 200) + 100;

        const newNode = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            x: randomX,
            y: randomY,
            width: 250,
            height: null,
            title: inputTitle.value.trim(),
            type: selType,
            customData: customData,
            color: '#3d2956',
            sources: sources
        };

        if (!activeInv.data.nodes) activeInv.data.nodes = [];
        activeInv.data.nodes.push(newNode);
        activeInv.modified = new Date().toISOString();

        investigations[invIndex] = activeInv;
        await brw.storage.local.set({ 'osint_investigations': investigations });

        inputTitle.value = "";
        inputContent.value = "";
        renderCardsList(); // Update the visual list
        flashButton(captureBtn, "✅ Added!", false);
    });
}