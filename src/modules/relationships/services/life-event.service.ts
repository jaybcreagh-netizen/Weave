// src/modules/relationships/services/life-event.service.ts
import type LifeEvent from '@/db/models/LifeEvent';

export function isUpcoming(lifeEvent: LifeEvent): boolean {
  const now = Date.now();
  const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
  const eventTime = lifeEvent.eventDate.getTime();
  return eventTime > now && eventTime <= thirtyDaysFromNow;
}

export function daysUntil(lifeEvent: LifeEvent): number {
  const now = Date.now();
  const eventTime = lifeEvent.eventDate.getTime();
  const diffMs = eventTime - now;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function isPast(lifeEvent: LifeEvent): boolean {
  return lifeEvent.eventDate.getTime() < Date.now();
}

export function needsFollowUp(lifeEvent: LifeEvent): boolean {
  if (!isPast(lifeEvent)) return false;
  const daysSince = Math.abs(daysUntil(lifeEvent));
  return daysSince <= 7;
}
