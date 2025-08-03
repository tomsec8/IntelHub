# 🧠 IntelHub – OSINT Toolkit for Chrome

<p align="center">
  <img src="icons/icon.png" alt="IntelHub Logo" width="120" />
</p>


A modern and intuitive Chrome extension that brings your favorite OSINT tools, metadata analyzers, and Google Dorking assistants right into your browser.

[![Get it on Chrome Web Store](https://img.shields.io/badge/Install%20from-Chrome%20Web%20Store-blue.svg?logo=google-chrome)](https://chromewebstore.google.com/detail/jfjpgfklmjdhabodgghmjclpgnpiejlh)


---

## 🔍 Overview

**IntelHub** turns your browser into a powerful Open-Source Intelligence (OSINT) environment.  
Perform deep analysis on links, websites, files, and social platforms — all locally, privacy-first, and fast.

> Whether you're a **cyber analyst**, **journalist**, **law enforcement**, or **OSINT enthusiast** – IntelHub is your modular, personal toolkit.

---

## ✅ System Requirements

To use this extension, you’ll need:

- 🖥️ **Browser**: Chrome or any Chromium-based browser (e.g., Brave, Edge)  
- 📦 **Storage**: Minimal – used only to save preferences and favorites  
- 🌐 **Internet Access**: Required for launching online OSINT tools  
- 🧩 **Permissions**: Extension requires scripting and tab access for certain features  

---

## 🚀 Installation

You can load the extension manually during development:

```bash
git clone https://github.com/tomsec8/IntelHub.git
```

1. Open `chrome://extensions/` in your browser  
2. Enable **Developer mode** (top-right corner)  
3. Click **"Load unpacked"** and select the `IntelHub` folder  

---

## 🚀 Key Features

| Category               | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| 🔎 **Smart Text Profiler** | Extract emails, phones, Israeli IDs, crypto wallets, domains, IPs, names, and more using advanced regex + multilingual NLP |
| 🧠 **Entity Recognition (NLP)** | Detect people, cities, organizations, and languages – English & Hebrew support |
| 📷 **Metadata Analyzer**     | Analyze EXIF & metadata from images, PDFs, Office docs – all locally |
| 🌐 **Website Analyzer**      | Reveal tech stack, WHOIS, fingerprints, and save full offline snapshot |
| 🧬 **Social ID Extractor**   | Extract usernames from Facebook, Instagram, X, Telegram, TikTok, LinkedIn |
| 🔗 **Link Analyzer**         | Unmask short URLs + scan with VirusTotal |
| 🧰 **Curated OSINT Tools**  | Browse categorized tools for reverse image search, domain lookup, breach checks, etc. |
| ⭐ **Favorites + UI**        | Clean dark mode, filters, favorites – smooth experience |


---

## 📦 Folder Structure

```
IntelHub/
├── content.js
├── manifest.json
├── popup.html
├── popup.js
├── styles/
│   └── styles.css
├── libs/
│   ├── compromise.min.js
│   ├── ExifReader.js
│   ├── jszip-lib.min.js
│   ├── pdf-lib.min.js
│   ├── psl.min.js
│   └── single-file.js
├── icons/
│   └── [icon files]

```

---

## 🆕 What's New in v2.0

✅ Brand-new dark-mode interface  
✅ Profiler AI with NLP and multilingual support  
✅ Local EXIF & Metadata analyzers  
✅ Full Website Analyzer (tech, WHOIS, snapshot)  
✅ Favorites system with filterable categories  
✅ Powerful new regex patterns + Hebrew support  
✅ Improved performance and modular design  

---

## 👨‍💻 Maintainer

Built with care by **TomSec8**  
Pull requests and suggestions are welcome!

---

## 🤝 Credits

- **Text Entity Extraction**: [Compromise NLP](https://github.com/spencermountain/compromise)  
- **EXIF Parser**: [ExifReader](https://github.com/mattiasw/ExifReader)  
- **PDF Parsing**: [pdf-lib](https://github.com/Hopding/pdf-lib)  
- **ZIP Handling**: [jszip](https://github.com/Stuk/jszip)  
- **Website Snapshot**: [single-file](https://github.com/gildas-lormeau/SingleFile)  
- **TLD Parsing**: [psl](https://github.com/lupomontero/psl)
 

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
