import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import type UserProfile from '@/db/models/UserProfile';
import type SurfacingLogModel from '@/db/models/SurfacingLog';
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import type { TimingProfile } from '@/db/models/UserProfile';
import { getTimingWindowForDate } from './personal-timing';
import { TIMING_WINDOWS, type TimingWindow } from './types';

const APP_OPEN_HISTORY_KEY = '@weave:timing_profile_app_opens';
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
export const TIMING_PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_APP_OPEN_SAMPLES = 400;

export interface TimingWindowStats {
  appOpens: number;
  surfaced: number;
  acted: number;
  dismissed: number;
  actionRate: number;
  dismissalRate: number;
  score: number;
}

export interface TimingTelemetryEvent {
  eventType: string;
  timestamp: number;
  window?: string | null;
}

interface DeriveTimingProfileInput {
  appOpenTimestamps: number[];
  surfacingEvents: TimingTelemetryEvent[];
  now?: number;
}

function createEmptyWindowStats(): TimingWindowStats {
  return {
    appOpens: 0,
    surfaced: 0,
    acted: 0,
    dismissed: 0,
    actionRate: 0,
    dismissalRate: 0,
    score: 0,
  };
}

function isTimingWindow(value?: string | null): value is TimingWindow {
  return !!value && TIMING_WINDOWS.includes(value as TimingWindow);
}

function buildWindowStatsMap(): Record<TimingWindow, TimingWindowStats> {
  return Object.fromEntries(
    TIMING_WINDOWS.map(window => [window, createEmptyWindowStats()])
  ) as Record<TimingWindow, TimingWindowStats>;
}

async function getUserProfile(): Promise<UserProfile | null> {
  const profiles = await database.get<UserProfile>('user_profile').query().fetch();
  return profiles[0] || null;
}

