import * as Sentry from '@sentry/react-native';

/**
 * Logger utility for handling logs in different environments.
 * 
 * In __DEV__:
 * - All logs are printed to the console.
 * 
 * In Production:
 * - debug/info: No-op (suppressed).
 * - warn: Sends a warning message to Sentry.
 * - error: Sends an exception or error message to Sentry.
 */
class Logger {
    /**
     * Log a debug message.
     * Only visible in __DEV__.
     */
    static debug(message: string, ...args: any[]): void {
        if (__DEV__) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }

    /**
     * Log an info message.
     * Only visible in __DEV__.
     */
    static info(message: string, ...args: any[]): void {
        if (__DEV__) {
            console.info(`[INFO] ${message}`, ...args);
        }
    }

    /**
     * Log a warning message.
     * Visible in __DEV__.
     * Sends a warning to Sentry in Production.
     */
    static warn(message: string, ...args: any[]): void {
        if (__DEV__) {
            console.warn(`[WARN] ${message}`, ...args);
        } else {
            // In production, send to Sentry as a warning
            Sentry.captureMessage(message, {
                level: 'warning',
                extra: { args },
            });
        }
    }

    /**
     * Log an error message.
     * Visible in __DEV__.
     * Sends an error to Sentry in Production.
     */
    static error(message: string, error?: any, ...args: any[]): void {
        if (__DEV__) {
            console.error(`[ERROR] ${message}`, error, ...args);
        } else {
            // In production, send to Sentry
            if (error instanceof Error) {
                Sentry.captureException(error, {
                    extra: { message, args },
                });
            } else {
                Sentry.captureMessage(message, {
                    level: 'error',
                    extra: { error, args },
                });
            }
        }
    }
}

export default Logger;
