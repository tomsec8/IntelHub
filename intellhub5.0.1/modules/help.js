import { createSection } from './utils.js';

export function initializeHelpSection(container) {
    const { wrapper: helpWrapper } = createSection(container, "Help / Guide 🛈");

    const baseUrl = "https://github.com/tomsec8/IntelHub/blob/main/help/";

    const guides = [
        { lang: "English", flag: "🇺🇸", file: "guide_en.md" },
        { lang: "Hebrew (עברית)", flag: "🇮🇱", file: "guide_he.md" },
        { lang: "Spanish (Español)", flag: "🇪🇸", file: "guide_es.md" },
        { lang: "French (Français)", flag: "🇫🇷", file: "guide_fr.md" },
        { lang: "German (Deutsch)", flag: "🇩🇪", file: "guide_de.md" },
        { lang: "Portuguese (Brazil)", flag: "🇧🇷", file: "guide_pt_br.md" },
        { lang: "Polish (Polski)", flag: "🇵🇱", file: "guide_pl.md" }
    ];

    const contentDiv = document.createElement("div");
    contentDiv.style.padding = "15px";

    const titleDiv = document.createElement("div");
    titleDiv.style.marginBottom = "15px";
    titleDiv.style.color = "#aaa";
    titleDiv.style.fontSize = "13px";
    titleDiv.style.textAlign = "center";
    titleDiv.textContent = "Select a language to view the full documentation:";
    contentDiv.appendChild(titleDiv);

    guides.forEach(g => {
        const link = document.createElement("a");
        link.href = baseUrl + g.file;
        link.target = "_blank";
        
        Object.assign(link.style, {
            display: "flex",
            alignItems: "center",
            padding: "10px 15px",
            marginBottom: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#e8eaf6",
            textDecoration: "none",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            transition: "all 0.2s ease"
        });

        link.addEventListener("mouseover", () => {
            link.style.background = "rgba(255, 255, 255, 0.1)";
        });
        link.addEventListener("mouseout", () => {
            link.style.background = "rgba(255, 255, 255, 0.05)";
        });

        const flagSpan = document.createElement("span");
        flagSpan.style.fontSize = "20px";
        flagSpan.style.marginRight = "12px";
        flagSpan.textContent = g.flag;

        const langSpan = document.createElement("span");
        langSpan.style.fontWeight = "500";
        langSpan.style.fontSize = "14px";
        langSpan.textContent = g.lang;

        link.appendChild(flagSpan);
        link.appendChild(langSpan);
        contentDiv.appendChild(link);
    });

    const footerDiv = document.createElement("div");
    footerDiv.style.marginTop = "15px";
    footerDiv.style.textAlign = "center";
    footerDiv.style.fontSize = "12px";
    footerDiv.style.color = "#666";
    footerDiv.textContent = "Docs hosted on GitHub";
    contentDiv.appendChild(footerDiv);

    helpWrapper.appendChild(contentDiv);

}