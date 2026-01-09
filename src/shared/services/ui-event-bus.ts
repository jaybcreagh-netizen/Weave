/**
 * UIEventBus - Enables imperative UI triggers from non-React code
 * 
 * This allows notification handlers and other non-React contexts to trigger
 * UI actions (like opening modals) without depending on React hooks.
 * 
 * Usage from non-React code:
 *   UIEventBus.emit({ type: 'OPEN_DIGEST_SHEET', items: [...] })
 * 
 * The GlobalUIProvider subscribes to these events and handles them.
 */

import { DigestItem } from '@/modules/notifications';
import { type Memory } from '@/modules/journal';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';

export interface MemoryMomentData {
    memory: Memory;
    entry: JournalEntry | WeeklyReflection;
    friendName?: string;
    friendId?: string;
}

// Define all possible UI events
export type UIEvent =
    | { type: 'OPEN_DIGEST_SHEET'; items: DigestItem[] }
    | { type: 'OPEN_WEEKLY_REFLECTION' }
    | { type: 'OPEN_SOCIAL_BATTERY_SHEET' }
    | { type: 'OPEN_MEMORY_MOMENT'; data: MemoryMomentData }
    | { type: 'SHOW_TOAST'; message: string; friendName?: string }
    | { type: 'FRIEND_NURTURED'; friendId: string }
    | { type: 'SHARED_WEAVE_CONFIRMED'; creatorName: string }; // Celebration when you accept a shared weave

type UIEventListener = (event: UIEvent) => void;

class UIEventBusClass {
    private listeners = new Set<UIEventListener>();

    /**
     * Emit a UI event - called from non-React code
     */
    emit(event: UIEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[UIEventBus] Error handling event:', event.type, error);
            }
        });
    }

    /**
     * Subscribe to UI events - called by GlobalUIProvider
     */
    subscribe(listener: UIEventListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Check if there are active listeners (for debugging)
     */
    get hasListeners(): boolean {
        return this.listeners.size > 0;
    }
}

// Export singleton instance
export const UIEventBus = new UIEventBusClass();
