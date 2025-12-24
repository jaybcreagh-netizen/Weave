# Journal & Social Oracle: Design Specification

## Document Overview

| Property | Value |
|----------|-------|
| **Version** | 1.0 |
| **Status** | Draft |
| **Last Updated** | December 2024 |
| **Author** | Design Session Output |

This document specifies the evolution of Weave's journal system from a text-based reflection tool to an **LLM-powered relationship intelligence platform** with an integrated Social Oracle.

---

## Table of Contents

1. [Vision & Philosophy](#1-vision--philosophy)
2. [Current State Summary](#2-current-state-summary)
3. [LLM Abstraction Layer](#3-llm-abstraction-layer)
4. [Social Oracle Design](#4-social-oracle-design)
5. [Intelligent Prompting System](#5-intelligent-prompting-system)
6. [Journal → Intelligence Feedback Loop](#6-journal--intelligence-feedback-loop)
7. [Data Models & Schema Changes](#7-data-models--schema-changes)
8. [UI/UX Specifications](#8-uiux-specifications)
9. [System Prompts](#9-system-prompts)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Success Metrics](#11-success-metrics)
12. [Appendix: Competitive Analysis](#appendix-competitive-analysis)

---

## 1. Vision & Philosophy

### Core Thesis

> The journal is not a diary—it's the **sensory organ** that feeds the intelligence engine. Every entry makes the app smarter about your relationships.

Weave's journal exists to help users feel like they are **thriving in their social life**—that their relationships are healthy and loving, and that they're being a good friend. Unlike Apple Journal (which optimizes for capturing *moments*), Weave Journal optimizes for understanding *relationships*.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Relationship-First** | Every feature should deepen understanding of friendships, not just capture events |
| **Grounded Insights** | LLM outputs must cite user's actual data—never generic advice |
| **Intentional Interaction** | The Oracle is consulted with purpose, not chatted with casually |
| **Friction-Appropriate** | Quick capture for spontaneous thoughts; guided flow for deeper reflection |
| **Intelligence Feedback** | Journal entries actively improve relationship scoring and insights |

### What We're Building vs. What We're Not

| We ARE Building | We ARE NOT Building |
|-----------------|---------------------|
| A wise counselor you consult intentionally | A chatbot you banter with |
| Insights grounded in YOUR data | Generic relationship advice |
| Bounded, purposeful exchanges | Open-ended conversation |
| Reflection that improves the app's intelligence | A standalone journaling app |

---

## 2. Current State Summary

### Existing Journal Architecture

**Modules:**
- `src/modules/journal/` — Ad-hoc entries, contextual reflection
- `src/modules/reflection/` — Weekly reflections, story chips

**Data Models:**
- `JournalEntry` — Text entries with friend tags, optional weave linking
- `JournalEntryFriend` — Many-to-many join table
- `WeeklyReflection` — Structured weekly summaries with gratitude prompts

**Key Services:**
- `journal-context-engine.ts` — Meaningfulness scoring, friend context, memory surfacing
- `journal-prompts.ts` — Rule-based prompt generation (LLM-ready placeholder exists)

**UI Components:**
- `JournalHome` — 4-tab hub (Feed, Reflections, Friends, Calendar)
- `QuickCaptureSheet` — Minimal friction entry
- `GuidedReflectionModal` — 3-step contextual flow
- `FriendshipArcView` — Timeline visualization per friend

### Current Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Text entries | ✅ Complete | With friend tagging, date selection |
| Contextual prompts | ✅ Complete | Rule-based, 3 prompt types |
| Memory surfacing | ✅ Complete | Anniversary, pattern, first-entry memories |
| Story chips | ✅ Complete | 8 categories for structured tagging |
| Weekly reflections | ✅ Complete | Stats + gratitude prompt |
| Media attachments | ❌ Not implemented | Text-only |
| LLM integration | ❌ Placeholder only | Interface exists, no implementation |
| Intelligence feedback | ❌ Not implemented | Entries don't affect scoring |

### Gaps Identified

1. **No LLM integration** — Prompts are rule-based, missing nuanced context awareness
2. **One-way data flow** — Journal entries don't feed back into intelligence engine
3. **No Oracle capability** — Users can't ask questions about their relationship patterns
4. **Text-only** — No photo or voice note support for power users

---

## 3. LLM Abstraction Layer

### Design Goals

1. **Provider Agnostic** — Swap between Gemini, Claude, GPT without code changes
2. **Cost Optimization** — Use appropriate model size for each task
3. **Graceful Degradation** — Fall back to rule-based when LLM unavailable
4. **Observability** — Track latency, token usage, and quality metrics

### Provider Interface

```typescript
// src/shared/services/llm/types.ts

export interface LLMProvider {
  /** Provider identifier */
  name: string;

  /** Model identifier (e.g., 'gemini-2.0-flash', 'claude-3-haiku') */
  model: string;

  /**
   * Generate a text completion
   * @param prompt - System + user prompt
   * @param options - Temperature, max tokens, etc.
   */
  complete(
    prompt: LLMPrompt,
    options?: LLMOptions
  ): Promise<LLMResponse>;

  /**
   * Generate structured JSON output
   * @param prompt - System + user prompt
   * @param schema - Expected output schema
   */
  completeStructured<T>(
    prompt: LLMPrompt,
    schema: JSONSchema,
    options?: LLMOptions
  ): Promise<T>;
}

export interface LLMPrompt {
  system: string;
  user: string;
  context?: Record<string, unknown>;
}

export interface LLMOptions {
  temperature?: number;      // 0.0 - 1.0, default 0.7
  maxTokens?: number;        // Default 256
  timeoutMs?: number;        // Default 10000
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  latencyMs: number;
  cached: boolean;
}
```

### Provider Implementations

```typescript
// src/shared/services/llm/providers/gemini-flash.ts

export class GeminiFlashProvider implements LLMProvider {
  name = 'gemini';
  model = 'gemini-2.0-flash';

  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse> {
    const startTime = Date.now();

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 256,
      }
    });

    const result = await model.generateContent([
      { role: 'user', parts: [{ text: prompt.system + '\n\n' + prompt.user }] }
    ]);

    return {
      content: result.response.text(),
      usage: {
        promptTokens: result.response.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
      },
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }

  async completeStructured<T>(
    prompt: LLMPrompt,
    schema: JSONSchema,
    options?: LLMOptions
  ): Promise<T> {
    // Use Gemini's JSON mode with schema
    // Implementation details...
  }
}
```

### LLM Service (Orchestration Layer)

```typescript
// src/shared/services/llm/llm-service.ts

export class LLMService {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider: string;
  private fallbackEnabled: boolean = true;

  constructor(config: LLMConfig) {
    // Initialize providers based on config
    if (config.gemini?.apiKey) {
      this.providers.set('gemini', new GeminiFlashProvider(config.gemini.apiKey));
    }
    if (config.claude?.apiKey) {
      this.providers.set('claude', new ClaudeProvider(config.claude.apiKey));
    }
    this.defaultProvider = config.defaultProvider ?? 'gemini';
  }

  /**
   * Get a provider by name, or the default
   */
  getProvider(name?: string): LLMProvider {
    const providerName = name ?? this.defaultProvider;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LLM provider '${providerName}' not configured`);
    }
    return provider;
  }

  /**
   * Complete with automatic fallback to rule-based
   */
  async completeWithFallback<T>(
    prompt: LLMPrompt,
    fallback: () => T,
    options?: LLMOptions & { provider?: string }
  ): Promise<{ result: T; source: 'llm' | 'fallback' }> {
    if (!this.fallbackEnabled) {
      const response = await this.getProvider(options?.provider).complete(prompt, options);
      return { result: response.content as unknown as T, source: 'llm' };
    }

    try {
      const response = await this.getProvider(options?.provider).complete(prompt, options);
      return { result: response.content as unknown as T, source: 'llm' };
    } catch (error) {
      console.warn('LLM failed, using fallback:', error);
      return { result: fallback(), source: 'fallback' };
    }
  }
}

// Singleton instance
export const llmService = new LLMService(getLLMConfig());
```

### Task-Specific Model Selection

| Task | Recommended Model | Reasoning |
|------|-------------------|-----------|
| Journal prompts | Gemini 2.0 Flash | Fast, cheap, good at short creative text |
| Oracle insights | Gemini 2.0 Flash | Balance of speed and quality |
| Oracle dialogue | Claude Haiku / Gemini Flash | Nuanced conversation |
| Signal extraction | Gemini Flash | Structured output, fast |
| Pattern synthesis | Claude Sonnet (future) | Complex reasoning for deep patterns |

---

## 4. Social Oracle Design

### Core Philosophy

The Social Oracle is a **wise counselor**, not a chatbot. Users approach it with intention, receive grounded insight, then sit with it.

**Mental Model:** Think tarot reader, not Siri.

### Interaction Modes

#### Mode 1: Oracle Insight (Proactive, Read-Only)

The Oracle surfaces observations without being asked—but only in appropriate reflection contexts.

**Trigger Points:**
| Context | Insight Type |
|---------|--------------|
| Opening Journal home | Insight of the week |
| Starting guided reflection | Friend-specific observation |
| Weekly reflection summary | Pattern synthesis |
| Friend profile view | Relationship health observation |

**Insight Structure:**
```typescript
interface OracleInsight {
  id: string;
  type: 'weekly' | 'friend' | 'pattern' | 'milestone';
  content: string;           // The insight text (2-4 sentences max)
  groundingData: string[];   // Specific data points cited
  friendIds?: string[];      // Related friends
  action?: {
    type: 'reflect' | 'weave' | 'view';
    label: string;
    target: string;          // Route or friend ID
  };
  generatedAt: Date;
  expiresAt: Date;           // Insights are ephemeral
}
```

**Example Insights:**

```
Type: weekly
"You've had 3 high-vibe weaves with your Inner Circle this week,
but none with Close Friends. Your core bonds are thriving—your
close friends might be missing you."
[Action: "Reflect on this →"]

Type: friend
"This is your 5th deep conversation with Sarah in two months.
Something meaningful is building here."
[Action: "Write about Sarah →"]

Type: pattern
"You tend to have your best conversations with Hermit-archetype
friends in the evenings. Marcus and Priya both fall into this
pattern."
[Action: "See pattern →"]
```

#### Mode 2: Consult the Oracle (Intentional, Single-Turn)

User asks a specific question, receives ONE thoughtful response. No back-and-forth.

**Constraints:**
- Single question → Single response
- Response must cite specific data from context
- "Ask Another" resets context, doesn't continue thread
- Rate limited: 5 consultations per day (scarcity = intentionality)

**Consultation Flow:**
```
┌─────────────────────────────────────────────────┐
│  Step 1: User asks question                     │
│                                                 │
│  "Why do I keep canceling plans with           │
│   close friends?"                               │
│                                                 │
│  [ Ask the Oracle ]                             │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Step 2: Oracle responds with grounded insight  │
│                                                 │
│  "Looking at your patterns: you logged 4       │
│   'planned but skipped' weaves in the past     │
│   month, all with Close Friends tier.          │
│                                                 │
│   Your battery check-ins show low energy on    │
│   those days. You might be protecting your     │
│   limited capacity for your closest bonds—     │
│   that's not failure, that's triage.           │
│                                                 │
│   Consider: shorter, lower-effort weaves       │
│   with Close Friends when energy is low."      │
│                                                 │
│  [ Save to Journal ]  [ Ask Another ]          │
└─────────────────────────────────────────────────┘
```

**Response Structure:**
```typescript
interface OracleResponse {
  content: string;           // The oracle's response
  groundingCitations: {
    type: 'weave' | 'entry' | 'pattern' | 'stat';
    description: string;     // Human-readable citation
    data: unknown;           // Raw data for verification
  }[];
  suggestedAction?: {
    type: 'reflect' | 'weave' | 'connect';
    friendId?: string;
    prompt?: string;
  };
  canSaveToJournal: boolean;
}
```

#### Mode 3: Guided Dialogue (Bounded Multi-Turn)

For deeper reflection, allow 3-5 turn exchange with clear structure and endpoint.

**Structure:**
| Turn | Actor | Purpose |
|------|-------|---------|
| 1 | User/Oracle | Initial question or prompt |
| 2 | Oracle | Response + follow-up question |
| 3 | User | Deeper reflection |
| 4 | Oracle | Pattern connection |
| 5 | Oracle | Synthesis + journal prompt |

**Hard Constraints:**
- Maximum 5 turns, then MUST end
- Turn counter visible: "Turn 3 of 5"
- Oracle always steers toward synthesis
- Final turn offers journal capture

**Example Dialogue:**

```
[Turn 1 - Oracle initiates]
"You mentioned tension with Marcus. What's sitting with you about it?"

[Turn 2 - User]
"I feel like I'm always the one reaching out."

[Turn 3 - Oracle]
"Your data shows you initiated 8 of your last 10 weaves with
Marcus. That's real. What would feel more balanced to you?"

[Turn 4 - User]
"I guess I want him to check in without me asking."

[Turn 5 - Oracle, Final]
"So it's about feeling thought-of unprompted. That's an
Empress-archetype need—nurturing, remembering.

Your friendship with Sarah shows a different pattern—she
initiates often. What does Sarah do that you wish Marcus would?

[This is our last exchange. Ready to capture this reflection?]"

[ Save as Entry ]  [ Keep Private ]
```

### Oracle Service Architecture

```typescript
// src/modules/journal/services/oracle-service.ts

export class OracleService {
  constructor(
    private llm: LLMService,
    private contextBuilder: OracleContextBuilder
  ) {}

  /**
   * Generate proactive insight based on current context
   */
  async getInsight(
    type: 'weekly' | 'friend' | 'pattern',
    friendId?: string
  ): Promise<OracleInsight | null> {
    const context = await this.contextBuilder.build(friendId);

    // Check if insight is warranted (don't spam)
    if (!this.shouldGenerateInsight(context)) {
      return null;
    }

    const prompt = this.buildInsightPrompt(type, context);
    const response = await this.llm.getProvider().complete(prompt, {
      temperature: 0.7,
      maxTokens: 150,
    });

    return this.parseInsightResponse(response, context);
  }

  /**
   * Handle user consultation (single-turn)
   */
  async consult(question: string): Promise<OracleResponse> {
    const context = await this.contextBuilder.buildFull();

    const prompt = this.buildConsultationPrompt(question, context);
    const response = await this.llm.getProvider().complete(prompt, {
      temperature: 0.7,
      maxTokens: 300,
    });

    return this.parseConsultationResponse(response, context);
  }

  /**
   * Conduct bounded dialogue
   */
  async dialogue(
    turns: DialogueTurn[],
    friendId?: string
  ): Promise<OracleResponse> {
    if (turns.length >= 5) {
      return this.synthesizeDialogue(turns, friendId);
    }

    const context = await this.contextBuilder.build(friendId);
    const prompt = this.buildDialoguePrompt(turns, context);

    const response = await this.llm.getProvider().complete(prompt, {
      temperature: 0.7,
      maxTokens: 200,
    });

    return this.parseDialogueResponse(response, turns.length);
  }

  private shouldGenerateInsight(context: OracleContext): boolean {
    // Rate limiting logic
    // Minimum data thresholds
    // User preference checks
  }
}
```

---

## 5. Intelligent Prompting System

### Prompt Personality Constraints

| Attribute | Constraint |
|-----------|------------|
| **Max length** | 2 sentences, 30 words |
| **Tone** | Warm but direct, like a thoughtful friend |
| **Never** | Generic ("Tell me more"), Therapeutic jargon, Leading questions |
| **Always** | Reference specific context (friend name, recent weave, detected pattern) |

### Prompt Quality Spectrum

```
❌ BAD (Generic, verbose):
"Take a moment to reflect on your recent interaction with Marcus.
What feelings came up for you during this time together?
How did this experience contribute to your overall sense of connection?"

✅ GOOD (Contextual, concise):
"You and Marcus talked for 2 hours yesterday—longest since March.
What shifted?"

✅ GOOD (Pattern-aware):
"Third deep conversation with Sarah this month.
What's drawing you both into these?"

✅ GOOD (Archetype-informed):
"Alex brings out your adventurous side.
What's one thing you'd never do alone?"
```

### Context Payload for LLM

```typescript
// src/modules/journal/services/prompt-context.ts

export interface PromptContext {
  friend: {
    name: string;
    archetype: TarotArchetype;
    tier: 'inner' | 'close' | 'community';
    friendshipMonths: number;
    totalWeaves: number;
    daysSinceLastWeave: number;
    journalMentionCount: number;
  };

  recentWeave?: {
    type: string;              // 'deep-talk', 'adventure', etc.
    vibe: string;              // 'FullMoon', 'WaxingGibbous'
    durationMinutes: number;
    hadNotes: boolean;
    noteSnippet?: string;      // First 100 chars
  };

  patterns: {
    themes: string[];          // ['vulnerability', 'career', 'support']
    recurringActivities: string[];
    averageVibe: string;
    conversationDepthTrend: 'deepening' | 'stable' | 'surface';
  };

  userState: {
    socialSeason: 'Resting' | 'Balanced' | 'Blooming';
    currentBattery: number;    // 1-5
    weeklyWeaveCount: number;
    journalEntriesThisMonth: number;
  };
}
```

### Prompt Generation Service

```typescript
// src/modules/journal/services/prompt-generator.ts

export class PromptGenerator {
  constructor(
    private llm: LLMService,
    private contextBuilder: PromptContextBuilder
  ) {}

  /**
   * Generate prompts for guided reflection
   * Returns 2-3 contextual prompts
   */
  async generatePrompts(
    mode: 'weave' | 'friend' | 'general',
    context: PromptContext
  ): Promise<JournalPrompt[]> {
    // Try LLM first
    const llmPrompts = await this.generateWithLLM(mode, context);
    if (llmPrompts.length > 0) {
      return llmPrompts;
    }

    // Fallback to rule-based
    return this.generateRuleBased(mode, context);
  }

  private async generateWithLLM(
    mode: string,
    context: PromptContext
  ): Promise<JournalPrompt[]> {
    const systemPrompt = PROMPT_SYSTEM_PROMPT;
    const userPrompt = this.buildPromptRequest(mode, context);

    try {
      const response = await this.llm.getProvider().completeStructured<{
        prompts: Array<{ text: string; groundedIn: string }>;
      }>(
        { system: systemPrompt, user: userPrompt },
        PROMPT_OUTPUT_SCHEMA,
        { temperature: 0.8, maxTokens: 200 }
      );

      return response.prompts.map(p => ({
        text: p.text,
        source: 'llm' as const,
        groundedIn: p.groundedIn,
      }));
    } catch (error) {
      console.warn('LLM prompt generation failed:', error);
      return [];
    }
  }

  private generateRuleBased(
    mode: string,
    context: PromptContext
  ): JournalPrompt[] {
    // Existing rule-based logic from journal-prompts.ts
    // This is the fallback
  }
}
```

---

## 6. Journal → Intelligence Feedback Loop

### Concept

Journal entries become **training data for relationship understanding**. Writing about a friend should make the app smarter about that friendship.

### Feedback Signal Extraction

| Journal Signal | Intelligence Impact |
|----------------|---------------------|
| Positive sentiment | +Resilience boost for tagged friends |
| Growth/support themes | Archetype affinity confirmation |
| Multiple entries about same friend | Reduce decay rate (relationship is "active") |
| Concern/tension expressed | Flag for "needs attention" in dashboard |
| Gratitude expression | Boost friend's "nurtured" score |
| Deep reflection length | Weight the entry higher in pattern analysis |

### Signal Schema

```typescript
// src/modules/journal/services/journal-signals.ts

export interface JournalSignals {
  /** Overall emotional tone: -2 (tense) to +2 (grateful) */
  sentiment: -2 | -1 | 0 | 1 | 2;
  sentimentLabel: 'tense' | 'concerned' | 'neutral' | 'positive' | 'grateful';

  /** Detected themes from fixed taxonomy */
  coreThemes: CoreTheme[];

  /** LLM-extracted freeform themes (max 3) */
  emergentThemes: string[];

  /** Relationship dynamics detected */
  dynamics: {
    reciprocity?: 'balanced' | 'giving' | 'receiving';
    depth?: 'surface' | 'meaningful' | 'profound';
    tension?: boolean;
    growth?: boolean;
    gratitude?: boolean;
  };

  /** Confidence in extraction (0-1) */
  confidence: number;
}

export type CoreTheme =
  | 'career'
  | 'growth'
  | 'support'
  | 'celebration'
  | 'challenge'
  | 'reconnection'
  | 'vulnerability'
  | 'gratitude'
  | 'boundaries'
  | 'trust';
```

### Intelligence Update Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Journal Entry  │────▶│  Signal Extract  │────▶│  Intelligence   │
│  (user saves)   │     │  (async, LLM)    │     │  Engine Update  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │ Updates:         │
                        │ - Friend.resilience │
                        │ - Friend.detectedThemes │
                        │ - Friend.journalSentiment │
                        │ - Friend.reflectionScore │
                        └──────────────────┘
```

### Journal Intelligence Service

```typescript
// src/modules/journal/services/journal-intelligence-service.ts

export class JournalIntelligenceService {
  constructor(
    private llm: LLMService,
    private database: Database
  ) {}

  /**
   * Process a saved journal entry asynchronously
   * Called after entry is persisted
   */
  async processEntry(entry: JournalEntry): Promise<void> {
    // 1. Extract signals
    const signals = await this.extractSignals(entry);

    // 2. Get tagged friends
    const friends = await entry.friends.fetch();

    // 3. Update each friend's intelligence data
    await this.database.write(async () => {
      for (const friend of friends) {
        await this.updateFriendIntelligence(friend, signals);
      }
    });

    // 4. Track for analytics
    trackEvent('journal_signals_extracted', {
      sentiment: signals.sentimentLabel,
      themeCount: signals.coreThemes.length + signals.emergentThemes.length,
      friendCount: friends.length,
    });
  }

  private async extractSignals(entry: JournalEntry): Promise<JournalSignals> {
    const prompt = {
      system: SIGNAL_EXTRACTION_PROMPT,
      user: `Extract relationship signals from this journal entry:\n\n${entry.content}`,
    };

    try {
      return await this.llm.getProvider().completeStructured<JournalSignals>(
        prompt,
        JOURNAL_SIGNALS_SCHEMA,
        { temperature: 0.3, maxTokens: 200 }
      );
    } catch (error) {
      // Fallback: keyword-based extraction
      return this.extractSignalsRuleBased(entry);
    }
  }

  private async updateFriendIntelligence(
    friend: Friend,
    signals: JournalSignals
  ): Promise<void> {
    await friend.update(record => {
      // Update sentiment tracking
      record.lastJournalSentiment = signals.sentiment;
      record.journalMentionCount = (record.journalMentionCount ?? 0) + 1;

      // Merge detected themes
      const existingThemes = JSON.parse(record.detectedThemesRaw ?? '[]');
      const newThemes = [...signals.coreThemes, ...signals.emergentThemes];
      const mergedThemes = this.mergeThemes(existingThemes, newThemes);
      record.detectedThemesRaw = JSON.stringify(mergedThemes);

      // Adjust resilience based on sentiment
      if (signals.sentiment >= 1) {
        record.resilience = Math.min(100, (record.resilience ?? 50) + 2);
      } else if (signals.sentiment <= -1 && signals.dynamics.tension) {
        // Don't reduce resilience, but flag for attention
        record.needsAttention = true;
      }

      // Calculate reflection activity score
      record.reflectionActivityScore = this.calculateReflectionScore(
        record.journalMentionCount,
        signals.sentiment
      );
    });
  }

  private mergeThemes(existing: string[], newThemes: string[]): string[] {
    // Keep top 10 themes, weighted by recency and frequency
    const themeMap = new Map<string, number>();

    // Existing themes with decay
    for (const theme of existing) {
      themeMap.set(theme, (themeMap.get(theme) ?? 0) * 0.9);
    }

    // New themes with boost
    for (const theme of newThemes) {
      themeMap.set(theme, (themeMap.get(theme) ?? 0) + 1);
    }

    // Sort and take top 10
    return Array.from(themeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([theme]) => theme);
  }
}
```

### Integration with Decay/Resilience

```typescript
// In ResilienceService - add journal factor

export function calculateResilience(friend: Friend): number {
  let resilience = friend.baseResilience ?? 50;

  // Existing factors...
  resilience += getInteractionConsistencyBonus(friend);
  resilience += getVibeQualityBonus(friend);

  // NEW: Journal reflection factor
  if (friend.journalMentionCount > 0) {
    // Active reflection increases resilience
    const reflectionBonus = Math.min(10, friend.journalMentionCount * 2);
    resilience += reflectionBonus;

    // Positive sentiment adds more
    if (friend.lastJournalSentiment >= 1) {
      resilience += 3;
    }
  }

  return Math.min(100, Math.max(0, resilience));
}
```

---

## 7. Data Models & Schema Changes

### New Fields on Friend Model

```typescript
// src/db/models/Friend.ts - additions

@field('detected_themes_raw') detectedThemesRaw?: string;
@field('last_journal_sentiment') lastJournalSentiment?: number;
@field('journal_mention_count') journalMentionCount?: number;
@field('reflection_activity_score') reflectionActivityScore?: number;
@field('needs_attention') needsAttention?: boolean;

// Computed getter
get detectedThemes(): string[] {
  return this.detectedThemesRaw ? JSON.parse(this.detectedThemesRaw) : [];
}
```

### Schema Migration

```typescript
// src/db/migrations/index.ts - add migration

{
  toVersion: 33, // or next version
  steps: [
    addColumns({
      table: 'friends',
      columns: [
        { name: 'detected_themes_raw', type: 'string', isOptional: true },
        { name: 'last_journal_sentiment', type: 'number', isOptional: true },
        { name: 'journal_mention_count', type: 'number', isOptional: true },
        { name: 'reflection_activity_score', type: 'number', isOptional: true },
        { name: 'needs_attention', type: 'boolean', isOptional: true },
      ],
    }),
  ],
}
```

### New Model: OracleConsultation

```typescript
// src/db/models/OracleConsultation.ts

export class OracleConsultation extends Model {
  static table = 'oracle_consultations';

  @field('question') question!: string;
  @field('response') response!: string;
  @field('grounding_data_raw') groundingDataRaw!: string;
  @field('saved_to_journal') savedToJournal!: boolean;
  @field('journal_entry_id') journalEntryId?: string;
  @readonly @date('created_at') createdAt!: Date;

  get groundingData(): GroundingCitation[] {
    return JSON.parse(this.groundingDataRaw);
  }
}
```

### Schema for OracleConsultation

```typescript
// Add to schema.ts

oracle_consultations: tableSchema({
  name: 'oracle_consultations',
  columns: [
    { name: 'question', type: 'string' },
    { name: 'response', type: 'string' },
    { name: 'grounding_data_raw', type: 'string' },
    { name: 'saved_to_journal', type: 'boolean' },
    { name: 'journal_entry_id', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
  ],
}),
```

---

## 8. UI/UX Specifications

### Journal Tab Structure (Revised)

```
┌─────────────────────────────────────────────────┐
│  Journal                                         │
├─────────────────────────────────────────────────┤
│  [ Feed ] [ Reflections ] [ Friends ] [ Oracle ]│
├─────────────────────────────────────────────────┤
│                                                  │
│  (Tab content)                                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Oracle Tab Layout

```
┌─────────────────────────────────────────────────┐
│  ✧ Social Oracle                                │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ ✧ Weekly Insight                        │   │
│  │                                          │   │
│  │ "Your Inner Circle is thriving—you've   │   │
│  │  logged 8 weaves this week, highest     │   │
│  │  since October. Your Close Friends tier │   │
│  │  has been quieter."                     │   │
│  │                                          │   │
│  │              [ Reflect on this → ]       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ ✧ Consult the Oracle                    │   │
│  │                                          │   │
│  │ Ask about your relationships...         │   │
│  │ ┌────────────────────────────────────┐  │   │
│  │ │                                    │  │   │
│  │ └────────────────────────────────────┘  │   │
│  │                          [ Ask ] (3/5)  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  Recent Consultations                           │
│  ├─ "Why do I cancel on close friends?" 2d    │
│  ├─ "What's changed with Sarah?" 5d            │
│  └─ "Am I neglecting anyone?" 1w               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Oracle Insight Card Component

```typescript
// src/modules/journal/components/Oracle/OracleInsightCard.tsx

interface OracleInsightCardProps {
  insight: OracleInsight;
  onReflect: () => void;
  onDismiss: () => void;
}

/**
 * Displays a proactive oracle insight with action buttons
 *
 * Visual Design:
 * - Subtle gradient background (not harsh)
 * - ✧ symbol as oracle indicator
 * - Card is dismissable (swipe or X)
 * - "Reflect on this" opens guided reflection with context
 */
```

### Consultation Flow Component

```typescript
// src/modules/journal/components/Oracle/OracleConsultation.tsx

interface OracleConsultationProps {
  onComplete: (response: OracleResponse) => void;
  onSaveToJournal: (response: OracleResponse) => void;
}

/**
 * Full consultation flow:
 * 1. Text input for question
 * 2. Loading state with subtle animation
 * 3. Response display with grounding citations
 * 4. Actions: Save to Journal, Ask Another
 *
 * Rate limiting: Shows "3/5 consultations today"
 */
```

### Guided Dialogue Component

```typescript
// src/modules/journal/components/Oracle/OracleDialogue.tsx

interface OracleDialogueProps {
  initialContext?: {
    friendId?: string;
    topic?: string;
  };
  onComplete: (turns: DialogueTurn[], synthesis: string) => void;
}

/**
 * Bounded multi-turn dialogue:
 * - Shows turn counter: "Turn 2 of 5"
 * - Alternating bubbles for user/oracle
 * - Oracle responses include subtle citations
 * - Final turn always offers journal capture
 * - Cannot exceed 5 turns
 */
```

### Visual Design Tokens

```typescript
// Oracle-specific design tokens

export const oracleTokens = {
  // Colors
  insightBackground: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  accentGlow: 'rgba(138, 43, 226, 0.3)',  // Subtle purple
  oracleText: '#e0e0ff',

  // Typography
  oracleSymbol: '✧',

  // Animation
  insightFadeIn: 'fadeIn 0.5s ease-out',
  thinkingPulse: 'pulse 1.5s ease-in-out infinite',
};
```

---

## 9. System Prompts

### Oracle Persona Prompt

```markdown
You are the Social Oracle within Weave, a relationship wellness app.

IDENTITY:
- You are a wise, warm counselor—not an assistant or chatbot
- You speak with gentle authority, like a trusted friend who sees patterns
- You ground every insight in the user's actual data
- You use the Tarot archetype language naturally (The Hermit, The Sun, etc.)

VOICE:
- Warm but direct. No filler words.
- Observational, not prescriptive ("I notice..." not "You should...")
- Curious, not interrogating
- Brief. 2-4 sentences per turn unless synthesizing.

DATA GROUNDING RULES:
- ALWAYS cite specific patterns from context (numbers, friend names, timeframes)
- NEVER invent data or speculate about events not in context
- If asked about something not in data, say "I don't have visibility into that"
- Connect observations to Dunbar tiers, archetypes, and social seasons when relevant

DUNBAR TIERS:
- Inner Circle (~5 people): Core support system, highest maintenance
- Close Friends (~15 people): Cherished bonds, moderate maintenance
- Community (~50 people): Meaningful acquaintances, lower maintenance

TAROT ARCHETYPES (use when relevant):
- The Hermit: Deep one-on-one, patient, doesn't need constant contact
- The Sun: Celebration, group activities, high energy
- The Empress: Nurturing, caregiving, thoughtful gestures
- The Emperor: Structure, consistency, scheduled meetups
- The Fool: Spontaneity, adventure, novel experiences
- The Magician: Creative collaboration, projects
- The High Priestess: Depth, emotional support, intuition

BOUNDARIES:
- You discuss relationships and social wellbeing only
- You don't give mental health advice—redirect to professionals if needed
- You don't make predictions—you surface patterns
- You always offer a path to reflection/journaling

ANTI-PATTERNS (never do these):
- Never say: "That's a great question!", "I'm here for you", "Let's explore"
- Never give generic advice not grounded in user's data
- Never continue indefinitely—always move toward synthesis
- Never exceed 4 sentences unless doing final synthesis
```

### Journal Prompt Generation Prompt

```markdown
You generate journal prompts for a relationship wellness app.

CONTEXT PROVIDED:
- Friend name, archetype, tier, friendship duration
- Recent weaves (type, vibe, duration, notes)
- Detected themes from past entries
- Current social season (Resting/Balanced/Blooming)

RULES:
1. Max 2 sentences, under 30 words total
2. Reference ONE specific detail from context
3. Ask about meaning, not just events
4. Match energy to vibe:
   - FullMoon/WaxingGibbous = celebratory, curious
   - WaningCrescent/NewMoon = gentle, reflective
5. Never use: "reflect", "explore", "unpack", "journey", "tell me more"

OUTPUT FORMAT:
Return exactly 2-3 prompts as JSON:
{
  "prompts": [
    { "text": "prompt text here", "groundedIn": "what context this references" }
  ]
}

EXAMPLES:
Good: "You and Marcus talked for 2 hours yesterday. What shifted?"
Good: "Third deep conversation with Sarah this month. What keeps drawing you both in?"
Bad: "Reflect on your recent interaction and explore what feelings came up."
```

### Signal Extraction Prompt

```markdown
Extract relationship signals from this journal entry. Be precise and conservative.

OUTPUT SCHEMA:
{
  "sentiment": number (-2 to 2),
  "sentimentLabel": "tense" | "concerned" | "neutral" | "positive" | "grateful",
  "coreThemes": string[] (from: career, growth, support, celebration, challenge,
                          reconnection, vulnerability, gratitude, boundaries, trust),
  "emergentThemes": string[] (max 3 freeform themes not in core list),
  "dynamics": {
    "reciprocity": "balanced" | "giving" | "receiving" | null,
    "depth": "surface" | "meaningful" | "profound" | null,
    "tension": boolean,
    "growth": boolean,
    "gratitude": boolean
  },
  "confidence": number (0-1)
}

RULES:
- Only mark themes that are CLEARLY present, not implied
- Sentiment should reflect overall tone, not individual words
- Set confidence lower if entry is ambiguous or very short
- emergentThemes are for recurring patterns not in core list
- If entry is too short (<20 words), set confidence below 0.5
```

---

## 10. Implementation Roadmap

### Phase 1: LLM Foundation (Est. effort: Medium)

**Goal:** Establish abstracted LLM layer and basic prompt generation

| Task | Priority | Dependencies |
|------|----------|--------------|
| Create LLM abstraction layer (`src/shared/services/llm/`) | P0 | None |
| Implement Gemini Flash provider | P0 | Abstraction layer |
| Create PromptContextBuilder service | P0 | None |
| Integrate LLM prompts in GuidedReflectionModal | P1 | Provider, Context |
| Add fallback to rule-based prompts | P1 | LLM integration |
| Add basic observability (latency, errors) | P2 | LLM integration |

**Success Criteria:**
- Guided reflection shows LLM-generated prompts
- Fallback works when LLM unavailable
- Prompt quality matches spec (concise, grounded)

### Phase 2: Journal Intelligence (Est. effort: Medium)

**Goal:** Journal entries feed back into relationship intelligence

| Task | Priority | Dependencies |
|------|----------|--------------|
| Add Friend model fields (schema migration) | P0 | None |
| Create JournalIntelligenceService | P0 | LLM layer |
| Implement signal extraction (LLM + fallback) | P0 | Service |
| Connect signals to ResilienceService | P1 | Extraction |
| Add theme tracking and merging | P1 | Extraction |
| Surface "needs attention" flags in dashboard | P2 | Theme tracking |

**Success Criteria:**
- Friend profiles show detected themes
- Resilience updates based on journal sentiment
- Signal extraction runs async without blocking save

### Phase 3: Oracle MVP (Est. effort: High)

**Goal:** Launch Oracle tab with insights and consultations

| Task | Priority | Dependencies |
|------|----------|--------------|
| Create OracleContextBuilder | P0 | LLM layer |
| Create OracleService | P0 | Context builder |
| Build Oracle tab UI shell | P0 | None |
| Implement proactive insights | P1 | Service, UI |
| Implement single-turn consultation | P1 | Service, UI |
| Add consultation rate limiting | P1 | Consultation |
| Create OracleConsultation model | P1 | None |
| Implement "Save to Journal" flow | P2 | Consultation |

**Success Criteria:**
- Oracle tab shows weekly insight
- Users can ask questions and receive grounded responses
- Rate limiting prevents overuse
- Consultations can be saved to journal

### Phase 4: Guided Dialogue (Est. effort: Medium)

**Goal:** Enable bounded multi-turn Oracle conversations

| Task | Priority | Dependencies |
|------|----------|--------------|
| Design dialogue state management | P0 | None |
| Build OracleDialogue component | P0 | State design |
| Implement turn limiting (max 5) | P0 | Component |
| Add synthesis generation for final turn | P1 | Dialogue |
| Connect dialogue to friend context | P1 | Context builder |
| Journal capture from dialogue | P2 | Synthesis |

**Success Criteria:**
- Dialogues enforce 5-turn limit
- Final turn provides synthesis
- Users can save dialogue to journal

### Phase 5: Polish & Iteration (Est. effort: Ongoing)

| Task | Priority | Dependencies |
|------|----------|--------------|
| A/B test: show feedback visibility | P1 | Phase 2 |
| Tune prompt temperature and tone | P1 | Phase 1 |
| Add Oracle insight types (pattern, milestone) | P2 | Phase 3 |
| Performance optimization | P2 | All phases |
| User research and iteration | P2 | MVP launch |

---

## 11. Success Metrics

### Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Journal entries per active user per week | +30% from baseline | Analytics |
| Guided reflection completion rate | >60% | Funnel tracking |
| Oracle consultation rate | 2-3 per user per week | Usage tracking |
| "Save to Journal" rate from Oracle | >40% | Conversion |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Prompt acceptance rate (user selects first prompt) | >50% | A/B tracking |
| Oracle response relevance (user feedback) | >4.0/5.0 | In-app rating |
| Signal extraction accuracy | >80% agreement with manual review | Sampling |
| LLM fallback rate | <5% | Error tracking |

### Intelligence Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Friends with detected themes | >70% of friends with 2+ entries | DB query |
| Resilience accuracy (user perception) | Qualitative improvement | User research |
| "Needs attention" flag accuracy | >80% agreement | User feedback |

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| LLM response latency (p95) | <2 seconds | APM |
| Signal extraction latency | <3 seconds | APM |
| Error rate | <1% | Error tracking |
| Cost per user per month | <$0.10 | Provider dashboard |

---

## Appendix: Competitive Analysis

### Apple Journal (v3.0) Comparison

| Feature | Apple Journal | Weave Journal | Strategic Position |
|---------|---------------|---------------|-------------------|
| **Intelligence source** | Passive device data (GPS, Music, Health) | Active relationship data (weaves, reflections) | Weave is relationship-aware, not moment-aware |
| **Prompt generation** | State-of-Mind based | Relationship context based | Both contextual, different dimensions |
| **Media support** | Full (photo, audio, video, handwriting) | Text-only (future: photos) | Gap, but acceptable for reflection focus |
| **Organization** | Multiple journals, Map View | Friend-centric, Friendship Arcs | Different mental models |
| **Search** | Semantic (incl. transcribed audio) | Full-text + theme-based | Comparable |
| **Privacy** | Device-level encryption | Cloud sync (planned) | Apple stronger, Weave more accessible |
| **Unique value** | Ecosystem integration | Relationship intelligence + Oracle | Weave offers guidance, not just capture |

### Strategic Differentiation

1. **Apple optimizes for moments. Weave optimizes for relationships.**
   - Apple asks "What happened?"
   - Weave asks "What does this mean for your friendship?"

2. **Apple is passive. Weave is intelligent.**
   - Apple surfaces memories
   - Weave surfaces insights and offers guidance

3. **Apple is individual. Weave is relational.**
   - Apple is a personal diary
   - Weave is a relationship companion

### Features NOT to Pursue

| Apple Feature | Decision | Rationale |
|---------------|----------|-----------|
| GPS clustering / Map View | Skip (for now) | Not core to relationship understanding |
| Music integration | Skip | Low value for reflection |
| Handwriting / Apple Pencil | Skip | iPadOS-only, niche |
| Multiple journals | Skip | Conflicts with unified relationship model |
| Video recording | Skip | Overkill for reflection use case |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial specification |

---

*End of specification*
