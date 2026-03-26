import type UserProfile from '@/db/models/UserProfile';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { SuggestionCandidateService } from '../suggestion-system/SuggestionCandidateService';
import { SuggestionDataLoader } from '../suggestion-system/SuggestionDataLoader';
import Logger from '@/shared/utils/Logger';
import { synthesizeNativeOpportunities } from './OpportunitySynthesisService';
import { OpportunityPoolService } from './OpportunityPoolService';
import { TimingProfileService } from './TimingProfileService';

const DEFAULT_POOL_STALE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_REFRESH_DEBOUNCE_MS = 1500;

type SubscriptionHandle = { unsubscribe: () => void };
type SnapshotMap = Map<string, string>;
type FriendSnapshotMap = Map<string, { fingerprint: string; friendId?: string }>;

async function getUserProfile(): Promise<UserProfile | null> {
  const profiles = await database.get<UserProfile>('user_profile').query().fetch();
  return profiles[0] || null;
}

async function updateUserProfileRefreshState(
  updates: Partial<{
    lastPoolRefresh: number;
    poolRefreshStateJSON: string;
    calendarPermissionGranted: boolean;
    lastAppOpen: number;
  }>
): Promise<void> {
  const profile = await getUserProfile();
  if (!profile) {
    return;
  }

  await database.write(async () => {
    await profile.update(record => {
      if (updates.lastPoolRefresh !== undefined) {
        record.lastPoolRefresh = updates.lastPoolRefresh;
      }
      if (updates.poolRefreshStateJSON !== undefined) {
        record.poolRefreshStateJSON = updates.poolRefreshStateJSON;
      }
      if (updates.calendarPermissionGranted !== undefined) {
        record.calendarPermissionGranted = updates.calendarPermissionGranted;
      }
      if (updates.lastAppOpen !== undefined) {
        record.lastAppOpen = updates.lastAppOpen;
      }
      record.updatedAt = new Date();
    });
  });
}

function buildSnapshotMap(
  rows: Array<{ id: string; _raw?: Record<string, unknown> }>
): SnapshotMap {
  return new Map(
    rows.map(row => [row.id, JSON.stringify(row._raw || {})])
  );
}

function buildFriendSnapshotMap(
  rows: Array<{ id: string; _raw?: Record<string, unknown> }>,
  getFriendId: (row: any) => string | undefined
): FriendSnapshotMap {
  return new Map(
    rows.map(row => [
      row.id,
      {
        fingerprint: JSON.stringify(row._raw || {}),
        friendId: getFriendId(row),
      },
    ])
  );
}

function collectChangedParentIds(previous: SnapshotMap, next: SnapshotMap): string[] {
  const changedIds = new Set<string>();

  for (const [id, fingerprint] of next.entries()) {
    if (previous.get(id) !== fingerprint) {
      changedIds.add(id);
    }
  }

  return Array.from(changedIds);
}

function collectChangedFriendIds(previous: FriendSnapshotMap, next: FriendSnapshotMap): string[] {
  const friendIds = new Set<string>();

  for (const [id, snapshot] of next.entries()) {
    const previousSnapshot = previous.get(id);
    if (!previousSnapshot || previousSnapshot.fingerprint !== snapshot.fingerprint) {
      if (snapshot.friendId) {
        friendIds.add(snapshot.friendId);
      }
    }
  }

  for (const [id, snapshot] of previous.entries()) {
    if (!next.has(id) && snapshot.friendId) {
      friendIds.add(snapshot.friendId);
    }
  }

  return Array.from(friendIds);
}

async function loadFriendIdsForParentChanges(
  linkTable: string,
  parentColumn: string,
  parentIds: string[]
): Promise<string[]> {
  if (parentIds.length === 0) {
    return [];
  }

  const rows = await database.get<any>(linkTable)
    .query(Q.where(parentColumn, Q.oneOf(parentIds)))
    .fetch();

  return Array.from(new Set(
    rows
      .map((row: { friendId?: string }) => row.friendId)
      .filter((friendId): friendId is string => !!friendId)
  ));
}

class OpportunityRefreshServiceClass {
  private subscriptions: SubscriptionHandle[] = [];
  private scheduledReason: string | null = null;
  private scheduledFriendIds = new Set<string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRefresh: Promise<number> | null = null;

