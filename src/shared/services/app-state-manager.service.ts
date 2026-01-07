import { AppState, AppStateStatus } from 'react-native';
import { logger } from '@/shared/services/logger.service';

type AppStateListener = (state: AppStateStatus) => void;
type IdleStateListener = (isIdle: boolean) => void;

const IDLE_TIMEOUT = 60000; // 1 minute of inactivity = idle

class AppStateManager {
  private listeners: Set<AppStateListener> = new Set();
  private idleListeners: Set<IdleStateListener> = new Set();
  private currentState: AppStateStatus = AppState.currentState;
  private subscription: any = null;
  private lastActivityTime: number = Date.now();
  private idleTimer: NodeJS.Timeout | null = null;
  private isCurrentlyIdle: boolean = false;

  constructor() {
    this.subscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Initial check
    if (this.currentState === 'active') {
      this.resetIdleTimer();
    }
  }

  /**
   * Start or reset the idle timer
   * This replaces the polling mechanism with a precise timeout
   */
  private resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Only schedule idle check if we are currently active (and not already idle)
    // If we are already idle, we wait for activity to reset
    if (this.currentState === 'active' && !this.isCurrentlyIdle) {
      this.idleTimer = setTimeout(() => {
        this.handleIdleTrigger();
      }, IDLE_TIMEOUT);
    }
  }

  private handleIdleTrigger() {
    if (this.currentState !== 'active') return;

    this.isCurrentlyIdle = true;

    // Notify idle listeners
    this.idleListeners.forEach(listener => {
      try {
        listener(true);
      } catch (error) {
        logger.error('AppState', 'Idle listener error:', error);
      }
    });
  }

  /**
   * Call this whenever user interacts with the app
   */
  recordActivity() {
    this.lastActivityTime = Date.now();

    // If was idle, notify that we're active again
    if (this.isCurrentlyIdle) {
      this.isCurrentlyIdle = false;
      this.idleListeners.forEach(listener => {
        try {
          listener(false);
        } catch (error) {
          logger.error('AppState', 'Idle listener error:', error);
        }
      });
    }

    // Reset the timer since we just had activity
    this.resetIdleTimer();
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    this.currentState = nextState;

    if (nextState === 'active') {
      this.resetIdleTimer();
    } else {
      // If we go background, we can pause the idle timer (or let it run? strictly speaking if we are background we are 'idle' in a sense, but usually we just care about active->idle transition)
      // Implementation choice: clear the timer to avoid firing 'idle' event while in background, unless we want to track background as idle.
      // Given: "Check for idle state every 10 seconds ... if (this.currentState !== 'active') return;" in original code.
      // So original code did NOT fire idle if background.
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
        this.idleTimer = null;
      }
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(nextState);
      } catch (error) {
        logger.error('AppState', 'Listener error:', error);
      }
    });
  };

  /**
   * Subscribe to app state changes
   */
  subscribe(listener: AppStateListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to idle state changes
   */
  subscribeToIdle(listener: IdleStateListener): () => void {
    this.idleListeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.idleListeners.delete(listener);
    };
  }

  /**
   * Check if app is currently active (in foreground)
   */
  isActive(): boolean {
    return this.currentState === 'active';
  }

  /**
   * Check if app is in background
   */
  isBackground(): boolean {
    return this.currentState === 'background';
  }

  /**
   * Check if app is idle
   */
  isIdle(): boolean {
    return this.isCurrentlyIdle;
  }

  /**
   * Check if app should be sleeping (background or idle)
   */
  shouldSleep(): boolean {
    return this.isBackground() || this.isIdle();
  }

  /**
   * Get current app state
   */
  getState(): AppStateStatus {
    return this.currentState;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.subscription) {
      this.subscription.remove();
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.listeners.clear();
    this.idleListeners.clear();
  }
}

// Singleton instance
export const appStateManager = new AppStateManager();
