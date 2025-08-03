// IntelHub - Load and Render Tools
// Fetches OSINT tools from GitHub, renders category buttons, and handles favorites


const GITHUB_TOOLS_URL = "https://raw.githubusercontent.com/tomsec8/IntelHub/main/tools.json";

let toolsData = {}; // Main tool data object
let resultArea;
let allToolsFlat = []; // Flattened tool list for search functionality


// Fetch the tools JSON file from GitHub and initialize UI
fetch(GITHUB_TOOLS_URL)
  .then((response) => response.json())
  .then((data) => {
    toolsData = data;
    flattenTools(data);
    renderMenu(); // Trigger UI rendering
  })
  .catch((error) => {
    document.getElementById("categoryButtons").innerHTML =
      "<p style='color:red;'> Failed to load tools from GitHub.</p>";
    console.error("Error loading tools:", error);
  });

// Converts nested tool data into a flat list for search filtering
function flattenTools(data) {
  allToolsFlat = [];
  for (const category in data) {
    data[category].forEach((tool) => {
      allToolsFlat.push({ ...tool, category });
    });
  }
}

// Renders the entire main menu including categories and favorites
function renderMenu() {
  const container = document.getElementById("categoryButtons");
  container.innerHTML = "";

  // ⭐ Favorites button
  const favBtn = document.createElement("button");
  favBtn.className = "category-button";
  favBtn.textContent = "Favorites";

  const favWrapper = document.createElement("div");
  favWrapper.className = "tool-list";

  favBtn.addEventListener("click", () => {
    favWrapper.classList.toggle("open");
  });

  // Load favorites from Chrome local storage
  chrome.storage.local.get("favorites", (data) => {
    const favorites = data.favorites || [];

    if (favorites.length === 0) {
      const msg = document.createElement("div");
      msg.textContent = "No favorites yet.";
      msg.style.textAlign = "center";
      msg.style.padding = "10px";
      favWrapper.appendChild(msg);
    } else {
      favorites.forEach((tool) => {
        const toolCard = document.createElement("div");
        toolCard.className = "tool-card";
        toolCard.title = tool.description;
        toolCard.style.position = "relative";

        const toolText = document.createElement("span");
        toolText.textContent = tool.name;
        toolText.style.display = "block";
        toolText.style.textAlign = "center";

        const starBtn = document.createElement("span");
        starBtn.innerHTML = "⭐";
        starBtn.style.position = "absolute";
        starBtn.style.top = "8px";
        starBtn.style.right = "10px";
        starBtn.style.cursor = "pointer";
        starBtn.style.fontSize = "16px";

        // Remove tool from favorites when star is clicked
        starBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const updated = favorites.filter((f) => !(f.name === tool.name && f.url === tool.url));
          chrome.storage.local.set({ favorites: updated }, () => {
            renderMenu(); // Refresh the list
          });
        });

        toolCard.addEventListener("click", () => {
          window.open(tool.url, "_blank");
        });

        toolCard.appendChild(toolText);
        toolCard.appendChild(starBtn);
        favWrapper.appendChild(toolCard);
      });
    }
  });

  container.appendChild(favBtn);
  container.appendChild(favWrapper);




// ========== OSINT TOOLS CATEGORY ==========
const osintBtn = document.createElement("button");
osintBtn.className = "category-button";
osintBtn.textContent = "OSINT TOOLS";

const osintWrapper = document.createElement("div");
osintWrapper.className = "tool-list";

// Toggle visibility of OSINT section
osintBtn.addEventListener("click", () => {
  osintWrapper.classList.toggle("open");
});

// Iterate through subcategories in the toolsData object
for (const subCategory in toolsData) {
  if (!toolsData[subCategory]?.length) continue;

  // Subcategory button (e.g., Social Media, Search Engines, etc.)
  const subButton = document.createElement("button");
  subButton.className = "sub-category-button";
  subButton.textContent = subCategory;

  const toolsWrapper = document.createElement("div");
  toolsWrapper.className = "tool-list";

  // Toggle visibility of tool list under subcategory
  subButton.addEventListener("click", () => {
    toolsWrapper.classList.toggle("open");
  });

  // Render tools inside the subcategory
  toolsData[subCategory].forEach((tool) => {
    const toolCard = document.createElement("div");
    toolCard.className = "tool-card";
    toolCard.title = tool.description;
    toolCard.style.position = "relative";

    const toolText = document.createElement("span");
    toolText.textContent = tool.name;
    toolText.style.display = "block";
    toolText.style.textAlign = "center";

    const starBtn = document.createElement("span");
    starBtn.innerHTML = "☆"; // Default icon - not favorited
    starBtn.style.position = "absolute";
    starBtn.style.top = "8px";
    starBtn.style.right = "10px";
    starBtn.style.cursor = "pointer";
    starBtn.style.fontSize = "16px";

    // Check if this tool is already in favorites
    chrome.storage.local.get("favorites", (data) => {
      const favorites = data.favorites || [];
      const isFav = favorites.some((f) => f.name === tool.name && f.url === tool.url);
      if (isFav) starBtn.innerHTML = "⭐"; // Highlight if already favorited
    });

    // Handle favorite toggle
    starBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.storage.local.get("favorites", (data) => {
        let favorites = data.favorites || [];
        const exists = favorites.find((f) => f.name === tool.name && f.url === tool.url);
        if (exists) {
          favorites = favorites.filter((f) => !(f.name === tool.name && f.url === tool.url));
          starBtn.innerHTML = "☆";
        } else {
          favorites.push(tool);
          starBtn.innerHTML = "⭐";
        }
        chrome.storage.local.set({ favorites });
      });
    });

    // Open the tool's URL in a new tab when clicked
    toolCard.addEventListener("click", () => {
      window.open(tool.url, "_blank");
    });

    toolCard.appendChild(toolText);
    toolCard.appendChild(starBtn);
    toolsWrapper.appendChild(toolCard);
  });

  osintWrapper.appendChild(subButton);
  osintWrapper.appendChild(toolsWrapper);
}

