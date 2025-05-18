---

# 🧠 IntelHub – OSINT Chrome Extension

A modular and beginner-friendly OSINT toolkit inside your browser – built as a Chrome extension to empower investigators, cybersecurity professionals, and intelligence analysts.

---

## 📋 Project Overview

**IntelHub** is a browser extension that provides a centralized interface for various OSINT tools, metadata analyzers, Google Dork generators, and more.  
Whether you're researching domains, analyzing files, or hunting usernames – this tool saves you time and simplifies your workflow.

---

## ✅ System Requirements

Before using this extension, make sure your system meets the following:

- 🧩 **Browser:** Chrome or any Chromium-based browser (e.g. Edge, Brave)  
- 🧱 **Storage:** Minimal – used to store favorites and user preferences  
- 🌐 **Internet Connection:** Required for accessing OSINT tools online  
- 🛠️ **Permissions:** Requires `"scripting"` and `"activeTab"` permissions

---

## 🚀 Installation

To install the extension locally for development:

```bash
# 1. Clone the repository
git clone https://github.com/tomsec8/IntelHub.git

# 2. Open Chrome and navigate to:
chrome://extensions/

# 3. Enable "Developer mode" (top right corner)

# 4. Click "Load unpacked" and select the IntelHub project folder

## 🧠 Available Categories

| Category                   | Description                                                                  |
|----------------------------|------------------------------------------------------------------------------|
| ⭐ **Favorites**            | Save tools you use often and access them quickly                             |
| 🕵️ **OSINT Tools**         | Curated tools for domain, IP, image, and social media investigation          |
| 📊 **Metadata Analyzer**   | Analyze metadata from image, PDF, and Office files locally                   |
| 🔍 **Google Dorks**         | Build complex search queries using multiple operators (site, filetype, etc.) |
| 📷 **Reverse Image Search** | Upload or paste an image and search across multiple engines (Google, Yandex, etc.) |

---

## 👨‍💻 Maintainer

Project by **[TomSec8](https://github.com/tomsec8)**  
Feel free to open issues or pull requests with suggestions or fixes.

---

## 🙏 Credits

This project includes or is inspired by work from:

- [ExifReader](https://github.com/mattiasw/ExifReader) – for client-side EXIF parsing  
- [PDFLib.js](https://github.com/Hopding/pdf-lib) – for PDF metadata extraction  
- [JSZip](https://stuk.github.io/jszip/) – for Office document metadata extraction

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---