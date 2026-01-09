import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';

/**
 * Derived Types
 * 
 * these types are derived directly from WatermelonDB models to ensure
 * type safety and single source of truth.
 */

// A strict subset of FriendModel that only includes properties
export type FriendShape = Readonly<FriendModel>;

// Helper to check if an object is a Model instance (runtime check)
export function isFriendModel(obj: any): obj is FriendModel {
    return obj && typeof obj.observe === 'function' && obj.table === 'friends';
}

export type InteractionShape = Readonly<InteractionModel>;

export function isInteractionModel(obj: any): obj is InteractionModel {
    return obj && typeof obj.observe === 'function' && obj.table === 'interactions';
}

/**
 * Share status info for an interaction.
 * Used to display reciprocity styling in timeline.
 */
export interface ShareInfo {
    isShared: true;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    isCreator: boolean;
    serverWeaveId: string;
    sharedAt: number;
}

/**
 * Extended interaction shape with optional share information.
 * Used in timeline components to render shared weave styling.
 */
export interface InteractionWithShareInfo extends InteractionShape {
    shareInfo?: ShareInfo;
}