container.appendChild(osintBtn);
container.appendChild(osintWrapper);


// ========== METADATA ANALYZER CATEGORY ==========
const metaBtn = document.createElement("button");
metaBtn.className = "category-button";
metaBtn.textContent = "Metadata Analyzer";

const metaWrapper = document.createElement("div");
metaWrapper.className = "tool-list";

// Toggle visibility of metadata options
metaBtn.addEventListener("click", () => {
  metaWrapper.classList.toggle("open");
});

// --- Upload image file (for EXIF analysis) ---
const imgBtn = document.createElement("button");
imgBtn.className = "sub-category-button";
imgBtn.textContent = "Upload image file";
imgBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  input.addEventListener("change", handleLocalImageUpload);
  document.body.appendChild(input);
  input.click();
});

// --- Upload PDF file (for metadata extraction) ---
const pdfBtn = document.createElement("button");
pdfBtn.className = "sub-category-button";
pdfBtn.textContent = "Upload PDF file";
pdfBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf";
  input.style.display = "none";
  input.addEventListener("change", handlePdfMetadata);
  document.body.appendChild(input);
  input.click();
});

// --- Upload Office file (e.g. DOCX, XLSX, PPTX) ---
const officeBtn = document.createElement("button");
officeBtn.className = "sub-category-button";
officeBtn.textContent = "Upload Office file";
officeBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".docx,.xlsx,.pptx";
  input.style.display = "none";
  input.addEventListener("change", handleOfficeMetadata);
  document.body.appendChild(input);
  input.click();
});

// Append buttons to the metadata section
metaWrapper.appendChild(imgBtn);
metaWrapper.appendChild(pdfBtn);
metaWrapper.appendChild(officeBtn);

// Add metadata category to the UI
container.appendChild(metaBtn);
container.appendChild(metaWrapper);




// ========== SITE ANALYZER CATEGORY ==========

function getRootDomain(hostname) {
  try {
    const parsed = psl.parse(hostname);
    return parsed.domain || hostname;
  } catch {
    return hostname;
  }
}

const siteBtn = document.createElement("button");
siteBtn.className = "category-button";
siteBtn.textContent = "Site Analyzer";

const siteWrapper = document.createElement("div");
siteWrapper.className = "tool-list";

siteBtn.addEventListener("click", () => {
  siteWrapper.classList.toggle("open");
});

const fingerprintBtn = document.createElement("button");
fingerprintBtn.className = "sub-category-button";
fingerprintBtn.textContent = "Website Fingerprint";
fingerprintBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      return {
        "User-Agent": navigator.userAgent,
        "Platform": navigator.platform,
        "Cookies": document.cookie
      };
    }
  }, (results) => {
    const result = results?.[0]?.result;
    if (!result) {
      alert("Failed to retrieve fingerprint.");
      return;
    }

    const container = document.getElementById("categoryButtons");
    const existing = document.getElementById("fingerprintResult");
    if (existing) existing.remove();

    const box = document.createElement("div");
    box.id = "fingerprintResult";
    box.style.background = "#2c1e3f";
    box.style.color = "#ffcc99";
    box.style.padding = "12px";
    box.style.marginTop = "10px";
    box.style.borderRadius = "12px";
    box.style.fontSize = "13px";
    box.style.maxHeight = "300px";
    box.style.overflowY = "auto";

    const title = document.createElement("div");
    title.textContent = "Website Fingerprint";
    title.style.fontWeight = "bold";
    title.style.fontSize = "14px";
    title.style.marginBottom = "10px";
    title.style.textAlign = "center";
    box.appendChild(title);

    // === Copy Button ===
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy All";
    copyBtn.style.marginBottom = "10px";
    copyBtn.className = "sub-category-button";
    copyBtn.addEventListener("click", () => {
      const lines = [];
      for (const key in result) {
        lines.push(`${key}: ${result[key]}`);
      }
      navigator.clipboard.writeText(lines.join("\n")).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy All"), 1000);
      });
    });
    box.appendChild(copyBtn);

    // === Data Table ===
    const table = document.createElement("table");

    for (const key in result) {
      const row = document.createElement("tr");

      const cellKey = document.createElement("td");
      cellKey.textContent = key;
      cellKey.style.fontWeight = "bold";
      cellKey.style.padding = "6px";

      const cellVal = document.createElement("td");
      cellVal.textContent = result[key];
      cellVal.style.padding = "6px";
      cellVal.style.cursor = "pointer";
      cellVal.title = "Click to copy";
      cellVal.addEventListener("click", () => {
        navigator.clipboard.writeText(result[key]);
        cellVal.textContent = "Copied!";
        setTimeout(() => (cellVal.textContent = result[key]), 1000);
      });

      row.appendChild(cellKey);
      row.appendChild(cellVal);
      table.appendChild(row);
    }

    box.appendChild(table);
    container.appendChild(box);
  });
});

