/**
 * Shared Logger Service
 * Wraps console methods to provide structured logging with tags.
 * Ensures debug logs only appear in development.
 */
const isDev = __DEV__;

export const logger = {
    /**
     * Log helpful debug information. Only prints in __DEV__ mode.
     * @param tag - Component or module name (e.g. "AuthService")
     * @param message - The message to log
     * @param args - Additional data to log
     */
    debug: (tag: string, message: string, ...args: unknown[]) => {
        if (isDev) {
            console.log(`[DEBUG] [${tag}] ${message}`, ...args);
        }
    },

    /**
     * Log general information. Always prints.
     * @param tag - Component or module name
     * @param message - The message to log
     * @param args - Additional data
     */
    info: (tag: string, message: string, ...args: unknown[]) => {
        console.log(`[INFO] [${tag}] ${message}`, ...args);
    },

    /**
     * Log a warning. Always prints.
     * @param tag - Component or module name
     * @param message - The warning message
     * @param args - Additional data
     */
    warn: (tag: string, message: string, ...args: unknown[]) => {
        console.warn(`[${tag}] ${message}`, ...args);
    },

    /**
     * Log an error. Always prints.
     * @param tag - Component or module name
     * @param message - The error message
     * @param args - Additional data or error objects
     */
    error: (tag: string, message: string, ...args: unknown[]) => {
        console.error(`[${tag}] ${message}`, ...args);
    },
};