async function loadAppOpenTelemetry(): Promise<number[]> {
  try {
    const value = await AsyncStorage.getItem(APP_OPEN_HISTORY_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((timestamp): timestamp is number => typeof timestamp === 'number')
      : [];
  } catch {
    return [];
  }
}

async function saveAppOpenTelemetry(samples: number[]): Promise<void> {
  await AsyncStorage.setItem(APP_OPEN_HISTORY_KEY, JSON.stringify(samples));
}

export function trimAppOpenTelemetry(
  samples: number[],
  now: number = Date.now()
): number[] {
  const cutoff = now - LOOKBACK_MS;
  return samples
    .filter(timestamp => typeof timestamp === 'number' && timestamp >= cutoff)
    .slice(-MAX_APP_OPEN_SAMPLES);
}

export function deriveTimingProfile({
  appOpenTimestamps,
  surfacingEvents,
  now = Date.now(),
}: DeriveTimingProfileInput): TimingProfile {
  const cutoff = now - LOOKBACK_MS;
  const trimmedAppOpens = trimAppOpenTelemetry(appOpenTimestamps, now);
  const relevantEvents = surfacingEvents.filter(event => event.timestamp >= cutoff && isTimingWindow(event.window));
  const statsByWindow = buildWindowStatsMap();

  trimmedAppOpens.forEach(timestamp => {
    const window = getTimingWindowForDate(new Date(timestamp));
    statsByWindow[window].appOpens += 1;
  });

  relevantEvents.forEach(event => {
    const window = event.window as TimingWindow;
    const stats = statsByWindow[window];

    if (event.eventType === 'surfaced') {
      stats.surfaced += 1;
    } else if (event.eventType === 'acted') {
      stats.acted += 1;
    } else if (event.eventType === 'dismissed') {
      stats.dismissed += 1;
    }
  });

  const scoredWindows = TIMING_WINDOWS.map(window => {
    const stats = statsByWindow[window];
    const actionRate = stats.surfaced > 0 ? stats.acted / stats.surfaced : 0;
    const dismissalRate = stats.surfaced > 0 ? stats.dismissed / stats.surfaced : 0;
    const appOpenSupport = Math.min(stats.appOpens, 10) * 0.6;
    const surfacedSupport = Math.min(stats.surfaced, 6) * 0.35;
    const unresolvedPenalty = Math.max(0, stats.surfaced - stats.acted - stats.dismissed) * 0.25;
    const score = (actionRate * 10) + appOpenSupport + surfacedSupport - (dismissalRate * 6) - unresolvedPenalty;

    stats.actionRate = Number(actionRate.toFixed(2));
    stats.dismissalRate = Number(dismissalRate.toFixed(2));
    stats.score = Number(score.toFixed(2));

    return {
      window,
      stats,
    };
  });

  const deadZones = scoredWindows
    .filter(({ stats }) => stats.surfaced >= 3 && stats.acted === 0 && stats.dismissalRate >= 0.5)
    .map(({ window }) => window);

  let peakWindows = scoredWindows
    .filter(({ stats, window }) => stats.score >= 2.5 && !deadZones.includes(window))
    .sort((left, right) => right.stats.score - left.stats.score)
    .map(({ window }) => window)
    .slice(0, 2);

  if (peakWindows.length === 0) {
    peakWindows = scoredWindows
      .filter(({ window }) => !deadZones.includes(window))
      .sort((left, right) => right.stats.appOpens - left.stats.appOpens)
      .map(({ window }) => window)
      .slice(0, 2);
  }

  const latestRelevantEvent = [...relevantEvents]
    .sort((left, right) => right.timestamp - left.timestamp)[0];

  return {
    preferredWindows: peakWindows,
    peakEngagementWindows: peakWindows,
    deadZones,
    bestResponseWindow: peakWindows[0],
    recentSurfaceWindow: latestRelevantEvent?.window || undefined,
    learnedAt: now,
    sampleSize: trimmedAppOpens.length + relevantEvents.length,
    source: 'telemetry',
    windowStats: Object.fromEntries(
      scoredWindows.map(({ window, stats }) => [window, stats])
    ),
  };
}

async function persistTimingProfile(profile: UserProfile, timingProfile: TimingProfile): Promise<void> {
  const serialized = JSON.stringify(timingProfile);

  if (profile.timingProfileJSON === serialized) {
    return;
  }

  await database.write(async () => {
    await profile.update(record => {
      record.timingProfileJSON = serialized;
      record.updatedAt = new Date();
    });
  });
}

async function recomputeTimingProfile(now: number = Date.now()): Promise<TimingProfile | null> {
  const profile = await getUserProfile();
  if (!profile) {
    return null;
  }

  const appOpenTimestamps = trimAppOpenTelemetry(await loadAppOpenTelemetry(), now);
  const surfacingEvents = await database.get<SurfacingLogModel>('surfacing_log')
    .query(Q.where('timestamp', Q.gte(now - LOOKBACK_MS)))
    .fetch();

  const timingProfile = deriveTimingProfile({
    appOpenTimestamps,
    surfacingEvents: surfacingEvents.map(event => ({
      eventType: event.eventType,
      timestamp: event.timestamp,
      window: event.window,
    })),
    now,
  });

  await persistTimingProfile(profile, timingProfile);
  return timingProfile;
}

async function recordAppOpen(timestamp: number = Date.now()): Promise<void> {
  const appOpenSamples = await loadAppOpenTelemetry();
  const trimmedSamples = trimAppOpenTelemetry([...appOpenSamples, timestamp], timestamp);
  await saveAppOpenTelemetry(trimmedSamples);
}

async function recomputeIfStale(
  now: number = Date.now(),
  maxAgeMs: number = TIMING_PROFILE_STALE_MS
): Promise<TimingProfile | null> {
  const profile = await getUserProfile();
  const learnedAt = profile?.timingProfile?.learnedAt;

  if (typeof learnedAt === 'number' && now - learnedAt < maxAgeMs) {
    return null;
  }

  try {
    return await recomputeTimingProfile(now);
  } catch (error) {
    Logger.error('[TimingProfile] Failed to recompute timing profile', error);
    return null;
  }
}

export const TimingProfileService = {
  recordAppOpen,
  recomputeTimingProfile,
  recomputeIfStale,
};
