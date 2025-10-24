# Suggestion Engine: Technical Implementation Plan

## Overview
This document outlines the exact technical steps, file structure, and code architecture for implementing the Suggestion Engine feature in Weave.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard                             │
│  ┌──────────┐                                                │
│  │ 🧵 Badge │ ──triggers──> InsightsSheet                    │
│  └──────────┘                    │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   useSuggestions()       │
                    │   (React Hook)           │
                    └──────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │  generateSuggestions()   │
                    │  (Core Engine)           │
                    └──────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌─────────┐    ┌─────────┐   ┌──────────┐
              │ Friends │    │  Scores │   │Archetypes│
              │  Data   │    │  Calc   │   │ Content  │
              └─────────┘    └─────────┘   └──────────┘
```

---

## File Structure

```
src/
├── lib/
│   ├── suggestion-engine.ts         # Core suggestion generation logic
│   ├── archetype-content.ts         # Archetype-aware text content
│   └── suggestion-storage.ts        # AsyncStorage persistence
│
├── hooks/
│   ├── useSuggestions.ts           # Main hook for dashboard
│   └── useFriendActionState.ts     # Hook for friend profile header
│
├── components/
│   ├── InsightsSheet.tsx           # Bottom sheet container
│   ├── SuggestionCard.tsx          # Individual suggestion card
│   ├── FriendActionHeader.tsx      # Profile header component
│   └── ThreadButton.tsx            # Header button with badge
│
└── types/
    └── suggestions.ts              # TypeScript interfaces
```

---

## Phase 1: Core Types & Infrastructure

### Step 1.1: Create Type Definitions

**File**: `src/types/suggestions.ts`

```typescript
import { Archetype, Tier } from './core';

export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type SuggestionCategory = 'drift' | 'maintain' | 'deepen' | 'celebrate' | 'reflect' | 'insight';
export type ActionType = 'log' | 'plan' | 'reflect';
export type InteractionCategory = 'text-call' | 'meal-drink' | 'hangout' | 'deep-talk' | 'activity-hobby' | 'event-party';

export interface SuggestionAction {
  type: ActionType;
  prefilledCategory?: InteractionCategory;
  prefilledMode?: 'quick-touch' | 'detailed';
  interactionId?: string; // For reflect actions
}

export interface Suggestion {
  id: string;
  friendId: string;
  friendName: string;
  urgency: Urgency;
  category: SuggestionCategory;

  // Display content
  title: string;
  subtitle: string;
  actionLabel: string;
  icon: string;

  // Behavior
  action: SuggestionAction;
  dismissible: boolean;

  // Meta
  createdAt: Date;
  expiresAt?: Date;
}

export interface SuggestionInput {
  friend: {
    id: string;
    name: string;
    archetype: Archetype;
    dunbarTier: Tier;
    createdAt: Date;
  };
  currentScore: number;
  lastInteractionDate?: Date;
  interactionCount: number;
  momentumScore: number;
  recentInteractions: Array<{
    id: string;
    category: InteractionCategory;
    interactionDate: Date;
    vibe?: string;
    notes?: string;
  }>;
}
```

---

### Step 1.2: Create Archetype Content Mappings

**File**: `src/lib/archetype-content.ts`

```typescript
import { Archetype } from '../types/core';
import { InteractionCategory } from '../types/suggestions';

export const ARCHETYPE_PREFERRED_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'The High Priestess': 'deep-talk',
  'The Adventurer': 'activity-hobby',
  'The Sun': 'event-party',
  'The Hermit': 'deep-talk',
  'The Magician': 'activity-hobby',
  'The Empress': 'meal-drink',
  'The Emperor': 'hangout',
};

