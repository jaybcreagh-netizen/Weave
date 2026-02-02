# Relationship Intelligence: Replacing Gamification with Understanding

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Replace badge-based gamification with an intelligence-driven engagement system |
| **Status** | Design Complete - Ready for Review |
| **Last Updated** | January 2025 |
| **Supersedes** | `badge-definitions.ts`, `achievement-definitions.ts`, `milestone-tracker.service.ts` |

---

## Part 1: Philosophy & Vision

### The Problem with Badges

Weave currently uses a badge-based gamification system borrowed from apps with fundamentally different goals. Duolingo gives badges because learning Spanish is inherently tedious. But nurturing friendships is intrinsically meaningful - badges risk cheapening something sacred.

| Current Mechanic | Why It Feels Wrong |
|------------------|-------------------|
| "50 Weaves!" trophy | Treats friendships like collectibles |
| Streak counters | Creates guilt, not connection |
| Rarity tiers (Epic/Legendary) | Gamerspeak in a relationship app |
| Trophy cabinet | LinkedIn endorsements energy |
| Progress bars | Optimizing friendship like XP grinding |

**Badges say:** "You did the thing! Good job!"
**Weave should say:** "Here's what I noticed about your relationships."

### The New Philosophy

**From:** Gamification layer bolted onto relationship tracking
**To:** Relationship intelligence that surfaces understanding

The engagement loop becomes:
1. User logs interaction
2. App notices patterns over time
3. App reflects insights back ("I noticed...")
4. User feels *understood*, not *rewarded*
5. User returns because the app *sees them clearly*

This is the difference between a fitness app that gives you badges vs. a therapist who says "I've noticed you exercise more when you're anxious."

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Insight over Achievement** | The reward is understanding, not trophies |
| **Narrative over Metrics** | Story beats, not progress bars |
| **Gentle over Urgent** | Observations, not judgments |
| **Quality over Quantity** | Depth of connection, not interaction counts |
| **Invisible Intelligence** | Sophisticated mechanics the user never sees |

---

## Part 2: System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER (Always Running)                  │
├─────────────────────────────────────────────────────────────────┤
│  DecayService          │ Time-based score decay by tier         │
│  MomentumService       │ Recent engagement velocity             │
│  ResilienceService     │ Quality-based decay resistance         │
│  PatternDetector       │ Behavioral pattern recognition         │
│  SignalGenerator       │ Creates typed signals from patterns    │
│  TriggerEvaluator      │ Decides when to surface insights       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (When triggered)
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  RelationshipQualityService   │ Calculates RQS per friendship   │
│  ReciprocityAnalyzer          │ Detects and interprets balance  │
│  NarrativeGenerator           │ Creates friendship stories      │
│  ReflectionSynthesizer        │ Periodic network reflections    │
│  LifeContextAdapter           │ Adjusts for life phases         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (For interpretation)
┌─────────────────────────────────────────────────────────────────┐
│                    ORACLE LAYER (LLM)                           │
├─────────────────────────────────────────────────────────────────┤
│  NarrativeSynthesis     │ Data → meaningful friendship stories  │
│  ReflectionGeneration   │ Periodic "state of network" letters   │
│  ReciprocityInterpret   │ Nuanced framing of imbalances         │
│  QualityRecognition     │ Appreciating depth in reflections     │
│  ConversationStarters   │ Contextual suggestions for reconnect  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    USER EXPERIENCE                              │
├─────────────────────────────────────────────────────────────────┤
│  • Insights feel personal, not mechanical                       │
│  • No badges, no visible scores                                 │
│  • Narrative milestones, not achievements                       │
│  • Gentle observations, not judgments                           │
│  • Periodic reflections, not real-time metrics                  │
└─────────────────────────────────────────────────────────────────┘
```

### What Changes vs. What Stays

| Keep (Invisible) | Remove (Visible) | Transform |
|------------------|------------------|-----------|
| Decay calculations | Badge definitions | Streaks → Consistency observations |
| Momentum tracking | Achievement unlocks | Milestones → Narrative moments |
| Resilience scoring | Trophy cabinet UI | Progress bars → (nothing) |
| Signal generation | Rarity tiers | Celebration modals → Gentle insights |
| Pattern detection | Streak counters | |
| Suggestion engine | Badge check listeners | |

---

## Part 3: Core Data Models

### 3.1 Relationship Quality Score (RQS)

Replaces badge-based progress with a holistic quality assessment.

```typescript
// src/modules/intelligence/types/relationship-quality.types.ts

interface RelationshipQualityScore {
  friendId: string;
  calculatedAt: Date;

  // Component scores (0-100 scale, internal only)
  components: {
    depth: number;        // Reflection quality, vulnerability signals
    consistency: number;  // Regular contact pattern vs tier expectation
    reciprocity: number;  // Balance of initiation (0.5 = perfect)
    growth: number;       // Score trajectory over 90 days
    resilience: number;   // Survived gaps without major decay
  };

  // Composite (weighted combination, never shown to user)
  composite: number;

  // Human-readable outputs
  texture: RelationshipTexture;
  trajectory: 'strengthening' | 'stable' | 'fading' | 'new';

  // For narrative generation
  notablePatterns: string[];  // e.g., "morning texter", "crisis supporter"
}

interface RelationshipTexture {
  depth: 'acquaintance' | 'friendly' | 'meaningful' | 'profound';
  rhythm: 'sporadic' | 'occasional' | 'regular' | 'frequent';
  balance: 'you_carry' | 'balanced' | 'they_carry';

  // Human-readable summary for UI
  summary: string;
  // e.g., "A meaningful friendship with regular contact. You tend to initiate, but they always show up."
}
```

**Database Schema:**

```typescript
// Add to src/db/schema.ts

tableSchema({
  name: 'relationship_quality_snapshots',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'calculated_at', type: 'number', isIndexed: true },

    // Component scores
    { name: 'depth_score', type: 'number' },
    { name: 'consistency_score', type: 'number' },
    { name: 'reciprocity_score', type: 'number' },
    { name: 'growth_score', type: 'number' },
    { name: 'resilience_score', type: 'number' },
    { name: 'composite_score', type: 'number' },

    // Texture
    { name: 'texture_json', type: 'string' },
    { name: 'trajectory', type: 'string' },
    { name: 'notable_patterns_json', type: 'string' },
  ]
})
```

### 3.2 Friendship Narrative

Tracks the story arc of each relationship.

```typescript
// src/modules/intelligence/types/narrative.types.ts

type FriendshipChapter =
  | 'spark'           // First 30 days - new connection
  | 'kindling'        // Building momentum (30-90 days active)
  | 'steady_flame'    // Consistent pattern established
  | 'deep_roots'      // High resilience achieved
  | 'rekindled'       // Came back from dormant
  | 'constellation';  // Part of inner circle for 1+ year

type NarrativeMoment =
  | 'first_weave'              // The beginning
  | 'first_deep_conversation'  // When it got real
  | 'first_crisis_support'     // They showed up when it mattered
  | 'survived_distance'        // Weathered a gap
  | 'rekindled'                // The return
  | 'anniversary'              // Yearly milestone
  | 'became_consistent'        // Found your rhythm
  | 'entered_inner_circle'     // Tier promotion to inner circle
  | 'shared_milestone'         // Birthday, life event celebrated together
  | 'reciprocity_shift';       // Balance changed significantly

interface FriendshipNarrative {
  friendId: string;

  // Current chapter
  currentChapter: FriendshipChapter;
  chapterStartedAt: Date;

  // Timeline of moments
  moments: NarrativeMomentRecord[];

  // LLM-generated narrative (cached)
  generatedNarrative?: {
    text: string;
    generatedAt: Date;
    dataSnapshot: string;  // Hash of data used to generate
  };

  // For anniversary detection
  friendshipStartDate: Date;  // First interaction logged
}

interface NarrativeMomentRecord {
  type: NarrativeMoment;
  occurredAt: Date;

  // Optional user reflection on this moment
  userReflection?: string;

  // Context for narrative generation
  context?: {
    interactionId?: string;
    journalEntryId?: string;
    metadata?: Record<string, unknown>;
  };
}
```

**Database Schema:**

```typescript
tableSchema({
  name: 'friendship_narratives',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'current_chapter', type: 'string' },
    { name: 'chapter_started_at', type: 'number' },
    { name: 'friendship_start_date', type: 'number' },
    { name: 'generated_narrative_json', type: 'string', isOptional: true },
  ]
})

tableSchema({
  name: 'narrative_moments',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'moment_type', type: 'string', isIndexed: true },
    { name: 'occurred_at', type: 'number', isIndexed: true },
    { name: 'user_reflection', type: 'string', isOptional: true },
    { name: 'context_json', type: 'string', isOptional: true },
  ]
})
```

### 3.3 Reciprocity Metrics

Tracks relationship balance over time.

```typescript
// src/modules/intelligence/types/reciprocity.types.ts

interface ReciprocityMetrics {
  friendId: string;
  calculatedAt: Date;

  // Core ratio (0 = they always initiate, 1 = you always initiate)
  initiationRatio: number;

  // Time-based analysis
  windows: {
    last30Days: ReciprocityWindow;
    last90Days: ReciprocityWindow;
    lifetime: ReciprocityWindow;
  };

  // Trend
  trend: 'improving' | 'stable' | 'declining';
  trendMagnitude: 'slight' | 'moderate' | 'significant';

  // Context flags
  flags: {
    onePersonCarrying: boolean;     // >75% one direction
    recentShift: boolean;           // Changed significantly in 30 days
    healthyBalance: boolean;        // 0.35-0.65 range
  };
}

interface ReciprocityWindow {
  yourInitiations: number;
  theirInitiations: number;
  ratio: number;
  totalInteractions: number;
}
```

**Database Schema:**

```typescript
tableSchema({
  name: 'reciprocity_snapshots',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'calculated_at', type: 'number', isIndexed: true },
    { name: 'initiation_ratio', type: 'number' },
    { name: 'windows_json', type: 'string' },
    { name: 'trend', type: 'string' },
    { name: 'trend_magnitude', type: 'string' },
    { name: 'flags_json', type: 'string' },
  ]
})
```

### 3.4 Periodic Reflections

Stores synthesized network reflections.

```typescript
// src/modules/intelligence/types/reflection.types.ts

type ReflectionPeriod = 'weekly' | 'monthly' | 'quarterly';

interface NetworkReflection {
  id: string;
  period: ReflectionPeriod;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;

  // Data inputs (for regeneration/debugging)
  dataSnapshot: {
    innerCircleHealth: number;
    totalInteractions: number;
    uniqueFriendsContacted: number;
    averageBattery: number;
    topPatterns: string[];
    significantChanges: SignificantChange[];
  };

