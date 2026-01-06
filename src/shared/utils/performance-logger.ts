/**
 * Performance Logger Utility
 * 
 * Simple utility to log performance metrics to the console.
 * Filter logs by searching for "[PERF]" in the console.
 */

export const PerfLogger = {
    /**
     * Log a performance event
     * @param tag - Category tag (e.g. 'Oracle', 'Journal', 'Boot')
     * @param message - Message describing the event
     * @param data - Optional data to include
     */
    log: (tag: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1); // HH:mm:ss.SSS
        console.log(`[PERF][${timestamp}][${tag}] ${message}`, data ? JSON.stringify(data) : '');
    },

    /**
     * Measure the duration of an async function
     * @param tag - Category tag
     * @param name - Name of the operation
     * @param fn - Function to execute
     */
    measure: async <T>(tag: string, name: string, fn: () => Promise<T> | T): Promise<T> => {
        const start = global.performance?.now() ?? Date.now();
        PerfLogger.log(tag, `START ${name}`);
        try {
            const result = await fn();
            const end = global.performance?.now() ?? Date.now();
            PerfLogger.log(tag, `END ${name}`, { duration: `${(end - start).toFixed(2)}ms` });
            return result;
        } catch (e) {
            const end = global.performance?.now() ?? Date.now();
            PerfLogger.log(tag, `ERROR ${name}`, { duration: `${(end - start).toFixed(2)}ms` });
            throw e;
        }
    },

    /**
     * Get current high-resolution timestamp
     */
    now: () => global.performance?.now() ?? Date.now(),
};