siteWrapper.appendChild(fingerprintBtn);

// === WHOIS & DNS Lookup ===
const whoisBtn = document.createElement("button");
whoisBtn.className = "sub-category-button";
whoisBtn.textContent = "WHOIS & DNS Lookup";
whoisBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const fullUrl = new URL(tab.url);
  const domain = getRootDomain(fullUrl.hostname);

  window.open(`https://www.whois.com/whois/${domain}`, "_blank");
  window.open(`https://dnschecker.org/all-dns-records-of-domain.php?query=${domain}&rtype=ALL&dns=google`, "_blank");
});
siteWrapper.appendChild(whoisBtn);

// === Technology Detection (W3Techs) ===
const techBtn = document.createElement("button");
techBtn.className = "sub-category-button";
techBtn.textContent = "Technology Detection";
techBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = getRootDomain(new URL(tab.url).hostname);
  window.open(`https://w3techs.com/sites/info/${domain}`, "_blank");
});
siteWrapper.appendChild(techBtn);

// === Subdomain Finder (just open the page) ===
const subdomainBtn = document.createElement("button");
subdomainBtn.className = "sub-category-button";
subdomainBtn.textContent = "Subdomain Finder";
subdomainBtn.addEventListener("click", () => {
  window.open("https://osint.sh/subdomain/", "_blank");
});
siteWrapper.appendChild(subdomainBtn);

// Append category
container.appendChild(siteBtn);
container.appendChild(siteWrapper);


// === Save Page Offline (SingleFile.js) ===
const savePageBtn = document.createElement("button");
savePageBtn.className = "sub-category-button";
savePageBtn.textContent = "Save Page Offline";

savePageBtn.addEventListener("click", async () => {
    showLoadingSpinner();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["libs/single-file.js"]
    });

    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
            const page = await singlefile.getPageData();
            return { htmlContent: page.content, title: document.title };
        }
    });

    const blob = new Blob([result.htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: `${result.title.replace(/[\\/:*?"<>|]/g, "_")}.html`,
        saveAs: true
    }, () => {
        hideLoadingSpinner();
    });
});

siteWrapper.appendChild(savePageBtn);

// === Spinner Functions ===
function showLoadingSpinner(message = "Saving page...") {
    let spinner = document.createElement("div");
    spinner.id = "loading-spinner";
    spinner.textContent = message;
    spinner.style.position = "fixed";
    spinner.style.top = "50%";
    spinner.style.left = "50%";
    spinner.style.transform = "translate(-50%, -50%)";
    spinner.style.background = "#111";
    spinner.style.color = "#fff";
    spinner.style.padding = "12px 20px";
    spinner.style.borderRadius = "8px";
    spinner.style.zIndex = "9999";
    spinner.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
    document.body.appendChild(spinner);
}

function hideLoadingSpinner() {
    const spinner = document.getElementById("loading-spinner");
    if (spinner) spinner.remove();
}




// ========== GOOGLE DORKS BUILDER ==========
const dorkBtn = document.createElement("button");
dorkBtn.className = "category-button";
dorkBtn.textContent = "Google Dorks";

const dorkWrapper = document.createElement("div");
dorkWrapper.className = "tool-list";

// Toggle visibility of Google Dorks section
dorkBtn.addEventListener("click", () => {
  dorkWrapper.classList.toggle("open");
});

// Define search fields for constructing the Dork
const fields = [
  { label: "Site", prefix: "site" },
  { label: "Filetype", prefix: "filetype" },
  { label: "In URL", prefix: "inurl" },
  { label: "In Title", prefix: "intitle" },
  { label: "In Text", prefix: "intext" },
  { label: "Free Text", prefix: null }
];

const inputMap = {}; // Will hold input elements per field

// Create input fields for each Dork component
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

// Output display for the generated Google Dork
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

// Button to launch Google search with the generated query
const searchBtn = document.createElement("button");
searchBtn.className = "sub-category-button";
searchBtn.textContent = "Search on Google";
searchBtn.addEventListener("click", () => {
  const query = buildDorkQuery();
  resultDisplay.value = query;
  if (query) window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
});

// Button to copy the generated dork to clipboard
const copyBtn = document.createElement("button");
copyBtn.className = "sub-category-button";
copyBtn.textContent = "Copy Dork";
copyBtn.addEventListener("click", () => {
  const query = buildDorkQuery();
  resultDisplay.value = query;
  navigator.clipboard.writeText(query).then(() => alert("Copied to clipboard!"));
});

// Append controls to the wrapper and menu
dorkWrapper.appendChild(searchBtn);
dorkWrapper.appendChild(copyBtn);
dorkWrapper.appendChild(resultDisplay);

container.appendChild(dorkBtn);
container.appendChild(dorkWrapper);

// === Social ID Extractor Category ===
const socialBtn = document.createElement("button");
socialBtn.className = "category-button";
socialBtn.textContent = "Social ID Extractor";

