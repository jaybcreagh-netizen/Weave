# Journal & Oracle: Spec Addendum v2

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Strategic addendum to journal-oracle-design-spec.md |
| **Builds On** | oracle-spec-addendum.md (technical solutions) |
| **Covers** | Social Brain vision, foundation-first strategy, revised roadmap |
| **Date** | December 2024 |

This document captures the strategic vision for AI as core infrastructure in Weave, and provides a foundation-first implementation approach.

---

## Part 1: The Social Brain Vision

### 1.1 Core Thesis

> **The earlier we build context-gathering infrastructure, the smarter Weave becomes—regardless of current model quality. Data is the moat; models are commoditized.**

This is a bet on two compounding factors:
1. **User data compounds:** Every journal entry, logged weave, and battery check-in makes the system smarter *for that user*
2. **Model quality improves:** Foundation models will get better and cheaper, immediately upgrading Weave's intelligence layer

### 1.2 The Destination (Not the Starting Point)

Where Weave could be in 2-3 years:

| Year | Oracle Capability | User Experience |
|------|-------------------|-----------------|
| **Year 1** | Surfaces patterns you missed | "You and Sarah have drifted since her promotion" |
| **Year 2** | Guides behavior proactively | "Based on your energy and patterns, here's your ideal social week" |
| **Year 3** | Predicts and prevents | "Your friendship with Alex is at risk—similar patterns preceded your drift with Jordan" |

This requires *years* of data and iteration. We're building the foundation now.

### 1.3 Three High-Value Use Cases

These are the north-star features that justify deep AI investment:

#### A. Solving Reflection Fatigue

**Problem:** Power users eventually run out of things to say in a journal.

**Solution:** An AI brain that asks follow-up questions grounded in relationship history.

**Example:**
> "Last time you saw Marcus, he was worried about his dad. Did that come up today?"

This transforms journaling from a report into a conversation.

**Infrastructure Required:**
- Per-friend conversation thread tracking
- Entity extraction (people, topics, ongoing concerns)
- Temporal awareness (when was X last mentioned?)

#### B. Data Entry → Emotional Reward

**Problem:** Most apps provide data (graphs, numbers). Users want *meaning*.

**Solution:** The journal becomes a "sensory organ" that feeds back insights users couldn't see themselves.

**Example:**
> "Your conversations with Close Friends have shifted from 'ideas and dreams' to 'logistics and venting.' That's not wrong—but is it what you want?"

