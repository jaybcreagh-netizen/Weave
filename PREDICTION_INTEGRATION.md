# Relationship Predictions Integration - Implementation Guide

## 🎯 Objective

Integrate existing prediction and pattern analysis capabilities into the Weave UI without adding clutter. All prediction logic already exists in `src/modules/insights/services/prediction.service.ts` and `src/modules/insights/services/pattern-detection.service.ts`. This task is about **surfacing** that intelligence in existing UI components.

## 📋 Context

### Existing Capabilities (Already Built)
- ✅ `predictFriendDrift()` - Forecasts when friends need attention
- ✅ `generateProactiveSuggestions()` - Creates upcoming-drift, optimal-timing, pattern-break, and momentum suggestions
- ✅ `analyzeInteractionPattern()` - Detects interaction frequency patterns
- ✅ `forecastNetworkHealth()` - Network-wide health predictions
- ✅ Friend model tracks `typicalIntervalDays` and `toleranceWindowDays` (learned from v21 migration)

### Integration Points (Existing UI)
1. **TodaysFocusWidget** (`src/components/home/widgets/TodaysFocusWidget.tsx`) - Main dashboard widget
2. **Suggestions System** (`src/modules/interactions/services/suggestion-engine.service.ts`) - Already generates suggestions
3. **Friend Profile** (`app/friend-profile.tsx`) - Individual friend detail view
4. **Home Screen** (`app/_home.tsx`) - Insights tab

### Key Principle
**Enhance existing components** with pattern-aware context. No new widgets. No clutter.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Prediction Engine                         │
│  (src/modules/insights/services/prediction.service.ts)      │
│                                                              │
│  • predictFriendDrift()                                     │
│  • generateProactiveSuggestions()                           │
│  • forecastNetworkHealth()                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├─────────────────┐
                       ▼                 ▼
         ┌──────────────────────┐   ┌──────────────────────┐
         │  Pattern Analysis    │   │  Suggestion Engine   │
         │  (pattern-detection) │   │  (existing)          │
         └──────────┬───────────┘   └──────────┬───────────┘
                    │                           │
                    └───────────┬───────────────┘
                                ▼
                    ┌────────────────────────┐
                    │   UI Components        │
                    │                        │
                    │  • TodaysFocusWidget   │
                    │  • PatternBadge (NEW)  │
                    │  • FriendProfile       │
                    │  • Suggestions List    │
                    └────────────────────────┘
```

---

## 📝 Implementation Tasks

### Task 1: Create Pattern Analysis Hook
**File:** `src/modules/insights/hooks/useFriendPattern.ts` (NEW)

**Purpose:** Centralized hook to fetch and analyze interaction patterns for a friend.

**Requirements:**
- Accept `friendId` as parameter
- Query interactions for that friend (last 90 days, completed only)
- Use `analyzeInteractionPattern()` from insights module
- Return pattern data with loading state
- Cache results to avoid expensive recomputation

**Implementation:**
```typescript
import { useState, useEffect } from 'react';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { analyzeInteractionPattern, type FriendshipPattern } from '@/modules/insights';

