# IntelHub User Guide 🕵️

Welcome to IntelHub. This extension aggregates advanced open-source intelligence (OSINT) tools into a single, convenient interface, allowing researchers and analysts to perform operations quickly and efficiently.

---

## 🏠 Overview - Main Interface
At the top left of the extension, you will find the **Refresh** button to update the tool list and extension settings.
Below it is a **Search Bar** for quickly locating specific categories or tools.

![Main Menu - Top](images/1.png)

On the right side, there is a **Scroll Bar** to navigate between different categories. In the top right corner, there is a toggle button to switch the **Theme**.

![Main Menu - Scroll](images/2.png)

---

## ⭐ Favorites - Management
This category centralizes tools you have marked as "Favorites" from the general pool, and allows adding custom tools and managing categories.

![Favorites Screen](images/3.png)

### Main Actions:
**New Category:** Create new folders/categories to organize your favorite tools.

![Create New Category](images/4.png)

**Add Custom Tool:** Add an external tool (not present in the extension) by entering a Name, URL, and short Description. You can assign the tool to a specific category before saving.

![Add Custom Tool](images/5.png)

**Export/Import:** Export your favorites list and settings as a backup file, or import them to transfer to another user.

![Export and Import](images/6.png)

**Ongoing Management:**
This is how the tool list looks after adding items.
To delete a category, click the trash can icon on the right. To remove a tool from favorites, click the Star icon (Unstar).

![Favorites List](images/7.png)

---

## 🛠️ OSINT Tools - Tool Repository
This category contains the core of the extension - a comprehensive list of intelligence tools divided by topics. The list is automatically synced with the GitHub repository and updates every 24 hours (or upon manual Refresh).

Clicking on a topic (Category) will open the list of tools belonging to it:

![Categories and Tools](images/8.png)

* Clicking a tool will open it in a new tab.
* Clicking the Star icon next to a tool name will add it to "Favorites".
* Hovering over a tool will display a short description (Tooltip) of its function.

![Tool Tooltip](images/9.png)

---

## 🖼️ Reverse Image Search
This tool allows you to perform a reverse image search across multiple search engines simultaneously.

![Reverse Image Search Menu](images/10.png)

**Input Options:**
1.  **Upload:** Upload an image file from your computer.
2.  **Paste:** Paste an image directly from the Clipboard.

*Before searching, select the checkboxes for the search engines you wish to use (Google, Yandex, Bing, TinEye, etc.). Your selection is saved for next time.*

---

## 📄 Metadata Analyzer
A tool for extracting hidden information (Metadata/EXIF) from files.

![Select File Type](images/11.png)

Select the desired file type (Image, PDF, or Office document) and upload it. The data report will appear immediately at the bottom of the window (scroll down to view full details).

![Metadata Results](images/12.png)

---

## 🔍 Google Dorks - Query Builder
An interface for easily building advanced Google search queries.

![Dorks Builder](images/13.png)

Enter the desired parameters in the various fields (Search within a specific site, File type, Keywords in Title/URL/Text).
After building the query, you can click **Search on Google** for immediate execution, or view the query structure in the box below and copy it.

![Copy Query](images/14.png)

---

## ✈️ Telegram Tools
A suite of tools for Telegram investigations. This category allows phone number lookups, user/group detail gathering, and export analysis.

![Telegram Tools Menu](images/15.png)

**User & Group Profiler:** Enter a username (or link) to perform a deep scan and display user details, profile picture, status, and an option to **Fetch Numeric ID**.

![Telegram Profiler Results](images/16.png)

---

## 🌐 Site, Link & Archive - Site Analysis
A collection of tools for analyzing the current page or a specific URL for initial reconnaissance.

![Site Analysis Menu](images/17.png)

**Available Tools:**
1.  **Website Fingerprint:** Captures the site's fingerprint (technologies, cookies) for authenticity checks.
2.  **WHOIS & DNS:** Checks domain ownership and DNS records.
3.  **Technology Detection:** Identifies the underlying technology stack.
4.  **Subdomain Finder:** Locates subdomains.
5.  **Save Page Offline:** Saves the current page as a local HTML file for documentation.
6.  **Archive Search:** Searches for the site's history in various web archives.

---

## 🆔 Social ID Extractor
Designed to extract the **Numeric User ID** from social media profiles, or to navigate to a profile based on an existing ID.

![ID Extraction Menu](images/18.png)

Navigate to the profile page (e.g., on Facebook) and click the first button to extract the ID.

![Extraction Result](images/19.png)

---

## 🔗 Link Analyzer
Contains tools for checking the safety and origin of links.

![Link Analysis Menu](images/20.png)

* **Unshorten URL:** Decodes shortened links (like bit.ly) to reveal the original address.
* **Scan for Viruses:** Checks the link against the VirusTotal database.

---

## 📝 Text Profiler
Scans and extracts **Entities** from text. The system identifies emails, crypto wallets, phone numbers, usernames, and more.

![Text Profiler Menu](images/21.png)

You can analyze text via **Paste**, external text file upload, or by scanning the **Current Page** in the browser. Results can be exported to CSV.

---

## 📊 Investigation Graph
Clicking this category opens the visualization system.

![Graph Button](images/22.png)

Using the graph, you can create an investigation map, add entity cards, and link them to visualize the intelligence picture clearly.

![Graph Interface](images/23.png)