  // LLM-generated content
  content: {
    greeting: string;           // Personalized opener
    observations: string[];     // 2-3 key observations
    celebration?: string;       // Something to feel good about
    gentleNudge?: string;       // Optional suggestion
    closing: string;            // Warm sign-off
  };

  // Status
  status: 'generated' | 'viewed' | 'dismissed';
  viewedAt?: Date;
}

interface SignificantChange {
  type: 'friendship_deepened' | 'friendship_fading' | 'new_connection' |
        'rekindled' | 'tier_change' | 'reciprocity_shift';
  friendId: string;
  friendName: string;
  description: string;
}
```

**Database Schema:**

```typescript
tableSchema({
  name: 'network_reflections',
  columns: [
    { name: 'period', type: 'string', isIndexed: true },
    { name: 'generated_at', type: 'number', isIndexed: true },
    { name: 'period_start', type: 'number' },
    { name: 'period_end', type: 'number' },
    { name: 'data_snapshot_json', type: 'string' },
    { name: 'content_json', type: 'string' },
    { name: 'status', type: 'string', isIndexed: true },
    { name: 'viewed_at', type: 'number', isOptional: true },
  ]
})
```

### 3.5 Life Context

Tracks user's current life phase for adaptive behavior.

```typescript
// src/modules/intelligence/types/life-context.types.ts

type LifePhase =
  | 'normal'           // Default state
  | 'major_transition' // New job, move, breakup
  | 'celebratory'      // Wedding, baby, promotion
  | 'grieving'         // Loss, hardship
  | 'hermit_mode'      // User-declared social rest
  | 'high_energy';     // Unusually social period

interface LifeContext {
  currentPhase: LifePhase;
  phaseStartedAt: Date;
  phaseEndAt?: Date;      // For time-limited phases

  // User-declared or inferred
  source: 'user_declared' | 'inferred';

  // Behavioral adjustments
  adjustments: {
    decayMultiplier: number;        // 0.5 = half decay during hardship
    suggestionFrequency: number;    // 0.5 = half as many suggestions
    insightTone: 'gentle' | 'normal' | 'celebratory';
    challengesEnabled: boolean;
  };

  // Optional context
  note?: string;  // "Starting new job at Acme Corp"
}
```

**Database Schema:**

```typescript
// Add columns to user_profile table
{
  name: 'life_phase',
  type: 'string',
  isOptional: true,
}
{
  name: 'life_phase_started_at',
  type: 'number',
  isOptional: true,
}
{
  name: 'life_phase_end_at',
  type: 'number',
  isOptional: true,
}
{
  name: 'life_phase_source',
  type: 'string',
  isOptional: true,
}
{
  name: 'life_phase_note',
  type: 'string',
  isOptional: true,
}
```

### 3.6 Relationship Insight (Replaces ProactiveInsight)

```typescript
// src/modules/intelligence/types/insight.types.ts

type InsightType =
  | 'observation'       // Pattern noticed
  | 'milestone'         // Narrative moment reached
  | 'reflection_prompt' // Question to consider
  | 'gentle_nudge'      // Soft suggestion
  | 'celebration';      // Something to feel good about

type InsightTone =
  | 'curious'      // "I noticed..."
  | 'affirming'    // "You've been..."
  | 'celebratory'  // "Something special..."
  | 'gentle'       // "It might be worth..."
  | 'reflective';  // "Have you considered..."

interface RelationshipInsight {
  id: string;
  type: InsightType;
  tone: InsightTone;

  // Content
  opener: string;        // "Something I noticed..." or "A thought..."
  message: string;       // The insight itself
  context?: string;      // Optional additional context

  // Relation
  friendId?: string;     // If friend-specific
  friendName?: string;

  // Grounding (for transparency and regeneration)
  groundingData: {
    signals: string[];           // What triggered this
    dataPoints: Record<string, unknown>;  // Specific values
    confidence: number;          // 0-1
  };

  // Optional action
  suggestedAction?: {
    type: 'reflect' | 'reach_out' | 'plan' | 'journal' | 'oracle_chat';
    label: string;
    params?: Record<string, unknown>;
  };

  // Lifecycle
  generatedAt: Date;
  expiresAt: Date;
  status: 'active' | 'viewed' | 'acted_on' | 'dismissed' | 'expired';
  viewedAt?: Date;
  actedOnAt?: Date;
}
```

---

## Part 4: Service Architecture

### 4.1 RelationshipQualityService

Calculates the holistic quality score for each friendship.

```typescript
// src/modules/intelligence/services/relationship-quality.service.ts

export class RelationshipQualityService {

  /**
   * Calculate RQS for a single friend
   * Called after weave logged or on periodic refresh
   */
  async calculateRQS(friendId: string): Promise<RelationshipQualityScore> {
    const friend = await this.getFriend(friendId);
    const interactions = await this.getInteractions(friendId, { days: 90 });
    const reflections = await this.getReflections(friendId, { days: 90 });
    const previousSnapshot = await this.getPreviousSnapshot(friendId);

    const components = {
      depth: this.calculateDepth(interactions, reflections),
      consistency: this.calculateConsistency(interactions, friend.tier),
      reciprocity: this.calculateReciprocity(interactions),
      growth: this.calculateGrowth(friend, previousSnapshot),
      resilience: friend.resilience,  // From existing ResilienceService
    };

    const composite = this.weightedAverage(components, {
      depth: 0.25,
      consistency: 0.20,
      reciprocity: 0.20,
      growth: 0.15,
      resilience: 0.20,
    });

    const texture = this.deriveTexture(components, interactions);
    const trajectory = this.determineTrajectory(previousSnapshot, composite);
    const patterns = this.detectPatterns(interactions);

    return {
      friendId,
      calculatedAt: new Date(),
      components,
      composite,
      texture,
      trajectory,
      notablePatterns: patterns,
    };
  }

  /**
   * Calculate depth component
   * Based on reflection quality and vulnerability signals
   */
  private calculateDepth(
    interactions: Interaction[],
    reflections: JournalEntry[]
  ): number {
    // Count interactions with reflections
    const withReflection = interactions.filter(i => i.notes?.length > 50);
    const reflectionRatio = withReflection.length / Math.max(interactions.length, 1);

    // Analyze reflection quality (from signal extraction)
    const profoundReflections = reflections.filter(r =>
      r.extractedSignals?.dynamics?.depthSignal === 'deep'
    );

    // Check for vulnerability signals in journal
    const vulnerabilityMentions = reflections.filter(r =>
      r.extractedSignals?.coreThemes?.includes('vulnerability')
    );

    // Weighted calculation
    const score = (
      reflectionRatio * 40 +
      Math.min(profoundReflections.length * 10, 30) +
      Math.min(vulnerabilityMentions.length * 10, 30)
    );

    return Math.min(score, 100);
  }

  /**
   * Derive human-readable texture from components
   */
  private deriveTexture(
    components: RelationshipQualityScore['components'],
    interactions: Interaction[]
  ): RelationshipTexture {
    const depth = components.depth > 70 ? 'profound' :
                  components.depth > 50 ? 'meaningful' :
                  components.depth > 30 ? 'friendly' : 'acquaintance';

    const avgDaysBetween = this.calculateAverageGap(interactions);
    const rhythm = avgDaysBetween < 7 ? 'frequent' :
                   avgDaysBetween < 21 ? 'regular' :
                   avgDaysBetween < 45 ? 'occasional' : 'sporadic';

    const reciprocity = components.reciprocity;
    const balance = reciprocity > 0.65 ? 'you_carry' :
                    reciprocity < 0.35 ? 'they_carry' : 'balanced';

    const summary = this.generateTextureSummary(depth, rhythm, balance);

    return { depth, rhythm, balance, summary };
  }

  private generateTextureSummary(
    depth: RelationshipTexture['depth'],
    rhythm: RelationshipTexture['rhythm'],
    balance: RelationshipTexture['balance']
  ): string {
    const depthPhrase = {
      profound: 'A deeply meaningful friendship',
      meaningful: 'A meaningful friendship',
      friendly: 'A comfortable friendship',
      acquaintance: 'A casual connection',
    }[depth];

    const rhythmPhrase = {
      frequent: 'with frequent contact',
      regular: 'with regular contact',
      occasional: 'with occasional contact',
      sporadic: 'with sporadic contact',
    }[rhythm];

    const balancePhrase = {
      you_carry: 'You tend to initiate, but they show up when it counts.',
      they_carry: 'They often reach out first, keeping the connection alive.',
      balanced: 'You both invest in keeping this connection strong.',
    }[balance];

    return `${depthPhrase} ${rhythmPhrase}. ${balancePhrase}`;
  }
}
```

### 4.2 NarrativeService

Manages friendship stories and narrative moments.

```typescript
// src/modules/intelligence/services/narrative.service.ts

export class NarrativeService {

  /**
   * Record a narrative moment
   * Called when significant events occur
   */
  async recordMoment(
    friendId: string,
    type: NarrativeMoment,
    context?: NarrativeMomentRecord['context']
  ): Promise<void> {
    const existing = await this.findExistingMoment(friendId, type);

    // Some moments can only happen once (first_weave)
    // Others can recur (anniversary, survived_distance)
    if (existing && !this.isRecurringMoment(type)) {
      return;
    }

    await database.write(async () => {
      await this.narrativeMomentsCollection.create(record => {
        record.friendId = friendId;
        record.momentType = type;
        record.occurredAt = Date.now();
        record.contextJson = context ? JSON.stringify(context) : null;
      });
    });

    // Check if this triggers a chapter transition
    await this.evaluateChapterTransition(friendId);

    // Invalidate cached narrative
    await this.invalidateNarrativeCache(friendId);
  }

  /**
   * Evaluate if friendship should transition to new chapter
   */
  private async evaluateChapterTransition(friendId: string): Promise<void> {
    const narrative = await this.getNarrative(friendId);
    const moments = await this.getMoments(friendId);
    const rqs = await this.relationshipQualityService.getLatestRQS(friendId);
    const friend = await this.getFriend(friendId);

    const newChapter = this.determineChapter(narrative, moments, rqs, friend);

    if (newChapter !== narrative.currentChapter) {
      await this.transitionChapter(friendId, newChapter);
    }
  }

