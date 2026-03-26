import type { Opportunity } from '../types';
import type {
  SelectorSignals,
  SuppressionReason,
  SuppressionResult,
} from './score-types';
import { toLookupSet } from './score-types';

const CRITICAL_OVERRIDE_URGENCY = 85;

function resolveExpiryTimestamp(opportunity: Opportunity): number | null {
  const candidates = [
    opportunity.timeRelevance.expiresAt,
    opportunity.timeRelevance.deadlineAt,
  ].filter((value): value is number => typeof value === 'number');

  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function getSuppressionReasons(
  opportunity: Opportunity,
  signals: SelectorSignals
): SuppressionReason[] {
  const reasons: SuppressionReason[] = [];
  const plannedFriendIds = toLookupSet(signals.plannedFriendIds);
  const matchedCalendarFriendIds = toLookupSet(signals.matchedCalendarFriendIds);
  const recentlyInteractedFriendIds = toLookupSet(signals.recentlyInteractedFriendIds);
  const snoozedOpportunityIds = toLookupSet(signals.snoozedOpportunityIds);
  const suppressedFriendIds = toLookupSet(signals.suppressedFriendIds);
  const isCriticalOverride = opportunity.urgency > CRITICAL_OVERRIDE_URGENCY;
  const friendId = opportunity.friendId;

  if (friendId && (plannedFriendIds.has(friendId) || matchedCalendarFriendIds.has(friendId))) {
    reasons.push('already_planned');
  }

  if (friendId && recentlyInteractedFriendIds.has(friendId) && !isCriticalOverride) {
    reasons.push('just_interacted');
  }

  if (snoozedOpportunityIds.has(opportunity.id)) {
    reasons.push('dismissed_or_snoozed');
  }

  const expiresAt = resolveExpiryTimestamp(opportunity);
  if (expiresAt !== null && expiresAt <= signals.now) {
    reasons.push('expired');
  }

  if (signals.quietHoursActive) {
    reasons.push('quiet_hours');
  }

  if (friendId && suppressedFriendIds.has(friendId) && !isCriticalOverride) {
    reasons.push('suppressed_friend');
  }

  return reasons;
}

export function isOpportunitySuppressed(
  opportunity: Opportunity,
  signals: SelectorSignals
): boolean {
  return getSuppressionReasons(opportunity, signals).length > 0;
}

export function evaluateOpportunitySuppressors(
  opportunities: Opportunity[],
  signals: SelectorSignals
): SuppressionResult<Opportunity>[] {
  return opportunities.map(opportunity => ({
    opportunity,
    reasons: getSuppressionReasons(opportunity, signals),
  }));
}

export function filterSuppressedOpportunities(
  opportunities: Opportunity[],
  signals: SelectorSignals
): Opportunity[] {
  return opportunities.filter(opportunity => !isOpportunitySuppressed(opportunity, signals));
}
