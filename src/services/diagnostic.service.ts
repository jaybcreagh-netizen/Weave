import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Friend from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';

export interface DiagnosticIssue {
    type: 'orphan_interaction' | 'orphan_badge' | 'orphan_life_event' | 'invalid_date' | 'invalid_tier' | 'invalid_archetype' | 'duplicate_singleton';
    table: string;
    id: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    payload?: any;
}

export interface DiagnosticReport {
    timestamp: number;
    issues: DiagnosticIssue[];
    totalIssues: number;
    scanDurationMs: number;
}

const VALID_TIERS = ['InnerCircle', 'CloseFriends', 'Community', 'Acquaintance'];
const VALID_ARCHETYPES = ['Sun', 'Hermit', 'Emperor', 'Fool', 'Empress', 'Magician', 'HighPriestess', 'Unknown', 'Lovers'];

export const DiagnosticService = {
    /**
     * Run a full health scan of the database
     */
    async runScan(): Promise<DiagnosticReport> {
        const startTime = Date.now();
        const issues: DiagnosticIssue[] = [];

        try {
            // 1. Check for Orphaned Interaction Links
            // An InteractionFriend record where the friend_id or interaction_id doesn't exist
            const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query().fetch();
            const allFriendIds = new Set((await database.get<Friend>('friends').query().fetch()).map(f => f.id));
            const allInteractionIds = new Set((await database.get('interactions').query().fetch()).map(i => i.id));

            for (const link of interactionFriends) {
                if (!allFriendIds.has(link.friendId)) {
                    issues.push({
                        type: 'orphan_interaction',
                        table: 'interaction_friends',
                        id: link.id,
                        description: `Link to non-existent friend ID: ${link.friendId}`,
                        severity: 'high',
                    });
                }
                if (!allInteractionIds.has(link.interactionId)) {
                    issues.push({
                        type: 'orphan_interaction',
                        table: 'interaction_friends',
                        id: link.id,
                        description: `Link to non-existent interaction ID: ${link.interactionId}`,
                        severity: 'medium',
                    });
                }
            }

            // 2. Check Friend Data Integrity
            const friends = await database.get<Friend>('friends').query().fetch();
            for (const friend of friends) {
                // defined manually to avoid circular dependency or import issues if constants aren't perfect
                if (!VALID_TIERS.includes(friend.dunbarTier)) {
                    // Some migrating data might use legacy names, check if critical
                    issues.push({
                        type: 'invalid_tier',
                        table: 'friends',
                        id: friend.id,
                        description: `Invalid Dunbar Tier: ${friend.dunbarTier}`,
                        severity: 'low',
                    });
                }

                if (!VALID_ARCHETYPES.includes(friend.archetype)) {
                    issues.push({
                        type: 'invalid_archetype',
                        table: 'friends',
                        id: friend.id,
                        description: `Invalid Archetype: ${friend.archetype}`,
                        severity: 'low',
                    });
                }

                // Check dates - allow MM-DD (standard) or YYYY-MM-DD (legacy/ISO)
                const validDateRegex = /^(\d{4}-)?\d{2}-\d{2}(T.*)?$/;

                if (friend.birthday && !validDateRegex.test(friend.birthday)) {
                    issues.push({
                        type: 'invalid_date',
                        table: 'friends',
                        id: friend.id,
                        description: `Invalid Birthday Format: ${friend.birthday} (Expected MM-DD or ISO)`,
                        severity: 'low',
                    });
                }

                if (friend.anniversary && !validDateRegex.test(friend.anniversary)) {
                    issues.push({
                        type: 'invalid_date',
                        table: 'friends',
                        id: friend.id,
                        description: `Invalid Anniversary Format: ${friend.anniversary} (Expected MM-DD or ISO)`,
                        severity: 'low',
                    });
                }
            }

            // 3. Check for singleton duplication
            const currentProgressCount = await database.get('user_progress').query().fetchCount();
            if (currentProgressCount > 1) {
                issues.push({
                    type: 'duplicate_singleton',
                    table: 'user_progress',
                    id: 'GLOBAL',
                    description: `Found ${currentProgressCount} user_progress records. Should be exactly 1.`,
                    severity: 'high',
                });
            }

            const currentProfileCount = await database.get('user_profile').query().fetchCount();
            if (currentProfileCount > 1) {
                issues.push({
                    type: 'duplicate_singleton',
                    table: 'user_profile',
                    id: 'GLOBAL',
                    description: `Found ${currentProfileCount} user_profile records. Should be exactly 1.`,
                    severity: 'high',
                });
            }


        } catch (error) {
            console.error('Diagnostic scan failed:', error);
            // We might want to add a special issue type for "scan_failed"
        }

        return {
            timestamp: Date.now(),
            issues,
            totalIssues: issues.length,
            scanDurationMs: Date.now() - startTime,
        };
    },

    /**
     * DANGER: Fix specific issues.
     * Currently only supports deleting invalid interaction links.
     */
    async fixOrphans(issues: DiagnosticIssue[]): Promise<number> {
        let fixedCount = 0;

        await database.write(async () => {
            for (const issue of issues) {
                if (issue.type === 'orphan_interaction' && issue.table === 'interaction_friends') {
                    try {
                        const record = await database.get('interaction_friends').find(issue.id);
                        await record.destroyPermanently();
                        fixedCount++;
                    } catch (e) {
                        console.warn(`Could not delete orphan ${issue.id}`, e);
                    }
                }
            }
        });

        return fixedCount;
    }
};