  /**
   * Determine appropriate chapter based on state
   */
  private determineChapter(
    narrative: FriendshipNarrative,
    moments: NarrativeMomentRecord[],
    rqs: RelationshipQualityScore,
    friend: Friend
  ): FriendshipChapter {
    const daysSinceStart = this.daysBetween(narrative.friendshipStartDate, new Date());
    const hasDeepConversation = moments.some(m => m.type === 'first_deep_conversation');
    const hasSurvivedDistance = moments.some(m => m.type === 'survived_distance');
    const wasRekindled = moments.some(m => m.type === 'rekindled');

    // Rekindled takes precedence if recent
    if (wasRekindled) {
      const rekindleMoment = moments.find(m => m.type === 'rekindled');
      const daysSinceRekindle = this.daysBetween(rekindleMoment!.occurredAt, new Date());
      if (daysSinceRekindle < 90) {
        return 'rekindled';
      }
    }

    // Constellation: Inner circle for 1+ year with high resilience
    if (
      friend.tier === 'inner_circle' &&
      daysSinceStart > 365 &&
      rqs.components.resilience > 70
    ) {
      return 'constellation';
    }

    // Deep roots: High resilience, survived distance
    if (rqs.components.resilience > 60 && hasSurvivedDistance) {
      return 'deep_roots';
    }

    // Steady flame: Consistent pattern established
    if (rqs.texture.rhythm !== 'sporadic' && rqs.trajectory === 'stable') {
      return 'steady_flame';
    }

    // Kindling: Building momentum
    if (daysSinceStart > 30 && daysSinceStart < 180 && rqs.trajectory !== 'fading') {
      return 'kindling';
    }

    // Spark: New connection
    return 'spark';
  }

  /**
   * Generate narrative text using Oracle
   * Called on demand or when data significantly changes
   */
  async generateNarrativeText(friendId: string): Promise<string> {
    const narrative = await this.getNarrative(friendId);
    const moments = await this.getMoments(friendId);
    const rqs = await this.relationshipQualityService.getLatestRQS(friendId);
    const friend = await this.getFriend(friendId);

    // Check cache validity
    const currentHash = this.hashNarrativeData(narrative, moments, rqs);
    if (
      narrative.generatedNarrative &&
      narrative.generatedNarrative.dataSnapshot === currentHash &&
      this.daysBetween(narrative.generatedNarrative.generatedAt, new Date()) < 30
    ) {
      return narrative.generatedNarrative.text;
    }

    // Generate via Oracle
    const text = await this.oracleService.generateFriendshipNarrative({
      friendName: friend.name,
      chapter: narrative.currentChapter,
      moments: moments.map(m => ({
        type: m.type,
        occurredAt: m.occurredAt,
      })),
      texture: rqs.texture,
      trajectory: rqs.trajectory,
      daysSinceStart: this.daysBetween(narrative.friendshipStartDate, new Date()),
      patterns: rqs.notablePatterns,
    });

    // Cache result
    await this.cacheNarrative(friendId, text, currentHash);

    return text;
  }
}
```

### 4.3 ReflectionSynthesizer

Generates periodic network reflections.

```typescript
// src/modules/intelligence/services/reflection-synthesizer.service.ts

export class ReflectionSynthesizerService {

  /**
   * Generate a periodic reflection
   * Called on schedule (weekly/monthly based on user preference)
   */
  async generateReflection(period: ReflectionPeriod): Promise<NetworkReflection> {
    const { start, end } = this.getPeriodBounds(period);

    // Gather data
    const dataSnapshot = await this.gatherDataSnapshot(start, end);

    // Skip if insufficient data
    if (dataSnapshot.totalInteractions < 3) {
      throw new InsufficientDataError('Not enough activity for a meaningful reflection');
    }

    // Generate content via Oracle
    const content = await this.oracleService.generateNetworkReflection({
      period,
      dataSnapshot,
      userProfile: await this.getUserProfile(),
      lifeContext: await this.getLifeContext(),
    });

    // Store
    const reflection = await database.write(async () => {
      return this.reflectionsCollection.create(record => {
        record.period = period;
        record.generatedAt = Date.now();
        record.periodStart = start.getTime();
        record.periodEnd = end.getTime();
        record.dataSnapshotJson = JSON.stringify(dataSnapshot);
        record.contentJson = JSON.stringify(content);
        record.status = 'generated';
      });
    });

    return this.mapToReflection(reflection);
  }

  /**
   * Gather all relevant data for the period
   */
  private async gatherDataSnapshot(
    start: Date,
    end: Date
  ): Promise<NetworkReflection['dataSnapshot']> {
    const interactions = await this.getInteractionsBetween(start, end);
    const friends = await this.getActiveFriends();
    const journalEntries = await this.getJournalEntriesBetween(start, end);
    const batteryLogs = await this.getBatteryLogsBetween(start, end);

    // Calculate metrics
    const uniqueFriends = new Set(
      interactions.flatMap(i => i.friendIds)
    ).size;

    const innerCircle = friends.filter(f => f.tier === 'inner_circle');
    const innerCircleInteractions = interactions.filter(i =>
      i.friendIds.some(fId => innerCircle.find(f => f.id === fId))
    );
    const innerCircleHealth = innerCircle.length > 0
      ? (innerCircleInteractions.length / innerCircle.length) * 20  // Normalize to 100
      : 0;

    const avgBattery = batteryLogs.length > 0
      ? batteryLogs.reduce((sum, l) => sum + l.level, 0) / batteryLogs.length
      : 3;

    // Detect patterns
    const patterns = await this.patternDetector.detectPatterns(interactions);

    // Find significant changes
    const changes = await this.detectSignificantChanges(friends, start, end);

    return {
      innerCircleHealth: Math.round(innerCircleHealth),
      totalInteractions: interactions.length,
      uniqueFriendsContacted: uniqueFriends,
      averageBattery: Math.round(avgBattery * 10) / 10,
      topPatterns: patterns.slice(0, 3).map(p => p.description),
      significantChanges: changes,
    };
  }
}
```

### 4.4 InsightOrchestrator

Replaces the gamification listener. Coordinates insight generation.

```typescript
// src/modules/intelligence/services/insight-orchestrator.service.ts

export class InsightOrchestratorService {

  /**
   * Main entry point after weave logged
   * Replaces checkAndAwardFriendBadges + checkAndAwardGlobalAchievements
   */
  async processInteraction(interaction: Interaction): Promise<void> {
    const friendIds = await this.getInteractionFriendIds(interaction.id);

    for (const friendId of friendIds) {
      // Update quality score
      await this.relationshipQualityService.calculateRQS(friendId);

      // Update reciprocity
      await this.reciprocityService.updateMetrics(friendId);

      // Check for narrative moments
      await this.checkNarrativeMoments(friendId, interaction);

      // Update signals
      await this.signalService.updateSignals(friendId);
    }

    // Maybe generate an insight (rate-limited)
    await this.maybeGenerateInsight(friendIds, interaction);
  }

  /**
   * Check for narrative moments triggered by this interaction
   */
  private async checkNarrativeMoments(
    friendId: string,
    interaction: Interaction
  ): Promise<void> {
    const friend = await this.getFriend(friendId);
    const narrative = await this.narrativeService.getNarrative(friendId);
    const interactionCount = await this.countInteractions(friendId);

    // First weave
    if (interactionCount === 1) {
      await this.narrativeService.recordMoment(friendId, 'first_weave', {
        interactionId: interaction.id,
      });
    }

    // First deep conversation (based on reflection signals)
    if (
      interaction.notes?.length > 100 &&
      !await this.narrativeService.hasMoment(friendId, 'first_deep_conversation')
    ) {
      const signals = await this.extractSignals(interaction.notes);
      if (signals?.dynamics?.depthSignal === 'deep') {
        await this.narrativeService.recordMoment(friendId, 'first_deep_conversation', {
          interactionId: interaction.id,
        });
      }
    }

    // Rekindled (was dormant, now active)
    if (friend.previousTier === 'dormant' && friend.tier !== 'dormant') {
      await this.narrativeService.recordMoment(friendId, 'rekindled', {
        interactionId: interaction.id,
      });
    }

    // Anniversary check
    const friendshipStart = narrative.friendshipStartDate;
    const now = new Date();
    if (this.isAnniversaryWeek(friendshipStart, now)) {
      const years = this.yearsBetween(friendshipStart, now);
      await this.narrativeService.recordMoment(friendId, 'anniversary', {
        interactionId: interaction.id,
        metadata: { years },
      });
    }
  }

  /**
   * Conditionally generate an insight (not every interaction)
   */
  private async maybeGenerateInsight(
    friendIds: string[],
    interaction: Interaction
  ): Promise<void> {
    // Rate limit: max 1 insight per day
    const lastInsight = await this.getLastInsightTime();
    if (this.daysBetween(lastInsight, new Date()) < 1) {
      return;
    }

    // Collect signals across all friends
    const signals = await this.signalService.getActiveSignals(friendIds);

    // Need sufficient signal strength
    if (signals.length < 2 || signals.every(s => s.confidence < 0.6)) {
      return;
    }

    // Generate insight via Oracle
    const insight = await this.oracleService.synthesizeInsight({
      signals,
      interaction,
      userContext: await this.getUserContext(),
    });

    if (insight) {
      await this.storeInsight(insight);
      await this.maybeNotifyUser(insight);
    }
  }
}
```

---

## Part 5: Oracle Integration

### 5.1 New Prompts

Add to `src/shared/services/llm/prompt-registry.ts`:

```typescript
// Friendship Narrative Generation
registerPrompt({
  id: 'friendship_narrative',
  version: '1.0.0',
  systemPrompt: `You are helping someone understand the story of their friendship.
Given the data about this relationship, write a brief narrative (2-4 sentences) that:
1. Captures the essence of how this friendship has evolved
2. Highlights meaningful moments without being sentimental
3. Speaks in second person ("You and Sarah...")
4. Feels like a thoughtful observation, not a summary

Avoid:
- Flowery language or excessive metaphors
- Judgment about the quality of the friendship
- Suggestions or advice (this is observation only)
- Generic phrases that could apply to any friendship`,

  userPromptTemplate: `Friend: {{friendName}}
Current chapter: {{chapter}}
Days since you met: {{daysSinceStart}}
Relationship texture: {{texture.summary}}
Trajectory: {{trajectory}}
Notable patterns: {{patterns}}

Key moments:
{{#each moments}}
- {{this.type}} ({{this.daysAgo}} days ago)
{{/each}}

Write a brief narrative about this friendship:`,

  responseSchema: {
    type: 'object',
    properties: {
      narrative: { type: 'string', maxLength: 500 },
    },
    required: ['narrative'],
  },
});