  private async runRefresh(friendIds: string[] | null, reason: string): Promise<number> {
    const isFullRefresh = !friendIds || friendIds.length === 0;
    const targetFriendIds = friendIds && friendIds.length > 0
      ? Array.from(new Set(friendIds))
      : await SuggestionCandidateService.getCandidates(50);

    const refreshTimestamp = Date.now();
    const contextMap = await SuggestionDataLoader.loadContextForCandidates(targetFriendIds);
    const opportunities = await synthesizeNativeOpportunities({
      contextMap,
      now: new Date(refreshTimestamp),
    });

    const upsertStats = await OpportunityPoolService.upsertRefreshedFriendSet(
      targetFriendIds,
      opportunities
    );
    const deactivatedOutsideCount = isFullRefresh
      ? await OpportunityPoolService.deactivateRowsOutsideFriendIds(targetFriendIds)
      : 0;
    const expiredCount = await OpportunityPoolService.cleanupExpiredRows(refreshTimestamp);

    await updateUserProfileRefreshState({
      lastPoolRefresh: refreshTimestamp,
      poolRefreshStateJSON: JSON.stringify({
        lastReason: reason,
        lastRefreshedFriendIds: targetFriendIds.slice(0, 50),
        lastRefreshCount: opportunities.length,
        ...upsertStats,
        refreshedAt: refreshTimestamp,
        deactivatedOutsideCount,
        expiredCount,
      }),
    });

    Logger.info('[OpportunityRefresh] Pool refreshed', {
      reason,
      friendCount: targetFriendIds.length,
      opportunityCount: opportunities.length,
      ...upsertStats,
      deactivatedOutsideCount,
      expiredCount,
    });

    return opportunities.length;
  }

