// modules/help.js

export function initializeHelpSection(container) {
    const helpBtn = document.createElement("button");
    helpBtn.className = "category-button";
    helpBtn.textContent = "Help / Guide 🛈 ";

    const helpWrapper = document.createElement("div");
    helpWrapper.className = "tool-list";

    helpBtn.addEventListener("click", () => {
        helpWrapper.classList.toggle("open");
    });

    helpWrapper.innerHTML = `
        <div style="padding:10px; font-size:14px; line-height:1.6; color:#ffcc99; text-align: left;">
          <b>Favorites:</b> Quickly access tools you've marked with ⭐.<br><br>
          <b>OSINT Tools:</b> Browse categorized open-source intelligence tools.<br><br>
          <b>Reverse Image Search:</b> Upload or paste an image to search it across selected engines.<br><br>
          <b>Archive Search:</b> Search for historical versions of web pages.<br><br>
          <b>Metadata Analyzer:</b> Upload files to extract metadata (EXIF, PDF info, etc.).<br><br>
          <b>Site Analyzer:</b> Analyze the current site for tech, WHOIS, and more.<br><br>
          <b>Social ID Extractor:</b> Extract user IDs from social media pages.<br><br>
          <b>Link Analyzer:</b> Unshorten URLs and check them for viruses.<br><br>
          <b>Text Profiler:</b> Extract emails, wallets, and more from text.<br><br>
          <b>Crypto Wallet Analyzer:</b> Analyze Bitcoin and Ethereum wallets for transactions, balance, and risk factors.<br><br>
          <b>Telegram Tools:</b> Look up phone numbers on Telegram or use the advanced analyzer for chat data exports.<br><br>
          <b>Google Dorks:</b> Build advanced Google search queries.
        </div>
    `;

    container.appendChild(helpBtn);
    container.appendChild(helpWrapper);
}