const socialWrapper = document.createElement("div");
socialWrapper.className = "tool-list";

socialBtn.addEventListener("click", () => {
  socialWrapper.classList.toggle("open");
});

container.appendChild(socialBtn);
container.appendChild(socialWrapper);

// === Universal Extract Social ID Button ===
const socialAutoBtn = document.createElement("button");
socialAutoBtn.className = "sub-category-button";
socialAutoBtn.textContent = "Extract Social ID";

socialAutoBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const raw = document.documentElement.innerHTML;
      const hostname = location.hostname;
      const path = location.pathname;
      let platform = "Unknown";
      let name = document.title;
      let userId = "";

      if (hostname.includes("facebook.com")) {
        platform = "Facebook";
        const nameMatch = raw.match(/"__isProfile":"User","name":"(.*?)"/);
        if (nameMatch) name = nameMatch[1];
        const idMatch =
          raw.match(/"selectedID":"(\d{6,})"/) ||
          raw.match(/"container_ID":"(\d{6,})"/) ||
          raw.match(/"entity_id":"(\d{6,})"/);
        if (idMatch) userId = idMatch[1];
      } else if (hostname.includes("instagram.com")) {
        platform = "Instagram";
        const idMatch = raw.match(/"profile_id":"(\d+)"/);
        if (idMatch) userId = idMatch[1];
      } else if (
        hostname.includes("t.me") ||
        hostname.includes("telegram.me") ||
        hostname.includes("web.telegram.org")
      ) {
        platform = "Telegram";
        const hash = location.hash;
        if (hash.startsWith("#@")) {
          userId = hash.replace("#@", "");
        } else if (hash.startsWith("#")) {
          const idMatch = hash.match(/^#(\d+)/);
          if (idMatch) userId = idMatch[1];
        }
      } else if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
        platform = "Twitter";
        const match = path.match(/^\/([^\/\?]+)/);
        if (match) userId = match[1];
      } else if (hostname.includes("tiktok.com")) {
        platform = "TikTok";
        const match = raw.match(/"uniqueId":"([^"]+)"/);
        if (match) userId = match[1];
        const idMatch = raw.match(/"user":\{"id":"(\d+)"/);
        if (idMatch) userId += ` (UID: ${idMatch[1]})`;
      } else if (hostname.includes("linkedin.com")) {
        platform = "LinkedIn";
        const match = path.match(/in\/([^\/\?]+)/);
        if (match) userId = match[1];
      }

      return { platform, name, userId };
    }
  });

  const box = document.createElement("div");
  box.style.background = "#1e1e1e";
  box.style.color = "#fff";
  box.style.padding = "10px";
  box.style.marginTop = "10px";
  box.style.borderRadius = "8px";
  box.style.fontSize = "14px";
  box.style.lineHeight = "1.6";

  box.innerHTML = `
    <div><b>Platform:</b> ${result.platform}</div>
    <div><b>Name:</b> ${result.name}</div>
    <div><b>ID:</b> <span id="extracted-id">${result.userId}</span></div>
    <button id="copy-social-id">Copy ID</button>
    <div style="font-size: 12px; margin-top: 6px; color: #aaa;">
      If the data was not updated, please refresh the page and try again.
    </div>
  `;

  socialWrapper.appendChild(box);

  setTimeout(() => {
    document.getElementById("copy-social-id").addEventListener("click", () => {
      const id = document.getElementById("extracted-id").textContent;
      navigator.clipboard.writeText(id);
      alert("ID copied to clipboard!");
    });
  }, 100);
});

socialWrapper.appendChild(socialAutoBtn);

// === Go to Profile by ID Button ===
const goToProfileBtn = document.createElement("button");
goToProfileBtn.className = "sub-category-button";
goToProfileBtn.textContent = "Go to Profile by ID";

goToProfileBtn.addEventListener("click", () => {
  const form = document.createElement("div");
  form.style.background = "#1e1e1e";
  form.style.color = "#fff";
  form.style.padding = "10px";
  form.style.marginTop = "10px";
  form.style.borderRadius = "8px";
  form.style.fontSize = "14px";

  form.innerHTML = `
    <label style="display:block; margin-bottom:6px;">Choose Platform:</label>
    <select id="platform-select" style="width:100%; margin-bottom:10px;">
      <option value="facebook">Facebook</option>
      <option value="instagram">Instagram</option>
      <option value="twitter">Twitter</option>
      <option value="tiktok">TikTok</option>
    </select>
    <label style="display:block; margin-bottom:6px;">Enter ID / Username:</label>
    <input id="profile-id-input" type="text" style="width:100%; margin-bottom:10px;" placeholder="Enter ID or username..." />
    <button id="open-profile-btn">Go</button>
  `;

  socialWrapper.appendChild(form);

  setTimeout(() => {
    document.getElementById("open-profile-btn").addEventListener("click", () => {
      const platform = document.getElementById("platform-select").value;
      const input = document.getElementById("profile-id-input").value.trim();
      if (!input) return alert("Please enter a valid ID or username.");

      let url = "";
      switch (platform) {
        case "facebook":
          url = `https://facebook.com/${input}`;
          break;
        case "instagram":
          url = `https://instagram.com/${input}`;
          break;
        case "twitter":
          url = `https://x.com/${input}`;
          break;
        case "tiktok":
          url = `https://www.tiktok.com/@${input}`;
          break;
      }

      window.open(url, "_blank");
    });
  }, 100);
});

