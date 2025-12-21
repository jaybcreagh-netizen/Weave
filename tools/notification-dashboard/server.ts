
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'client/public')));

const CONFIG_PATH = path.resolve(__dirname, '../../src/modules/notifications/notification.config.ts');

// Helper to parse the config file (very basic regex parsing for this tool)
// In a robust tool, we'd use the TypeScript Compiler API, but this is a quick internal tool.
// We'll read the file, extract the JSON-like object, and serve it.
// Helper to extract a balanced JSON-like object from a string starting at a specific index
const extractObject = (source: string, startSearchStr: string): string | null => {
    const startIdx = source.indexOf(startSearchStr);
    if (startIdx === -1) return null;

    // Find the first '{' after the start search string
    let openBraceIdx = source.indexOf('{', startIdx);
    if (openBraceIdx === -1) return null;

    let balance = 1;
    let currentIdx = openBraceIdx + 1;

    while (balance > 0 && currentIdx < source.length) {
        const char = source[currentIdx];
        if (char === '{') balance++;
        else if (char === '}') balance--;
        currentIdx++;
    }

    if (balance === 0) {
        return source.substring(openBraceIdx, currentIdx);
    }
    return null;
};

const readConfig = () => {
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        console.log("Reading config...");

        const response: any = {};

        // 1. Parse NOTIFICATION_CONFIG
        const channelsStr = extractObject(content, 'export const NOTIFICATION_CONFIG');
        if (channelsStr) {
            try {
                // Eval is safe here as this is a local dev tool
                response.channels = eval('(' + channelsStr + ')');
            } catch (e) {
                console.error("Error parsing channels", e);
            }
        }

        // 2. Parse GLOBAL_NOTIFICATION_SETTINGS
        const globalStr = extractObject(content, 'export const GLOBAL_NOTIFICATION_SETTINGS');
        if (globalStr) {
            try {
                response.global = eval('(' + globalStr + ')');
            } catch (e) {
                console.error("Error parsing global", e);
            }
        }

        return response;
    } catch (e) {
        console.error("Error reading config", e);
        return {};
    }
};

app.get('/api/config', (req, res) => {
    res.json(readConfig());
});

app.post('/api/config', (req, res) => {
    const { channels, global } = req.body;

    try {
        const originalContent = fs.readFileSync(CONFIG_PATH, 'utf-8');

        // We will reconstruct the file by keeping imports/types but replacing the const definitions.
        // This is a bit fragile with regex but sufficient for a dev tool.

        // 1. Strings
        const channelsStr = JSON.stringify(channels || {}, null, 4).replace(/"(\w+)":/g, '$1:');
        const globalStr = JSON.stringify(global || {}, null, 4).replace(/"(\w+)":/g, '$1:');

        let newContent = originalContent;

        // Replace NOTIFICATION_CONFIG
        newContent = newContent.replace(
            /export const NOTIFICATION_CONFIG[\s\S]*?=\s*\{[\s\S]*?\};/,
            `export const NOTIFICATION_CONFIG: Record<string, NotificationConfigItem> = ${channelsStr};`
        );

        // Replace GLOBAL_NOTIFICATION_SETTINGS
        // If it exists, replace it. If not, we might need to append (but assuming it exists for now based on previous steps)
        if (newContent.match(/export const GLOBAL_NOTIFICATION_SETTINGS/)) {
            newContent = newContent.replace(
                /export const GLOBAL_NOTIFICATION_SETTINGS[\s\S]*?=\s*\{[\s\S]*?\};/,
                `export const GLOBAL_NOTIFICATION_SETTINGS: GlobalNotificationSettings = ${globalStr};`
            );
        } else {
            // Append if missing (e.g. if file didn't have it yet)
            newContent += `\n\nexport const GLOBAL_NOTIFICATION_SETTINGS: GlobalNotificationSettings = ${globalStr};`;
        }

        fs.writeFileSync(CONFIG_PATH, newContent);
        res.json({ success: true });
    } catch (e) {
        console.error("Save failed", e);
        res.status(500).json({ error: String(e) });
    }
});

app.listen(PORT, () => {
    console.log(`Notification Dashboard running at http://localhost:${PORT}`);
    console.log(`Opening browser...`);
    exec(`open http://localhost:${PORT}`);
});
