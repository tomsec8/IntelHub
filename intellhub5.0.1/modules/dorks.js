import { flashButton, brw, createSection, saveViewState, resetViewState } from './utils.js';

const fields = [
    { label: "Site", prefix: "site" },
    { label: "Filetype", prefix: "filetype" },
    { label: "In URL", prefix: "inurl" },
    { label: "In Title", prefix: "intitle" },
    { label: "In Text", prefix: "intext" },
    { label: "After Date", prefix: "after", type: "date" },
    { label: "Before Date", prefix: "before", type: "date" },
    { label: "Free Text", prefix: null }
];

const inputMap = {};

function saveDorksState() {
    const inputValues = {};
    for (const key in inputMap) {
        if (inputMap[key]) {
            inputValues[key] = inputMap[key].value;
        }
    }
    saveViewState('dorks', { inputValues });
}

function buildDorkQuery() {
    const parts = [];
    for (const key in inputMap) {
        const value = inputMap[key].value.trim();
        if (!value) continue;

        if (key === "__free") {
            parts.push(value);
        } else if (key === "intext") {
            if (value.includes(" AND ")) {
                const andParts = value.split(" AND ").map(v => v.trim());
                const joined = andParts.map(v => `intext:"${v}"`).join(" AND ");
                parts.push(joined);
            } else if (value.includes(",")) {
                const orParts = value.split(",").map(v => v.trim());
                const joined = orParts.map(v => `intext:"${v}"`).join(" OR ");
                parts.push(`(${joined})`);
            } else {
                parts.push(`intext:"${value}"`);
            }
        } else {
            const isCommaSeparated = value.includes(",");
            const items = isCommaSeparated
                ? value.split(",").map(v => v.trim())
                : value.split(" ").map(v => v.trim());

            if (items.length === 1) {
                parts.push(`${key}:${items[0]}`);
            } else if (items.length > 1) {
                const joined = items.map(v => `${key}:${v}`).join(isCommaSeparated ? " OR " : " ");
                parts.push(isCommaSeparated ? `(${joined})` : joined);
            }
        }
    }
    return parts.join(" ");
}

export function restoreDorksView(container, state) {
    const dorkBtn = Array.from(container.querySelectorAll('.category-button')).find(btn => btn.textContent === "Google Dorks");
    if (dorkBtn) {
        const dorkWrapper = dorkBtn.nextElementSibling;
        if (dorkWrapper) {
            dorkWrapper.classList.add("open");
        }
    }

    if (state.inputValues) {
        for (const key in state.inputValues) {
            if (inputMap[key]) {
                inputMap[key].value = state.inputValues[key];
            }
        }
    }
}

export function initializeDorks(container) {
    const { wrapper: dorkWrapper } = createSection(container, "Google Dorks", {
        onToggle: (isOpen) => {
            if (isOpen) saveDorksState();
            else resetViewState();
        }
    });

    fields.forEach(field => {
        const label = document.createElement("label");
        label.textContent = field.label;
        label.style.display = "block";
        label.style.marginTop = "8px";
        label.style.fontSize = "13px";

        const input = document.createElement("input");
        input.type = field.type || "text";
        input.placeholder = field.prefix ? `${field.prefix}:...` : "any keywords";
        input.style.width = "90%";
        input.style.padding = "6px 10px";
        input.style.marginBottom = "6px";
        input.style.borderRadius = "6px";
        input.style.border = "1px solid #555";
        input.style.backgroundColor = "#1f1530";
        input.style.color = "#fff";

        input.addEventListener('input', saveDorksState);

        dorkWrapper.appendChild(label);
        dorkWrapper.appendChild(input);

        inputMap[field.prefix ?? "__free"] = input;
    });

    const resultDisplay = document.createElement("textarea");
    resultDisplay.style.width = "90%";
    resultDisplay.style.marginTop = "10px";
    resultDisplay.style.height = "60px";
    resultDisplay.readOnly = true;
    resultDisplay.style.backgroundColor = "#2c1e3f";
    resultDisplay.style.color = "#ffcc99";
    resultDisplay.style.border = "none";
    resultDisplay.style.borderRadius = "6px";
    resultDisplay.style.padding = "6px";

    const searchBtn = document.createElement("button");
    searchBtn.className = "sub-category-button";
    searchBtn.textContent = "Search on Google";
    searchBtn.addEventListener("click", () => {
        const query = buildDorkQuery();
        resultDisplay.value = query;
        if (query) {
            brw.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, active: false });
        }
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "sub-category-button";
    copyBtn.textContent = "Copy Dork";
    copyBtn.addEventListener("click", () => {
        const query = buildDorkQuery();
        resultDisplay.value = query;
        navigator.clipboard.writeText(query).then(() => {
            flashButton(copyBtn, "Copied!");
        });
    });

    dorkWrapper.appendChild(searchBtn);
    dorkWrapper.appendChild(copyBtn);
    dorkWrapper.appendChild(resultDisplay);


}