socialWrapper.appendChild(goToProfileBtn);


// === Link Analyzer Category ===
const linkBtn = document.createElement("button");
linkBtn.className = "category-button";
linkBtn.textContent = "Link Analyzer";

const linkWrapper = document.createElement("div");
linkWrapper.className = "tool-list";

linkBtn.addEventListener("click", () => {
  linkWrapper.classList.toggle("open");
});

container.appendChild(linkBtn);
container.appendChild(linkWrapper);

// === Unshorten URL Button ===
const shortenerBtn = document.createElement("button");
shortenerBtn.className = "sub-category-button";
shortenerBtn.textContent = "Unshorten URL";

shortenerBtn.addEventListener("click", () => {
  const form = document.createElement("div");
  form.style.background = "#1e1e1e";
  form.style.color = "#fff";
  form.style.padding = "10px";
  form.style.marginTop = "10px";
  form.style.borderRadius = "8px";
  form.style.fontSize = "14px";

  form.innerHTML = `
    <label style="display:block; margin-bottom:6px;">Enter shortened URL:</label>
    <input id="short-url-input" type="text" style="width:100%; margin-bottom:10px;" placeholder="e.g. https://bit.ly/..." />
    <button id="unshorten-now-btn">Unshorten</button>
    <div id="unshorten-result" style="margin-top:10px;"></div>
  `;

  const old = document.getElementById("unshorten-form");
  if (old) old.remove();
  form.id = "unshorten-form";
  linkWrapper.appendChild(form);

  setTimeout(() => {
    document.getElementById("unshorten-now-btn").addEventListener("click", async () => {
      const url = document.getElementById("short-url-input").value.trim();
      const resultDiv = document.getElementById("unshorten-result");

      if (!url.startsWith("http")) {
        resultDiv.innerHTML = `<span style="color:red;">Please enter a valid URL.</span>`;
        return;
      }

      resultDiv.innerHTML = "🔍 Checking...";

      try {
        const res = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`);
        const data = await res.json();

        if (data.success) {
          resultDiv.innerHTML = `
            <b>Original URL:</b> <a href="${data.resolved_url}" target="_blank" style="color:lightblue;">${data.resolved_url}</a><br>
            <span style="font-size:12px; color:#aaa;">Remaining API calls: ${data.remaining_calls}</span>
          `;
        } else {
          resultDiv.innerHTML = `<span style="color:red;">Unshortening failed. Try again later.</span>`;
        }
      } catch (err) {
        resultDiv.innerHTML = `<span style="color:red;">Error: ${err.message}</span>`;
      }
    });
  }, 100);
});

linkWrapper.appendChild(shortenerBtn);

// === Scan URL via VirusTotal Button ===
const scanBtn = document.createElement("button");
scanBtn.className = "sub-category-button";
scanBtn.textContent = "Scan for Viruses";

scanBtn.addEventListener("click", () => {
  const form = document.createElement("div");
  form.style.background = "#1e1e1e";
  form.style.color = "#fff";
  form.style.padding = "10px";
  form.style.marginTop = "10px";
  form.style.borderRadius = "8px";
  form.style.fontSize = "14px";

  form.innerHTML = `
    <label style="display:block; margin-bottom:6px;">Enter URL to scan:</label>
    <input id="scan-url-input" type="text" style="width:100%; margin-bottom:10px;" placeholder="e.g. https://example.com" />
    <button id="scan-now-btn">Scan</button>
    <div id="scan-result" style="margin-top:10px;"></div>
  `;

  const old = document.getElementById("scan-form");
  if (old) old.remove();
  form.id = "scan-form";
  linkWrapper.appendChild(form);

  setTimeout(() => {
    document.getElementById("scan-now-btn").addEventListener("click", () => {
      let url = document.getElementById("scan-url-input").value.trim();
      const resultDiv = document.getElementById("scan-result");

      if (!url.startsWith("http")) {
        resultDiv.innerHTML = `<span style="color:red;">Please enter a valid URL (starting with http/https).</span>`;
        return;
      }

      // Remove only the protocol (http:// or https://)
      url = url.replace(/^https?:\/\//, "");

      const scanUrl = `https://www.virustotal.com/gui/domain/${encodeURIComponent(url)}`;

      resultDiv.innerHTML = `
        <b>VirusTotal Scan:</b> <a href="${scanUrl}" target="_blank" style="color:lightblue;">Open ${url} on VirusTotal</a>
      `;
    });
  }, 100);
});

linkWrapper.appendChild(scanBtn);






// ========== TEXT PROFILER ==========
const profilerBtn = document.createElement("button");
profilerBtn.className = "category-button";
profilerBtn.textContent = "Text Profiler";

const profilerWrapper = document.createElement("div");
profilerWrapper.className = "tool-list";

profilerBtn.addEventListener("click", () => {
  profilerWrapper.classList.toggle("open");
});

// === Paste Text button ===
const pasteBtn = document.createElement("button");
pasteBtn.className = "sub-category-button";
pasteBtn.textContent = "Paste Text";
// Clicking prompts user for text and then analyzes it
pasteBtn.addEventListener("click", () => {
  const userInput = prompt("Paste the text to analyze:");
  if (userInput) renderProfilerResults(userInput);
});

// === Upload file button ===
const uploadBtn = document.createElement("button");
uploadBtn.className = "sub-category-button";
uploadBtn.textContent = "Upload TXT / JSON";
// Clicking lets user select a .txt or .json file, then analyzes its content
uploadBtn.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt,.json";
  input.style.display = "none";
  input.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    renderProfilerResults(text);
  });
  document.body.appendChild(input);
  input.click();
});