export function useFriendPattern(friendId: string): {
  pattern: FriendshipPattern | null;
  isLoading: boolean;
  isReliable: boolean;
} {
  const [pattern, setPattern] = useState<FriendshipPattern | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!friendId) {
      setIsLoading(false);
      return;
    }

    const loadPattern = async () => {
      try {
        setIsLoading(true);

        // Get interaction_friends records for this friend
        const interactionFriends = await database
          .get<InteractionFriend>('interaction_friends')
          .query(Q.where('friend_id', friendId))
          .fetch();

        // Get interaction IDs
        const interactionIds = interactionFriends.map(
          (ifriend) => ifriend._raw.interaction_id as string
        );

        if (interactionIds.length === 0) {
          setPattern(null);
          setIsLoading(false);
          return;
        }

        // Query interactions (last 90 days, completed only)
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const interactions = await database
          .get<Interaction>('interactions')
          .query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
            Q.sortBy('interaction_date', Q.desc)
          )
          .fetch();

        // Analyze pattern
        const analyzedPattern = analyzeInteractionPattern(
          interactions.map((i) => ({
            id: i.id,
            interactionDate: i.interactionDate,
            status: 'completed' as const,
            category: i.interactionCategory,
          }))
        );

        setPattern(analyzedPattern);
      } catch (error) {
        console.error('Error loading friend pattern:', error);
        setPattern(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadPattern();

    // Subscribe to interaction changes for this friend
    const subscription = database
      .get<InteractionFriend>('interaction_friends')
      .query(Q.where('friend_id', friendId))
      .observe()
      .subscribe(() => {
        loadPattern();
      });

    return () => subscription.unsubscribe();
  }, [friendId]);

  return {
    pattern,
    isLoading,
    isReliable: pattern ? pattern.sampleSize >= 3 && pattern.consistency >= 0.6 : false,
  };
}
```

**Export:** Add to `src/modules/insights/index.ts`:
```typescript
export { useFriendPattern } from './hooks/useFriendPattern';
```

---

### Task 2: Create PatternBadge Component
**File:** `src/components/PatternBadge.tsx` (NEW)

**Purpose:** Small, subtle badge showing "You usually connect every X days" on friend profiles.

**Design:**
- Only shows when pattern is reliable (3+ interactions, 60%+ consistency)
- Shows average interval and days since last interaction
- Color-coded: green (within tolerance), yellow (approaching overdue), red (overdue)
- Compact, non-intrusive

**Implementation:**
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendPattern } from '@/modules/insights';
import FriendModel from '@/db/models/Friend';

interface PatternBadgeProps {
  friend: FriendModel;
  style?: any;
}

export const PatternBadge: React.FC<PatternBadgeProps> = ({ friend, style }) => {
  const { colors } = useTheme();
  const { pattern, isReliable } = useFriendPattern(friend.id);

  if (!isReliable || !pattern) return null;

  const daysSince = differenceInDays(new Date(), friend.lastUpdated);
  const isOverdue = daysSince > pattern.averageIntervalDays * 1.2;
  const isApproaching = daysSince > pattern.averageIntervalDays * 0.8 && !isOverdue;

  // Determine badge color
  let badgeColor = colors.muted;
  let textColor = colors['muted-foreground'];

  if (isOverdue) {
    badgeColor = 'rgba(239, 68, 68, 0.15)'; // red
    textColor = '#EF4444';
  } else if (isApproaching) {
    badgeColor = 'rgba(251, 146, 60, 0.15)'; // yellow
    textColor = '#FB923C';
  } else {
    badgeColor = 'rgba(34, 197, 94, 0.15)'; // green
    textColor = '#22C55E';
  }

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor }, style]}>
      <Clock size={11} color={textColor} />
      <Text style={[styles.badgeText, { color: textColor }]}>
        Usually {pattern.averageIntervalDays}d · {daysSince}d ago
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
});
```

---

### Task 3: Enhance TodaysFocusWidget with Pattern Context
**File:** `src/components/home/widgets/TodaysFocusWidget.tsx`

**Changes:**
1. Import pattern analysis functions
2. Calculate patterns for fading friends
3. Enhance message generation with pattern context

**Specific Changes:**

**Add imports (top of file):**
```typescript
import {
  analyzeInteractionPattern,
  isPatternReliable,
  getPatternDescription,
  type FriendshipPattern
} from '@/modules/insights';
```

**Modify `fadingFriend` state to include pattern:**
```typescript
// Line ~91 - Update state type
const [fadingFriend, setFadingFriend] = useState<{
  friend: FriendModel;
  score: number;
  pattern?: FriendshipPattern;
} | null>(null);
```

**Update the fading friend detection logic (line ~263):**
```typescript
// Find fading friend (lowest score) with pattern analysis
useEffect(() => {
  if (!friends || friends.length === 0) return;

  const analyzeFadingFriends = async () => {
    const friendsWithData = await Promise.all(
      friends.map(async (f) => {
        // Calculate score
        const score = calculateCurrentScore(f);

        // Load interactions for pattern analysis
        try {
          const interactionFriends = await database
            .get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', f.id))
            .fetch();

          const interactionIds = interactionFriends.map(
            (ifriend) => ifriend._raw.interaction_id as string
          );

          if (interactionIds.length > 0) {
            const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
            const interactions = await database
              .get<Interaction>('interactions')
              .query(
                Q.where('id', Q.oneOf(interactionIds)),
                Q.where('status', 'completed'),
                Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
                Q.sortBy('interaction_date', Q.desc)
              )
              .fetch();

            const pattern = analyzeInteractionPattern(
              interactions.map((i) => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: 'completed' as const,
                category: i.interactionCategory,
              }))
            );

            return { friend: f, score, pattern };
          }
        } catch (error) {
          console.error('Error analyzing pattern for', f.name, error);
        }

        return { friend: f, score, pattern: undefined };
      })
    );

    // Get all friends below threshold
    const fadingFriends = friendsWithData
      .filter((f) => f.score < 40)
      .sort((a, b) => a.score - b.score);

    if (fadingFriends.length > 0) {
      const index = getDailyRotation(fadingFriends.length);
      setFadingFriend(fadingFriends[index]);
    } else {
      setFadingFriend(null);
    }
  };

  analyzeFadingFriends();
}, [friends]);
```

