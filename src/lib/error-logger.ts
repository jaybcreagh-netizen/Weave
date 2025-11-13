import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureException, addBreadcrumb } from './sentry';

/**
 * Local Error Logging System
 *
 * Stores errors locally for debugging and exports them for support.
 * Works alongside Sentry for comprehensive error tracking.
 */

const ERROR_LOG_KEY = '@weave:error_log';
const MAX_STORED_ERRORS = 50;

export interface ErrorLog {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  level: 'error' | 'warning' | 'info';
  seen: boolean;
}

/**
 * Log an error locally and send to Sentry
 */
export async function logError(
  error: Error | string,
  context?: Record<string, any>,
  level: 'error' | 'warning' | 'info' = 'error'
): Promise<void> {
  try {
    const errorLog: ErrorLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      context,
      level,
      seen: false,
    };

    // Store locally
    const existingLogs = await getErrorLogs();
    const newLogs = [errorLog, ...existingLogs].slice(0, MAX_STORED_ERRORS);
    await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(newLogs));

    // Send to Sentry (only for errors, not warnings/info)
    if (level === 'error' && typeof error !== 'string') {
      captureException(error, context);
    } else if (level === 'error') {
      addBreadcrumb(errorLog.message, context);
    }

    // Console log in dev mode
    if (__DEV__) {
      console.error(`[ErrorLogger] ${level.toUpperCase()}:`, errorLog.message, context);
      if (errorLog.stack) {
        console.error(errorLog.stack);
      }
    }
  } catch (storageError) {
    // Fail silently - don't let error logging crash the app
    console.error('[ErrorLogger] Failed to log error:', storageError);
  }
}

/**
 * Get all stored error logs
 */
export async function getErrorLogs(): Promise<ErrorLog[]> {
  try {
    const stored = await AsyncStorage.getItem(ERROR_LOG_KEY);
    if (!stored) return [];

    const logs: ErrorLog[] = JSON.parse(stored);
    return logs;
  } catch (error) {
    console.error('[ErrorLogger] Failed to retrieve error logs:', error);
    return [];
  }
}

/**
 * Get unseen error count
 */
export async function getUnseenErrorCount(): Promise<number> {
  const logs = await getErrorLogs();
  return logs.filter(log => !log.seen && log.level === 'error').length;
}

/**
 * Mark all errors as seen
 */
export async function markErrorsAsSeen(): Promise<void> {
  try {
    const logs = await getErrorLogs();
    const updatedLogs = logs.map(log => ({ ...log, seen: true }));
    await AsyncStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updatedLogs));
  } catch (error) {
    console.error('[ErrorLogger] Failed to mark errors as seen:', error);
  }
}

/**
 * Clear all error logs
 */
export async function clearErrorLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ERROR_LOG_KEY);
  } catch (error) {
    console.error('[ErrorLogger] Failed to clear error logs:', error);
  }
}

/**
 * Export error logs as formatted text for sharing
 */
export async function exportErrorLogs(): Promise<string> {
  const logs = await getErrorLogs();

  if (logs.length === 0) {
    return 'No errors logged.';
  }

  let output = `Weave Error Log Export\n`;
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total Errors: ${logs.length}\n`;
  output += `\n${'='.repeat(80)}\n\n`;

  logs.forEach((log, index) => {
    output += `[${index + 1}] ${log.level.toUpperCase()} - ${new Date(log.timestamp).toLocaleString()}\n`;
    output += `Message: ${log.message}\n`;

    if (log.context) {
      output += `Context: ${JSON.stringify(log.context, null, 2)}\n`;
    }

    if (log.stack) {
      output += `Stack Trace:\n${log.stack}\n`;
    }

    output += `\n${'-'.repeat(80)}\n\n`;
  });

  return output;
}

/**
 * Global error handler setup
 * Call this once at app startup
 */
export function setupGlobalErrorHandlers() {
  // Capture unhandled promise rejections
  const originalPromiseRejectionHandler = global.Promise.prototype.catch;

  // Log unhandled promise rejections
  const handlePromiseRejection = (reason: any) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logError(error, { type: 'unhandled_promise_rejection' }, 'error');
  };

  // Override global promise rejection tracking
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('unhandledRejection', (event: any) => {
      handlePromiseRejection(event.reason);
    });
  }

  console.log('[ErrorLogger] Global error handlers initialized');
}