profilerWrapper.appendChild(pasteBtn);
profilerWrapper.appendChild(uploadBtn);

// Result display area (will show extracted entities or messages)
resultArea = document.createElement("div");
profilerWrapper.appendChild(resultArea);

// Export button (allows downloading results as CSV)
const exportBtn = document.createElement("button");
exportBtn.className = "sub-category-button";
exportBtn.textContent = "Export as CSV";
// Clicking exports current results to CSV
exportBtn.addEventListener("click", () => {
  const csvRows = [["Type", "Value"]];
  profilerLastResults.forEach(row => csvRows.push([row.type, row.value]));
  const csvContent = csvRows.map(e => e.join(",")).join("\n");

  const filename = prompt("Choose a filename:", "extracted_entities.csv");
  if (!filename) return;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
});
profilerWrapper.appendChild(exportBtn);

document.getElementById("categoryButtons").appendChild(profilerBtn);
document.getElementById("categoryButtons").appendChild(profilerWrapper);


const analyzePageBtn = document.createElement("button");
analyzePageBtn.className = "sub-category-button";
analyzePageBtn.textContent = "Analyze Page";
analyzePageBtn.addEventListener("click", async () => {
  chrome.scripting.executeScript(
    {
      target: { tabId: (await getCurrentTabId()) },
      files: ["content.js"]
    },
    async () => {
      chrome.tabs.sendMessage((await getCurrentTabId()), { action: "extractPageText" }, (response) => {
        if (response && response.text) {
          renderProfilerResults(response.text);
        } else {
          alert("Failed to extract text from page.");
        }
      });
    }
  );
});

profilerWrapper.appendChild(analyzePageBtn);

// helper to get current tab id
async function getCurrentTabId() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0].id);
    });
  });
}


// Function to build the Google Dork query
function buildDorkQuery() {
  const parts = [];

  for (const key in inputMap) {
    const value = inputMap[key].value.trim();
    if (!value) continue;

    if (key === "__free") {
      parts.push(value);
    } else if (key === "intext") {
      // Custom behavior for intext field
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
      // Standard fields like site, filetype, intitle, etc.
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

}

// Function to handle PDF metadata extraction
function handlePdfMetadata(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const arrayBuffer = e.target.result;
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const metadata = pdfDoc.getTitle() || {}; // Extract main title or default to empty object
      const info = pdfDoc.context.lookup(pdfDoc.catalog.get(PDFLib.PDFName.of('Info')));

      const output = document.createElement("div");
      const fileNameHeader = document.createElement("div");
      fileNameHeader.textContent = `📄 PDF File: ${file.name}`;
      fileNameHeader.style.fontWeight = "bold";
      fileNameHeader.style.marginBottom = "10px";
      fileNameHeader.style.fontSize = "14px";
      fileNameHeader.style.textAlign = "center";
      output.appendChild(fileNameHeader);

      output.style.padding = "10px";
      output.style.background = "#2c1e3f";
      output.style.color = "#ffcc99";
      output.style.borderRadius = "12px";
      output.style.fontSize = "13px";
      output.style.maxHeight = "300px";
      output.style.overflowY = "auto";
      output.style.marginTop = "10px";

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      // Table fields with their extracted values
      const fields = [
        ["Title", pdfDoc.getTitle()],
        ["Author", pdfDoc.getAuthor()],
        ["Subject", pdfDoc.getSubject()],
        ["Keywords", pdfDoc.getKeywords()],
        ["Creator", pdfDoc.getCreator()],
        ["Producer", pdfDoc.getProducer()],
        ["Creation Date", pdfDoc.getCreationDate()],
        ["Modification Date", pdfDoc.getModificationDate()],
      ];

      for (const [key, val] of fields) {
        if (!val) continue;

        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.fontWeight = "bold";
        keyCell.style.padding = "6px";
        keyCell.style.borderBottom = "1px solid #444";

        const valueCell = document.createElement("td");
        valueCell.textContent = val.toString();
        valueCell.style.padding = "6px";
        valueCell.style.borderBottom = "1px solid #444";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        table.appendChild(row);
      }

      output.appendChild(table);
      const container = document.getElementById("categoryButtons");
      container.appendChild(output);

    } catch (err) {
      console.error("Failed to parse PDF metadata:", err);
      alert("Could not read PDF metadata.");
    }
  };

  reader.readAsArrayBuffer(file);
}