// Network Reflection Generation
registerPrompt({
  id: 'network_reflection',
  version: '1.0.0',
  systemPrompt: `You are writing a periodic reflection letter about someone's social life.
This should feel like a thoughtful letter from a wise friend who has been observing their patterns.

Guidelines:
1. Be warm but not effusive
2. Ground observations in specific data (e.g., "you saw your inner circle 8 times")
3. Notice patterns without judging them
4. If suggesting anything, frame it as a gentle question, not advice
5. Keep the whole reflection under 200 words
6. Match the user's preferred tone: {{tone}}

Structure:
- greeting: A personalized opener (1 sentence)
- observations: 2-3 key patterns or changes noticed (array of strings)
- celebration: Something they can feel good about (optional)
- gentleNudge: A soft suggestion if warranted (optional)
- closing: A warm sign-off (1 sentence)`,

  userPromptTemplate: `Period: {{period}} ({{periodStart}} to {{periodEnd}})
User's current life phase: {{lifePhase}}
User's social season: {{socialSeason}}
Preferred tone: {{tone}}

Data:
- Inner circle health: {{dataSnapshot.innerCircleHealth}}/100
- Total interactions: {{dataSnapshot.totalInteractions}}
- Unique friends contacted: {{dataSnapshot.uniqueFriendsContacted}}
- Average energy level: {{dataSnapshot.averageBattery}}/5
- Top patterns: {{dataSnapshot.topPatterns}}

Significant changes:
{{#each dataSnapshot.significantChanges}}
- {{this.type}}: {{this.description}} ({{this.friendName}})
{{/each}}

Write the reflection:`,

  responseSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', maxLength: 100 },
      observations: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      celebration: { type: 'string', maxLength: 150 },
      gentleNudge: { type: 'string', maxLength: 150 },
      closing: { type: 'string', maxLength: 100 },
    },
    required: ['greeting', 'observations', 'closing'],
  },
});

// Insight Synthesis
registerPrompt({
  id: 'insight_synthesis',
  version: '1.0.0',
  systemPrompt: `You are synthesizing relationship signals into a single insightful observation.
Given multiple data signals about someone's social patterns, create ONE insight that:
1. Connects multiple signals into a coherent observation
2. Focuses on meaning, not just facts
3. Feels like noticing something, not reporting metrics
4. Is 1-2 sentences maximum
5. Starts with a natural opener like "I noticed...", "Something interesting...", or "A thought..."

Never:
- Use exclamation points
- Sound like a notification or alert
- Give direct advice (questions are okay)
- Mention scores or percentages`,

  userPromptTemplate: `Signals:
{{#each signals}}
- {{this.type}}: {{this.description}} (confidence: {{this.confidence}})
{{/each}}

Recent context:
- User's energy: {{userContext.battery}}/5
- Life phase: {{userContext.lifePhase}}
- Recent journal themes: {{userContext.recentThemes}}

Preferred tone: {{userContext.tone}}

Synthesize into one insight:`,

  responseSchema: {
    type: 'object',
    properties: {
      opener: { type: 'string', maxLength: 50 },
      message: { type: 'string', maxLength: 200 },
      tone: { enum: ['curious', 'affirming', 'celebratory', 'gentle', 'reflective'] },
      suggestedAction: {
        type: 'object',
        properties: {
          type: { enum: ['reflect', 'reach_out', 'plan', 'journal', 'oracle_chat'] },
          label: { type: 'string', maxLength: 30 },
        },
      },
    },
    required: ['opener', 'message', 'tone'],
  },
});

// Reciprocity Interpretation
registerPrompt({
  id: 'reciprocity_interpretation',
  version: '1.0.0',
  systemPrompt: `You are helping someone understand the balance in one of their friendships.
Given reciprocity data, write a brief, nuanced interpretation that:
1. Acknowledges the data without judgment
2. Offers possible interpretations (not assumptions)
3. Frames as curiosity, not concern
4. Is 2-3 sentences maximum

Remember: Imbalanced initiation isn't inherently bad. Some people are natural initiators.
Some friends are going through hard times. The goal is awareness, not correction.`,

  userPromptTemplate: `Friend: {{friendName}}
Your initiation ratio: {{ratio}} (0 = they always, 1 = you always)
Last 30 days: You initiated {{your30}} times, they initiated {{their30}} times
Trend: {{trend}} ({{trendMagnitude}})
This friend's archetype: {{archetype}}

Write a nuanced interpretation:`,

  responseSchema: {
    type: 'object',
    properties: {
      interpretation: { type: 'string', maxLength: 300 },
      possibleReasons: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      reflectionQuestion: { type: 'string', maxLength: 100 },
    },
    required: ['interpretation'],
  },
});
```

### 5.2 Oracle Service Extensions

Add methods to `src/modules/oracle/services/oracle-service.ts`:

```typescript
/**
 * Generate a friendship narrative
 */
async generateFriendshipNarrative(
  context: FriendshipNarrativeContext
): Promise<string> {
  const response = await this.llmService.completeStructured({
    promptId: 'friendship_narrative',
    variables: {
      friendName: context.friendName,
      chapter: context.chapter,
      daysSinceStart: context.daysSinceStart,
      texture: context.texture,
      trajectory: context.trajectory,
      patterns: context.patterns.join(', '),
      moments: context.moments.map(m => ({
        type: this.humanizeMomentType(m.type),
        daysAgo: this.daysBetween(m.occurredAt, new Date()),
      })),
    },
    contextTier: ContextTier.ESSENTIAL,
  });

  return response.narrative;
}

/**
 * Generate a network reflection
 */
async generateNetworkReflection(
  context: NetworkReflectionContext
): Promise<NetworkReflection['content']> {
  const response = await this.llmService.completeStructured({
    promptId: 'network_reflection',
    variables: {
      period: context.period,
      periodStart: this.formatDate(context.dataSnapshot.periodStart),
      periodEnd: this.formatDate(context.dataSnapshot.periodEnd),
      lifePhase: context.lifeContext?.currentPhase || 'normal',
      socialSeason: context.userProfile.socialSeason,
      tone: context.userProfile.oracleTone || 'warm',
      dataSnapshot: context.dataSnapshot,
    },
    contextTier: ContextTier.PATTERN,
  });

  return {
    greeting: response.greeting,
    observations: response.observations,
    celebration: response.celebration,
    gentleNudge: response.gentleNudge,
    closing: response.closing,
  };
}

/**
 * Synthesize signals into an insight
 */
async synthesizeInsight(
  context: InsightSynthesisContext
): Promise<RelationshipInsight | null> {
  // Don't generate if signals are too weak
  const avgConfidence = context.signals.reduce((sum, s) => sum + s.confidence, 0)
    / context.signals.length;
  if (avgConfidence < 0.5) {
    return null;
  }

  const response = await this.llmService.completeStructured({
    promptId: 'insight_synthesis',
    variables: {
      signals: context.signals.map(s => ({
        type: s.type,
        description: s.description,
        confidence: Math.round(s.confidence * 100) / 100,
      })),
      userContext: {
        battery: context.userContext.battery,
        lifePhase: context.userContext.lifePhase,
        recentThemes: context.userContext.recentThemes.join(', '),
        tone: context.userContext.tone,
      },
    },
    contextTier: ContextTier.ESSENTIAL,
  });

  return {
    id: generateId(),
    type: 'observation',
    tone: response.tone,
    opener: response.opener,
    message: response.message,
    groundingData: {
      signals: context.signals.map(s => s.type),
      dataPoints: {},
      confidence: avgConfidence,
    },
    suggestedAction: response.suggestedAction,
    generatedAt: new Date(),
    expiresAt: addDays(new Date(), 7),
    status: 'active',
  };
}

/**
 * Interpret reciprocity for a specific friend
 */
async interpretReciprocity(
  friendId: string,
  metrics: ReciprocityMetrics
): Promise<ReciprocityInterpretation> {
  const friend = await this.getFriend(friendId);

  const response = await this.llmService.completeStructured({
    promptId: 'reciprocity_interpretation',
    variables: {
      friendName: friend.name,
      ratio: Math.round(metrics.initiationRatio * 100) / 100,
      your30: metrics.windows.last30Days.yourInitiations,
      their30: metrics.windows.last30Days.theirInitiations,
      trend: metrics.trend,
      trendMagnitude: metrics.trendMagnitude,
      archetype: friend.archetype,
    },
    contextTier: ContextTier.ESSENTIAL,
  });

  return {
    interpretation: response.interpretation,
    possibleReasons: response.possibleReasons,
    reflectionQuestion: response.reflectionQuestion,
  };
}
```

### 5.3 Cost Management

| Feature | Frequency | Model | Cost Strategy |
|---------|-----------|-------|---------------|
| Friendship narrative | On request or anniversary | Haiku/Flash | Cache 30 days |
| Network reflection | Weekly/biweekly | Haiku/Flash | Scheduled, cached |
| Insight synthesis | Max 1/day when triggered | Haiku/Flash | Rate limited |
| Reciprocity interpretation | On demand | Haiku/Flash | On-demand only |
| Conversation starters | On suggestion tap | Haiku/Flash | Lazy generation |

**Fallback Strategy:**

```typescript
// For each LLM call, have a template fallback
async generateFriendshipNarrative(context): Promise<string> {
  try {
    return await this.llmService.completeStructured({...});
  } catch (error) {
    // Log but don't fail
    logger.warn('LLM narrative generation failed, using template', { error });
    return this.templateFallback.generateNarrative(context);
  }
}
```

---

## Part 6: UI Components

### 6.1 InsightCard (Replaces OracleInsightCard)

Simple, conversational design:

```typescript
// src/modules/intelligence/components/InsightCard.tsx

interface InsightCardProps {
  insight: RelationshipInsight;
  onDismiss: () => void;
  onAction?: () => void;
}