export const ARCHETYPE_DRIFT_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'She values deep, meaningful conversations. Invite her for a one-on-one coffee to reconnect.',
  'The Adventurer': 'He loves shared experiences. Suggest a hike or trying something new together.',
  'The Sun': 'She thrives in joyful moments. Plan a fun hangout or celebrate something together.',
  'The Hermit': 'He appreciates quiet, intimate time. Reach out for a thoughtful conversation.',
  'The Magician': 'She values creativity and collaboration. Suggest working on a project or exploring ideas together.',
  'The Empress': 'She nurtures through presence. Share a meal or spend quality time together.',
  'The Emperor': 'He values loyalty and consistency. Show up and spend solid time together.',
};

export const ARCHETYPE_MOMENTUM_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'Deepen your conversations - she values insight and truth.',
  'The Adventurer': "Plan an adventure - he'd love to explore something new with you.",
  'The Sun': 'Celebrate this connection - create a joyful moment together.',
  'The Hermit': 'Create space for depth - he appreciates meaningful solitude with you.',
  'The Magician': 'Collaborate on something creative - she loves co-creating magic.',
  'The Empress': 'Nurture each other - share warmth and care.',
  'The Emperor': 'Build something together - he values purposeful connection.',
};

export function getArchetypePreferredCategory(archetype: Archetype): InteractionCategory {
  return ARCHETYPE_PREFERRED_CATEGORIES[archetype] || 'hangout';
}

export function getArchetypeDriftSuggestion(archetype: Archetype, name: string): string {
  const template = ARCHETYPE_DRIFT_SUGGESTIONS[archetype] || 'Reach out and reconnect.';
  return template.replace('She', name).replace('He', name).replace('she', name.toLowerCase()).replace('he', name.toLowerCase());
}

export function getArchetypeMomentumSuggestion(archetype: Archetype, name: string): string {
  const template = ARCHETYPE_MOMENTUM_SUGGESTIONS[archetype] || 'Keep nurturing this connection.';
  return template.replace('she', name.toLowerCase()).replace('he', name.toLowerCase());
}
```

---

### Step 1.3: Create Storage Utilities

**File**: `src/lib/suggestion-storage.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISSED_KEY = 'weave:suggestions:dismissed';
const LAST_SHOWN_KEY = 'weave:suggestions:lastShown';

export interface DismissedSuggestion {
  id: string;
  dismissedAt: number;
  cooldownDays: number;
}

export async function getDismissedSuggestions(): Promise<Map<string, DismissedSuggestion>> {
  try {
    const json = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!json) return new Map();

    const array: DismissedSuggestion[] = JSON.parse(json);
    const now = Date.now();

    // Filter out expired dismissals
    const active = array.filter(d => {
      const expiresAt = d.dismissedAt + (d.cooldownDays * 86400000);
      return now < expiresAt;
    });

    // Save cleaned list
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(active));

    return new Map(active.map(d => [d.id, d]));
  } catch (error) {
    console.error('Failed to get dismissed suggestions:', error);
    return new Map();
  }
}

export async function dismissSuggestion(id: string, cooldownDays: number): Promise<void> {
  try {
    const dismissed = await getDismissedSuggestions();
    dismissed.set(id, {
      id,
      dismissedAt: Date.now(),
      cooldownDays,
    });

    const array = Array.from(dismissed.values());
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(array));
  } catch (error) {
    console.error('Failed to dismiss suggestion:', error);
  }
}

export async function getLastShownTimestamp(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error('Failed to get last shown timestamp:', error);
    return 0;
  }
}

export async function setLastShownTimestamp(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, timestamp.toString());
  } catch (error) {
    console.error('Failed to set last shown timestamp:', error);
  }
}
```

---

## Phase 2: Core Suggestion Engine

### Step 2.1: Create Suggestion Generation Logic

**File**: `src/lib/suggestion-engine.ts`

```typescript
import { Suggestion, SuggestionInput } from '../types/suggestions';
import {
  getArchetypePreferredCategory,
  getArchetypeDriftSuggestion,
  getArchetypeMomentumSuggestion,
} from './archetype-content';