// Function to handle Office file metadata extraction
function handleOfficeMetadata(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const zip = await JSZip.loadAsync(e.target.result);

      const metadataFiles = [
        "docProps/core.xml", // Core metadata
        "docProps/app.xml"   // Additional metadata
      ];

      const metadata = {};

      for (const path of metadataFiles) {
        if (zip.files[path]) {
          const content = await zip.files[path].async("string");
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, "text/xml");

          const children = xmlDoc.documentElement.childNodes;
          for (const node of children) {
            if (node.nodeType === 1) {
              metadata[node.nodeName] = node.textContent;
            }
          }
        }
      }

      const output = document.createElement("div");
      const fileNameHeader = document.createElement("div");
      fileNameHeader.textContent = `Office File: ${file.name}`;
      fileNameHeader.style.fontWeight = "bold";
      fileNameHeader.style.marginBottom = "10px";
      fileNameHeader.style.fontSize = "14px";
      fileNameHeader.style.textAlign = "center";
      output.appendChild(fileNameHeader);

      output.style.padding = "10px";
      output.style.background = "#2c1e3f";
      output.style.color = "#ffcc99";
      output.style.borderRadius = "12px";
      output.style.fontSize = "13px";
      output.style.maxHeight = "300px";
      output.style.overflowY = "auto";
      output.style.marginTop = "10px";

      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      for (const key in metadata) {
        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = key;
        keyCell.style.fontWeight = "bold";
        keyCell.style.padding = "6px";
        keyCell.style.borderBottom = "1px solid #444";

        const valueCell = document.createElement("td");
        valueCell.textContent = metadata[key];
        valueCell.style.padding = "6px";
        valueCell.style.borderBottom = "1px solid #444";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        table.appendChild(row);
      }

      output.appendChild(table);
      const container = document.getElementById("categoryButtons");
      container.appendChild(output);

    } catch (err) {
      console.error("Failed to parse Office metadata:", err);
      alert("Could not read Office file metadata.");
    }
  };

  reader.readAsArrayBuffer(file);
}


// Function to handle image upload and extract EXIF metadata
function handleLocalImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const tags = ExifReader.load(e.target.result);
      console.log("📷 EXIF Tags:", tags);

      const output = document.createElement("div");
      const fileNameHeader = document.createElement("div");
      fileNameHeader.textContent = `File: ${file.name}`;
      fileNameHeader.style.fontWeight = "bold";
      fileNameHeader.style.marginBottom = "10px";
      fileNameHeader.style.fontSize = "14px";
      fileNameHeader.style.textAlign = "center";
      output.appendChild(fileNameHeader);

      output.style.padding = "10px";
      output.style.background = "#2c1e3f";
      output.style.color = "#ffcc99";
      output.style.borderRadius = "12px";
      output.style.fontSize = "13px";
      output.style.maxHeight = "300px";
      output.style.overflowY = "auto";
      output.style.marginTop = "10px";

      // Create table to display metadata
      const table = document.createElement("table");
      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      for (const tag in tags) {
        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = tag;
        keyCell.style.fontWeight = "bold";
        keyCell.style.padding = "6px";
        keyCell.style.borderBottom = "1px solid #444";

        const valueCell = document.createElement("td");
        valueCell.textContent = tags[tag]?.description ?? "[no value]";
        valueCell.style.padding = "6px";
        valueCell.style.borderBottom = "1px solid #444";

        row.appendChild(keyCell);
        row.appendChild(valueCell);
        table.appendChild(row);
      }

      output.appendChild(table);
      const container = document.getElementById("categoryButtons");
      container.appendChild(output);

    } catch (err) {
      console.error("Failed to read EXIF:", err);
      alert("This image does not contain readable EXIF data.");
    }
  };

  reader.readAsArrayBuffer(file);
}

// Live search functionality: filters tools by input


document.getElementById("searchBox").addEventListener("input", function (e) {
  const query = e.target.value.toLowerCase();
  const container = document.getElementById("categoryButtons");

  if (!query || query.length < 2) {
    renderMenu();
    return;
  }

  const results = allToolsFlat.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
  );

  container.innerHTML = "";

  const title = document.createElement("h3");
  title.textContent = `Search results (${results.length})`;
  title.style.textAlign = "center";
  container.appendChild(title);

  results.forEach((tool) => {
    const toolCard = document.createElement("div");
    toolCard.className = "tool-card";
    toolCard.textContent = tool.name;
    toolCard.title = tool.description;
    toolCard.addEventListener("click", () =>
      window.open(tool.url, "_blank")
    );
    container.appendChild(toolCard);
  });
});


// === extractEntities with NLP integration ===
// Requires compromise.js and franc-min to be loaded in popup.html or content.js