**Enhance `getFadingMessage` function (line ~153):**
```typescript
// Helper: Get intelligent message for friend-fading state
const getFadingMessage = (
  friend: FriendModel,
  score: number,
  pattern?: FriendshipPattern
): string => {
  const messages = [];

  // Add pattern-aware context if available
  if (pattern && isPatternReliable(pattern)) {
    const daysSince = differenceInDays(new Date(), friend.lastUpdated);
    const expectedInterval = pattern.averageIntervalDays;

    if (daysSince > expectedInterval * 1.5) {
      messages.push(
        `You usually connect every ${expectedInterval} days—it's been ${daysSince}`
      );
      messages.push(
        `Your ${expectedInterval}-day rhythm with ${friend.name} is breaking`
      );
    } else {
      messages.push(
        `${friend.name}'s connection is fading—you usually connect every ${expectedInterval} days`
      );
    }
  } else {
    // Fallback to score-based messages
    if (score < 20) {
      messages.push(`${friend.name}'s connection is fading—reach out soon`);
      messages.push(`Don't let ${friend.name} slip away`);
    } else if (score < 30) {
      messages.push(`${friend.name} could use some attention`);
      messages.push(`Time to reconnect with ${friend.name}`);
    } else {
      messages.push(`${friend.name}'s connection is weakening`);
      messages.push(`${friend.name} would appreciate hearing from you`);
    }
  }

  return messages[getDailyRotation(messages.length)];
};
```

**Update FriendFadingCard render (line ~982):**
```typescript
case 'friend-fading':
  return <FriendFadingCard
    friend={priority.data.friend}
    score={priority.data.score}
    message={getFadingMessage(
      priority.data.friend,
      priority.data.score,
      priority.data.pattern  // Pass pattern
    )}
    {...cardProps}
  />;
```

---

### Task 4: Add Pattern Badge to Friend Profile
**File:** `app/friend-profile.tsx`

**Changes:**
1. Import PatternBadge component
2. Add badge below friend name in header

**Specific Changes:**

**Add import (top of file):**
```typescript
import { PatternBadge } from '@/components/PatternBadge';
```

**Find the friend header section** (around line ~200-250, look for where friend name and tier are displayed) and add PatternBadge:

```typescript
// Find this section (example location, actual may vary):
<Text style={styles.friendName}>{friend.name}</Text>
<Text style={styles.friendTier}>{friend.dunbarTier}</Text>