export function InsightCard({ insight, onDismiss, onAction }: InsightCardProps) {
  return (
    <Card className="p-4 border border-border/50">
      {/* Conversational opener */}
      <Text variant="caption" className="text-muted-foreground mb-2">
        {insight.opener}
      </Text>

      {/* Main message */}
      <Text variant="body" className="mb-3">
        {insight.message}
      </Text>

      {/* Optional context */}
      {insight.context && (
        <Text variant="caption" className="text-muted-foreground mb-3">
          {insight.context}
        </Text>
      )}

      {/* Actions */}
      <View className="flex-row justify-between items-center">
        <Pressable onPress={onDismiss}>
          <Text variant="caption" className="text-muted-foreground">
            Dismiss
          </Text>
        </Pressable>

        {insight.suggestedAction && (
          <Pressable onPress={onAction}>
            <Text variant="caption" className="text-primary">
              {insight.suggestedAction.label}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}
```

### 6.2 NetworkReflectionSheet

Full-screen sheet for periodic reflections:

```typescript
// src/modules/intelligence/components/NetworkReflectionSheet.tsx

interface NetworkReflectionSheetProps {
  reflection: NetworkReflection;
  onClose: () => void;
}

export function NetworkReflectionSheet({
  reflection,
  onClose
}: NetworkReflectionSheetProps) {
  const { content } = reflection;

  return (
    <BottomSheet snapPoints={['85%']} onClose={onClose}>
      <ScrollView className="p-6">
        {/* Header */}
        <Text variant="h3" className="mb-2">
          Your {reflection.period} reflection
        </Text>
        <Text variant="caption" className="text-muted-foreground mb-6">
          {formatDateRange(reflection.periodStart, reflection.periodEnd)}
        </Text>

        {/* Greeting */}
        <Text variant="body" className="mb-6 italic">
          {content.greeting}
        </Text>

        {/* Observations */}
        <View className="mb-6">
          {content.observations.map((observation, i) => (
            <View key={i} className="flex-row mb-3">
              <View className="w-2 h-2 rounded-full bg-primary mt-2 mr-3" />
              <Text variant="body" className="flex-1">
                {observation}
              </Text>
            </View>
          ))}
        </View>

        {/* Celebration */}
        {content.celebration && (
          <Card className="p-4 bg-success/10 border-success/20 mb-6">
            <Text variant="body">{content.celebration}</Text>
          </Card>
        )}

        {/* Gentle nudge */}
        {content.gentleNudge && (
          <Card className="p-4 bg-muted mb-6">
            <Text variant="body" className="text-muted-foreground">
              {content.gentleNudge}
            </Text>
          </Card>
        )}

        {/* Closing */}
        <Text variant="body" className="text-center text-muted-foreground">
          {content.closing}
        </Text>

        {/* Actions */}
        <View className="mt-8">
          <Button onPress={onClose} variant="outline" className="w-full">
            Close
          </Button>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
```

### 6.3 FriendshipStoryView

Timeline view for individual friendship narratives:

```typescript
// src/modules/intelligence/components/FriendshipStoryView.tsx

interface FriendshipStoryViewProps {
  friendId: string;
}

export function FriendshipStoryView({ friendId }: FriendshipStoryViewProps) {
  const narrative = useNarrative(friendId);
  const moments = useMoments(friendId);
  const [narrativeText, setNarrativeText] = useState<string | null>(null);

  // Lazy load narrative text
  useEffect(() => {
    narrativeService.generateNarrativeText(friendId)
      .then(setNarrativeText);
  }, [friendId]);

  return (
    <View className="p-4">
      {/* Chapter badge */}
      <View className="flex-row items-center mb-4">
        <ChapterIcon chapter={narrative.currentChapter} />
        <Text variant="caption" className="ml-2 text-muted-foreground">
          {humanizeChapter(narrative.currentChapter)}
        </Text>
      </View>

      {/* Narrative text */}
      {narrativeText && (
        <Text variant="body" className="mb-6 italic">
          {narrativeText}
        </Text>
      )}

      {/* Timeline */}
      <View>
        <Text variant="h4" className="mb-4">Your story together</Text>
        {moments.map((moment, i) => (
          <TimelineMoment
            key={moment.id}
            moment={moment}
            isLast={i === moments.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function TimelineMoment({
  moment,
  isLast
}: {
  moment: NarrativeMomentRecord;
  isLast: boolean;
}) {
  return (
    <View className="flex-row">
      {/* Timeline line */}
      <View className="items-center mr-4">
        <View className="w-3 h-3 rounded-full bg-primary" />
        {!isLast && <View className="w-0.5 flex-1 bg-border" />}
      </View>

      {/* Content */}
      <View className="flex-1 pb-6">
        <Text variant="body">
          {humanizeMomentType(moment.type)}
        </Text>
        <Text variant="caption" className="text-muted-foreground">
          {formatDate(moment.occurredAt)}
        </Text>
        {moment.userReflection && (
          <Text variant="caption" className="mt-2 italic">
            "{moment.userReflection}"
          </Text>
        )}
      </View>
    </View>
  );
}
```

---

## Part 7: Migration Strategy

### Phase 1: Data Model Migration (Week 1)

1. **Add new tables** (non-breaking):
   - `relationship_quality_snapshots`
   - `friendship_narratives`
   - `narrative_moments`
   - `reciprocity_snapshots`
   - `network_reflections`

2. **Add columns to user_profile**:
   - `life_phase`
   - `life_phase_started_at`
   - `life_phase_end_at`
   - `life_phase_source`
   - `life_phase_note`

3. **Migrate existing data**:
   - Convert existing badge unlocks to narrative moments where applicable
   - Calculate initial RQS for all friends
   - Generate initial reciprocity snapshots

### Phase 2: Service Implementation (Week 2-3)

1. **Implement core services**:
   - `RelationshipQualityService`
   - `NarrativeService`
   - `ReciprocityService`
   - `ReflectionSynthesizerService`

2. **Add Oracle prompts**:
   - `friendship_narrative`
   - `network_reflection`
   - `insight_synthesis`
   - `reciprocity_interpretation`

3. **Implement InsightOrchestrator**:
   - Replace gamification listener
   - Wire up to interaction events

### Phase 3: UI Implementation (Week 3-4)

1. **New components**:
   - `InsightCard`
   - `NetworkReflectionSheet`
   - `FriendshipStoryView`
   - `ReciprocityInsightCard`

2. **Integration points**:
   - Add FriendshipStoryView to friend profile
   - Add InsightCard to home dashboard
   - Add periodic reflection trigger

### Phase 4: Deprecation (Week 4-5)

1. **Feature flag old system**:
   ```typescript
   const useNewIntelligence = await featureFlags.get('relationship_intelligence');
   ```

2. **Gradual rollout**:
   - 10% of users → monitor engagement
   - 50% of users → gather feedback
   - 100% of users → full rollout

3. **Remove old code** (after 2 weeks at 100%):
   - Delete `badge-definitions.ts`
   - Delete `achievement-definitions.ts`
   - Delete `milestone-tracker.service.ts`
   - Delete `badge.service.ts`
   - Delete `achievement.service.ts`
   - Delete `streak.service.ts`
   - Delete `TrophyCabinetModal.tsx`
   - Delete `BadgeUnlockModal.tsx`
   - Delete `MilestoneCelebration.tsx`

---

## Part 8: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/modules/intelligence/types/relationship-quality.types.ts` | RQS type definitions |
| `src/modules/intelligence/types/narrative.types.ts` | Narrative type definitions |
| `src/modules/intelligence/types/reciprocity.types.ts` | Reciprocity type definitions |
| `src/modules/intelligence/types/reflection.types.ts` | Reflection type definitions |
| `src/modules/intelligence/types/life-context.types.ts` | Life context types |
| `src/modules/intelligence/types/insight.types.ts` | Insight type definitions |
| `src/modules/intelligence/services/relationship-quality.service.ts` | RQS calculations |
| `src/modules/intelligence/services/narrative.service.ts` | Narrative management |
| `src/modules/intelligence/services/reciprocity.service.ts` | Reciprocity tracking |
| `src/modules/intelligence/services/reflection-synthesizer.service.ts` | Periodic reflections |
| `src/modules/intelligence/services/insight-orchestrator.service.ts` | Main coordinator |
| `src/modules/intelligence/services/life-context.service.ts` | Life phase management |
| `src/modules/intelligence/components/InsightCard.tsx` | Insight display |
| `src/modules/intelligence/components/NetworkReflectionSheet.tsx` | Reflection display |
| `src/modules/intelligence/components/FriendshipStoryView.tsx` | Narrative timeline |
| `src/modules/intelligence/components/ReciprocityInsightCard.tsx` | Reciprocity display |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add new tables |
| `src/db/migrations.ts` | Migration for new schema |
| `src/shared/services/llm/prompt-registry.ts` | Add new prompts |
| `src/modules/oracle/services/oracle-service.ts` | Add new generation methods |
| `src/modules/relationships/screens/FriendProfileScreen.tsx` | Add FriendshipStoryView |
| `src/modules/home/components/widgets/` | Replace badge widgets with insight widgets |
| `src/shared/components/DataInitializer.tsx` | Wire up InsightOrchestrator |

### Files to Delete (After Migration)

| File | Reason |
|------|--------|
| `src/modules/gamification/constants/badge-definitions.ts` | Replaced by narratives |
| `src/modules/gamification/constants/achievement-definitions.ts` | Replaced by narratives |
| `src/modules/gamification/services/badge.service.ts` | Replaced by NarrativeService |
| `src/modules/gamification/services/achievement.service.ts` | Replaced by RQS |
| `src/modules/gamification/services/streak.service.ts` | Replaced by consistency in RQS |
| `src/modules/gamification/services/milestone-tracker.service.ts` | Replaced by NarrativeService |
| `src/modules/gamification/components/TrophyCabinetModal.tsx` | No longer needed |
| `src/modules/gamification/components/BadgeUnlockModal.tsx` | Replaced by InsightCard |
| `src/modules/gamification/components/MilestoneCelebration.tsx` | Replaced by gentle insights |
| `src/modules/gamification/listeners/gamification.listener.ts` | Replaced by InsightOrchestrator |

---

## Part 9: Success Metrics

| Metric | Old Baseline | Target | Measurement |
|--------|--------------|--------|-------------|
| Daily active users | — | +10% | Analytics |
| Interactions logged per user/week | — | +15% | Database |
| Reflections written per user/week | — | +20% | Database |
| "Not helpful" rate on insights | ~10% | <5% | Insight feedback |
| Insight acted-upon rate | — | >40% | Insight status |
| Time in app per session | — | +5% | Analytics |
| User-reported "app understands me" | — | >70% | Survey |

### Qualitative Success Indicators

- Users mention "the app noticed" in feedback
- Users share friendship narratives with friends
- Reduction in guilt-related feedback ("I feel bad when...")
- Increase in journal reflection depth

---

## Part 10: Open Questions

1. **Narrative generation frequency**: Generate on-demand only, or proactively cache?
2. **Reciprocity sensitivity**: At what threshold is imbalance "worth mentioning"?
3. **Life context inference**: Should we infer phases from behavior, or require user declaration?
4. **Network reflection opt-in**: Weekly by default, or require explicit opt-in?
5. **Friendship story sharing**: Allow users to share narrative with the friend?

---

## Part 11: Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM costs increase | High | Aggressive caching, rate limiting, template fallbacks |
| Narratives feel generic | Medium | Rich context in prompts, user tone preference |
| Users miss badges | Low | Keep milestone moments, just present differently |
| Migration breaks existing data | High | Non-destructive migration, feature flags |
| Insights not engaging | Medium | A/B test against old system, iterate on prompts |

---

## Appendix A: Moment Type Definitions

```typescript
const MOMENT_TYPE_DISPLAY: Record<NarrativeMoment, string> = {
  first_weave: 'Your first connection',
  first_deep_conversation: 'When it got real',
  first_crisis_support: 'They showed up',
  survived_distance: 'Weathered the gap',
  rekindled: 'The return',
  anniversary: 'Another year together',
  became_consistent: 'Found your rhythm',
  entered_inner_circle: 'Became essential',
  shared_milestone: 'Celebrated together',
  reciprocity_shift: 'The balance shifted',
};
```

## Appendix B: Chapter Descriptions

```typescript
const CHAPTER_DESCRIPTIONS: Record<FriendshipChapter, string> = {
  spark: 'A new connection finding its footing',
  kindling: 'Building momentum together',
  steady_flame: 'A reliable rhythm established',
  deep_roots: 'A resilient bond that weathers storms',
  rekindled: 'Reconnected after time apart',
  constellation: 'Part of your essential network',
};
```

---

## Part 12: Phased Implementation Strategy

### Overview

This is an ambitious system. To de-risk the migration and validate user response incrementally, we propose a **four-phase rollout** with clear milestones and decision gates.

### Phase 1: Network Reflections (Weeks 1-2)

**Goal**: Introduce the "understanding" paradigm without replacing anything.

**Deliverables**:
- `ReflectionSynthesizerService` - Generates weekly/monthly reflections
- `NetworkReflectionSheet` - Bottom sheet displaying reflections
- `network_reflection` prompt in Oracle registry
- Notification trigger for reflection availability

**Why Start Here**:
- **Low risk**: Adds new value without changing existing flows
- **High emotional impact**: Weekly "letters" feel personal immediately
- **Validates LLM approach**: Tests Oracle narrative generation at scale
- **Measurable**: Can track open rates, time spent reading

**Data Requirements**:
- Uses existing interaction data (no new tables needed initially)
- Calculates inner circle health from existing tier assignments
- Pulls social battery from existing `UserProfile.socialBattery`

**Decision Gate**: Proceed to Phase 2 if:
- >40% of users open their first reflection
- >60% read to completion (scroll depth)
- Qualitative feedback positive ("felt understood")

---

### Phase 2: Friendship Narratives (Weeks 3-4)

**Goal**: Add relational depth to individual friend profiles.

**Deliverables**:
- `friendship_narratives` and `narrative_moments` tables (schema migration)
- `NarrativeService` - Manages chapters and moments
- `FriendshipStoryView` component on friend profile
- `friendship_narrative` prompt in Oracle registry

**Integration Point**: Add as a collapsible section on `FriendProfileScreen.tsx`, below the existing info but above interaction history.

**Why Phase 2**:
- Builds on Phase 1's validated narrative generation
- Enriches existing UI without replacing anything
- Creates emotional attachment to profiles

**Decision Gate**: Proceed to Phase 3 if:
- >30% of users expand the story section
- Average time on friend profile increases
- Users mention "story" in feedback

---

### Phase 3: Relationship Quality & Insights (Weeks 5-7)

**Goal**: Replace reactive badge popups with proactive insights.

**Deliverables**:
- `relationship_quality_snapshots` and `reciprocity_snapshots` tables
- `RelationshipQualityService` - Calculates RQS per friend
- `ReciprocityService` - Tracks initiation balance
- `InsightOrchestratorService` - Coordinates insight generation
- `InsightCard` component
- `insight_synthesis` and `reciprocity_interpretation` prompts
- New dashboard widget or slot in `TodaysFocusWidgetV2`

**Critical Integration**:
```typescript
// In DataInitializer.tsx or OrchestratorService
// After interaction logged:
await insightOrchestrator.processInteraction(interaction);
// This REPLACES the gamification listener call, not supplements it
```

**Decision Gate**: Proceed to Phase 4 if:
- Insight engagement > badge engagement (historical baseline)
- "Not helpful" rate < 10%
- >35% of insights are acted upon

---

### Phase 4: Gamification Deprecation (Weeks 8-10)

**Goal**: Remove legacy badge system, keep streaks.

**Deliverables**:
- Feature flag to hide badge UI
- Remove badge check listeners from orchestrator
- Archive (don't delete) badge data for potential future reference
- Clean up dead code after 2 weeks at 100% rollout

**Files to Archive** (move to `src/modules/gamification/_deprecated/`):
- `badge-definitions.ts`
- `achievement-definitions.ts`
- `badge.service.ts`
- `achievement.service.ts`
- `TrophyCabinetModal.tsx`
- `BadgeUnlockModal.tsx`
- `MilestoneCelebration.tsx`

**Files to KEEP**:
- `streak.service.ts`
- `season-aware-streak.service.ts`
- All streak UI components

---

### Phase Diagram

```
Week 1-2          Week 3-4          Week 5-7          Week 8-10
┌─────────┐       ┌─────────┐       ┌─────────┐       ┌─────────┐
│ PHASE 1 │──────▶│ PHASE 2 │──────▶│ PHASE 3 │──────▶│ PHASE 4 │
│Reflect- │ Gate  │Narrative│ Gate  │ RQS +   │ Gate  │Deprecate│
│  ions   │  ✓    │ Stories │  ✓    │ Insights│  ✓    │ Badges  │
└─────────┘       └─────────┘       └─────────┘       └─────────┘
     │                 │                 │                 │
     ▼                 ▼                 ▼                 ▼
 [Adds to           [Adds to          [Replaces       [Removes old
  app]               profiles]         listener]        code]
```

---

## Part 13: Streak Coexistence Strategy

### Philosophy

The streak system serves a different purpose than the badge system:
- **Badges**: "You achieved something!" → Gamification → Being removed
- **Streaks**: "You're showing up consistently" → Habit formation → Being kept

Consistency awareness is valuable as long as it's presented compassionately. The existing `SeasonAwareStreakService` already does this beautifully.

### What Stays

| Component | Location | Reason |
|-----------|----------|--------|
| `streak.service.ts` | `gamification/services/` | Core calculation logic |
| `season-aware-streak.service.ts` | `intelligence/services/` | Compassionate presentation |
| Streak display in `TodaysFocusWidgetV2` | `home/components/` | Already integrated |
| Streak visibility toggle | Based on social season | Respects user energy |

### Integration with New System

The streak system and insight system coexist without conflict:

```typescript
// After weave logged:

// 1. Streak update (existing)
await SeasonAwareStreakService.updateStreakAfterActivity();

// 2. Insight orchestration (new)
await insightOrchestrator.processInteraction(interaction);

// These are independent - streaks are about YOUR consistency
// Insights are about RELATIONSHIP understanding
```

### UI Coexistence

```
┌─────────────────────────────────────────┐
│ Today's Focus                           │
├─────────────────────────────────────────┤
│ [Streak indicator]  [Week progress]     │ ← KEEP (gamification)
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 💡 "I noticed you and Sarah..."     │ │ ← NEW (intel insight)
│ │                          [Dismiss]  │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ [Suggestions list...]                   │
└─────────────────────────────────────────┘
```

### Semantic Clarity

To avoid confusion, rename concepts:
- **Streak** = Your personal consistency pattern (keep)
- **Insight** = What the app noticed about relationships (new)
- **Achievement/Badge** = Legacy gamification (remove)

### Season Awareness Extension

The new insight system should also respect social seasons:

```typescript
// In InsightOrchestrator
async maybeGenerateInsight(): Promise<void> {
  const profile = await this.getUserProfile();
  
  // Respect Resting season
  if (profile.socialSeason === 'resting') {
    return; // No insights during rest periods
  }
  
  // Gentler insights during Balanced season
  const tone = profile.socialSeason === 'balanced' ? 'gentle' : 'normal';
  
  // ...generate insight with appropriate tone
}
```

---

## Part 14: UI Integration

### 14.1 Information Architecture

| Insight Type | Surface Location | Trigger |
|--------------|------------------|---------|
| **Network Reflection** | Full-screen sheet (push notification) | Weekly/biweekly schedule |
| **Daily Insight** | Card slot in Today's Focus | After weave logged (rate limited) |
| **Friendship Narrative** | Collapsible section on Friend Profile | On demand (tap to generate) |
| **Reciprocity Insight** | Inline on Friend Profile, below narrative | Calculated, shown if notable |

### 14.2 Today's Focus Widget Enhancement

**Current Structure** (simplified):
```
┌─ Header (streak) ─────────────────────┐
├─ Upcoming Dates ──────────────────────┤
├─ Pending Plans ───────────────────────┤
├─ Suggestions ─────────────────────────┤
└─ Footer (weekly progress) ────────────┘
```

**Proposed Structure** (add insight slot):
```
┌─ Header (streak) ─────────────────────┐
├─ 💡 DAILY INSIGHT (new, optional) ────┤  ← Subtle, dismissible
├─ Upcoming Dates ──────────────────────┤
├─ Pending Plans ───────────────────────┤
├─ Suggestions ─────────────────────────┤
└─ Footer (weekly progress) ────────────┘
```

**InsightSlot Component**:
```tsx
// New component: src/modules/intelligence/components/InsightSlot.tsx

export function InsightSlot() {
  const insight = useActiveInsight(); // Fetches latest unexpired insight
  
  if (!insight) return null;
  
  return (
    <View className="mx-4 mb-3">
      <InsightCard 
        insight={insight}
        onDismiss={() => dismissInsight(insight.id)}
        onAction={() => handleInsightAction(insight)}
      />
    </View>
  );
}
```

### 14.3 Friend Profile Enhancement

Based on actual `friend-profile.tsx` structure, here's where intelligence features integrate:

**Current Component Hierarchy**:
```
friend-profile.tsx
├─ ProfileHeader
│   ├─ Navigation (back, actions menu)
│   ├─ FriendListRowContent (avatar, name, tier/archetype)
│   ├─ PatternBadge (interaction patterns)
│   ├─ PendingWeavesBadge (if linked friend)
│   ├─ LinkedArchetypeBadge (their chosen archetype)
│   └─ TierFitCard (tier alignment insight)
├─ ActionButtons
│   ├─ Log Weave → /weave-logger
│   ├─ Plan Weave → PlanChoiceSheet
│   └─ Journal → /journal (friend-arc mode)
├─ LifeEventsSection
│   └─ Active life events with add/edit
└─ TimelineList (SectionList)
    ├─ Seeds (future plans)
    ├─ Today (today's interactions)
    └─ Woven Memories (past interactions)
```

**Enhanced Layout — Where New Features Go**:

```
┌─────────────────────────────────────────────────────────────┐
│  PROFILE HEADER                                             │
│  ┌─────────┬──────────────────────────────────────────────┐ │
│  │  👤     │  Marcus Chen                                 │ │
│  │ avatar  │  ⭐ Inner Circle • The Hermit                │ │
│  └─────────┴──────────────────────────────────────────────┘ │
│                                                             │
│  [PatternBadge: "Deep conversationalist"]                   │
│  [LinkedArchetypeBadge: "They see themselves as The Fool"]  │
│  [TierFitCard: Current tier fit info]  ← EXISTING          │
├─────────────────────────────────────────────────────────────┤
│  ACTION BUTTONS                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                 │
│  │ Log Weave │ │Plan Weave │ │  Journal  │                 │
│  └───────────┘ └───────────┘ └───────────┘                 │
├─────────────────────────────────────────────────────────────┤
│  📖 YOUR STORY (NEW — collapsible section)                  │
│  ─────────────────────────────────────────────────────────  │
│  "A deep friendship in its 'steady flame' chapter.          │
│   You met 2 years ago at a dinner party, and since then     │
│   you've been each other's go-to for late-night talks."     │
│                                                             │
│   Moments that matter:                                      │
│   ├─ 📍 First weave: Coffee catch-up (Nov 2022)             │
│   ├─ 💬 First deep convo: That late-night call (Jan 2023)   │
│   └─ 🌟 Became consistent: Weekly walks started (Mar 2023)  │
│                                                             │
│   [Expand full story ↓]                                     │
├─────────────────────────────────────────────────────────────┤
│  ⚖️ BALANCE (NEW — inline insight, contextual)              │
│  ─────────────────────────────────────────────────────────  │
│  "You tend to reach out first (68% of the time).            │
│   But Marcus always shows up when it counts —               │
│   quality over quantity."                                   │
│                                                             │
│   [Dismiss ✕]  [Explore in Oracle →]                        │
├─────────────────────────────────────────────────────────────┤
│  LIFE EVENTS  ← EXISTING                                    │
│  🎂 Birthday in 2 weeks  •  ✈️ Traveling until Feb 15       │
│                                                [+ Add]      │
├─────────────────────────────────────────────────────────────┤
│  TIMELINE  ← EXISTING                                       │
│  ┌─ Seeds ────────────────────────────────────────────────┐ │
│  │  📅 Feb 10 — Dinner at Giovanni's (planned)            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Today ────────────────────────────────────────────────┐ │
│  │  (empty)                                               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌─ Woven Memories ───────────────────────────────────────┐ │
│  │  Jan 28 — Coffee and deep talk (1.5 hrs)               │ │
│  │  Jan 21 — Group dinner at Cafe Luna                    │ │
│  │  Jan 14 — Quick call (30 min)                          │ │
│  │  ...                                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**New Components Required**:

#### 1. `FriendshipStorySection`

```tsx
// src/modules/intelligence/components/FriendshipStorySection.tsx

interface FriendshipStorySectionProps {
  friendId: string;
  friendName: string;
}

export function FriendshipStorySection({ friendId, friendName }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { narrative, isLoading } = useFriendshipNarrative(friendId);
  
  if (!narrative) return null; // Don't show if no data yet
  
  return (
    <CollapsibleSection
      icon={<BookOpen size={16} />}
      title="Your Story"
      initiallyExpanded={false}
      onToggle={setIsExpanded}
    >
      {/* Summary text */}
      <Text variant="body" className="mb-4" style={{ fontFamily: fonts.serif }}>
        {narrative.summary}
      </Text>
      
      {/* Moments timeline */}
      {narrative.moments?.length > 0 && (
        <View className="pl-2 border-l-2 border-border">
          {narrative.moments.slice(0, isExpanded ? undefined : 3).map((moment) => (
            <View key={moment.id} className="flex-row items-center py-1.5">
              <View className="w-2 h-2 rounded-full bg-primary -ml-[5px] mr-2" />
              <Text variant="caption" className="text-muted-foreground">
                {moment.emoji} {moment.label} — {formatDate(moment.date)}
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Expand action */}
      {narrative.moments?.length > 3 && !isExpanded && (
        <TouchableOpacity onPress={() => setIsExpanded(true)}>
          <Text variant="caption" className="text-primary mt-2">
            View full story ↓
          </Text>
        </TouchableOpacity>
      )}
    </CollapsibleSection>
  );
}
```

#### 2. `ReciprocityInsightCard`

```tsx
// src/modules/intelligence/components/ReciprocityInsightCard.tsx

interface ReciprocityInsightCardProps {
  friendId: string;
  friendName: string;
  onDismiss?: () => void;
  onExplore?: () => void;
}

export function ReciprocityInsightCard({ friendId, friendName, onDismiss, onExplore }: Props) {
  const { reciprocity, flags } = useReciprocityMetrics(friendId);
  
  // Only show if there's something notable
  if (!flags.onePersonCarrying && !flags.recentShift) return null;
  
  const message = generateReciprocityMessage(reciprocity, friendName, flags);
  
  return (
    <Card className="mx-4 my-2 p-3" style={{ backgroundColor: colors.muted }}>
      <View className="flex-row items-start">
        <Scale size={16} color={colors['muted-foreground']} className="mt-0.5 mr-2" />
        <View className="flex-1">
          <Text variant="caption" className="text-muted-foreground mb-1">
            Balance
          </Text>
          <Text variant="body" style={{ fontFamily: fonts.serif }}>
            {message}
          </Text>
        </View>
      </View>
      
      <View className="flex-row justify-end mt-2 gap-2">
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} className="px-2 py-1">
            <X size={14} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
        {onExplore && (
          <TouchableOpacity onPress={onExplore} className="flex-row items-center px-2 py-1">
            <Text variant="caption" className="text-primary mr-1">Explore</Text>
            <ArrowRight size={12} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}
```

#### 3. Integration in ProfileHeader

Modify `ProfileHeader.tsx` to include new sections:

```tsx
// In ProfileHeader.tsx — add after TierFitCard

{/* Friendship Story Section */}
<FriendshipStorySection 
  friendId={friend.id} 
  friendName={friend.name}
/>

{/* Reciprocity Insight (only shows if flags trigger) */}
<ReciprocityInsightCard
  friendId={friend.id}
  friendName={friend.name}
  onDismiss={() => dismissReciprocityInsight(friend.id)}
  onExplore={() => {
    // Navigate to Oracle with context
    router.push({
      pathname: '/oracle',
      params: { 
        context: 'reciprocity',
        friendId: friend.id,
        friendName: friend.name
      }
    });
  }}
/>
```

**Visibility Rules**:

| Section | When to Show |
|---------|--------------|
| **Your Story** | After 3+ interactions (so there's something to say) |
| **Balance** | Only if `onePersonCarrying` OR `recentShift` flags true |
| **Timeline moments** | Max 3 by default, expand to see all |

**Empty States**:

```tsx
// Your Story — too early
<View className="p-4 border border-dashed border-border rounded-lg mx-4 my-2">
  <Text variant="caption" className="text-muted-foreground text-center">
    Your story with {friendName} is just beginning.
    Keep weaving to see it unfold. ✨
  </Text>
</View>
```

**Overflow Menu Enhancement** (for story sharing):

```tsx
// In ProfileHeader action buttons, add to overflow menu (⋯)

<TouchableOpacity onPress={onShareStory}>
  <View className="flex-row items-center py-3 px-4">
    <Share size={18} color={colors.foreground} />
    <Text className="ml-3">Share Story</Text>
  </View>
</TouchableOpacity>
```

### 14.4 Network Reflection Sheet

**Trigger**: Push notification or banner in app.

**Visual Design**:
```
┌────────────────────────────────────────┐
│  Your Weekly Reflection               │
│  Jan 20-26, 2025                       │
├────────────────────────────────────────┤
│                                        │
│  "Hi there. Another week in the        │
│   books. Here's what I noticed..."     │
│                                        │
│  • You saw your inner circle 4 times,  │
│    including two deep conversations    │
│    with Marcus.                        │
│                                        │
│  • Sarah and Alex haven't been on      │
│    your radar — that's okay if         │
│    intentional.                        │
│                                        │
│  • Your energy averaged 3.2/5,         │
│    slightly lower than last week.      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ✨ Something to celebrate:       │  │
│  │ You rekindled with Jordan after  │  │
│  │ 3 months. That took intention.   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  "Take care of yourself this week.     │
│   The connections will be here         │
│   when you're ready."                  │
│                                        │
│         [Close]                        │
└────────────────────────────────────────┘
```

### 14.5 Empty States

**No insight available**:
```
┌─────────────────────────────────────┐
│  💡                                  │
│  "Insights will appear as I learn    │
│   more about your relationships."    │
└─────────────────────────────────────┘
```

**First narrative generation**:
```
┌─────────────────────────────────────┐
│  📖 Your Story                       │
│  "Keep logging weaves and I'll      │
│   start to see the story unfold."   │
│                    [Learn more]     │
└─────────────────────────────────────┘
```

---

## Part 15: Data Foundation Audit

### Confirmed Existing Capabilities

Based on codebase investigation, the following are **already in place**:

| Required Data | Existing Implementation | Location |
|---------------|-------------------------|----------|
| **Initiation tracking** | `Interaction.initiator` field | `src/db/models/Interaction.ts:66` |
| | Values: `'user' \| 'friend' \| 'mutual'` | Added in schema v25 |
| **Signal extraction** | `extractSignals()` function | `src/modules/journal/services/signal-extractor.ts` |
| | Extracts: sentiment, themes, dynamics | LLM + rule-based fallback |
| | Dynamics includes: `depthSignal`, `reciprocitySignal`, `tensionDetected` | |
| **Streak tracking** | `StreakService` | `src/modules/gamification/services/streak.service.ts` |
| | `SeasonAwareStreakService` | `src/modules/intelligence/services/season-aware-streak.service.ts` |
| | Season-aware messaging | Respects Resting/Balanced/Blooming |
| **Social battery** | `UserProfile.socialBattery` | Existing field |
| **Social season** | `UserProfile.socialSeason` | Already used across app |
| **Tier assignments** | `Friend.tier` | `'inner_circle' \| 'close' \| 'community' \| 'dormant'` |
| **Resilience scores** | `Friend.resilience` | Calculated by `ResilienceService` |

### New Tables Required (Confirmed)

| Table | Purpose | Phase |
|-------|---------|-------|
| `relationship_quality_snapshots` | Store RQS calculations over time | Phase 3 |
| `friendship_narratives` | Store chapter + cached narrative text | Phase 2 |
| `narrative_moments` | Individual story moments | Phase 2 |
| `reciprocity_snapshots` | Track balance over windows | Phase 3 |
| `network_reflections` | Store generated reflections | Phase 1 |

### Data Gaps Identified

| Gap | Severity | Mitigation |
|-----|----------|------------|
| No `initiator` tracking on historical data | Low | Future-forward only; calculate reciprocity from data available post-v25 |
| Signal extraction not stored persistently | Medium | Currently re-extracted on demand; could cache in `journal_signals` table |
| Life context fields not on user_profile | Low | Add in Phase 1 migration (simple columns) |

### Migration Safety

All new tables are **additive** — no existing data is modified:
- Existing badge/achievement data preserved (just hidden)
- Streak calculations unchanged
- Friend model unchanged (reads existing fields)

---

## Part 16: Resolved Open Questions

Based on codebase investigation and product discussion, these questions are now resolved:

### Question 1: Narrative Generation Frequency

**Decision**: Both on-demand AND cached.

| Trigger | Caching Strategy |
|---------|-----------------|
| User opens friend profile story section | Generate if no cached version, else show cached |
| Friendship anniversary | Proactively regenerate and notify |
| Significant moment recorded | Invalidate cache, lazy regenerate on next view |
| 30+ days since last generation | Mark stale, regenerate on next view |

**Implementation**:
```typescript
async generateNarrativeText(friendId: string): Promise<string> {
  const narrative = await this.getNarrative(friendId);
  const hash = this.hashNarrativeData(...);
  
  // Return cached if valid
  if (narrative.generatedNarrative && 
      narrative.generatedNarrative.dataSnapshot === hash &&
      this.daysSince(narrative.generatedNarrative.generatedAt) < 30) {
    return narrative.generatedNarrative.text;
  }
  
  // Generate fresh
  return await this.oracleService.generateFriendshipNarrative({...});
}
```

---

### Question 2: Reciprocity Sensitivity Threshold

**Decision**: 70% one direction after 5+ interactions.

| Rule | Rationale |
|------|-----------|
| Minimum 5 interactions | Avoids false positives in new friendships |
| 70% threshold | Significant but not extreme (80%+ would be concerning) |
| Window: Last 90 days | Recency matters; ancient imbalance less relevant |

**Implementation**:
```typescript
interface ReciprocityFlags {
  onePersonCarrying: boolean;  // > 0.70 or < 0.30, AND interactions >= 5
  recentShift: boolean;        // Changed > 15% in 30 days
  healthyBalance: boolean;     // 0.35 - 0.65 range
}

function calculateFlags(metrics: ReciprocityMetrics): ReciprocityFlags {
  const { initiationRatio, windows } = metrics;
  const hasEnoughData = windows.last90Days.totalInteractions >= 5;
  
  return {
    onePersonCarrying: hasEnoughData && (initiationRatio > 0.70 || initiationRatio < 0.30),
    recentShift: Math.abs(windows.last30Days.ratio - windows.last90Days.ratio) > 0.15,
    healthyBalance: initiationRatio >= 0.35 && initiationRatio <= 0.65,
  };
}
```

**Display Logic**: Only surface reciprocity insight when `onePersonCarrying === true`. Frame as observation, not problem.

---

### Question 3: Life Context — Infer or Declare?

**Decision**: Infer from behavior, with user override.

**Inference Signals**:
| Signal | Inferred Phase | Confidence Threshold |
|--------|---------------|---------------------|
| Social battery consistently < 2 for 7+ days | `hermit_mode` | Medium |
| 3x normal interaction rate | `high_energy` | High |
| No interactions for 14+ days (unusual for user) | `major_transition` (maybe) | Low - prompt user |
| Life event of type 'loss' logged | `grieving` | High |
| Life event of type 'wedding/baby' | `celebratory` | High |

**User Override UI**:
```
Settings > Life Context > Current Phase
  ○ Normal (default)
  ○ Taking a social break 🌙
  ○ Going through something hard 💙
  ○ Celebrating a life milestone 🎉
  ○ Feeling extra social ⚡
```

**Safety**: For sensitive phases (grieving, major_transition), always require user confirmation before changing behavior. Never automatically infer "grieving" from activity alone.

---

### Question 4: Network Reflection — Standalone or Integrated?

**Decision**: Integrate into the existing Weekly Reflection flow.

The app already has a weekly reflection feature (`WeeklyReflection` model, `ReflectionPromptStepComponent`). Rather than creating a separate "Network Reflection", we **enhance** the weekly reflection with oracle-generated observations.

**Enhanced Weekly Reflection Flow**:
```
┌────────────────────────────────────────┐
│  Your Weekly Reflection                │
│  Jan 20-26, 2025                       │
├────────────────────────────────────────┤
│                                        │
│  ✨ What the Oracle noticed:           │  ← NEW: AI-generated section
│  ─────────────────────────────────────│
│  "You spent quality time with your     │
│   inner circle this week. Marcus       │
│   and you had 2 deep conversations."   │
│                                        │
│  • Sarah's been quiet — intentional?   │
│  • Your energy averaged 3.2/5          │
│                                        │
├────────────────────────────────────────┤
│  How did this week feel?               │  ← EXISTING: User input prompts
│  [Your response here...]               │
│                                        │
│  Anyone you're grateful for?           │
│  [Your response here...]               │
│                                        │
└────────────────────────────────────────┘
```

**Implementation**:
- Add `oracleObservations` field to `WeeklyReflection` model
- Generate observations when user opens weekly reflection
- Display above the manual reflection prompts

---

### Question 5: Friendship Story Sharing

**Decision**: Phase 2+ feature. Location: Friend Profile share action.

**Where it lives**:
```
Friend Profile > Overflow Menu (⋯)
  > Share Story
    → Generates a sharable summary (text or image)
    → Uses system share sheet
```

**Content to Share**:
```
Our Friendship Story 📖
(generated by Weave)

"[Friend name] and I met 2 years ago.
Since then, we've shared 47 moments together.
Our friendship is in its 'deep roots' chapter — 
we've weathered distance and always find our way back."

#WeaveFriendship
```

**Privacy consideration**: Never include scores or private journal content. Only share the poetic summary.

---

### Question 6: UI Surface for Relationship Insights

**Decision**: Integrate with existing `ProactiveInsight` system, surface through Oracle.

**Investigation Finding**: The app already has a "Single Synthesis Model" via `InsightsCarousel` in `OracleChat.tsx`. This shows 1 insight at a time with actions like "Tell me more" and "Plan".

**Integration Approach**:

| New Insight Type | Maps to ProactiveInsight | Surface Location |
|------------------|-------------------------|------------------|
| Relationship observation | `insightType: 'relationship'` | Oracle Chat (existing carousel) |
| Reciprocity alert | `insightType: 'reciprocity'` | Oracle Chat + Friend Profile inline |
| Friendship milestone | `insightType: 'milestone'` | Oracle Chat + Optional push notification |

**Why Not Duplicate on Dashboard?**
- Dashboard (`TodaysFocusWidgetV2`) is already dense with suggestions, plans, upcoming dates
- Oracle is the "intelligence" surface — insights belong there
- Users already expect Oracle to "notice things"

**Unified Flow**:
```
┌──────────────────────────────────────────────────────────────┐
│                    SIGNAL SOURCES                            │
├──────────────────────────────────────────────────────────────┤
│ [Interaction logged] [Journal signal] [Pattern detected]    │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              InsightOrchestratorService                      │
│  • Gathers signals from RQS, Reciprocity, Narrative moments │
│  • Applies rate limiting (1/day max)                        │
│  • Creates ProactiveInsight record                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              ProactiveInsight (existing table)               │
│  • headline: "Something I noticed..."                        │
│  • body: "You and Sarah have been connecting more..."        │
│  • sourceSignalsJson: [...grounding data...]                 │
│  • actionType: 'plan_weave' | 'reflect' | 'oracle_chat'     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              OracleChat > InsightsCarousel                   │
│  • Shows latest unseen insight                               │
│  • "Tell me more" → Opens threaded Oracle chat               │
│  • "Plan" → Opens weave planner with friend prefilled        │
└──────────────────────────────────────────────────────────────┘
```

**Why This Works**:
1. **No new UI needed** — uses existing OracleInsightCard
2. **Consistent mental model** — "Oracle notices things"
3. **Actions already wired** — "Tell me more", "Plan", "Log"
4. **Rate limiting in place** — Single Synthesis Model prevents insight spam

**Friend Profile Inline Exception**:
Reciprocity insight CAN appear inline on friend profile (in addition to Oracle) since it's contextual to that friend:
```
Friend Profile
├─ Your Story section
├─ ⚖️ Balance: "You tend to reach out first..."  ← Inline reciprocity
└─ Interaction History
```

---

## Appendix C: Component Hierarchy

```
src/modules/intelligence/
├── components/
│   ├── InsightCard.tsx           # Single insight display
│   ├── InsightSlot.tsx           # Dashboard integration point
│   ├── FriendshipStoryView.tsx   # Profile narrative section
│   ├── ReciprocityInsight.tsx    # Balance display on profile
│   └── NetworkReflectionSheet.tsx # Full-screen reflection
├── services/
│   ├── relationship-quality.service.ts
│   ├── narrative.service.ts
│   ├── reciprocity.service.ts
│   ├── reflection-synthesizer.service.ts
│   ├── insight-orchestrator.service.ts
│   ├── life-context.service.ts
│   └── season-aware-streak.service.ts  # (existing)
├── hooks/
│   ├── useActiveInsight.ts
│   ├── useNarrative.ts
│   ├── useReciprocity.ts
│   └── useNetworkReflection.ts
├── types/
│   ├── relationship-quality.types.ts
│   ├── narrative.types.ts
│   ├── reciprocity.types.ts
│   ├── reflection.types.ts
│   ├── life-context.types.ts
│   └── insight.types.ts
└── index.ts                      # Public exports
```

---

## Appendix D: Prompt Tone Examples

### Friendly Observation (Default)
> "I noticed you and Marcus have been connecting more frequently this month. Your conversations seem to run deeper lately."

### Affirming
> "You've been showing up for your inner circle consistently. That takes intention."

### Gentle Curiosity  
> "Sarah's been quiet on your timeline. Is that intentional rest, or would it feel good to reach out?"

### Celebratory
> "Something special: You and Jordan hit your 2-year friendship anniversary this week. That's a lot of history together."

### Reflective
> "Your energy has been lower this week. It might be a good time to lean on your closest connections rather than spread thin."
