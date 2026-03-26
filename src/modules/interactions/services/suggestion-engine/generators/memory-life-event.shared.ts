import { Q } from '@nozbe/watermelondb';
import type FriendMemory from '@/db/models/FriendMemory';
import type LifeEvent from '@/db/models/LifeEvent';
import type { Suggestion } from '@/shared/types/common';
import type { Tier } from '@/shared/types/common';
import { buildLifeEventPrefillFromMemory } from '@/modules/relationships/services/memory-life-event.service';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';
import type { Opportunity, OpportunitySuggestionPayload } from '../../opportunity-system/types';

const LIFE_EVENT_DATE_DUPLICATE_WINDOW_DAYS = 14;

export interface MemoryLifeEventFriend {
  id: string;
  name: string;
  dunbarTier?: Tier;
}

function tokenSimilarity(a: string, b: string): number {
  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 1);

  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  aTokens.forEach(token => {
    if (bTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(aTokens.size, bTokens.size);
}

function getLifeEventUrgencyScore(eventDate?: string): number {
  if (!eventDate) return 50;
  const parsed = new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return 50;

  const daysUntil = Math.floor((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysUntil <= 1) return 76;
  if (daysUntil <= 10) return 50;
  return 25;
}

function buildLifeEventPrompt(
  friendName: string,
  prefill: ReturnType<typeof buildLifeEventPrefillFromMemory>
): string {
  if (!prefill) return `Help me add a life event for ${friendName}.`;
  const parts = [
    `Help me add a life event for ${friendName}.`,
    prefill.title ? `Title: ${prefill.title}.` : '',
    prefill.notes ? `Notes: ${prefill.notes}.` : '',
    prefill.eventDate ? `Date: ${prefill.eventDate}.` : '',
  ].filter(Boolean);
  return parts.join(' ');
}

function buildBaseOpportunity(
  friend: MemoryLifeEventFriend,
  opportunityId: string,
  title: string,
  subtitle: string,
  actionLabel: string,
  urgency: number,
  action: Suggestion['action'],
  suggestionPayload: OpportunitySuggestionPayload
): Opportunity {
  const deadlineAt = action.lifeEventDate ? new Date(action.lifeEventDate).getTime() : undefined;

  return {
    id: opportunityId,
    friendId: friend.id,
    friendName: friend.name,
    friendTier: friend.dunbarTier,
    category: 'life-event',
    generatorSource: 'memory-life-event-generator',
    urgency,
    confidence: 0.86,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 20,
    explanation: {
      whyNow: subtitle,
      whyThisFriend: `${friend.name} has a milestone or upcoming event captured in your memory notes.`,
      whyThisAction: action.lifeEventId
        ? 'Reviewing the existing life event is the safest next step before creating anything new.'
        : 'Turning the note into a structured life event will keep it visible at the right moment.',
    },
    timeRelevance: {
      bestWindow: deadlineAt ? 'afternoon' : 'midday',
      deadlineAt,
    },
    copyContext: {
      recentInteractionCategory: 'celebration',
    },
    presentationCopy: {
      title,
      subtitle,
      actionLabel,
      reason: subtitle,
      aiEnriched: false,
    },
    suggestionPayload,
    createdAt: Date.now(),
  };
}

export async function generateMemoryLifeEventOpportunities(
  friends: MemoryLifeEventFriend[]
): Promise<Opportunity[]> {
  if (!friends.length) return [];

  const friendIds = friends.map(friend => friend.id);
  const friendLookup = new Map(friends.map(friend => [friend.id, friend]));
  const memoryCollection = getOptionalQueryCollection<FriendMemory>('friend_memories');
  const lifeEventsCollection = getOptionalQueryCollection<LifeEvent>('life_events');
  if (!memoryCollection || !lifeEventsCollection) return [];

  const [memories, existingLifeEvents] = await Promise.all([
    memoryCollection
      .query(
        Q.where('friend_id', Q.oneOf(friendIds)),
        Q.where('is_archived', false),
        Q.where('type', Q.oneOf(['upcoming', 'milestone'])),
        Q.sortBy('updated_at', Q.desc),
      )
      .fetch(),
    lifeEventsCollection
      .query(
        Q.where('friend_id', Q.oneOf(friendIds)),
        Q.sortBy('event_date', Q.desc),
        Q.take(400),
      )
      .fetch(),
  ]);

  const existingLifeEventsByFriend = new Map<string, LifeEvent[]>();
  existingLifeEvents.forEach(event => {
    const friendEvents = existingLifeEventsByFriend.get(event.friendId) || [];
    friendEvents.push(event);
    existingLifeEventsByFriend.set(event.friendId, friendEvents);
  });

  const opportunities: Opportunity[] = [];
  const seenFriendIds = new Set<string>();

  for (const memory of memories) {
    if (seenFriendIds.has(memory.friendId)) continue;

    const friend = friendLookup.get(memory.friendId);
    if (!friend) continue;

    const prefill = buildLifeEventPrefillFromMemory({
      type: memory.type,
      title: memory.title,
      content: memory.content,
      effectiveDate: memory.effectiveDate,
    });
    if (!prefill) continue;

    const candidateDateMs = prefill.eventDate ? new Date(prefill.eventDate).getTime() : NaN;
    const friendLifeEvents = existingLifeEventsByFriend.get(memory.friendId) || [];
    const duplicateLifeEvent = friendLifeEvents.find(existing => {
      const typeMatch = !prefill.eventType || existing.eventType === prefill.eventType;
      if (!typeMatch) return false;

      const titleSimilarity = tokenSimilarity(existing.title || '', prefill.title || memory.title || '');
      const notesSimilarity = tokenSimilarity(existing.notes || '', prefill.notes || memory.content || '');

      if (!Number.isNaN(candidateDateMs)) {
        const existingDateMs = existing.eventDate?.getTime?.() || NaN;
        if (!Number.isNaN(existingDateMs)) {
          const deltaDays = Math.abs(existingDateMs - candidateDateMs) / (1000 * 60 * 60 * 24);
          if (deltaDays <= LIFE_EVENT_DATE_DUPLICATE_WINDOW_DAYS && (titleSimilarity >= 0.55 || notesSimilarity >= 0.62)) {
            return true;
          }
        }
      }

      return titleSimilarity >= 0.82 || (titleSimilarity >= 0.55 && notesSimilarity >= 0.7);
    });

    if (duplicateLifeEvent) {
      opportunities.push(
        buildBaseOpportunity(
          friend,
          `memory-life-event-review-${memory.id}-${duplicateLifeEvent.id}`,
          `Review ${friend.name}'s life event`,
          `You already logged "${duplicateLifeEvent.title}". Update it if this note adds new details.`,
          'Review Life Event',
          getLifeEventUrgencyScore(
            duplicateLifeEvent.eventDate ? duplicateLifeEvent.eventDate.toISOString() : undefined,
          ),
          {
            type: 'life-event',
            prefillPrompt: `Review the life event for ${friend.name} and update anything that changed.`,
            lifeEventId: duplicateLifeEvent.id,
            lifeEventType: duplicateLifeEvent.eventType,
            lifeEventTitle: duplicateLifeEvent.title,
            lifeEventNotes: duplicateLifeEvent.notes || prefill.notes,
            lifeEventDate: duplicateLifeEvent.eventDate
              ? duplicateLifeEvent.eventDate.toISOString()
              : prefill.eventDate,
          },
          {
            type: 'celebrate',
            icon: 'ClipboardCheck',
            dismissible: true,
            action: {
              type: 'life-event',
              prefillPrompt: `Review the life event for ${friend.name} and update anything that changed.`,
              lifeEventId: duplicateLifeEvent.id,
              lifeEventType: duplicateLifeEvent.eventType,
              lifeEventTitle: duplicateLifeEvent.title,
              lifeEventNotes: duplicateLifeEvent.notes || prefill.notes,
              lifeEventDate: duplicateLifeEvent.eventDate
                ? duplicateLifeEvent.eventDate.toISOString()
                : prefill.eventDate,
            },
          },
        )
      );

      seenFriendIds.add(friend.id);
      if (opportunities.length >= 2) break;
      continue;
    }

    const dateLabel = prefill.eventDate
      ? new Date(prefill.eventDate).toLocaleDateString()
      : null;
    const subtitle = dateLabel
      ? `You noted "${memory.title}" for ${dateLabel}. Save it as a life event so it stays visible.`
      : `You noted "${memory.title}". Save it as a life event so it stays visible.`;
    const action: Suggestion['action'] = {
      type: 'life-event',
      prefillPrompt: buildLifeEventPrompt(friend.name, prefill),
      lifeEventType: prefill.eventType,
      lifeEventTitle: prefill.title,
      lifeEventNotes: prefill.notes,
      lifeEventDate: prefill.eventDate,
    };

    opportunities.push(
      buildBaseOpportunity(
        friend,
        `memory-life-event-${memory.id}`,
        `Capture a milestone for ${friend.name}`,
        subtitle,
        'Add Life Event',
        getLifeEventUrgencyScore(prefill.eventDate),
        action,
        {
          type: 'celebrate',
          icon: 'Gift',
          dismissible: true,
          action,
        },
      )
    );

    seenFriendIds.add(friend.id);
    if (opportunities.length >= 2) break;
  }

  return opportunities;
}
