export const TelegramScraper = {
    async analyze(input) {
        let url;
        let cleanName = input.trim();

        if (cleanName.startsWith('https://t.me/')) {
            url = cleanName;
            cleanName = cleanName.replace('https://t.me/', '').replace('+', ''); 
        } else if (cleanName.startsWith('@')) {
            cleanName = cleanName.replace('@', '');
            url = `https://t.me/${cleanName}`;
        } else {
            url = `https://t.me/${cleanName}`;
        }

        try {
            const response = await fetch(url, {
                method: 'GET',
                cache: 'no-cache'
            });

            if (!response.ok) throw new Error("Failed to fetch page");

            const html = await response.text();

            if (html.includes('tgme_page_title') && html.includes('Telegram: Contact @')) {
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const title = doc.querySelector('meta[property="og:title"]')?.content || "Unknown";
            const description = doc.querySelector('meta[property="og:description"]')?.content || "";
            const image = doc.querySelector('meta[property="og:image"]')?.content || "";
            
            let extraInfo = "";
            let type = "User";

            const extraEl = doc.querySelector('.tgme_page_extra');
            if (extraEl) {
                extraInfo = extraEl.textContent.trim();
                if (extraInfo.includes('subscribers')) type = "Channel";
                else if (extraInfo.includes('members')) type = "Group";
                else if (extraInfo.includes('bot')) type = "Bot";
            }

            const isVerified = !!doc.querySelector('.tgme_page_title i.verified-icon');

            if (title === "Telegram: Contact @undefined" || (!extraInfo && !description && title === "Telegram")) {
                return { success: false, error: "User/Channel not found" };
            }

            return {
                success: true,
                data: {
                    username: cleanName,
                    title: title,
                    description: description,
                    image: image,
                    type: type,
                    stats: extraInfo,
                    verified: isVerified,
                    url: url
                }
            };

        } catch (e) {
            console.error(e);
            return { success: false, error: "Connection Error (CORS/Network)" };
        }
    }
};