  private async queueAwareRefresh(friendIds: string[] | null, reason: string): Promise<number> {
    if (this.currentRefresh) {
      await this.currentRefresh;
    }

    const refreshPromise = this.runRefresh(friendIds, reason);
    this.currentRefresh = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      if (this.currentRefresh === refreshPromise) {
        this.currentRefresh = null;
      }
    }
  }

  async refreshAll(reason: string = 'manual'): Promise<number> {
    return this.queueAwareRefresh(null, reason);
  }

  async refreshForFriends(friendIds: string[], reason: string = 'manual'): Promise<number> {
    if (friendIds.length === 0) {
      return 0;
    }

    return this.queueAwareRefresh(friendIds, reason);
  }

  async refreshIfStale(
    reason: string = 'stale_check',
    maxAgeMs: number = DEFAULT_POOL_STALE_MS
  ): Promise<number> {
    const profile = await getUserProfile();
    const lastPoolRefresh = profile?.lastPoolRefresh;

    if (!lastPoolRefresh || Date.now() - lastPoolRefresh > maxAgeMs) {
      return this.refreshAll(reason);
    }

    await OpportunityPoolService.cleanupExpiredRows();
    return 0;
  }

  scheduleRefreshAll(reason: string, delayMs: number = DEFAULT_REFRESH_DEBOUNCE_MS) {
    this.scheduledReason = reason;
    this.scheduledFriendIds.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const scheduledReason = this.scheduledReason || reason;
      this.scheduledReason = null;
      this.debounceTimer = null;
      this.refreshAll(scheduledReason).catch(error => {
        Logger.error('[OpportunityRefresh] Scheduled full refresh failed', error);
      });
    }, delayMs);
  }

  scheduleRefreshForFriends(
    friendIds: string[],
    reason: string,
    delayMs: number = DEFAULT_REFRESH_DEBOUNCE_MS
  ) {
    friendIds.forEach(friendId => this.scheduledFriendIds.add(friendId));
    this.scheduledReason = reason;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const scheduledFriendIds = Array.from(this.scheduledFriendIds);
      const scheduledReason = this.scheduledReason || reason;
      this.scheduledFriendIds.clear();
      this.scheduledReason = null;
      this.debounceTimer = null;

      this.refreshForFriends(scheduledFriendIds, scheduledReason).catch(error => {
        Logger.error('[OpportunityRefresh] Scheduled friend refresh failed', error);
      });
    }, delayMs);
  }

  async recordAppForeground(timestamp: number = Date.now()): Promise<void> {
    await updateUserProfileRefreshState({ lastAppOpen: timestamp });
    await TimingProfileService.recordAppOpen(timestamp);
    await TimingProfileService.recomputeIfStale(timestamp);
  }

  async updateCalendarPermissionState(granted: boolean): Promise<void> {
    await updateUserProfileRefreshState({ calendarPermissionGranted: granted });
  }

  startInvalidationSubscriptions(): () => void {
    if (this.subscriptions.length > 0) {
      return () => this.stopInvalidationSubscriptions();
    }

    const directFriendTables: Array<{
      table: string;
      reason: string;
      getFriendId: (row: any) => string | undefined;
    }> = [
      { table: 'friends', reason: 'friends_changed', getFriendId: row => row.id },
      { table: 'interaction_friends', reason: 'interaction_links_changed', getFriendId: row => row.friendId },
      { table: 'intention_friends', reason: 'intention_links_changed', getFriendId: row => row.friendId },
      { table: 'life_events', reason: 'life_events_changed', getFriendId: row => row.friendId },
      { table: 'journal_entry_friends', reason: 'journal_entry_links_changed', getFriendId: row => row.friendId },
      { table: 'conversation_threads', reason: 'conversation_threads_changed', getFriendId: row => row.friendId },
    ];

    const linkedParentTables: Array<{
      table: string;
      reason: string;
      linkTable: string;
      parentColumn: string;
    }> = [
      {
        table: 'interactions',
        reason: 'plans_changed',
        linkTable: 'interaction_friends',
        parentColumn: 'interaction_id',
      },
      {
        table: 'intentions',
        reason: 'intentions_changed',
        linkTable: 'intention_friends',
        parentColumn: 'intention_id',
      },
      {
        table: 'journal_entries',
        reason: 'journal_entries_changed',
        linkTable: 'journal_entry_friends',
        parentColumn: 'journal_entry_id',
      },
    ];

    this.subscriptions = directFriendTables.map(({ table, reason, getFriendId }) => {
      let snapshot = new Map<string, { fingerprint: string; friendId?: string }>();
      let initialized = false;

      return database.get(table).query().observe().subscribe({
        next: rows => {
          const nextSnapshot = buildFriendSnapshotMap(rows as any[], getFriendId);
          if (!initialized) {
            snapshot = nextSnapshot;
            initialized = true;
            return;
          }

          const changedFriendIds = collectChangedFriendIds(snapshot, nextSnapshot);
          snapshot = nextSnapshot;

          if (changedFriendIds.length > 0) {
            this.scheduleRefreshForFriends(changedFriendIds, reason);
          }
        },
        error: error => Logger.error(`[OpportunityRefresh] ${table} observer failed`, error),
      });
    });

    this.subscriptions.push(
      ...linkedParentTables.map(({ table, reason, linkTable, parentColumn }) => {
        let snapshot = new Map<string, string>();
        let initialized = false;

        return database.get(table).query().observe().subscribe({
          next: rows => {
            const nextSnapshot = buildSnapshotMap(rows as any[]);
            if (!initialized) {
              snapshot = nextSnapshot;
              initialized = true;
              return;
            }

            const changedParentIds = collectChangedParentIds(snapshot, nextSnapshot);
            snapshot = nextSnapshot;

            if (changedParentIds.length === 0) {
              return;
            }

            loadFriendIdsForParentChanges(linkTable, parentColumn, changedParentIds)
              .then(friendIds => {
                if (friendIds.length > 0) {
                  this.scheduleRefreshForFriends(friendIds, reason);
                }
              })
              .catch(error => {
                Logger.error(`[OpportunityRefresh] ${table} link lookup failed`, error);
                this.scheduleRefreshAll(reason);
              });
          },
          error: error => Logger.error(`[OpportunityRefresh] ${table} observer failed`, error),
        });
      })
    );

    let lastProfileFingerprint: string | null = null;
    const profileSubscription = database
      .get<UserProfile>('user_profile')
      .query()
      .observe()
      .subscribe({
        next: profiles => {
          const profile = profiles[0];
          const fingerprint = JSON.stringify({
            currentSocialSeason: profile?.currentSocialSeason || null,
            socialBatteryCurrent: profile?.socialBatteryCurrent ?? null,
            suggestionFrequency: profile?.suggestionFrequency || null,
            preferredSuggestionWindowsJSON: profile?.preferredSuggestionWindowsJSON || null,
            timingProfileJSON: profile?.timingProfileJSON || null,
            calendarPermissionGranted: profile?.calendarPermissionGranted ?? null,
          });

          if (lastProfileFingerprint === null) {
            lastProfileFingerprint = fingerprint;
            return;
          }

          if (fingerprint !== lastProfileFingerprint) {
            lastProfileFingerprint = fingerprint;
            this.scheduleRefreshAll('profile_relevance_changed');
          }
        },
        error: error => Logger.error('[OpportunityRefresh] user_profile observer failed', error),
      });
    this.subscriptions.push(profileSubscription);

    return () => this.stopInvalidationSubscriptions();
  }

  stopInvalidationSubscriptions() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions = [];
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.scheduledReason = null;
    this.scheduledFriendIds.clear();
  }
}

export const OpportunityRefreshService = new OpportunityRefreshServiceClass();
