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
  private idleCheckInterval: any = null;
  private isCurrentlyIdle: boolean = false;

  constructor() {
    this.subscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Start idle detection only when app is active
    this.startIdleDetection();
  }

  private startIdleDetection() {
    // Check for idle state every 10 seconds
    this.idleCheckInterval = setInterval(() => {
      if (this.currentState !== 'active') return;

      const timeSinceActivity = Date.now() - this.lastActivityTime;
      const shouldBeIdle = timeSinceActivity > IDLE_TIMEOUT;

      if (shouldBeIdle !== this.isCurrentlyIdle) {
        this.isCurrentlyIdle = shouldBeIdle;


        // Notify idle listeners
        this.idleListeners.forEach(listener => {
          try {
            listener(shouldBeIdle);
          } catch (error) {
            logger.error('AppState', 'Idle listener error:', error);
          }
        });
      }
    }, 10000);
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
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {


    this.currentState = nextState;

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
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }
    this.listeners.clear();
    this.idleListeners.clear();
  }
}

// Singleton instance
export const appStateManager = new AppStateManager();
