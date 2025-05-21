// IntelHub - Load and Render Tools
// Fetches OSINT tools from GitHub, renders category buttons, and handles favorites

const GITHUB_TOOLS_URL = "https://raw.githubusercontent.com/tomsec8/IntelHub/main/tools.json";

let toolsData = {}; // Main tool data object
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
  navigator.clipboard.writeText(query).then(() => alert("✅ Copied to clipboard!"));
});

// Append controls to the wrapper and menu
dorkWrapper.appendChild(searchBtn);
dorkWrapper.appendChild(copyBtn);
dorkWrapper.appendChild(resultDisplay);

container.appendChild(dorkBtn);
container.appendChild(dorkWrapper);

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

