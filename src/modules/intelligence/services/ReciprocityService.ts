/**
 * ReciprocityService
 * 
 * Analyzes the balance of initiation in friendships over multiple time windows.
 * Produces trends, magnitude assessments, and actionable flags.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import ReciprocitySnapshot, {
    ReciprocityWindow,
    ReciprocityWindows,
    ReciprocityFlags
} from '@/db/models/ReciprocitySnapshot';

// ============================================================================
// TYPES
// ============================================================================

export interface ReciprocityAnalysis {
    friendId: string;
    calculatedAt: Date;
    initiationRatio: number;
    windows: ReciprocityWindows;
    trend: 'improving' | 'stable' | 'declining';
    trendMagnitude: 'slight' | 'moderate' | 'significant';
    flags: ReciprocityFlags;
}

// ============================================================================
// SERVICE
// ============================================================================

class ReciprocityService {

    /**
     * Calculate detailed reciprocity metrics for a friend
     */
    async calculateReciprocity(friendId: string): Promise<ReciprocityAnalysis> {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        // Get all interactions with initiator data
        const allInteractions = await this.getInteractionsWithInitiator(friendId);

        // Calculate windows
        const windows: ReciprocityWindows = {
            last30Days: this.calculateWindow(allInteractions, now - 30 * day, now),
            last90Days: this.calculateWindow(allInteractions, now - 90 * day, now),
            lifetime: this.calculateWindow(allInteractions, 0, now),
        };

        // Overall ratio based on 90-day window (or lifetime if less data)
        const initiationRatio = windows.last90Days.totalInteractions >= 3
            ? windows.last90Days.ratio
            : windows.lifetime.ratio;

        // Detect trend
        const { trend, trendMagnitude } = this.detectTrend(windows);

        // Detect flags
        const flags = this.detectFlags(initiationRatio, windows);

        // Save snapshot
        await this.saveSnapshot(friendId, initiationRatio, windows, trend, trendMagnitude, flags);

        return {
            friendId,
            calculatedAt: new Date(),
            initiationRatio,
            windows,
            trend,
            trendMagnitude,
            flags,
        };
    }

    /**
     * Get interactions with initiator field populated
     */
    private async getInteractionsWithInitiator(friendId: string): Promise<Array<{ date: number; initiator: string | null }>> {
        // Two-step query for many-to-many
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId)).fetch();

        const interactionIds = interactionFriends.map(if_ => if_.interactionId);
        if (interactionIds.length === 0) return [];

        const interactions = await database.get<Interaction>('interactions')
            .query(
                Q.where('id', Q.oneOf(interactionIds)),
                Q.where('status', 'completed')
            ).fetch();

        return interactions.map(i => ({
            date: i.interactionDate.getTime(),
            initiator: i.initiator || null,
        }));
    }

    /**
     * Calculate ratio for a time window
     */
    private calculateWindow(
        interactions: Array<{ date: number; initiator: string | null }>,
        startTime: number,
        endTime: number
    ): ReciprocityWindow {
        const inWindow = interactions.filter(i => i.date >= startTime && i.date <= endTime);
        const withInitiator = inWindow.filter(i => i.initiator);

        const yourInitiations = withInitiator.filter(i => i.initiator === 'user').length;
        const theirInitiations = withInitiator.filter(i => i.initiator === 'friend').length;
        const total = yourInitiations + theirInitiations;

        return {
            yourInitiations,
            theirInitiations,
            ratio: total > 0 ? yourInitiations / total : 0.5,
            totalInteractions: inWindow.length,
        };
    }

    /**
     * Detect trend by comparing windows
     */
    private detectTrend(windows: ReciprocityWindows): {
        trend: 'improving' | 'stable' | 'declining';
        trendMagnitude: 'slight' | 'moderate' | 'significant';
    } {
        // Need enough data in both windows
        if (windows.last30Days.totalInteractions < 2 || windows.last90Days.totalInteractions < 3) {
            return { trend: 'stable', trendMagnitude: 'slight' };
        }

        // For reciprocity, "improving" means moving toward 0.5 (balance)
        const current30 = windows.last30Days.ratio;
        const longer90 = windows.last90Days.ratio;

        const distanceFromBalance30 = Math.abs(current30 - 0.5);
        const distanceFromBalance90 = Math.abs(longer90 - 0.5);
        const improvement = distanceFromBalance90 - distanceFromBalance30;

        let trend: 'improving' | 'stable' | 'declining';
        let trendMagnitude: 'slight' | 'moderate' | 'significant';

        if (improvement > 0.1) {
            trend = 'improving';
        } else if (improvement < -0.1) {
            trend = 'declining';
        } else {
            trend = 'stable';
        }

        const absChange = Math.abs(improvement);
        if (absChange > 0.2) {
            trendMagnitude = 'significant';
        } else if (absChange > 0.1) {
            trendMagnitude = 'moderate';
        } else {
            trendMagnitude = 'slight';
        }

        return { trend, trendMagnitude };
    }

    /**
     * Detect actionable flags
     */
    private detectFlags(ratio: number, windows: ReciprocityWindows): ReciprocityFlags {
        // One person carrying if > 75% one direction
        const onePersonCarrying = ratio < 0.25 || ratio > 0.75;

        // Recent shift if 30-day differs from 90-day by 0.15+
        const recentShift =
            windows.last30Days.totalInteractions >= 2 &&
            windows.last90Days.totalInteractions >= 3 &&
            Math.abs(windows.last30Days.ratio - windows.last90Days.ratio) >= 0.15;

        // Healthy balance is 0.35-0.65 range
        const healthyBalance = ratio >= 0.35 && ratio <= 0.65;

        return { onePersonCarrying, recentShift, healthyBalance };
    }

    /**
     * Save snapshot to database
     */
    private async saveSnapshot(
        friendId: string,
        initiationRatio: number,
        windows: ReciprocityWindows,
        trend: string,
        trendMagnitude: string,
        flags: ReciprocityFlags
    ): Promise<void> {
        await database.write(async () => {
            await database.get<ReciprocitySnapshot>('reciprocity_snapshots').create((record: any) => {
                record._raw.friend_id = friendId;
                record._raw.calculated_at = Date.now();
                record._raw.initiation_ratio = initiationRatio;
                record._raw.windows_json = JSON.stringify(windows);
                record._raw.trend = trend;
                record._raw.trend_magnitude = trendMagnitude;
                record._raw.flags_json = JSON.stringify(flags);
            });
        });
    }

    /**
     * Get latest reciprocity snapshot for a friend
     */
    async getLatestReciprocity(friendId: string): Promise<ReciprocityAnalysis | null> {
        const snapshots = await database.get<ReciprocitySnapshot>('reciprocity_snapshots')
            .query(
                Q.where('friend_id', friendId),
                Q.sortBy('calculated_at', Q.desc),
                Q.take(1)
            ).fetch();

        const snapshot = snapshots[0];
        if (!snapshot) return null;

        return {
            friendId,
            calculatedAt: new Date(snapshot.calculatedAt),
            initiationRatio: snapshot.initiationRatio,
            windows: snapshot.windows!,
            trend: snapshot.trend as 'improving' | 'stable' | 'declining',
            trendMagnitude: snapshot.trendMagnitude as 'slight' | 'moderate' | 'significant',
            flags: snapshot.flags!,
        };
    }

    /**
     * Generate human-readable summary
     */
    generateSummary(analysis: ReciprocityAnalysis): string {
        const { initiationRatio, flags, trend } = analysis;

        let balance: string;
        if (initiationRatio > 0.65) {
            balance = "You tend to reach out more";
        } else if (initiationRatio < 0.35) {
            balance = "They tend to reach out more";
        } else {
            balance = "You both reach out fairly evenly";
        }

        if (trend === 'improving' && !flags.healthyBalance) {
            return `${balance}, but the balance has been improving lately.`;
        } else if (trend === 'declining' && flags.onePersonCarrying) {
            return `${balance}. This imbalance has been growing recently.`;
        } else if (flags.healthyBalance) {
            return `${balance} — a healthy, balanced dynamic.`;
        } else {
            return `${balance}.`;
        }
    }
}

export const reciprocityService = new ReciprocityService();