**Infrastructure Required:**
- Rich context across time windows
- Pattern detection (not just current state)
- Grounded citations (so insights don't feel like horoscopes)

#### C. Automated Maintenance Triage

**Problem:** For users with 150+ contacts (Dunbar's full circle), manual maintenance is impossible.

**Solution:** A Social Brain that automates triage, surfacing exactly which 3 people need attention today.

**Example:**
> "Priority today: Text Marcus (7 days dormant, high-momentum friend). Call your mom (Sunday ritual, haven't logged it). Reply to Sarah (she initiated twice, you haven't responded)."

**Infrastructure Required:**
- Real-time scoring across all friends
- Multi-factor weighting (decay, reciprocity, user energy, life events)
- Confidence thresholds (don't recommend if uncertain)

---

## Part 2: Foundation-First Strategy

### 2.1 Philosophy

> **Build the schema and data capture now. Surface intelligence later. The infrastructure is what compounds—not the model quality.**

This means:
- Capture more data than you currently use
- Log every LLM input/output for future analysis
- Schema richness > feature richness
- Rule-based logic first, LLM-enhanced explanations later

### 2.2 What "Build Early" Means Concretely

| Principle | Implementation |
|-----------|----------------|
| **Capture more than you use** | Extract signals from every entry, even if not surfaced yet |
| **Log everything** | Every LLM call, every user interaction, every ignored insight |
| **Schema > Features** | Rich data model with basic UI beats thin schema with fancy UI |
| **Rule-based first** | Triage, decay, resilience work without LLM. Add LLM for *explanations* |

### 2.3 New Infrastructure Components

These should be built *before* or *alongside* user-facing AI features:

#### A. Conversation Threads Model

Track ongoing topics and concerns per friend.

```typescript
// src/db/models/ConversationThread.ts

export class ConversationThread extends Model {
  static table = 'conversation_threads';
  
  @field('friend_id') friendId!: string;
  @field('topic') topic!: string;                    // "Marcus's dad's health"
  @field('first_mentioned') firstMentioned!: number;
  @field('last_mentioned') lastMentioned!: number;
  @field('mention_count') mentionCount!: number;
  @field('status') status!: 'active' | 'resolved' | 'dormant';
  @field('sentiment') sentiment!: 'concern' | 'neutral' | 'positive';
  @field('source_entry_ids_raw') sourceEntryIdsRaw!: string; // JSON array
  
  @relation('friends', 'friend_id') friend!: Relation<Friend>;
  
  get sourceEntryIds(): string[] {
    return JSON.parse(this.sourceEntryIdsRaw);
  }
}
```

**Schema:**

```typescript
tableSchema({
  name: 'conversation_threads',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'topic', type: 'string' },
    { name: 'first_mentioned', type: 'number' },
    { name: 'last_mentioned', type: 'number', isIndexed: true },
    { name: 'mention_count', type: 'number' },
    { name: 'status', type: 'string' },              // 'active' | 'resolved' | 'dormant'
    { name: 'sentiment', type: 'string' },           // 'concern' | 'neutral' | 'positive'
    { name: 'source_entry_ids_raw', type: 'string' },
  ],
}),
```

**Why build now:** Even without LLM extraction, users can manually tag "ongoing threads" in entries. This captures the structure. LLM extraction can backfill later.

#### B. Enhanced Friend Intelligence Fields

Add to Friend model for richer context:

```typescript
// Additional fields on Friend model

// Relationship dynamics
@field('reconnection_attempts') reconnectionAttempts?: number;
@field('successful_reconnections') successfulReconnections?: number;
@field('last_reconnection_date') lastReconnectionDate?: number;

// Communication patterns  
@field('avg_weave_duration_minutes') avgWeaveDurationMinutes?: number;
@field('preferred_weave_types_raw') preferredWeaveTypesRaw?: string;    // JSON array
@field('best_time_of_day') bestTimeOfDay?: 'morning' | 'afternoon' | 'evening';
@field('best_day_of_week') bestDayOfWeek?: number;                      // 0-6

// Topic evolution (populated by signal extraction)
@field('topic_clusters_raw') topicClustersRaw?: string;                 // JSON: topic -> frequency
@field('topic_trend') topicTrend?: 'deepening' | 'stable' | 'surface';  // Computed over time

// Computed getters
get reconnectionEaseRatio(): number {
  if (!this.reconnectionAttempts || this.reconnectionAttempts === 0) return 1;
  return (this.successfulReconnections ?? 0) / this.reconnectionAttempts;
}

get preferredWeaveTypes(): string[] {
  return this.preferredWeaveTypesRaw ? JSON.parse(this.preferredWeaveTypesRaw) : [];
}

get topicClusters(): Record<string, number> {
  return this.topicClustersRaw ? JSON.parse(this.topicClustersRaw) : {};
}
```

**Migration:**

```typescript
{
  toVersion: 34, // or next version
  steps: [
    addColumns({
      table: 'friends',
      columns: [
        // Reconnection tracking
        { name: 'reconnection_attempts', type: 'number', isOptional: true },
        { name: 'successful_reconnections', type: 'number', isOptional: true },
        { name: 'last_reconnection_date', type: 'number', isOptional: true },
        
        // Communication patterns
        { name: 'avg_weave_duration_minutes', type: 'number', isOptional: true },
        { name: 'preferred_weave_types_raw', type: 'string', isOptional: true },
        { name: 'best_time_of_day', type: 'string', isOptional: true },
        { name: 'best_day_of_week', type: 'number', isOptional: true },
        
        // Topic evolution
        { name: 'topic_clusters_raw', type: 'string', isOptional: true },
        { name: 'topic_trend', type: 'string', isOptional: true },
      ],
    }),
  ],
}
```

#### C. Daily Triage System

Rule-based triage that works without LLM, enhanced with LLM later.

```typescript
// src/modules/intelligence/services/triage-service.ts

export interface TriageRecommendation {
  friendId: string;
  friendName: string;
  urgency: 'high' | 'medium' | 'low';
  reason: TriageReason;
  confidence: number;
  suggestedAction: 'text' | 'call' | 'plan' | 'check-in';
  contextSnippet?: string;           // LLM-generated, optional
  groundingData: {
    daysSinceContact: number;
    weaveScore: number;
    momentum: 'rising' | 'stable' | 'declining';
    pendingThread?: string;          // Ongoing topic to follow up on
  };
}

export type TriageReason = 
  | 'decay_critical'                 // About to drop tier
  | 'decay_warning'                  // Approaching threshold
  | 'reciprocity_imbalance'          // They've initiated, you haven't responded
  | 'pending_thread'                 // Ongoing topic needs follow-up
  | 'life_event'                     // Birthday, anniversary, known event
  | 'reconnection_opportunity'       // Was dormant, showed sign of life
  | 'ritual_due'                     // Regular cadence (Sunday call with mom)
  | 'high_momentum_maintenance';     // Thriving relationship, keep it going

export class TriageService {
  constructor(
    private database: Database,
    private llm?: LLMService           // Optional - works without
  ) {}

  /**
   * Generate today's triage recommendations
   * Works fully rule-based; LLM adds context snippets if available
   */
  async generateDailyTriage(
    userEnergy: number,                // 1-5 social battery
    maxRecommendations: number = 3
  ): Promise<TriageRecommendation[]> {
    
    // 1. Get all friends with relevant data
    const friends = await this.database
      .get<Friend>('friends')
      .query(Q.where('is_archived', false))
      .fetch();
    
    // 2. Score each friend for triage priority
    const scored = await Promise.all(
      friends.map(f => this.scoreFriendForTriage(f))
    );
    
    // 3. Filter by user energy
    const filtered = this.filterByEnergy(scored, userEnergy);
    
    // 4. Sort by priority and take top N
    const sorted = filtered
      .sort((a, b) => this.comparePriority(a, b))
      .slice(0, maxRecommendations);
    
    // 5. Optionally enhance with LLM context
    if (this.llm) {
      return this.enhanceWithContext(sorted);
    }
    
    return sorted;
  }
  
  private async scoreFriendForTriage(friend: Friend): Promise<TriageRecommendation> {
    const daysSince = this.daysSinceLastContact(friend);
    const decayStatus = this.getDecayStatus(friend);
    const pendingThreads = await this.getPendingThreads(friend.id);
    const lifeEvents = await this.getUpcomingLifeEvents(friend.id);
    
    // Determine primary reason (priority order)
    let reason: TriageReason;
    let urgency: 'high' | 'medium' | 'low';
    
    if (decayStatus === 'critical') {
      reason = 'decay_critical';
      urgency = 'high';
    } else if (lifeEvents.length > 0) {
      reason = 'life_event';
      urgency = 'high';
    } else if (this.hasReciprocityImbalance(friend)) {
      reason = 'reciprocity_imbalance';
      urgency = 'medium';
    } else if (pendingThreads.length > 0) {
      reason = 'pending_thread';
      urgency = 'medium';
    } else if (decayStatus === 'warning') {
      reason = 'decay_warning';
      urgency = 'medium';
    } else if (friend.momentum === 'rising') {
      reason = 'high_momentum_maintenance';
      urgency = 'low';
    } else {
      reason = 'decay_warning';
      urgency = 'low';
    }
    
    return {
      friendId: friend.id,
      friendName: friend.name,
      urgency,
      reason,
      confidence: this.calculateConfidence(friend, reason),
      suggestedAction: this.suggestAction(friend, reason),
      groundingData: {
        daysSinceContact: daysSince,
        weaveScore: friend.weaveScore ?? 50,
        momentum: friend.momentum ?? 'stable',
        pendingThread: pendingThreads[0]?.topic,
      },
    };
  }
  
  private filterByEnergy(
    recommendations: TriageRecommendation[],
    energy: number
  ): TriageRecommendation[] {
    // Low energy (1-2): Only high urgency
    // Medium energy (3): High and medium urgency
    // High energy (4-5): All recommendations
    
    if (energy <= 2) {
      return recommendations.filter(r => r.urgency === 'high');
    } else if (energy === 3) {
      return recommendations.filter(r => r.urgency !== 'low');
    }
    return recommendations;
  }
  
  private suggestAction(
    friend: Friend,
    reason: TriageReason
  ): 'text' | 'call' | 'plan' | 'check-in' {
    // Based on friend's preferred communication and reason
    if (reason === 'life_event') return 'call';
    if (reason === 'pending_thread') return 'text';
    if (friend.bestTimeOfDay && friend.preferredWeaveTypes.includes('call')) {
      return 'call';
    }
    return 'text';
  }
  
  /**
   * Add LLM-generated context snippets to recommendations
   */
  private async enhanceWithContext(
    recommendations: TriageRecommendation[]
  ): Promise<TriageRecommendation[]> {
    // Batch LLM call for efficiency
    const contexts = await Promise.all(
      recommendations.map(r => this.generateContextSnippet(r))
    );
    
    return recommendations.map((r, i) => ({
      ...r,
      contextSnippet: contexts[i],
    }));
  }
  
  private async generateContextSnippet(
    rec: TriageRecommendation
  ): Promise<string | undefined> {
    if (!this.llm) return undefined;
    
    try {
      const prompt = {
        system: `Generate a brief (1 sentence) context reminder for why to reach out to a friend. Be specific and grounded in the data provided.`,
        user: `Friend: ${rec.friendName}
Reason: ${rec.reason}
Days since contact: ${rec.groundingData.daysSinceContact}
${rec.groundingData.pendingThread ? `Pending topic: ${rec.groundingData.pendingThread}` : ''}

Generate a brief, actionable context snippet.`,
      };
      
      const response = await this.llm.getProvider().complete(prompt, {
        temperature: 0.7,
        maxTokens: 50,
      });
      
      return response.content;
    } catch {
      return undefined;
    }
  }
}
```

**Why build now:** Triage logic is 100% rule-based and useful today. LLM just enhances the context snippets. Ship the feature without LLM dependency.

#### D. Comprehensive Logging Infrastructure

Capture everything for future analysis.

```typescript
// src/shared/services/intelligence-log.ts

export interface IntelligenceLogEntry {
  id: string;
  timestamp: number;
  eventType: IntelligenceEventType;
  payload: Record<string, unknown>;
  metadata: {
    userId?: string;
    sessionId?: string;
    appVersion: string;
  };
}

export type IntelligenceEventType =
  // LLM events
  | 'llm_request'
  | 'llm_response'
  | 'llm_error'
  | 'llm_fallback_used'
  
  // Signal extraction
  | 'signal_extracted'
  | 'signal_applied'
  | 'signal_discarded'          // Confidence too low
  
  // Oracle events
  | 'oracle_insight_generated'
  | 'oracle_insight_shown'
  | 'oracle_insight_dismissed'
  | 'oracle_insight_acted_on'
  | 'oracle_consultation_asked'
  | 'oracle_consultation_saved'
  
  // Triage events
  | 'triage_generated'
  | 'triage_shown'
  | 'triage_acted_on'
  | 'triage_dismissed'
  
  // Thread tracking
  | 'thread_created'
  | 'thread_updated'
  | 'thread_resolved'
  
  // User feedback
  | 'insight_feedback'          // Helpful / Not helpful
  | 'prompt_selected'
  | 'prompt_skipped';

export class IntelligenceLogger {
  private buffer: IntelligenceLogEntry[] = [];
  private flushInterval: number = 30000; // 30 seconds
  
  constructor() {
    // Periodic flush to storage
    setInterval(() => this.flush(), this.flushInterval);
  }
  
  log(eventType: IntelligenceEventType, payload: Record<string, unknown>): void {
    this.buffer.push({
      id: generateId(),
      timestamp: Date.now(),
      eventType,
      payload,
      metadata: {
        appVersion: getAppVersion(),
        sessionId: getSessionId(),
      },
    });
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const entries = [...this.buffer];
    this.buffer = [];
    
    // Store locally
    await this.storeLocally(entries);
    
    // Optionally sync to server for analysis
    // await this.syncToServer(entries);
  }
  
  private async storeLocally(entries: IntelligenceLogEntry[]): Promise<void> {
    const existing = await AsyncStorage.getItem('intelligence_log');
    const logs: IntelligenceLogEntry[] = existing ? JSON.parse(existing) : [];
    
    // Keep last 1000 entries
    const combined = [...logs, ...entries].slice(-1000);
    
    await AsyncStorage.setItem('intelligence_log', JSON.stringify(combined));
  }
  
  // Analysis helpers
  async getInsightResonanceRate(): Promise<number> {
    const logs = await this.getLogs();
    const shown = logs.filter(l => l.eventType === 'oracle_insight_shown').length;
    const actedOn = logs.filter(l => l.eventType === 'oracle_insight_acted_on').length;
    return shown > 0 ? actedOn / shown : 0;
  }
  
  async getPromptAcceptanceRate(): Promise<number> {
    const logs = await this.getLogs();
    const selected = logs.filter(l => l.eventType === 'prompt_selected').length;
    const skipped = logs.filter(l => l.eventType === 'prompt_skipped').length;
    const total = selected + skipped;
    return total > 0 ? selected / total : 0;
  }
  
  async getLLMFallbackRate(): Promise<number> {
    const logs = await this.getLogs();
    const requests = logs.filter(l => l.eventType === 'llm_request').length;
    const fallbacks = logs.filter(l => l.eventType === 'llm_fallback_used').length;
    return requests > 0 ? fallbacks / requests : 0;
  }
}

// Singleton
export const intelligenceLog = new IntelligenceLogger();
```

**Why build now:** You can't analyze what you don't capture. Every LLM call, every user interaction with intelligence features, every ignored recommendation—this is your training data for prompt tuning.

---

## Part 3: What NOT to Build (Yet)

### 3.1 Features That Sound Good But Are Premature

| Feature | Why Wait |
|---------|----------|
| **Semantic Drift Detection** | Requires topic extraction from every entry (expensive), vector storage, statistical comparison. Approximate with story chips for now. |
| **Stress Index Inference** | Inferring stress from journal keywords feels creepy when wrong. Use explicit signals only (battery, mood check-ins). |
| **Message Scraping** | Privacy nightmare. Derive initiator ratio from logged weaves only. |
| **Multi-turn Oracle Dialogue** | Validate single-turn works first. Dialogue adds complexity without proven value. |
| **Proactive Push Notifications** | Users didn't ask. Start with in-app surfaces, graduate to push after validation. |

### 3.2 The Oracle Accuracy Problem

The Oracle's value comes from being *right*, not from seeing *more*.

| Oracle Level | Data Sources | Risk |
|--------------|--------------|------|
| **Level 2 (Target for MVP)** | Logged weaves, journal sentiment, story chips | Low—based on explicit user input |
| **Level 3 (Future)** | + Topic extraction, stress inference | Medium—inferences can be wrong |
| **Level 4 (Never)** | + Text scraping, calendar mining | High—invasive, trust-destroying |

**Rule:** Only surface inferences when confidence is high. A confident wrong insight is worse than no insight.

---

## Part 4: Revised Roadmap (Foundation-First)

### Phase 1: Schema & Data Capture (Weeks 1-2)

Build infrastructure before user-facing features.

| Task | Purpose |
|------|---------|
| Add `conversation_threads` table | Track ongoing topics per friend |
| Add Friend intelligence fields | Reconnection ease, communication patterns, topic clusters |
| Add `intelligence_log` system | Capture all events for analysis |
| Add `journal_signals` table | Store extraction results (even before extraction exists) |
| Create IntelligenceLogger service | Centralized logging |

**Deliverable:** Rich schema that captures data from day 1. No user-visible changes.

### Phase 2: Basic LLM Integration (Weeks 3-4)

Ship Smart Prompts with foundation for more.

| Task | Purpose |
|------|---------|
| LLM abstraction layer | Provider-agnostic, error handling, retry |
| PromptGenerator with LLM | Replace rule-based prompts |
| Background signal extraction | Populate journal_signals, Friend.detectedThemes |
| Quality tracking | Log every LLM call, track acceptance rates |

**Deliverable:** LLM-powered prompts in GuidedReflectionModal. Signal extraction running silently.

### Phase 3: Rule-Based Triage (Week 5)

Ship triage without LLM dependency.

| Task | Purpose |
|------|---------|
| TriageService (rule-based) | Generate daily recommendations |
| Triage UI component | Show "3 friends to reach out to today" |
| Connect to user energy | Filter by social battery |

**Deliverable:** Daily triage recommendations based on decay, reciprocity, life events. No LLM required.

### Phase 4: Oracle MVP (Weeks 6-7)

Single-turn consultation with grounded insights.

| Task | Purpose |
|------|---------|
| OracleContextBuilder | Aggregate friend data for prompts |
| OracleService (consultation only) | Handle user questions |
| Oracle tab UI | Question input, response display |
| Rate limiting (5/day) | Intentionality through scarcity |
| Save to Journal flow | Capture valuable consultations |

**Deliverable:** Users can ask questions, get grounded answers. No proactive insights yet.

### Phase 5: Follow-Up Questions (Week 8)

The "reflection fatigue" killer.

| Task | Purpose |
|------|---------|
| Thread extraction (basic) | Identify ongoing topics from entries |
| Follow-up prompt generation | "Last time, Marcus was worried about X..." |
| Thread UI (optional) | Show active threads per friend |

**Deliverable:** Smart prompts that reference previous conversations. Journaling becomes a dialogue.

### Phase 6: Proactive Insights (Week 9-10)

Only after validating Oracle usage.

| Task | Purpose |
|------|---------|
| Insight generation service | Weekly patterns, friend-specific observations |
| Insight card UI | Show on Journal home, Oracle tab |
| Insight feedback tracking | Helpful / Not helpful |

**Deliverable:** Oracle surfaces insights without being asked. Validate resonance.

### Phase 7: Enhanced Triage (Week 11+)

Add LLM context to rule-based triage.

| Task | Purpose |
|------|---------|
| Context snippet generation | "She mentioned job stress last week" |
| Pending thread integration | "Follow up on Marcus's dad" |
| Push notification exploration | Careful, user-controlled |

**Deliverable:** Triage recommendations feel personalized and actionable.

---

## Part 5: Success Metrics by Phase

### Phase 1-2 (Foundation + Smart Prompts)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Schema migration success | 100% | Foundation works |
| LLM fallback rate | <10% | LLM is reliable |
| Prompt acceptance rate | >50% | LLM prompts are better |
| Signal extraction accuracy | >80% (manual review) | Extraction is trustworthy |

### Phase 3 (Triage)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Triage shown → acted on | >30% | Recommendations are useful |
| Weaves logged after triage | +20% | Feature drives behavior |
| User energy correlation | Visible | Energy filtering works |

### Phase 4 (Oracle)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Consultations per user/week | 2-3 | Users find it valuable |
| Saved to journal rate | >40% | Insights are worth keeping |
| "Helpful" feedback rate | >70% | Responses resonate |

### Phase 5+ (Follow-ups, Proactive)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Follow-up prompt selection | >60% | Context improves prompts |
| Insight resonance rate | >50% acted on | Proactive insights are relevant |
| Journal entries per user/week | +30% | AI reduces friction |

---

## Part 6: Risk Checkpoints

### 6-Month Checkpoint

If after 6 months:
- Oracle engagement is <20% of active users
- Prompt acceptance rate is similar to rule-based
- Users report insights feel "generic" or "wrong"

**Then:** Reconsider Social Brain thesis. AI becomes a supporting feature, not the core. Redirect effort to non-AI differentiation.

### What Success Looks Like

- Users say "Weave *knows* me"
- Power users can't imagine switching (would lose relationship intelligence)
- Journal entries get longer and more frequent
- Triage recommendations drive real-world actions
- Oracle consultations lead to relationship breakthroughs

---

## Part 7: Philosophical Guardrails

### 7.1 The Oracle's Boundaries

| The Oracle IS | The Oracle IS NOT |
|---------------|-------------------|
| A wise counselor you consult intentionally | A chatbot you banter with |
| Insights grounded in YOUR data | Generic relationship advice |
| Pattern recognition humans miss | A therapist or mental health tool |
| Observation, not prescription | "You should..." directives |

### 7.2 Intelligence Levels

| Level | Oracle Says | Risk Level |
|-------|-------------|------------|
| **Observation** | "You've seen Sarah 3 times this month" | None |
| **Pattern** | "Your conversations with Sarah have gotten shorter" | Low |
| **Inference** | "You might be avoiding deeper topics with Sarah" | Medium |
| **Prescription** | "You should have a serious talk with Sarah" | High—avoid |

**Rule:** Stay at Observation and Pattern levels. Inferences only with high confidence. Never prescribe.

### 7.3 Trust Maintenance

User trust is the product. One confident wrong insight damages it significantly.

**Principles:**
1. When uncertain, say nothing (or acknowledge uncertainty)
2. Always show grounding ("Based on your last 5 weaves...")
3. Let users correct the Oracle (feedback loop)
4. Never infer from data users didn't explicitly provide

---

## Summary

The Social Brain is the right long-term vision for Weave. But it's a *destination*, not a starting point.

**Build the foundation now:**
- Rich schema that captures context
- Logging infrastructure for analysis
- Rule-based features that work without LLM

**Validate with users:**
- Smart Prompts first (lowest risk)
- Oracle consultations second (differentiated value)
- Proactive insights only after validation

**Models will improve.** The bet is that your *data* and *schema* will be ready when they do.

The goal isn't to build the smartest AI today. It's to build the infrastructure that lets Weave get smarter every day, for every user, automatically.

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial technical solutions (oracle-spec-addendum.md) |
| 2.0 | Dec 2024 | Strategic vision, foundation-first approach, revised roadmap |