// Add PatternBadge right after:
<PatternBadge friend={friend} style={{ marginTop: 8 }} />
```

---

### Task 5: Integrate Predictions into Suggestions System
**File:** `src/modules/interactions/services/suggestion-engine.service.ts`

**Changes:**
The suggestion engine already has pattern-aware context in lines 595-597 and 630-633. We need to ensure it's always enabled and using the pattern analysis.

**Verify/Update the `generateSuggestion` function:**

Around line 467, ensure pattern analysis is happening:

```typescript
export async function generateSuggestion(input: SuggestionInput): Promise<Suggestion | null> {
  const { friend, currentScore, lastInteractionDate, interactionCount, momentumScore, recentInteractions } = input;

  // Analyze friendship pattern from interaction history
  const pattern = analyzeInteractionPattern(
    recentInteractions.map(i => ({
      id: i.id,
      interactionDate: i.interactionDate,
      status: 'completed',
      category: i.category,
    }))
  );

  // ... rest of function
}
```

This already exists! Just verify it's working correctly.

---

### Task 6: Add Network Health Forecast Banner (Optional, Subtle)
**File:** `app/_home.tsx`

**Purpose:** Small banner at top of Insights tab showing "3 friends will need attention this week"

**Changes:**

**Add imports:**
```typescript
import { forecastNetworkHealth } from '@/modules/insights';
import { TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react-native';
```

**Add state and effect:**
```typescript
const [networkForecast, setNetworkForecast] = useState<{
  forecastedHealth: number;
  friendsNeedingAttention: FriendModel[];
  trend: 'up' | 'down' | 'stable';
} | null>(null);

useEffect(() => {
  if (!friends || friends.length === 0) return;

  const forecast = forecastNetworkHealth(friends, 7); // 7 days ahead
  const currentHealth = friends.reduce((sum, f) => sum + f.weaveScore, 0) / friends.length;

  const trend =
    forecast.forecastedHealth > currentHealth + 5 ? 'up' :
    forecast.forecastedHealth < currentHealth - 5 ? 'down' : 'stable';

  setNetworkForecast({
    forecastedHealth: forecast.forecastedHealth,
    friendsNeedingAttention: forecast.friendsNeedingAttention,
    trend,
  });
}, [friends]);
```

**Add forecast banner component (before main content):**
```typescript
{networkForecast && networkForecast.friendsNeedingAttention.length > 0 && (
  <View style={[styles.forecastBanner, { backgroundColor: colors.muted }]}>
    <View style={styles.forecastIcon}>
      {networkForecast.trend === 'down' && <TrendingDown size={16} color={colors['muted-foreground']} />}
      {networkForecast.trend === 'up' && <TrendingUp size={16} color={colors.primary} />}
      {networkForecast.trend === 'stable' && <CheckCircle2 size={16} color={colors.primary} />}
    </View>
    <Text style={[styles.forecastText, { color: colors.foreground }]}>
      {networkForecast.trend === 'down'
        ? `${networkForecast.friendsNeedingAttention.length} ${networkForecast.friendsNeedingAttention.length === 1 ? 'friend' : 'friends'} will need attention this week`
        : `Your network is ${networkForecast.trend === 'stable' ? 'stable' : 'thriving'} this week`
      }
    </Text>
  </View>
)}
```

**Add styles:**
```typescript
const styles = StyleSheet.create({
  // ... existing styles
  forecastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 8,
  },
  forecastIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
});
```

---

## 🧪 Testing Requirements

### Unit Tests
Create `src/modules/insights/hooks/__tests__/useFriendPattern.test.ts`:
- Test pattern loading for friend with 0 interactions
- Test pattern loading for friend with 3+ interactions
- Test pattern reliability calculation
- Test cache invalidation on new interaction

### Integration Tests
1. **TodaysFocusWidget Pattern Context:**
   - Add friend with consistent 7-day pattern
   - Verify widget message includes "Usually 7 days"
   - Wait 10 days without interaction
   - Verify "it's been 10 days" appears

2. **Pattern Badge Display:**
   - Navigate to friend profile with reliable pattern
   - Verify badge shows correct interval
   - Verify badge color changes when overdue

3. **Network Forecast:**
   - Create scenario with 3 friends below threshold
   - Verify forecast banner shows "3 friends will need attention"
   - Verify icon matches trend direction

### Visual Regression
- Screenshot TodaysFocusWidget with pattern-aware messages
- Screenshot friend profile with PatternBadge
- Screenshot Insights tab with forecast banner

---

## 📊 Success Metrics

1. **Pattern Detection Coverage:** 70%+ of friends with 3+ interactions show patterns
2. **Suggestion Accuracy:** Pattern-aware suggestions have 85%+ confidence when reliable
3. **User Engagement:** 20% increase in proactive reconnections (measured via "reached out before critical drift")
4. **UI Clarity:** User surveys indicate pattern info is "helpful" not "cluttered"

---

## 🔍 Code Quality Checklist

- [ ] All new components follow existing component patterns (TypeScript, React Native, NativeWind)
- [ ] Hooks properly clean up subscriptions (avoid memory leaks)
- [ ] Pattern calculations are cached to avoid performance issues
- [ ] Error handling for missing/invalid data
- [ ] Loading states for async pattern fetching
- [ ] Color-coded visual feedback (green/yellow/red for pattern states)
- [ ] Accessibility: proper labels for screen readers
- [ ] No console.log statements in production code (use console.error for errors only)
- [ ] TypeScript types are strict (no `any` unless absolutely necessary)

---

## 🚀 Deployment Notes

### Phase 1: Core Pattern Integration (Week 1)
- Task 1: useFriendPattern hook
- Task 2: PatternBadge component
- Task 3: TodaysFocusWidget enhancement
- Task 4: Friend profile integration

**Goal:** Users see pattern context in 2-3 key places without UI changes.

### Phase 2: Network Intelligence (Week 2)
- Task 5: Verify suggestion system integration
- Task 6: Network forecast banner
- Performance optimization: cache patterns

**Goal:** Network-level predictions surface proactively.

### Phase 3: Polish (Week 3)
- Add "Why this suggestion?" expandable explainer
- Confidence indicators on predictions
- User settings to adjust prediction sensitivity

---

## 📝 Implementation Notes

### Performance Considerations
1. **Pattern Calculation is Expensive:**
   - Cache results per friend (12-24 hour TTL)
   - Only recalculate on new interaction
   - Use WatermelonDB observables to trigger updates

2. **Database Queries:**
   - Limit interaction queries to 90 days
   - Use indexed queries (interaction_date, status)
   - Batch friend pattern calculations

3. **UI Thread:**
   - Keep pattern analysis off UI thread
   - Use React Query or similar for caching
   - Show loading states for async pattern fetching

### Accessibility
- PatternBadge should have accessible label: "Connection pattern: Usually 7 days, 10 days since last interaction"
- Network forecast banner should be announced by screen readers
- Color coding should not be the only indicator (use icons too)

### Edge Cases
1. **Friend with 0-2 interactions:** Don't show pattern badge, fall back to generic messages
2. **Inconsistent patterns (low consistency):** Show "Learning your pattern" instead of specific interval
3. **Multiple patterns (e.g., changed rhythm):** Use most recent 30-day pattern
4. **Dormant friends:** Don't predict patterns, mark as "No recent pattern"

---

## 📚 References

### Existing Code to Study
- `src/modules/insights/services/prediction.service.ts` - Core prediction logic
- `src/modules/insights/services/pattern-detection.service.ts` - Pattern analysis
- `src/modules/insights/services/pattern.service.ts` - FriendshipPattern types
- `src/components/home/widgets/TodaysFocusWidget.tsx` - Main integration point
- `src/modules/interactions/services/suggestion-engine.service.ts` - Suggestion generation

### Type Definitions
```typescript
// From pattern.service.ts
export interface FriendshipPattern {
  friendId: string;
  averageIntervalDays: number;
  consistency: number; // 0-1
  sampleSize: number;
  preferredDayOfWeek?: number; // 0-6
  preferredCategories: string[];
}

