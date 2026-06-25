import { brw, isFirefox, createSection, saveViewState, resetViewState } from './utils.js';

let lastQuery = '';

export function restoreGoogleAiChatView(container, state) {
    if (state.isOpen) {
        const btn = Array.from(container.querySelectorAll('.category-button')).find(b => b.textContent.includes("Google AI Search"));
        if (btn) btn.nextElementSibling?.classList.add("open");
    }

    if (state.query) {
        lastQuery = state.query;
        const input = container.querySelector('.ai-input');
        if (input) input.value = state.query;
        
        if (!isFirefox()) {
            const iframe = container.querySelector('#google-ai-iframe');
            if (iframe && state.query) {
                iframe.src = `https://www.google.com/search?q=${encodeURIComponent(state.query)}&udm=50`;
            }
        }
    }
}

export function initializeGoogleAiChat(container) {
    const { wrapper } = createSection(container, "Google AI Search 🤖", {
        onToggle: () => saveState()
    });

    const firefox = isFirefox();

    const saveState = () => {
        const isOpen = wrapper.classList.contains("open");
        const queryVal = input.value;
        if (!isOpen && !queryVal) {
            resetViewState();
            return;
        }
        saveViewState('googleAiChat', {
            isOpen: isOpen,
            query: queryVal
        });
    };

    const mainContainer = document.createElement("div");
    mainContainer.style.display = "flex";
    mainContainer.style.flexDirection = "column";
    mainContainer.style.gap = "10px";
    mainContainer.style.padding = "4px";

    const inputGroup = document.createElement("div");
    inputGroup.style.display = "flex";
    inputGroup.style.gap = "8px";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "ai-input";
    input.placeholder = "Ask Google AI anything...";
    input.style.flex = "1";
    input.style.padding = "10px";
    input.style.borderRadius = "8px";
    input.style.border = "1px solid #555";
    input.style.backgroundColor = "#1a1a2e";
    input.style.color = "#fff";
    input.addEventListener('input', saveState);

    const searchBtn = document.createElement("button");
    searchBtn.textContent = firefox ? "Open AI ↗" : "Search";
    searchBtn.className = "tool-button";
    searchBtn.style.margin = "0";
    searchBtn.style.padding = "0 16px";
    searchBtn.style.background = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
    searchBtn.style.color = "#fff";
    searchBtn.style.border = "none";
    searchBtn.style.borderRadius = "8px";
    searchBtn.style.cursor = "pointer";
    searchBtn.style.fontWeight = "bold";

    inputGroup.appendChild(input);
    inputGroup.appendChild(searchBtn);
    mainContainer.appendChild(inputGroup);

    if (firefox) {
        // Firefox: show explanation + open in new tab
        const note = document.createElement("div");
        note.style.fontSize = "11px";
        note.style.color = "#94a3b8";
        note.style.padding = "6px 0";
        note.textContent = "🦊 Firefox: Google AI will open in a new tab.";
        mainContainer.appendChild(note);
    } else {
        // Chrome: show iframe
        const iframeWrapper = document.createElement("div");
        iframeWrapper.style.flex = "1";
        iframeWrapper.style.display = "flex";
        iframeWrapper.style.flexDirection = "column";
        iframeWrapper.style.marginTop = "10px";
        iframeWrapper.style.border = "1px solid #333";
        iframeWrapper.style.borderRadius = "8px";
        iframeWrapper.style.overflow = "hidden";
        iframeWrapper.style.height = "70vh";
        iframeWrapper.style.minHeight = "400px";

        const iframe = document.createElement("iframe");
        iframe.id = "google-ai-iframe";
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.src = "about:blank";

        iframeWrapper.appendChild(iframe);
        mainContainer.appendChild(iframeWrapper);
    }

    wrapper.appendChild(mainContainer);

    searchBtn.addEventListener('click', () => {
        const query = input.value.trim();
        if (!query) return;
        lastQuery = query;
        saveState();

        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=50`;

        if (firefox) {
            brw.tabs.create({ url: url, active: true });
        } else {
            const iframe = document.getElementById('google-ai-iframe');
            if (iframe) iframe.src = url;
        }
    });

    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            searchBtn.click();
        }
    });
}
