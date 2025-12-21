
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.resolve(__dirname, '../../src/modules/notifications/notification.config.ts');

const extractObject = (source: string, startSearchStr: string): string | null => {
    const startIdx = source.indexOf(startSearchStr);
    if (startIdx === -1) {
        console.log(`Could not find startSearchStr: "${startSearchStr}"`);
        return null;
    }

    // Find the first '{' after the start search string
    let openBraceIdx = source.indexOf('{', startIdx);
    if (openBraceIdx === -1) {
        console.log(`Could not find opening brace after "${startSearchStr}"`);
        return null;
    }

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
    console.log("Unbalanced braces");
    return null;
};

const run = () => {
    console.log("Reading config from:", CONFIG_PATH);
    try {
        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        console.log("File read successfully. Length:", content.length);

        console.log("\n--- Parsing Channels ---");
        const channelsStr = extractObject(content, 'export const NOTIFICATION_CONFIG');
        if (channelsStr) {
            console.log("Channels string extracted. Length:", channelsStr.length);
            console.log("Snippet:", channelsStr.substring(0, 50) + "...");
            try {
                const channels = eval('(' + channelsStr + ')');
                console.log("✅ Channels parsed successfully. Keys:", Object.keys(channels));
            } catch (e) {
                console.error("❌ Error eval-ing channels:", e);
                console.log("Failed String Content:\n", channelsStr);
            }
        } else {
            console.error("❌ Failed to extract channels string");
        }

        console.log("\n--- Parsing Global ---");
        const globalStr = extractObject(content, 'export const GLOBAL_NOTIFICATION_SETTINGS');
        if (globalStr) {
            console.log("Global string extracted. Length:", globalStr.length);
            console.log("Snippet:", globalStr.substring(0, 50) + "...");
            try {
                const global = eval('(' + globalStr + ')');
                console.log("✅ Global parsed successfully.", global);
            } catch (e) {
                console.error("❌ Error eval-ing global:", e);
                console.log("Failed String Content:\n", globalStr);
            }
        } else {
            console.error("❌ Failed to extract global string");
        }

    } catch (e) {
        console.error("Critical error:", e);
    }
};

run();