const COOLDOWN_DAYS = {
  'critical-drift': 1,
  'high-drift': 2,
  'first-weave': 2,
  'archetype-mismatch': 3,
  'momentum': 7,
  'maintenance': 3,
  'deepen': 7,
  'reflect': 2,
};

export function generateSuggestion(input: SuggestionInput): Suggestion | null {
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions } = input;

  // PRIORITY 1: Reflect on recent interaction
  const recentReflectSuggestion = checkReflectSuggestion(friend, recentInteractions);
  if (recentReflectSuggestion) return recentReflectSuggestion;

  // PRIORITY 2: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    return {
      id: `critical-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'critical',
      category: 'drift',
      title: `${friend.name} is drifting away`,
      subtitle: getArchetypeDriftSuggestion(friend.archetype, friend.name),
      actionLabel: 'Reach Out Now',
      icon: '🚨',
      action: {
        type: 'log',
        prefilledCategory: getArchetypePreferredCategory(friend.archetype),
        prefilledMode: 'detailed',
      },
      dismissible: false, // Too important to dismiss
      createdAt: new Date(),
    };
  }

  // PRIORITY 3: High drift (attention needed)
  const isHighDrift =
    (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
    (friend.dunbarTier === 'CloseFriends' && currentScore < 35);

  if (isHighDrift) {
    return {
      id: `high-drift-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'drift',
      title: `Time to reconnect with ${friend.name}`,
      subtitle: `Your connection is cooling. ${getArchetypeDriftSuggestion(friend.archetype, friend.name)}`,
      actionLabel: 'Plan a Weave',
      icon: '⚠️',
      action: {
        type: 'plan',
        prefilledCategory: getArchetypePreferredCategory(friend.archetype),
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 4: First weave (new friend)
  if (interactionCount === 0) {
    const daysSinceAdded = lastInteractionDate
      ? (Date.now() - friend.createdAt.getTime()) / 86400000
      : 999;

    if (daysSinceAdded >= 1) {
      return {
        id: `first-weave-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'maintain',
        title: `A new thread with ${friend.name}`,
        subtitle: 'Log your first weave to begin strengthening this connection.',
        actionLabel: 'Log First Weave',
        icon: '🧵',
        action: { type: 'log' },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  // PRIORITY 5: Archetype mismatch insight
  const archetypeMismatch = checkArchetypeMismatch(friend, recentInteractions);
  if (archetypeMismatch) return archetypeMismatch;

  // PRIORITY 6: Momentum opportunity
  if (currentScore > 60 && momentumScore > 10) {
    const daysSinceLast = lastInteractionDate
      ? (Date.now() - lastInteractionDate.getTime()) / 86400000
      : 999;

    if (daysSinceLast <= 7) {
      return {
        id: `momentum-${friend.id}`,
        friendId: friend.id,
        friendName: friend.name,
        urgency: 'medium',
        category: 'deepen',
        title: `You're connecting well with ${friend.name}`,
        subtitle: `Ride this momentum! ${getArchetypeMomentumSuggestion(friend.archetype, friend.name)}`,
        actionLabel: 'Deepen the Bond',
        icon: '🌟',
        action: {
          type: 'plan',
          prefilledCategory: getArchetypePreferredCategory(friend.archetype),
        },
        dismissible: true,
        createdAt: new Date(),
      };
    }
  }

  // PRIORITY 7: Maintenance
  const daysSinceInteraction = lastInteractionDate
    ? (Date.now() - lastInteractionDate.getTime()) / 86400000
    : 999;

  const maintenanceThreshold = {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier];

  if (currentScore >= 40 && currentScore <= 70 && daysSinceInteraction > maintenanceThreshold) {
    return {
      id: `maintenance-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'maintain',
      title: `Keep the thread warm with ${friend.name}`,
      subtitle: 'A simple text or voice note can maintain your connection.',
      actionLabel: 'Log Quick Weave',
      icon: '💛',
      action: {
        type: 'log',
        prefilledCategory: 'text-call',
        prefilledMode: 'quick-touch',
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  // PRIORITY 8: Deepen (thriving)
  if (currentScore > 85 && friend.dunbarTier !== 'Community') {
    return {
      id: `deepen-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'low',
      category: 'celebrate',
      title: `Your bond with ${friend.name} is thriving`,
      subtitle: 'Plan something special to celebrate this connection.',
      actionLabel: 'Plan Something Meaningful',
      icon: '✨',
      action: { type: 'plan' },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  return null;
}

function checkReflectSuggestion(
  friend: SuggestionInput['friend'],
  recentInteractions: SuggestionInput['recentInteractions']
): Suggestion | null {
  if (recentInteractions.length === 0) return null;

  const mostRecent = recentInteractions[0];
  const hoursSince = (Date.now() - mostRecent.interactionDate.getTime()) / 3600000;

  if (hoursSince < 24 && (!mostRecent.notes || !mostRecent.vibe)) {
    return {
      id: `reflect-${mostRecent.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'high',
      category: 'reflect',
      title: 'Recent Weave',
      subtitle: `How was your time with ${friend.name}? Add your reflection.`,
      actionLabel: 'Reflect on Weave',
      icon: '✨',
      action: {
        type: 'reflect',
        interactionId: mostRecent.id,
      },
      dismissible: true,
      createdAt: new Date(),
      expiresAt: new Date(mostRecent.interactionDate.getTime() + 48 * 3600000), // 48 hours
    };
  }

  return null;
}

function checkArchetypeMismatch(
  friend: SuggestionInput['friend'],
  recentInteractions: SuggestionInput['recentInteractions']
): Suggestion | null {
  if (recentInteractions.length < 3) return null;

  const last3 = recentInteractions.slice(0, 3);
  const preferredCategory = getArchetypePreferredCategory(friend.archetype);

  const hasPreferred = last3.some(i => i.category === preferredCategory);

  if (!hasPreferred) {
    return {
      id: `archetype-mismatch-${friend.id}`,
      friendId: friend.id,
      friendName: friend.name,
      urgency: 'medium',
      category: 'insight',
      title: `Missing ${friend.name}'s depth`,
      subtitle: `${friend.archetype} values certain types of connection. Your last 3 weaves didn't create space for that. Try ${preferredCategory.replace('-', ' ')}.`,
      actionLabel: 'Plan Deep Connection',
      icon: '💡',
      action: {
        type: 'plan',
        prefilledCategory: preferredCategory,
      },
      dismissible: true,
      createdAt: new Date(),
    };
  }

  return null;
}

export function getSuggestionCooldownDays(suggestionId: string): number {
  if (suggestionId.startsWith('critical-drift')) return COOLDOWN_DAYS['critical-drift'];
  if (suggestionId.startsWith('high-drift')) return COOLDOWN_DAYS['high-drift'];
  if (suggestionId.startsWith('first-weave')) return COOLDOWN_DAYS['first-weave'];
  if (suggestionId.startsWith('archetype-mismatch')) return COOLDOWN_DAYS['archetype-mismatch'];
  if (suggestionId.startsWith('momentum')) return COOLDOWN_DAYS['momentum'];
  if (suggestionId.startsWith('maintenance')) return COOLDOWN_DAYS['maintenance'];
  if (suggestionId.startsWith('deepen')) return COOLDOWN_DAYS['deepen'];
  if (suggestionId.startsWith('reflect')) return COOLDOWN_DAYS['reflect'];
  return 3; // Default
}
```

---

## Phase 3: React Hooks

### Step 3.1: Create useSuggestions Hook

**File**: `src/hooks/useSuggestions.ts`

```typescript
import { useMemo, useEffect, useState } from 'react';
import { useFriendStore } from '../stores/friendStore';
import { useInteractionStore } from '../stores/interactionStore';
import { generateSuggestion } from '../lib/suggestion-engine';
import { getDismissedSuggestions, dismissSuggestion as dismissSuggestionStorage } from '../lib/suggestion-storage';
import { Suggestion } from '../types/suggestions';
import { calculateCurrentScore, calculateMomentumScore } from '../lib/weave-engine';

export function useSuggestions() {
  const friends = useFriendStore(state => state.friends);
  const interactions = useInteractionStore(state => state.interactions);
  const [dismissedMap, setDismissedMap] = useState<Map<string, any>>(new Map());

  // Load dismissed suggestions on mount
  useEffect(() => {
    getDismissedSuggestions().then(setDismissedMap);
  }, []);

  const suggestions = useMemo(() => {
    const allSuggestions: Suggestion[] = [];

    for (const friend of friends) {
      // Get friend's interactions
      const friendInteractions = interactions
        .filter(i => i.friendIds?.includes(friend.id))
        .sort((a, b) => b.interactionDate.getTime() - a.interactionDate.getTime());

      const lastInteraction = friendInteractions[0];
      const currentScore = calculateCurrentScore(friend);
      const momentumScore = calculateMomentumScore(friend, friendInteractions);

      const suggestion = generateSuggestion({
        friend: {
          id: friend.id,
          name: friend.name,
          archetype: friend.archetype,
          dunbarTier: friend.dunbarTier,
          createdAt: friend.createdAt,
        },
        currentScore,
        lastInteractionDate: lastInteraction?.interactionDate,
        interactionCount: friendInteractions.length,
        momentumScore,
        recentInteractions: friendInteractions.slice(0, 5).map(i => ({
          id: i.id,
          category: i.category as any,
          interactionDate: i.interactionDate,
          vibe: i.vibe,
          notes: i.notes,
        })),
      });

      if (suggestion) {
        allSuggestions.push(suggestion);
      }
    }

    // Filter out dismissed (unless critical)
    const active = allSuggestions.filter(s => {
      if (s.urgency === 'critical') return true; // Critical always shows
      return !dismissedMap.has(s.id);
    });

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    active.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return active;
  }, [friends, interactions, dismissedMap]);

  const dismissSuggestion = async (id: string, cooldownDays: number) => {
    await dismissSuggestionStorage(id, cooldownDays);
    const updated = await getDismissedSuggestions();
    setDismissedMap(updated);
  };

  const hasCritical = suggestions.some(s => s.urgency === 'critical');

  return {
    suggestions,
    suggestionCount: suggestions.length,
    hasCritical,
    dismissSuggestion,
  };
}
```

---

### Step 3.2: Create useFriendActionState Hook

**File**: `src/hooks/useFriendActionState.ts`

```typescript
import { useMemo } from 'react';
import { Interaction } from '../db/models/Interaction';
import Friend from '../db/models/Friend';
import { generateSuggestion } from '../lib/suggestion-engine';
import { calculateCurrentScore, calculateMomentumScore } from '../lib/weave-engine';
import { Suggestion } from '../types/suggestions';

export function useFriendActionState(
  friend: Friend,
  interactions: Interaction[]
): Suggestion | null {
  return useMemo(() => {
    const sortedInteractions = [...interactions].sort(
      (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
    );

    const currentScore = calculateCurrentScore(friend);
    const momentumScore = calculateMomentumScore(friend, sortedInteractions);
    const lastInteraction = sortedInteractions[0];

    return generateSuggestion({
      friend: {
        id: friend.id,
        name: friend.name,
        archetype: friend.archetype,
        dunbarTier: friend.dunbarTier,
        createdAt: friend.createdAt,
      },
      currentScore,
      lastInteractionDate: lastInteraction?.interactionDate,
      interactionCount: sortedInteractions.length,
      momentumScore,
      recentInteractions: sortedInteractions.slice(0, 5).map(i => ({
        id: i.id,
        category: i.category as any,
        interactionDate: i.interactionDate,
        vibe: i.vibe,
        notes: i.notes,
      })),
    });
  }, [friend, interactions]);
}
```

---

## Phase 4: UI Components

### Step 4.1: Create ThreadButton Component

**File**: `src/components/ThreadButton.tsx`

```typescript
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';

interface ThreadButtonProps {
  count: number;
  hasCritical: boolean;
  onPress: () => void;
}

export function ThreadButton({ count, hasCritical, onPress }: ThreadButtonProps) {
  const { colors } = useTheme();
  const pulseScale = useSharedValue(1);

  // Pulse animation for critical suggestions
  useEffect(() => {
    if (hasCritical) {
      pulseScale.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [hasCritical]);

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Text style={styles.icon}>🧵</Text>
      {count > 0 && (
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: hasCritical ? colors.destructive : colors.accent },
            badgeStyle,
          ]}
        >
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
```

---

### Step 4.2: Create SuggestionCard Component

**File**: `src/components/SuggestionCard.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Suggestion } from '../types/suggestions';
import { useTheme } from '../hooks/useTheme';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAct: () => void;
  onLater: () => void;
}

export function SuggestionCard({ suggestion, onAct, onLater }: SuggestionCardProps) {
  const { colors } = useTheme();

  const urgencyColors = {
    critical: colors.destructive,
    high: colors.accent,
    medium: colors.primary,
    low: colors['muted-foreground'],
  };

  const urgencyColor = urgencyColors[suggestion.urgency];

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{suggestion.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: urgencyColor }]}>
            {suggestion.title}
          </Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.foreground }]}>
        {suggestion.subtitle}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: urgencyColor }]}
          onPress={onAct}
        >
          <Text style={styles.primaryButtonText}>{suggestion.actionLabel}</Text>
        </TouchableOpacity>

        {suggestion.dismissible && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onLater}>
            <Text style={[styles.secondaryButtonText, { color: colors['muted-foreground'] }]}>
              Later
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
```

---

### Step 4.3: Create InsightsSheet Component

**File**: `src/components/InsightsSheet.tsx`

```typescript
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Suggestion } from '../types/suggestions';
import { SuggestionCard } from './SuggestionCard';
import { useTheme } from '../hooks/useTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