// From prediction.service.ts
export interface FriendPrediction {
  friendId: string;
  friendName: string;
  currentScore: number;
  predictedScore: number;
  daysUntilAttentionNeeded: number;
  confidence: number; // 0-1
  reason: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}
```

---

## ✅ Definition of Done

- [ ] All 6 tasks implemented and tested
- [ ] Pattern context appears in TodaysFocusWidget messages
- [ ] PatternBadge shows on friend profiles with reliable patterns
- [ ] Network forecast banner displays on Insights tab (optional)
- [ ] No new widgets added (only enhancements to existing UI)
- [ ] Performance testing shows no significant slowdown
- [ ] Code review completed
- [ ] Documentation updated (this file + code comments)
- [ ] Unit tests pass with 80%+ coverage for new code
- [ ] Integration tests verify end-to-end flow
- [ ] Deployed to staging for user testing

---

## 🆘 Troubleshooting

### Pattern not showing up?
- Check `pattern.sampleSize >= 3`
- Check `pattern.consistency >= 0.6`
- Verify interactions are marked as 'completed'
- Check date range (last 90 days)

### Performance issues?
- Add caching layer for pattern calculations
- Reduce query scope (30 days instead of 90)
- Use React Query for memoization
- Profile with React DevTools

### Pattern seems wrong?
- Verify interaction dates are correct
- Check for planned interactions mistakenly included
- Verify time zone handling in date calculations

---

## 📞 Support

For questions or issues during implementation:
1. Check existing prediction service code for examples
2. Review CLAUDE.md for project architecture
3. Test with mock data in development
4. Use `console.error` for debugging (not console.log)

---

**Last Updated:** 2025-11-26
**Version:** 1.0
**Status:** Ready for Implementation
