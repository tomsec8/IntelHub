// modules/dorks.js

const fields = [
  { label: "Site", prefix: "site" },
  { label: "Filetype", prefix: "filetype" },
  { label: "In URL", prefix: "inurl" },
  { label: "In Title", prefix: "intitle" },
  { label: "In Text", prefix: "intext" },
  { label: "Free Text", prefix: null }
];

const inputMap = {};

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

export function initializeDorks(container) {
    const dorkBtn = document.createElement("button");
    dorkBtn.className = "category-button";
    dorkBtn.textContent = "Google Dorks";

    const dorkWrapper = document.createElement("div");
    dorkWrapper.className = "tool-list";

    dorkBtn.addEventListener("click", () => {
        dorkWrapper.classList.toggle("open");
    });

    fields.forEach(field => {
        const label = document.createElement("label");
        label.textContent = field.label;
        label.style.display = "block";
        label.style.marginTop = "8px";
        label.style.fontSize = "13px";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = field.prefix ? `${field.prefix}:...` : "any keywords";
        input.style.width = "90%";
        input.style.padding = "6px 10px";
        input.style.marginBottom = "6px";
        input.style.borderRadius = "6px";
        input.style.border = "1px solid #555";
        input.style.backgroundColor = "#1f1530";
        input.style.color = "#fff";

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
        if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
    });

    const copyBtn = document.createElement("button");
    copyBtn.className = "sub-category-button";
    copyBtn.textContent = "Copy Dork";
    copyBtn.addEventListener("click", () => {
        const query = buildDorkQuery();
        resultDisplay.value = query;
        navigator.clipboard.writeText(query).then(() => alert("Copied to clipboard!"));
    });

    dorkWrapper.appendChild(searchBtn);
    dorkWrapper.appendChild(copyBtn);
    dorkWrapper.appendChild(resultDisplay);

    container.appendChild(dorkBtn);
    container.appendChild(dorkWrapper);
}