interface InsightsSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
}

export function InsightsSheet({
  isVisible,
  suggestions,
  onClose,
  onAct,
  onLater,
}: InsightsSheetProps) {
  const { colors, isDarkMode } = useTheme();
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, { damping: 30, stiffness: 400 });
    }
  }, [isVisible]);

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => animateOut(onClose)}
      >
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView intensity={20} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.background },
          sheetStyle,
        ]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            🧵 Insights for Your Weave
          </Text>
          <TouchableOpacity onPress={() => animateOut(onClose)}>
            <Text style={[styles.closeButton, { color: colors['muted-foreground'] }]}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {suggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                All caught up!
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
                Your weave is looking strong. Keep nurturing your connections.
              </Text>
            </View>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAct={() => onAct(suggestion)}
                onLater={() => onLater(suggestion.id)}
              />
            ))
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.closeFooter}
            onPress={() => animateOut(onClose)}
          >
            <Text style={[styles.closeFooterText, { color: colors['muted-foreground'] }]}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  closeButton: {
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  closeFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeFooterText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
```

---

## Phase 5: Dashboard Integration

### Step 5.1: Update Dashboard Header

**File**: `app/dashboard.tsx` (modifications)

```typescript
// Add imports
import { ThreadButton } from '../src/components/ThreadButton';
import { InsightsSheet } from '../src/components/InsightsSheet';
import { useSuggestions } from '../src/hooks/useSuggestions';
import { getSuggestionCooldownDays } from '../src/lib/suggestion-engine';
import * as Haptics from 'expo-haptics';

// Inside Dashboard component
const [insightsSheetVisible, setInsightsSheetVisible] = useState(false);
const { suggestions, suggestionCount, hasCritical, dismissSuggestion } = useSuggestions();

const handleActOnSuggestion = (suggestion: Suggestion) => {
  setInsightsSheetVisible(false);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  // Navigate based on action type
  if (suggestion.action.type === 'reflect') {
    // Open reflection modal for this interaction
    router.push(`/interaction-form?interactionId=${suggestion.action.interactionId}&mode=reflect`);
  } else if (suggestion.action.type === 'log') {
    router.push(`/interaction-form?friendId=${suggestion.friendId}&category=${suggestion.action.prefilledCategory || ''}&mode=${suggestion.action.prefilledMode || 'detailed'}`);
  } else if (suggestion.action.type === 'plan') {
    router.push(`/interaction-form?friendId=${suggestion.friendId}&category=${suggestion.action.prefilledCategory || ''}&mode=plan`);
  }
};

const handleDismissSuggestion = async (suggestionId: string) => {
  const cooldownDays = getSuggestionCooldownDays(suggestionId);
  await dismissSuggestion(suggestionId, cooldownDays);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// In JSX, update header section
<View style={styles.header}>
  <ThreadButton
    count={suggestionCount}
    hasCritical={hasCritical}
    onPress={() => setInsightsSheetVisible(true)}
  />

  <Text style={[styles.title, { color: colors.foreground }]}>Weave</Text>

  <View style={styles.headerRight}>
    <TouchableOpacity onPress={handleAddFriend}>
      <Text style={styles.addIcon}>+</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => setSettingsVisible(true)}>
      <Text style={styles.settingsIcon}>⚙️</Text>
    </TouchableOpacity>
  </View>
</View>

// At bottom of component, before closing tags
<InsightsSheet
  isVisible={insightsSheetVisible}
  suggestions={suggestions}
  onClose={() => setInsightsSheetVisible(false)}
  onAct={handleActOnSuggestion}
  onLater={handleDismissSuggestion}
/>
```

---

## Testing Plan

### Unit Tests
1. **suggestion-engine.ts**
   - Test each priority rule in isolation
   - Test edge cases (new friend, no interactions, etc.)
   - Test archetype content selection

2. **suggestion-storage.ts**
   - Test dismissal persistence
   - Test cooldown expiration
   - Test cleanup of expired dismissals

### Integration Tests
1. **useSuggestions hook**
   - Test with various friend states
   - Test dismissal flow
   - Test suggestion count accuracy

2. **Dashboard integration**
   - Test thread button badge updates
   - Test sheet open/close animations
   - Test navigation from suggestions

### Manual Testing Checklist
- [ ] Badge count updates when suggestions change
- [ ] Critical suggestions pulse red
- [ ] Sheet slides up smoothly
- [ ] Suggestions sorted by urgency
- [ ] "Later" dismisses for correct cooldown
- [ ] Critical suggestions can't be dismissed
- [ ] Empty state shows when no suggestions
- [ ] Navigation works for all action types
- [ ] Haptics trigger correctly

---

## Migration Notes

### AsyncStorage Keys
- `weave:suggestions:dismissed` - Dismissed suggestion IDs
- `weave:suggestions:lastShown` - Last shown timestamp

### Database Changes
No database migrations needed - uses existing tables.

---

## Performance Considerations

1. **Memoization**: `useSuggestions` uses `useMemo` to avoid recalculating on every render
2. **Batch operations**: AsyncStorage reads/writes happen in batches
3. **Lazy loading**: Suggestions only calculated when dashboard mounts
4. **Efficient filtering**: Dismissed map stored as `Map<string, any>` for O(1) lookups

---

## Next Steps After Implementation

1. Add analytics tracking for suggestion engagement
2. Implement A/B testing for copy variations
3. Add notification support for critical suggestions
4. Create weekly digest of suggestions
5. Add suggestion history view

---

## Questions to Resolve

1. Should we add notification permissions for critical drift?
2. Should suggestions be available in friend profile timeline?
3. Do we want a "View All History" for past dismissed suggestions?
4. Should we track which suggestions lead to actual interactions?
