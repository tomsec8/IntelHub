# 🧠 IntelHub – OSINT Toolkit for Chrome

A modern and intuitive Chrome extension that brings your favorite OSINT tools, metadata analyzers, and Google Dorking assistants right into your browser.

---

## 📋 Project Overview

**IntelHub** is a modular Open Source Intelligence (OSINT) Chrome extension designed for investigators, analysts, and cybersecurity professionals.  
It centralizes critical tools, metadata analysis features, and advanced Google search utilities — all accessible in one click.

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

## 🧠 Features & Categories

| Category               | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| ⭐ **Favorites**        | Mark any OSINT tool and access it quickly from the favorites tab            |
| 🕵️ **OSINT Tools**     | Domain, IP, image analysis, social media, and more organized by category     |
| 📊 **Metadata Analyzer** | Upload images, PDFs, or Office files and extract metadata locally           |
| 🔎 **Google Dorks**     | Easily build advanced Google queries with support for multiple operators     |
| 📷 **Reverse Image**    | (Optional) Search across reverse image engines (Google, Yandex, TinEye etc.) |

---

## 📦 Folder Structure

```
IntelHub/
├── icons/
├── popup.html
├── popup.js
├── style.css
├── tools.json
├── manifest.json
├── README.md
```

---

## 👨‍💻 Maintainer

Built with care by **TomSec8**  
Pull requests and suggestions are welcome!

---

## 🙏 Credits

- **ExifReader** – For reading EXIF data  
- **pdf-lib** – PDF metadata parsing  
- **JSZip** – For reading Office file metadata  
- Public OSINT tools sourced and organized for accessibility  

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.
