export const FILETYPE_OPTIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv',
    'odt', 'ods', 'odp', 'xml', 'json', 'sql', 'log', 'conf', 'cfg', 'ini',
    'env', 'bak', 'zip', 'rar', '7z', 'tar', 'gz', 'html', 'htm', 'php',
    'asp', 'aspx', 'jsp', 'js', 'css', 'kml', 'dwg', 'apk'
];

const fields = [
    { label: "Site", prefix: "site" },
    { label: "Filetype", prefix: "filetype" },
    { label: "In URL", prefix: "inurl" },
    { label: "In Title", prefix: "intitle" },
    { label: "In Text", prefix: "intext" },
    { label: "After Date", prefix: "after", type: "date" },
    { label: "Before Date", prefix: "before", type: "date" },
    { label: "Free Text", prefix: null }
];

export const DORK_FIELDS = fields;

export function buildDorkQueryFromValues(values) {
    const parts = [];
    for (const key in values) {
        const value = String(values[key] || '').trim();
        if (!value) continue;

        if (key === "__free") {
            parts.push(value);
        } else if (key === "intext") {
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

