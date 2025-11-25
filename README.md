# IntelHub – OSINT Toolkit 🧠

<p align="center">
  <img src="icons/icon.png" alt="IntelHub Logo" width="120" />
</p>

<p align="center">
  <b>Advanced Browser-Based Intelligence Suite v4.0</b>
</p>

<p align="center">
  A comprehensive Open-Source Intelligence (OSINT) suite that transforms your browser into a powerful investigation toolkit. <br>
  Designed for researchers, analysts, and investigators with advanced tools for Telegram analysis, Digital Forensics, and complete privacy protection.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/jfjpgfklmjdhabodgghmjclpgnpiejlh">
    <img src="https://img.shields.io/badge/Chrome-Available-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Chrome Web Store">
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/intelhub/">
    <img src="https://img.shields.io/badge/Firefox-Available-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" alt="Firefox Add-ons">
  </a>
</p>

---

## 📚 Documentation / Guides
**Full usage guides are available in the `help` section within the extension or here:**

| 🇺🇸 English | 🇮🇱 Hebrew | 🇪🇸 Spanish | 🇫🇷 French | 🇩🇪 German | 🇧🇷 Portuguese | 🇵🇱 Polish |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| [Link](help/guide_en.md) | [Link](help/guide_he.md) | [Link](help/guide_es.md) | [Link](help/guide_fr.md) | [Link](help/guide_de.md) | [Link](help/guide_pt_br.md) | [Link](help/guide_pl.md) |

---

## ✨ What's New in Version 4.0?

🎨 **UI/UX Overhaul & Themes**
Switch between the **Modern** and **Classic** themes instantly via the new toggle button. We've also replaced intrusive pop-up alerts with smooth visual feedback.

📊 **Investigation Graph**
A brand new visualization tool! Map out your investigation entities, connect dots, and create a visual relationship graph directly within the extension.

🔗 **Unified Site Analysis**
We've merged "Site Analysis", "Link Analysis", and "Archive Search" into one powerful hub for streamlined domain reconnaissance.

---

## 📸 Interface Preview

| **Main Menu** | **OSINT Tools** | **Graph View** |
|:---:|:---:|:---:|
| <img src="help/images/1.png" width="250" /> | <img src="help/images/8.png" width="250" /> | <img src="help/images/23.png" width="250" /> |

---

## 🛠️ Key Features

### 📱 Telegram Intelligence
* **User & Group Profiler:** Fetch details, profile pictures, and bio from usernames.
* **Numeric ID Extraction:** Grab unique Numeric IDs for users, groups, and channels.
* **Phone Lookup:** Quick links to check phone number registrations.

### 🌐 Site, Link & Archive Recon
* **Digital Fingerprint:** Identify tech stacks, cookies, and user-agent data.
* **Safety Checks:** Unshorten URLs and scan them with VirusTotal in one click.
* **Time Travel:** Search for historical versions of any site across Wayback Machine, Archive.today, and more.
* **Offline Evidence:** Save a perfect local HTML snapshot of any webpage.

### 🖼️ Media & Metadata
* **Reverse Image Search:** Upload or paste any image to search for it across Google, Yandex, Bing, and TinEye.
* **Metadata (EXIF) Viewer:** Extract hidden data from Images, PDFs, and Office documents locally.

### 📝 Text & Social Analysis
* **Text Profiler:** Automatically extract emails, crypto addresses, and phone numbers from any text block.
* **Social ID Extractor:** One-click extraction of numeric IDs from Facebook and other social platforms.

### ⚡ Productivity
* **Favorites System:** Save your most-used tools. Create custom categories and add your own external tools.
* **Import/Export:** Backup your configuration and share it with other analysts.
* **Google Dorks Builder:** Construct complex search queries with a simple UI.

---

## 📥 Installation (Developer Mode)

Since this is a developer tool, you can install it manually:

1.  **Download** or **Clone** this repository.
2.  Open your browser and navigate to `chrome://extensions`.
3.  Toggle **Developer Mode** (top right corner).
4.  Click **Load Unpacked**.
5.  Select the `IntelHub` folder (the one containing `manifest.json`).

---

## 📦 Project Structure

```text
IntelHub/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── README.md
├── help/
│   ├── guide_en.md
│   ├── guide_he.md
│   └── images/
├── styles/
│   ├── styles.css
│   └── styles_old.css
├── modules/
│   ├── osintTools.js
│   ├── favorites.js
│   ├── telegramAnalyzer.js
│   ├── siteAnalyzer.js
│   ├── investigationGraph.js
│   ├── help.js
│   ├── utils.js
│   └── ...
├── libs/
│   ├── cytoscape.min.js
│   ├── chart.min.js
│   ├── ExifReader.js
│   ├── pdf-lib.min.js
│   └── ...
└── icons/

```
---

## 🔒 Privacy Policy
* **Local Execution:** All scripts run within your browser (Client-Side).
* **No Tracking:** We do not collect analytics or user data.
* **External Requests:** Connections are made only when you explicitly use a tool (e.g., querying VirusTotal or fetching the tool list from GitHub).

---

## 🤝 Credits & Libraries

This project makes use of the following open-source libraries:

- **[Compromise NLP](https://github.com/spencermountain/compromise)**: For text entity extraction.
- **[ExifReader](https://github.com/mattiasw/ExifReader)**: For parsing image metadata.
- **[pdf-lib](https://github.com/Hopding/pdf-lib)**: For PDF metadata analysis.
- **[jszip](https://github.com/Stuk/jszip)**: For handling Office documents.
- **[SingleFile](https://github.com/gildas-lormeau/SingleFile)**: For saving offline webpages.
- **[psl](https://github.com/lupomontero/psl)**: For parsing domain names.
- **[Chart.js](https://github.com/chartjs/Chart.js)** & **[Cytoscape.js](https://github.com/cytoscape/cytoscape.js)**: For data visualization and graphs.
- **[date-fns](https://github.com/date-fns/date-fns)**: For date manipulation.

### APIs Used
- **[Unshorten.me](https://unshorten.me)** – Resolving shortened URLs.
- **[corsproxy.io](https://corsproxy.io)** – Handling CORS for external requests.
- **[VirusTotal](https://www.virustotal.com/)** – Domain safety scanning.

> © All APIs and services belong to their respective owners.

---

## Maintainer 👨‍💻

Built with care by **[TomSec8](https://github.com/tomsec8)**.
Pull requests, issues, and suggestions are welcome!

---

## License 📜

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
