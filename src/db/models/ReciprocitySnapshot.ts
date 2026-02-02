import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

/**
 * ReciprocitySnapshot
 * 
 * Stores detailed reciprocity analysis for each friendship.
 * Tracks initiation balance over time with trends and actionable flags.
 */
export default class ReciprocitySnapshot extends Model {
    static table = 'reciprocity_snapshots';

    @text('friend_id') friendId!: string;
    @field('calculated_at') calculatedAt!: number;

    // Core ratio (0 = they always initiate, 1 = you always initiate)
    @field('initiation_ratio') initiationRatio!: number;

    // Time-windowed analysis
    @text('windows_json') windowsJson!: string;

    // Trend analysis
    @text('trend') trend!: string; // 'improving' | 'stable' | 'declining'
    @text('trend_magnitude') trendMagnitude!: string; // 'slight' | 'moderate' | 'significant'

    // Flags
    @text('flags_json') flagsJson!: string;

    @readonly @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;

    // Parsed getters
    get windows(): ReciprocityWindows | null {
        try {
            return JSON.parse(this.windowsJson);
        } catch {
            return null;
        }
    }

    get flags(): ReciprocityFlags | null {
        try {
            return JSON.parse(this.flagsJson);
        } catch {
            return null;
        }
    }
}

// Type definitions
export interface ReciprocityWindow {
    yourInitiations: number;
    theirInitiations: number;
    ratio: number;
    totalInteractions: number;
}

export interface ReciprocityWindows {
    last30Days: ReciprocityWindow;
    last90Days: ReciprocityWindow;
    lifetime: ReciprocityWindow;
}

export interface ReciprocityFlags {
    onePersonCarrying: boolean;  // > 75% one direction
    recentShift: boolean;        // Changed significantly in 30 days
    healthyBalance: boolean;     // 0.35-0.65 range
}