function extractEntities(text) {
  const results = [];
  const found = new Set();

  const patterns = {
    "Facebook Profile": /facebook\.com\/(?:profile\.php\?id=)?([a-zA-Z0-9.]+)/g,
    "Instagram Profile": /instagram\.com\/([a-zA-Z0-9._]+)/g,
    "Twitter Profile": /twitter\.com\/([a-zA-Z0-9_]+)/g,
    "LinkedIn Profile": /linkedin\.com\/in\/([a-zA-Z0-9-]+)/g,
    "Email": /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "Phone": /\+?\d{1,3}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/g,
    "BTC Wallet": /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/g,
    "ETH Wallet": /\b0x[a-fA-F0-9]{40}\b/g,
    "Username": /(?<!\w)@[\w\d._]{3,}/g,
    "Domain": /\b(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|gov|edu|co|il|me|info|biz)\b/gi,
    "Flag Emoji": /[\uD83C][\uDDE6-\uDDFF]{2}/g,
  };

  for (const label in patterns) {
    const regexList = Array.isArray(patterns[label]) ? patterns[label] : [patterns[label]];
    regexList.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach(match => {
        let val = match[1] || match[0];
        val = val.trim().replace(/[.,;:]$/, '');
        if (label.includes("Phone")) {
          const digits = val.replace(/\D/g, '');
          if (digits.length < 7 || digits.length > 12) return;
          if (/^\d{9}$/.test(digits)) return;
          if (/\d{4} \d{4} \d{4}/.test(val)) return;
          if (/^9{7,}$/.test(digits)) return;
          if (found.has("Credit Card::" + val)) return;
        }
        if (label === "Domain") {
          const bannedDomains = ["gmail.com", "facebook.com", "instagram.com", "twitter.com", "linkedin.com"];
          if (bannedDomains.includes(val)) return;
          if (/@[\w.-]+\.[a-z]{2,}/i.test(text) && text.includes("@" + val)) return;
        }
        if (label === "Birthdate") {
          const parts = val.split(/[./-]/).map(Number);
          if (parts.length !== 3 || parts.some(isNaN)) return;
          const [day, month, year] = parts;
          if (day > 31 || month > 12 || year < 1900 || year > 2100) return;
        }
        if (label === "Email (labeled)" && found.has("Email::" + val)) return;
        if (label === "Username" && val.includes(".")) return;
        const key = label + "::" + val;
        if (!found.has(key)) {
          results.push({ type: label, value: val });
          found.add(key);
        }
      });
    });
  }

  // === NLP via compromise.js ===
  if (typeof nlp !== 'undefined') {
    const doc = nlp(text);
    const people = doc.people().out('array');
    const places = doc.places().out('array');

    people.forEach(name => {
      const key = "Person::" + name;
      if (!found.has(key)) {
        results.push({ type: "Person", value: name });
        found.add(key);
      }
    });

    places.forEach(place => {
      const key = "Place::" + place;
      if (!found.has(key)) {
        results.push({ type: "Place", value: place });
        found.add(key);
      }
    });
  }

  return results;
}


let profilerLastResults = [];

function renderProfilerResults(text) {
  const results = extractEntities(text);
  if (results.length === 0) {
    resultArea.innerHTML = "<p style='text-align:center; color: #ffcc99;'>❌ No identifiable entities found.</p>";
    return;
  }

  profilerLastResults = results;

  resultArea.innerHTML = "";

  const types = [...new Set(results.map(r => r.type))].sort();
  const filterDiv = document.createElement("div");
  filterDiv.style.margin = "10px auto";
  filterDiv.style.textAlign = "center";

  const searchInput = document.createElement("input");
  searchInput.placeholder = "Search...";
  searchInput.style.marginBottom = "8px";
  searchInput.style.padding = "6px";
  searchInput.style.width = "90%";
  searchInput.style.borderRadius = "8px";
  searchInput.style.border = "1px solid #888";
  searchInput.style.background = "#1f1530";
  searchInput.style.color = "#fff";
  filterDiv.appendChild(searchInput);

  const checkboxes = {};
  types.forEach(type => {
    const label = document.createElement("label");
    label.style.marginRight = "10px";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.dataset.type = type;
    checkboxes[type] = box;
    label.appendChild(box);
    label.appendChild(document.createTextNode(" " + type));
    filterDiv.appendChild(label);
  });

  resultArea.appendChild(filterDiv);

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.color = "#ffcc99";
  table.style.cursor = "pointer";

  const scrollBox = document.createElement("div");
  scrollBox.className = "profiler-results-container";
  scrollBox.appendChild(table);
  resultArea.appendChild(scrollBox);

  function renderTable() {
    table.innerHTML = "";
    const query = searchInput.value.toLowerCase();
    results.forEach(({ type, value }) => {
      if (!checkboxes[type].checked) return;
      if (!type.toLowerCase().includes(query) && !value.toLowerCase().includes(query)) return;

      const row = document.createElement("tr");

      const td1 = document.createElement("td");
      td1.textContent = type;
      td1.style.fontWeight = "bold";
      td1.style.padding = "6px";
      td1.title = "Click to copy";
      td1.addEventListener("click", () => {
        navigator.clipboard.writeText(type);
        td1.textContent = "✅ " + type;
        setTimeout(() => (td1.textContent = type), 1000);
      });

      const td2 = document.createElement("td");
      td2.textContent = value;
      td2.style.padding = "6px";
      td2.title = "Click to copy";
      td2.addEventListener("click", () => {
        navigator.clipboard.writeText(value);
        td2.textContent = "✅ " + value;
        setTimeout(() => (td2.textContent = value), 1000);
      });

      row.appendChild(td1);
      row.appendChild(td2);
      table.appendChild(row);
    });
  }

  renderTable();
  searchInput.addEventListener("input", renderTable);
  Object.values(checkboxes).forEach(c => c.addEventListener("change", renderTable));
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.htmlContent) {
    const blob = new Blob([message.htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `${message.title.replace(/[\\/:*?"<>|]/g, "_")}.html`,
      saveAs: true
    });
  }
});






