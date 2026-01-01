# Journal & Oracle: Spec Addendum

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Addendum to journal-oracle-design-spec.md |
| **Covers** | Problem solutions, missing spec items, MVP scope |
| **Date** | December 2024 |

This document addresses gaps in the original specification and provides a pragmatic MVP approach.

---

## Part 1: Solutions to Identified Problems

### 1.1 Error Handling Strategy

**Problem:** The original spec treats all LLM errors identically with a catch-all fallback.

**Solution:** Implement an error taxonomy with specific handling strategies.

```typescript
// src/shared/services/llm/errors.ts

export enum LLMErrorType {
  RATE_LIMITED = 'rate_limited',
  CONTEXT_TOO_LONG = 'context_too_long',
  MALFORMED_OUTPUT = 'malformed_output',
  TIMEOUT = 'timeout',
  AUTH_FAILED = 'auth_failed',
  NETWORK_ERROR = 'network_error',
  CONTENT_FILTERED = 'content_filtered',
  UNKNOWN = 'unknown',
}

export interface LLMError {
  type: LLMErrorType;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

export function classifyError(error: unknown): LLMError {
  // Gemini-specific error classification
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429')) {
      return {
        type: LLMErrorType.RATE_LIMITED,
        message: 'API rate limit reached',
        retryable: true,
        retryAfterMs: 60000, // 1 minute default
      };
    }
    
    if (msg.includes('context length') || msg.includes('too long') || msg.includes('token')) {
      return {
        type: LLMErrorType.CONTEXT_TOO_LONG,
        message: 'Input too long for model',
        retryable: true, // Can retry with truncated context
      };
    }
    
    if (msg.includes('timeout') || msg.includes('deadline')) {
      return {
        type: LLMErrorType.TIMEOUT,
        message: 'Request timed out',
        retryable: true,
        retryAfterMs: 0, // Immediate retry OK
      };
    }
    
    if (msg.includes('api key') || msg.includes('authentication') || msg.includes('401')) {
      return {
        type: LLMErrorType.AUTH_FAILED,
        message: 'API authentication failed',
        retryable: false, // Needs user intervention
      };
    }
    
    if (msg.includes('safety') || msg.includes('blocked') || msg.includes('filtered')) {
      return {
        type: LLMErrorType.CONTENT_FILTERED,
        message: 'Content was filtered by safety systems',
        retryable: false,
      };
    }
  }
  
  return {
    type: LLMErrorType.UNKNOWN,
    message: 'Unknown error occurred',
    retryable: true,
    retryAfterMs: 5000,
    originalError: error,
  };
}
```

**Retry Logic:**

```typescript
// src/shared/services/llm/retry.ts

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onContextTooLong?: () => void, // Callback to truncate context
): Promise<T> {
  let lastError: LLMError | null = null;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (rawError) {
      const error = classifyError(rawError);
      lastError = error;
      
      // Non-retryable errors fail immediately
      if (!error.retryable) {
        throw error;
      }
      
      // Special handling for context too long
      if (error.type === LLMErrorType.CONTEXT_TOO_LONG && onContextTooLong) {
        onContextTooLong();
        // Don't count this as an attempt - we modified the input
        attempt--;
        continue;
      }
      
      // Don't wait after last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        error.retryAfterMs ?? config.baseDelayMs * Math.pow(2, attempt - 1),
        config.maxDelayMs
      );
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}
```

**UI Error States:**

| Error Type | User-Facing Message | UI Behavior |
|------------|---------------------|-------------|
| `RATE_LIMITED` | "Taking a moment to think..." | Show spinner, auto-retry |
| `CONTEXT_TOO_LONG` | (Silent) | Truncate and retry automatically |
| `MALFORMED_OUTPUT` | (Silent) | Retry up to 3x, then fallback |
| `TIMEOUT` | "Still thinking..." | Show extended spinner, retry |
| `AUTH_FAILED` | "Connection issue. Please restart the app." | Show error banner, log to analytics |
| `CONTENT_FILTERED` | "I can't help with that specific question." | Show message, offer alternatives |
| `NETWORK_ERROR` | "No internet connection" | Show offline indicator |

---

### 1.2 Prompt Versioning & Quality Tracking

**Problem:** No mechanism to track, compare, or rollback prompts.

**Solution:** Simple versioning system with quality metrics.

```typescript
// src/shared/services/llm/prompt-registry.ts

export interface PromptDefinition {
  id: string;                    // e.g., 'journal_prompt_v1'
  version: string;               // Semantic version: '1.0.0'
  systemPrompt: string;
  userPromptTemplate: string;    // With {{variable}} placeholders
  expectedOutputSchema?: object; // JSON schema for structured output
  metadata: {
    author: string;
    createdAt: string;
    description: string;
    previousVersion?: string;    // For rollback reference
  };
}

// Centralized prompt registry
export const PROMPT_REGISTRY: Record<string, PromptDefinition> = {
  journal_prompt: {
    id: 'journal_prompt',
    version: '1.0.0',
    systemPrompt: `You generate journal prompts for a relationship wellness app...`,
    userPromptTemplate: `Generate prompts for {{mode}} mode.\n\nContext:\n{{context}}`,
    metadata: {
      author: 'jay',
      createdAt: '2024-12-28',
      description: 'Initial journal prompt generator',
    },
  },
  
  oracle_consultation: {
    id: 'oracle_consultation',
    version: '1.0.0',
    systemPrompt: `You are the Social Oracle within Weave...`,
    userPromptTemplate: `User question: {{question}}\n\nContext:\n{{context}}`,
    metadata: {
      author: 'jay',
      createdAt: '2024-12-28',
      description: 'Oracle single-turn consultation',
    },
  },
  
  signal_extraction: {
    id: 'signal_extraction',
    version: '1.0.0',
    systemPrompt: `Extract relationship signals from this journal entry...`,
    userPromptTemplate: `Entry:\n{{content}}`,
    expectedOutputSchema: {/* JournalSignals schema */},
    metadata: {
      author: 'jay',
      createdAt: '2024-12-28',
      description: 'Journal entry signal extraction',
    },
  },
};

export function getPrompt(id: string): PromptDefinition {
  const prompt = PROMPT_REGISTRY[id];
  if (!prompt) {
    throw new Error(`Unknown prompt: ${id}`);
  }
  return prompt;
}
```

**Quality Tracking Table:**

```typescript
// Add to schema.ts

tableSchema({
  name: 'llm_quality_log',
  columns: [
    { name: 'prompt_id', type: 'string', isIndexed: true },
    { name: 'prompt_version', type: 'string' },
    { name: 'input_hash', type: 'string' },          // Hash of context for deduplication
    { name: 'output_hash', type: 'string' },         // Hash of response
    { name: 'latency_ms', type: 'number' },
    { name: 'tokens_used', type: 'number' },
    { name: 'error_type', type: 'string', isOptional: true },
    { name: 'user_feedback', type: 'string', isOptional: true }, // 'accepted' | 'rejected' | 'edited'
    { name: 'created_at', type: 'number', isIndexed: true },
  ],
}),
```

**Usage Pattern:**

```typescript
// In any LLM call
const promptDef = getPrompt('journal_prompt');
const startTime = Date.now();

try {
  const response = await llm.complete({
    system: promptDef.systemPrompt,
    user: renderTemplate(promptDef.userPromptTemplate, context),
  });
  
  await logQuality({
    promptId: promptDef.id,
    promptVersion: promptDef.version,
    inputHash: hashContext(context),
    outputHash: hashString(response.content),
    latencyMs: Date.now() - startTime,
    tokensUsed: response.usage.promptTokens + response.usage.completionTokens,
  });
  
  return response;
} catch (error) {
  await logQuality({
    promptId: promptDef.id,
    promptVersion: promptDef.version,
    inputHash: hashContext(context),
    latencyMs: Date.now() - startTime,
    errorType: classifyError(error).type,
  });
  throw error;
}
```

**Analytics Queries (for later):**

```sql
-- Prompt acceptance rate by version
SELECT prompt_version, 
       COUNT(CASE WHEN user_feedback = 'accepted' THEN 1 END) * 100.0 / COUNT(*) as acceptance_rate
FROM llm_quality_log
WHERE prompt_id = 'journal_prompt'
GROUP BY prompt_version;

-- Error rate by prompt
SELECT prompt_id, 
       COUNT(CASE WHEN error_type IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as error_rate
FROM llm_quality_log
GROUP BY prompt_id;

-- p95 latency
SELECT prompt_id, prompt_version,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM llm_quality_log
GROUP BY prompt_id, prompt_version;
```

---

### 1.3 Smarter Cache Invalidation

**Problem:** Every interaction invalidates all caches, causing unnecessary rebuilds.

**Solution:** Granular invalidation with lazy rebuilding.

```typescript
// src/modules/reflection/services/oracle/context-cache.ts

export interface CacheEntry {
  id: string;
  contextType: 'essential' | 'pattern' | 'rich';
  friendId?: string;              // null = global context
  payload: OracleContextPayload;
  validUntil: number;
  staleAt: number;                // Can serve stale while rebuilding
  lastAccessed: number;
}

export class ContextCache {
  private cache = new Map<string, CacheEntry>();
  private rebuildInProgress = new Set<string>();
  
  private getCacheKey(type: string, friendId?: string): string {
    return friendId ? `${type}:${friendId}` : `${type}:global`;
  }
  
  async get(
    type: 'essential' | 'pattern' | 'rich',
    friendId?: string,
    builder: () => Promise<OracleContextPayload>
  ): Promise<OracleContextPayload> {
    const key = this.getCacheKey(type, friendId);
    const entry = this.cache.get(key);
    const now = Date.now();
    
    // Fresh cache hit
    if (entry && entry.validUntil > now) {
      entry.lastAccessed = now;
      return entry.payload;
    }
    
    // Stale but usable - return stale and rebuild in background
    if (entry && entry.staleAt > now && !this.rebuildInProgress.has(key)) {
      this.rebuildInProgress.add(key);
      this.rebuildInBackground(key, type, friendId, builder);
      return entry.payload;
    }
    
    // Must rebuild synchronously
    return this.rebuild(key, type, friendId, builder);
  }
  
  private async rebuild(
    key: string,
    type: string,
    friendId: string | undefined,
    builder: () => Promise<OracleContextPayload>
  ): Promise<OracleContextPayload> {
    const payload = await builder();
    const ttl = this.getTTL(type);
    const staleTTL = ttl * 2; // Can serve stale for 2x TTL
    
    this.cache.set(key, {
      id: key,
      contextType: type as any,
      friendId,
      payload,
      validUntil: Date.now() + ttl,
      staleAt: Date.now() + staleTTL,
      lastAccessed: Date.now(),
    });
    
    return payload;
  }
  
  private async rebuildInBackground(
    key: string,
    type: string,
    friendId: string | undefined,
    builder: () => Promise<OracleContextPayload>
  ): Promise<void> {
    try {
      await this.rebuild(key, type, friendId, builder);
    } finally {
      this.rebuildInProgress.delete(key);
    }
  }
  
  /**
   * Invalidate specific scopes instead of everything
   */
  invalidate(scope: InvalidationScope): void {
    const keysToInvalidate: string[] = [];
    
    switch (scope.type) {
      case 'friend':
        // Only invalidate caches involving this friend
        for (const [key, entry] of this.cache) {
          if (entry.friendId === scope.friendId || !entry.friendId) {
            keysToInvalidate.push(key);
          }
        }
        break;
        
      case 'user_state':
        // Only invalidate essential context (has user state)
        for (const [key, entry] of this.cache) {
          if (entry.contextType === 'essential') {
            keysToInvalidate.push(key);
          }
        }
        break;
        
      case 'interaction':
        // Invalidate pattern and rich contexts (have recent activity)
        for (const [key, entry] of this.cache) {
          if (entry.contextType !== 'essential') {
            keysToInvalidate.push(key);
          }
          // Also invalidate if this friend is involved
          if (scope.friendId && entry.friendId === scope.friendId) {
            keysToInvalidate.push(key);
          }
        }
        break;
        
      case 'all':
        keysToInvalidate.push(...this.cache.keys());
        break;
    }
    
    // Mark as stale rather than delete (allows serving stale)
    for (const key of keysToInvalidate) {
      const entry = this.cache.get(key);
      if (entry) {
        entry.validUntil = 0; // Expired, but staleAt still valid
      }
    }
  }
  
  private getTTL(type: string): number {
    switch (type) {
      case 'essential': return 30 * 60 * 1000;  // 30 min
      case 'pattern':   return 15 * 60 * 1000;  // 15 min
      case 'rich':      return 5 * 60 * 1000;   // 5 min
      default:          return 10 * 60 * 1000;
    }
  }
}

export interface InvalidationScope {
  type: 'friend' | 'user_state' | 'interaction' | 'all';
  friendId?: string;
}
```

**Invalidation Mapping:**

| Event | Invalidation Scope | Rationale |
|-------|-------------------|-----------|
| Interaction logged | `{ type: 'interaction', friendId }` | Affects patterns for that friend |
| Journal entry saved | `{ type: 'friend', friendId }` | Affects themes/sentiment for tagged friends |
| Friend score updated | `{ type: 'friend', friendId }` | Affects health status |
| Social battery changed | `{ type: 'user_state' }` | Only affects essential context |
| Weekly reflection | `{ type: 'all' }` | Potentially affects everything |
| Friend tier changed | `{ type: 'friend', friendId }` | Affects that friend's context |

---

### 1.4 Rate Limiting Implementation

**Problem:** "5 consultations per day" mentioned but not specified.

**Solution:** Local rate limiting with clear UX.

```typescript
// src/modules/reflection/services/oracle/rate-limiter.ts

export interface RateLimitConfig {
  maxConsultationsPerDay: number;
  resetHour: number;              // Local hour (0-23) to reset
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxConsultationsPerDay: 5,
  resetHour: 4,                   // Reset at 4 AM local time
};

export class OracleRateLimiter {
  private config: RateLimitConfig;
  private storageKey = 'oracle_rate_limit';
  
  constructor(config: RateLimitConfig = DEFAULT_CONFIG) {
    this.config = config;
  }
  
  async canConsult(): Promise<boolean> {
    const state = await this.getState();
    return state.remaining > 0;
  }
  
  async getRemainingConsultations(): Promise<number> {
    const state = await this.getState();
    return state.remaining;
  }
  
  async getResetTime(): Promise<Date> {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setHours(this.config.resetHour, 0, 0, 0);
    
    // If we're past reset hour today, reset is tomorrow
    if (now.getHours() >= this.config.resetHour) {
      resetTime.setDate(resetTime.getDate() + 1);
    }
    
    return resetTime;
  }
  
  async recordConsultation(): Promise<void> {
    const state = await this.getState();
    
    if (state.remaining <= 0) {
      throw new Error('Rate limit exceeded');
    }
    
    await this.saveState({
      date: state.date,
      used: state.used + 1,
      remaining: state.remaining - 1,
    });
  }
  
  private async getState(): Promise<RateLimitState> {
    const stored = await AsyncStorage.getItem(this.storageKey);
    const today = this.getDateKey();
    
    if (!stored) {
      return this.freshState(today);
    }
    
    const state: RateLimitState = JSON.parse(stored);
    
    // Check if we need to reset (new day)
    if (state.date !== today) {
      return this.freshState(today);
    }
    
    return state;
  }
  
  private freshState(date: string): RateLimitState {
    return {
      date,
      used: 0,
      remaining: this.config.maxConsultationsPerDay,
    };
  }
  
  private getDateKey(): string {
    const now = new Date();
    // Adjust for reset hour (if before reset hour, count as previous day)
    if (now.getHours() < this.config.resetHour) {
      now.setDate(now.getDate() - 1);
    }
    return now.toISOString().split('T')[0];
  }
  
  private async saveState(state: RateLimitState): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(state));
  }
}

interface RateLimitState {
  date: string;       // YYYY-MM-DD
  used: number;
  remaining: number;
}
```

**UI Component:**

```typescript
// src/modules/reflection/components/Oracle/RateLimitIndicator.tsx

export function RateLimitIndicator() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetTime, setResetTime] = useState<Date | null>(null);
  
  useEffect(() => {
    const limiter = new OracleRateLimiter();
    limiter.getRemainingConsultations().then(setRemaining);
    limiter.getResetTime().then(setResetTime);
  }, []);
  
  if (remaining === null) return null;
  
  const isLow = remaining <= 2;
  const isExhausted = remaining === 0;
  
  return (
    <View style={styles.container}>
      <Text style={[styles.text, isLow && styles.lowText]}>
        {isExhausted 
          ? `Resets ${formatRelativeTime(resetTime)}`
          : `${remaining} consultation${remaining !== 1 ? 's' : ''} remaining`
        }
      </Text>
      {!isExhausted && (
        <View style={styles.dots}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                i < remaining ? styles.dotFilled : styles.dotEmpty
              ]} 
            />
          ))}
        </View>
      )}
    </View>
  );
}
```

**Exhausted State UX:**

When `remaining === 0`:
- Disable the "Ask" button
- Show friendly message: "The Oracle rests. Return tomorrow."
- Show exact reset time
- Offer alternative: "Browse your past consultations" or "Try a guided reflection instead"

---

### 1.5 Robust Signal Extraction

**Problem:** LLM sentiment analysis on short personal text is unreliable.

**Solution:** Multi-layer extraction with confidence gating.

```typescript
// src/modules/journal/services/signal-extraction.ts

export interface ExtractionResult {
  signals: JournalSignals;
  method: 'llm' | 'hybrid' | 'rule_based';
  confidence: number;
  shouldApply: boolean;          // False if confidence too low
}

export class SignalExtractor {
  private llm: LLMService;
  
  // Minimum thresholds
  private readonly MIN_ENTRY_LENGTH = 20;      // Words
  private readonly MIN_CONFIDENCE = 0.5;
  private readonly MIN_CONFIDENCE_FOR_NEGATIVE = 0.7; // Higher bar for negative signals
  
  async extract(entry: JournalEntry): Promise<ExtractionResult> {
    const wordCount = entry.content.split(/\s+/).length;
    
    // Too short for reliable extraction
    if (wordCount < this.MIN_ENTRY_LENGTH) {
      return {
        signals: this.neutralSignals(),
        method: 'rule_based',
        confidence: 0.3,
        shouldApply: false,
      };
    }
    
    // Try LLM extraction
    const llmResult = await this.extractWithLLM(entry);
    
    // Validate LLM result against rule-based signals
    const ruleResult = this.extractRuleBased(entry);
    
    // If they agree, high confidence
    if (this.signalsAgree(llmResult.signals, ruleResult.signals)) {
      return {
        signals: llmResult.signals,
        method: 'hybrid',
        confidence: Math.min(llmResult.confidence + 0.2, 1.0),
        shouldApply: true,
      };
    }
    
    // If they disagree significantly on sentiment, be conservative
    if (Math.abs(llmResult.signals.sentiment - ruleResult.signals.sentiment) >= 2) {
      // Use the more neutral interpretation
      const conservativeSignals = this.mergeConservatively(llmResult.signals, ruleResult.signals);
      return {
        signals: conservativeSignals,
        method: 'hybrid',
        confidence: 0.5,
        shouldApply: conservativeSignals.sentiment >= 0, // Only apply if not negative
      };
    }
    
    // Default to LLM with its reported confidence
    return {
      signals: llmResult.signals,
      method: 'llm',
      confidence: llmResult.confidence,
      shouldApply: this.shouldApplySignals(llmResult),
    };
  }
  
  private shouldApplySignals(result: { signals: JournalSignals; confidence: number }): boolean {
    // Always apply positive signals if confidence is reasonable
    if (result.signals.sentiment >= 0 && result.confidence >= this.MIN_CONFIDENCE) {
      return true;
    }
    
    // Higher bar for negative signals (to avoid false "needs attention" flags)
    if (result.signals.sentiment < 0 && result.confidence >= this.MIN_CONFIDENCE_FOR_NEGATIVE) {
      return true;
    }
    
    return false;
  }
  
  private extractRuleBased(entry: JournalEntry): { signals: JournalSignals; confidence: number } {
    const text = entry.content.toLowerCase();
    
    // Simple keyword-based sentiment
    const positiveWords = ['grateful', 'thankful', 'happy', 'great', 'wonderful', 'love', 'amazing', 'best', 'joy'];
    const negativeWords = ['worried', 'anxious', 'frustrated', 'angry', 'sad', 'disappointed', 'hurt', 'upset', 'conflict'];
    
    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;
    
    let sentiment: number;
    if (positiveCount > negativeCount + 1) {
      sentiment = positiveCount > 3 ? 2 : 1;
    } else if (negativeCount > positiveCount + 1) {
      sentiment = negativeCount > 3 ? -2 : -1;
    } else {
      sentiment = 0;
    }
    
    // Theme detection
    const themePatterns: Record<CoreTheme, RegExp[]> = {
      gratitude: [/thank/i, /grateful/i, /appreciate/i],
      support: [/helped/i, /support/i, /there for/i],
      growth: [/learn/i, /grow/i, /realize/i, /understand/i],
      vulnerability: [/open up/i, /share/i, /honest/i, /vulnerable/i],
      celebration: [/celebrat/i, /party/i, /birthday/i, /milestone/i],
      career: [/work/i, /job/i, /career/i, /boss/i, /colleague/i],
      challenge: [/difficult/i, /hard/i, /struggle/i, /challenge/i],
      reconnection: [/reconnect/i, /catch up/i, /long time/i, /miss/i],
      boundaries: [/boundary/i, /space/i, /limit/i, /no\b/i],
      trust: [/trust/i, /rely/i, /depend/i, /count on/i],
    };
    
    const coreThemes: CoreTheme[] = [];
    for (const [theme, patterns] of Object.entries(themePatterns)) {
      if (patterns.some(p => p.test(text))) {
        coreThemes.push(theme as CoreTheme);
      }
    }
    
    return {
      signals: {
        sentiment,
        sentimentLabel: this.sentimentToLabel(sentiment),
        coreThemes: coreThemes.slice(0, 5),
        emergentThemes: [],
        dynamics: {
          tension: negativeCount > 2,
          gratitude: text.includes('grateful') || text.includes('thankful'),
          growth: /learn|grow|realize/.test(text),
        },
        confidence: 0.4, // Rule-based is inherently lower confidence
      },
      confidence: 0.4,
    };
  }
  
  private mergeConservatively(llm: JournalSignals, rules: JournalSignals): JournalSignals {
    return {
      ...llm,
      // Use the less extreme sentiment
      sentiment: Math.abs(llm.sentiment) < Math.abs(rules.sentiment) ? llm.sentiment : rules.sentiment,
      sentimentLabel: this.sentimentToLabel(
        Math.abs(llm.sentiment) < Math.abs(rules.sentiment) ? llm.sentiment : rules.sentiment
      ),
      // Only keep themes both agree on
      coreThemes: llm.coreThemes.filter(t => rules.coreThemes.includes(t)),
      // Clear tension flag unless both agree
      dynamics: {
        ...llm.dynamics,
        tension: llm.dynamics.tension && rules.dynamics.tension,
      },
      confidence: 0.5,
    };
  }
  
  private signalsAgree(a: JournalSignals, b: JournalSignals): boolean {
    // Same sentiment direction
    const sameDirection = (a.sentiment >= 0) === (b.sentiment >= 0);
    // Within 1 point
    const closeValue = Math.abs(a.sentiment - b.sentiment) <= 1;
    // At least one theme overlap
    const themeOverlap = a.coreThemes.some(t => b.coreThemes.includes(t));
    
    return sameDirection && closeValue;
  }
  
  private neutralSignals(): JournalSignals {
    return {
      sentiment: 0,
      sentimentLabel: 'neutral',
      coreThemes: [],
      emergentThemes: [],
      dynamics: {},
      confidence: 0,
    };
  }
  
  private sentimentToLabel(sentiment: number): JournalSignals['sentimentLabel'] {
    if (sentiment >= 2) return 'grateful';
    if (sentiment === 1) return 'positive';
    if (sentiment === 0) return 'neutral';
    if (sentiment === -1) return 'concerned';
    return 'tense';
  }
}
```

**"Needs Attention" Flag Logic:**

```typescript
// Only flag after pattern detection, not single entries

async function shouldFlagNeedsAttention(
  friend: Friend,
  newSignals: JournalSignals,
  database: Database
): Promise<boolean> {
  // Never flag based on single entry
  const recentEntries = await database.get('journal_entries')
    .query(
      Q.where('friend_ids', Q.like(`%${friend.id}%`)),
      Q.sortBy('created_at', Q.desc),
      Q.take(3)
    )
    .fetch();
  
  if (recentEntries.length < 2) {
    return false;
  }
  
  // Check for pattern: multiple negative entries
  const recentSignals = await Promise.all(
    recentEntries.map(e => getSignalsForEntry(e.id))
  );
  
  const negativeCount = recentSignals.filter(s => s && s.sentiment < 0).length;
  const tensionCount = recentSignals.filter(s => s && s.dynamics.tension).length;
  
  // Flag if 2+ negative entries OR consistent tension
  return negativeCount >= 2 || tensionCount >= 2;
}
```

---

### 1.6 Offline/Sync Strategy

**Problem:** Spec assumes always-online.

**Solution:** Graceful degradation with queued operations.

```typescript
// src/shared/services/offline/offline-queue.ts

export interface QueuedOperation {
  id: string;
  type: 'signal_extraction' | 'oracle_consultation' | 'insight_generation';
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  error?: string;
}

export class OfflineQueue {
  private storageKey = 'llm_offline_queue';
  
  async enqueue(operation: Omit<QueuedOperation, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
    const queue = await this.getQueue();
    const newOp: QueuedOperation = {
      ...operation,
      id: generateId(),
      createdAt: Date.now(),
      attempts: 0,
    };
    queue.push(newOp);
    await this.saveQueue(queue);
    return newOp.id;
  }
  
  async processQueue(): Promise<void> {
    const queue = await this.getQueue();
    const stillPending: QueuedOperation[] = [];
    
    for (const op of queue) {
      if (op.attempts >= 3) {
        // Give up after 3 attempts
        console.warn(`Giving up on operation ${op.id} after 3 attempts`);
        continue;
      }
      
      try {
        await this.processOperation(op);
        // Success - don't re-add to queue
      } catch (error) {
        // Failed - update and keep in queue
        op.attempts++;
        op.lastAttempt = Date.now();
        op.error = error instanceof Error ? error.message : 'Unknown error';
        stillPending.push(op);
      }
    }
    
    await this.saveQueue(stillPending);
  }
  
  private async processOperation(op: QueuedOperation): Promise<void> {
    switch (op.type) {
      case 'signal_extraction':
        const entry = await database.get('journal_entries').find(op.payload.entryId);
        await journalIntelligenceService.processEntry(entry);
        break;
        
      case 'oracle_consultation':
        // Consultations should fail if offline - user expects immediate response
        throw new Error('Cannot process consultation offline');
        
      case 'insight_generation':
        await oracleService.generateAndCacheInsight(op.payload.type);
        break;
    }
  }
}

// Network listener to trigger queue processing
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    offlineQueue.processQueue();
  }
});
```

**Feature Availability by Network State:**

| Feature | Online | Offline |
|---------|--------|---------|
| Journal entry save | ✅ Full (with async signal extraction) | ✅ Save locally, queue extraction |
| Guided prompts | ✅ LLM-generated | ⚠️ Rule-based fallback |
| Oracle consultation | ✅ Full | ❌ Disabled with message |
| Oracle insights | ✅ Fresh generation | ⚠️ Show cached if available |
| Guided dialogue | ✅ Full | ❌ Disabled with message |

**Offline UI Pattern:**

```typescript
// src/shared/hooks/useNetworkAware.ts

export function useNetworkAwareLLM() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return unsubscribe;
  }, []);
  
  return {
    isOnline,
    canUseOracle: isOnline,
    canUseGuidedDialogue: isOnline,
    promptSource: isOnline ? 'llm' : 'fallback',
  };
}

// In Oracle tab
function OracleTab() {
  const { canUseOracle, isOnline } = useNetworkAwareLLM();
  
  if (!isOnline) {
    return (
      <OfflineState
        title="Oracle Unavailable"
        message="The Oracle requires an internet connection. Your past consultations are still available below."
        showPastConsultations
      />
    );
  }
  
  // Normal Oracle UI...
}
```

---

## Part 2: Missing Spec Items

### 2.1 API Key Management

**Options:**

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Bundled in app** | Simple | Exposed in APK, can be extracted | ❌ Never do this |
| **Environment variable at build** | Simple, not in source | Still in bundle | ❌ Same problem |
| **Fetched from your server** | Secure, revocable | Needs backend | ✅ For production |
| **User provides their own key** | No cost to you | Bad UX, support burden | ⚠️ Only for power users |

**Recommended Implementation (Server-Proxied):**

For MVP, you can use a simple proxy approach:

```typescript
// Your backend (can be a simple Cloudflare Worker)

export async function handleLLMRequest(request: Request): Promise<Response> {
  // Validate the request is from your app
  const authHeader = request.headers.get('Authorization');
  if (!isValidAppToken(authHeader)) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Forward to Gemini with your API key
  const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1/...', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY, // Stored in environment
    },
    body: request.body,
  });
  
  return geminiResponse;
}
```

```typescript
// In your app

export class ProxiedGeminiProvider implements LLMProvider {
  private proxyUrl: string;
  private appToken: string;
  
  constructor(config: { proxyUrl: string; appToken: string }) {
    this.proxyUrl = config.proxyUrl;
    this.appToken = config.appToken;
  }
  
  async complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse> {
    const response = await fetch(this.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.appToken}`,
      },
      body: JSON.stringify({ prompt, options }),
    });
    
    // ... handle response
  }
}
```

**For true MVP (beta only):** You could temporarily use a bundled key with heavy rate limiting and monitoring, accepting the risk for a small beta. Replace before public launch.

---

### 2.2 Cost Monitoring

```typescript
// src/shared/services/llm/cost-tracker.ts

export interface CostConfig {
  // Gemini Flash pricing (as of late 2024)
  costPerInputToken: number;   // ~$0.000000375 per token
  costPerOutputToken: number;  // ~$0.0000015 per token
  
  // Alerts
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  alertThresholds: number[];   // e.g., [0.5, 0.8, 0.95]
}

const DEFAULT_CONFIG: CostConfig = {
  costPerInputToken: 0.000000375,
  costPerOutputToken: 0.0000015,
  dailyBudgetCents: 50,        // $0.50/day default
  monthlyBudgetCents: 1000,    // $10/month default
  alertThresholds: [0.5, 0.8, 0.95],
};

export class CostTracker {
  private config: CostConfig;
  
  constructor(config: CostConfig = DEFAULT_CONFIG) {
    this.config = config;
  }
  
  async trackUsage(usage: { promptTokens: number; completionTokens: number }): Promise<void> {
    const costCents = this.calculateCost(usage);
    
    // Update daily total
    const dailyKey = `cost_${this.getTodayKey()}`;
    const currentDaily = (await AsyncStorage.getItem(dailyKey)) ?? '0';
    const newDaily = parseFloat(currentDaily) + costCents;
    await AsyncStorage.setItem(dailyKey, newDaily.toString());
    
    // Update monthly total
    const monthlyKey = `cost_${this.getMonthKey()}`;
    const currentMonthly = (await AsyncStorage.getItem(monthlyKey)) ?? '0';
    const newMonthly = parseFloat(currentMonthly) + costCents;
    await AsyncStorage.setItem(monthlyKey, newMonthly.toString());
    
    // Check thresholds
    await this.checkAlerts(newDaily, newMonthly);
  }
  
  private calculateCost(usage: { promptTokens: number; completionTokens: number }): number {
    const inputCost = usage.promptTokens * this.config.costPerInputToken;
    const outputCost = usage.completionTokens * this.config.costPerOutputToken;
    return (inputCost + outputCost) * 100; // Convert to cents
  }
  
  private async checkAlerts(dailyCents: number, monthlyCents: number): Promise<void> {
    const dailyRatio = dailyCents / this.config.dailyBudgetCents;
    const monthlyRatio = monthlyCents / this.config.monthlyBudgetCents;
    
    for (const threshold of this.config.alertThresholds) {
      if (dailyRatio >= threshold) {
        await this.sendAlert('daily', threshold, dailyCents);
      }
      if (monthlyRatio >= threshold) {
        await this.sendAlert('monthly', threshold, monthlyCents);
      }
    }
  }
  
  private async sendAlert(period: string, threshold: number, currentCents: number): Promise<void> {
    // Log to analytics
    trackEvent('cost_alert', {
      period,
      threshold,
      currentCents,
      budgetCents: period === 'daily' 
        ? this.config.dailyBudgetCents 
        : this.config.monthlyBudgetCents,
    });
    
    // Could also: send push notification, email, etc.
  }
  
  async shouldThrottle(): Promise<boolean> {
    const dailyCents = parseFloat(
      (await AsyncStorage.getItem(`cost_${this.getTodayKey()}`)) ?? '0'
    );
    return dailyCents >= this.config.dailyBudgetCents;
  }
}
```

**Per-User Cost Estimation:**

```
Assumptions for 1 active user/day:
- 3 guided reflections × 200 tokens output = 600 tokens
- 2 oracle consultations × 500 tokens output = 1,000 tokens  
- 1 signal extraction × 200 tokens output = 200 tokens
- Average input context: 1,000 tokens

Daily tokens per user:
- Input: ~3,000 tokens
- Output: ~1,800 tokens

Daily cost per user:
- Input: 3,000 × $0.000000375 = $0.001125
- Output: 1,800 × $0.0000015 = $0.0027
- Total: ~$0.004/user/day = ~$0.12/user/month

With 40 beta users, all active daily:
- ~$4.80/month

Gemini Flash is cheap. You're fine.
```

---

### 2.3 User Opt-Out & Privacy

```typescript
// src/shared/services/settings/llm-settings.ts

export interface LLMPrivacySettings {
  enableLLMFeatures: boolean;           // Master toggle
  enableJournalAnalysis: boolean;       // Signal extraction
  enableOracleInsights: boolean;        // Proactive insights
  enableOracleConsultations: boolean;   // User-initiated consultations
  dataRetentionDays: number;            // How long to keep LLM logs (0 = don't log)
}

const DEFAULT_SETTINGS: LLMPrivacySettings = {
  enableLLMFeatures: true,
  enableJournalAnalysis: true,
  enableOracleInsights: true,
  enableOracleConsultations: true,
  dataRetentionDays: 30,
};

// Settings screen component
function LLMPrivacySettings() {
  const [settings, setSettings] = useSettings<LLMPrivacySettings>('llm_privacy');
  
  return (
    <SettingsSection title="AI Features">
      <SettingsToggle
        label="Enable AI Features"
        description="Turn off to disable all AI-powered features. Prompts will use simple templates instead."
        value={settings.enableLLMFeatures}
        onChange={v => setSettings({ ...settings, enableLLMFeatures: v })}
      />
      
      {settings.enableLLMFeatures && (
        <>
          <SettingsToggle
            label="Journal Insights"
            description="Allow AI to analyze your journal entries to improve relationship understanding."
            value={settings.enableJournalAnalysis}
            onChange={v => setSettings({ ...settings, enableJournalAnalysis: v })}
          />
          
          <SettingsToggle
            label="Proactive Oracle"
            description="Show AI-generated insights without asking."
            value={settings.enableOracleInsights}
            onChange={v => setSettings({ ...settings, enableOracleInsights: v })}
          />
          
          <SettingsInfo>
            <Text>Your journal entries are sent to Google's Gemini AI for analysis. </Text>
            <Text>Anthropic/Google do not use this data to train their models. </Text>
            <Link href="/privacy-policy">Read our privacy policy</Link>
          </SettingsInfo>
        </>
      )}
    </SettingsSection>
  );
}
```

**Privacy Policy Additions:**

You'll need to update your privacy policy to disclose:
- That journal content is sent to third-party AI (Google/Anthropic)
- What data is sent (content, no PII ideally)
- That providers don't train on this data (verify this in their terms)
- How to opt out
- Data retention periods

---

### 2.4 Content Safety

**Problem:** Users might journal about self-harm, and that content goes to LLM.

**Solution:** Pre-screening layer before LLM, with appropriate responses.

```typescript
// src/shared/services/safety/content-safety.ts

export interface SafetyCheckResult {
  isSafe: boolean;
  category?: 'self_harm' | 'crisis' | 'violence' | 'other';
  confidence: number;
  shouldBlockLLM: boolean;
  suggestedResponse?: string;
}

const CRISIS_PATTERNS = [
  /\b(suicid|kill myself|end (my|it all)|don'?t want to (live|be here))\b/i,
  /\b(self[- ]?harm|cut(ting)? myself|hurt myself)\b/i,
  /\b(want to die|better off dead|no reason to live)\b/i,
];

const DISTRESS_PATTERNS = [
  /\b(hopeless|worthless|can'?t go on|giving up)\b/i,
  /\b(nobody cares|all alone|no one understands)\b/i,
];

export function checkContentSafety(content: string): SafetyCheckResult {
  const lowerContent = content.toLowerCase();
  
  // Check for crisis indicators
  for (const pattern of CRISIS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        isSafe: false,
        category: 'crisis',
        confidence: 0.9,
        shouldBlockLLM: true,
        suggestedResponse: getCrisisResponse(),
      };
    }
  }
  
  // Check for distress (lower severity)
  for (const pattern of DISTRESS_PATTERNS) {
    if (pattern.test(content)) {
      return {
        isSafe: true, // Allow saving, but handle carefully
        category: 'self_harm',
        confidence: 0.7,
        shouldBlockLLM: false, // Can still use LLM, but with care
        suggestedResponse: getDistressResponse(),
      };
    }
  }
  
  return {
    isSafe: true,
    confidence: 1.0,
    shouldBlockLLM: false,
  };
}

function getCrisisResponse(): string {
  return `I noticed you might be going through something really difficult. Your wellbeing matters.

If you're in crisis, please reach out:
• National Suicide Prevention Lifeline: 988 (US)
• Crisis Text Line: Text HOME to 741741
• International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

Your entry has been saved privately. I'm here when you're ready to talk about your friendships.`;
}

function getDistressResponse(): string {
  return `It sounds like you're carrying something heavy right now. That's okay to feel.

If you'd like to talk to someone, the Crisis Text Line is available 24/7 - just text HOME to 741741.

Your journal is a safe space. Take your time.`;
}
```

**Integration Point:**

```typescript
// In journal save flow

async function saveJournalEntry(content: string, friendIds: string[]): Promise<void> {
  // 1. Safety check BEFORE any LLM processing
  const safetyResult = checkContentSafety(content);
  
  // 2. Save entry regardless (user's content is theirs)
  const entry = await createEntry(content, friendIds);
  
  // 3. Handle safety result
  if (safetyResult.category === 'crisis') {
    // Show crisis resources, don't send to LLM
    showCrisisModal(safetyResult.suggestedResponse);
    return; // Skip signal extraction
  }
  
  if (safetyResult.category === 'self_harm') {
    // Show supportive message, but still process
    showSupportiveToast(safetyResult.suggestedResponse);
  }
  
  // 4. Only send to LLM if appropriate
  if (!safetyResult.shouldBlockLLM) {
    await queueSignalExtraction(entry.id);
  }
}
```

---

### 2.5 Latency UX

**Loading States:**

```typescript
// src/shared/components/LLMLoadingState.tsx

interface LLMLoadingProps {
  type: 'prompt' | 'consultation' | 'insight' | 'extraction';
  onCancel?: () => void;
}

const LOADING_MESSAGES = {
  prompt: ['Finding the right question...', 'Thinking about your friendship...'],
  consultation: ['The Oracle is reflecting...', 'Consulting the patterns...', 'Gathering insights...'],
  insight: ['Noticing patterns...'],
  extraction: [], // Silent, no UI
};

export function LLMLoadingState({ type, onCancel }: LLMLoadingProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showExtended, setShowExtended] = useState(false);
  const messages = LOADING_MESSAGES[type];
  
  // Rotate messages every 2s
  useEffect(() => {
    if (messages.length <= 1) return;
    const interval = setInterval(() => {
      setMessageIndex(i => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages]);
  
  // Show "taking longer than expected" after 5s
  useEffect(() => {
    const timeout = setTimeout(() => setShowExtended(true), 5000);
    return () => clearTimeout(timeout);
  }, []);
  
  if (type === 'extraction') {
    return null; // Silent extraction
  }
  
  return (
    <View style={styles.container}>
      <OracleSymbol animate />
      <Text style={styles.message}>{messages[messageIndex]}</Text>
      
      {showExtended && (
        <Text style={styles.extended}>Taking a moment longer...</Text>
      )}
      
      {onCancel && showExtended && (
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

**Skeleton Screens:**

```typescript
// For Oracle insight card while loading
function OracleInsightSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SkeletonLine width={120} />
      </View>
      <SkeletonLine width="100%" />
      <SkeletonLine width="80%" />
      <SkeletonLine width="60%" />
    </View>
  );
}

// For prompt list while loading
function PromptListSkeleton() {
  return (
    <View style={styles.promptList}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.promptItem}>
          <SkeletonLine width="90%" />
        </View>
      ))}
    </View>
  );
}
```

**Optimistic UI for Prompts:**

```typescript
// Show rule-based prompts immediately, replace with LLM when ready

function GuidedReflectionPrompts({ context }: { context: PromptContext }) {
  const [prompts, setPrompts] = useState<JournalPrompt[]>([]);
  const [source, setSource] = useState<'loading' | 'fallback' | 'llm'>('loading');
  
  useEffect(() => {
    // Immediately show rule-based
    const fallbackPrompts = generateRuleBasedPrompts(context);
    setPrompts(fallbackPrompts);
    setSource('fallback');
    
    // Then try LLM in background
    generateLLMPrompts(context)
      .then(llmPrompts => {
        setPrompts(llmPrompts);
        setSource('llm');
      })
      .catch(() => {
        // Keep fallback, already shown
      });
  }, [context]);
  
  return (
    <View>
      {prompts.map((prompt, i) => (
        <PromptChip 
          key={i} 
          prompt={prompt} 
          // Subtle indicator if still using fallback
          isPlaceholder={source === 'fallback'}
        />
      ))}
    </View>
  );
}
```

---

### 2.6 Testing Strategy

**Approach: Deterministic Mocks + Snapshot Testing + Real Integration Tests**

```typescript
// src/shared/services/llm/__mocks__/llm-service.ts

export class MockLLMService implements LLMService {
  private mockResponses: Map<string, string> = new Map();
  
  setMockResponse(promptSubstring: string, response: string): void {
    this.mockResponses.set(promptSubstring, response);
  }
  
  async complete(prompt: LLMPrompt): Promise<LLMResponse> {
    // Find matching mock
    for (const [key, response] of this.mockResponses) {
      if (prompt.user.includes(key)) {
        return {
          content: response,
          usage: { promptTokens: 100, completionTokens: 50 },
          latencyMs: 100,
          cached: false,
        };
      }
    }
    
    // Default response
    return {
      content: 'Mock LLM response',
      usage: { promptTokens: 100, completionTokens: 50 },
      latencyMs: 100,
      cached: false,
    };
  }
}

// In tests
describe('OracleService', () => {
  let mockLLM: MockLLMService;
  let oracle: OracleService;
  
  beforeEach(() => {
    mockLLM = new MockLLMService();
    oracle = new OracleService(mockLLM, new MockContextBuilder());
  });
  
  it('returns grounded insight', async () => {
    mockLLM.setMockResponse(
      'Generate insight',
      JSON.stringify({
        content: 'You had 3 deep conversations this week.',
        groundingData: [{ type: 'stat', description: '3 conversations' }],
      })
    );
    
    const insight = await oracle.getInsight('weekly');
    
    expect(insight.content).toContain('3 deep conversations');
    expect(insight.groundingData).toHaveLength(1);
  });
});
```

**Snapshot Testing for Prompts:**

```typescript
// Test that prompt templates produce expected structure

describe('Prompt Generation', () => {
  it('generates consistent journal prompts', async () => {
    const context: PromptContext = {
      friend: {
        name: 'Sarah',
        archetype: 'Hermit',
        tier: 'inner',
        // ... fixed context
      },
      // ... more fixed context
    };
    
    const prompts = await generateRuleBasedPrompts('weave', context);
    
    // Snapshot the structure, not exact content
    expect(prompts).toMatchSnapshot();
    
    // Validate constraints
    for (const prompt of prompts) {
      expect(prompt.text.split(' ').length).toBeLessThanOrEqual(30);
      expect(prompt.text).toContain('Sarah'); // Must reference friend
    }
  });
});
```

**Real Integration Tests (Run Sparingly):**

```typescript
// integration/llm.integration.test.ts
// Only run manually or in CI with real API key

describe('LLM Integration', () => {
  const realLLM = new GeminiFlashProvider(process.env.GEMINI_API_KEY);
  
  it('returns valid structured output', async () => {
    const response = await realLLM.completeStructured<JournalSignals>(
      {
        system: SIGNAL_EXTRACTION_PROMPT,
        user: 'I had a wonderful coffee chat with Sarah. She really listened when I talked about work stress.',
      },
      JOURNAL_SIGNALS_SCHEMA
    );
    
    expect(response.sentiment).toBeGreaterThanOrEqual(-2);
    expect(response.sentiment).toBeLessThanOrEqual(2);
    expect(response.coreThemes).toBeInstanceOf(Array);
  });
  
  it('handles content filtering gracefully', async () => {
    // Test with content that might trigger safety filters
    // Verify we get appropriate error type
  });
});
```

---

### 2.7 Rollout Strategy

```typescript
// src/shared/services/feature-flags/llm-features.ts

export interface LLMFeatureFlags {
  llmPromptsEnabled: boolean;
  llmPromptsRolloutPercent: number;     // 0-100
  oracleEnabled: boolean;
  oracleRolloutPercent: number;
  signalExtractionEnabled: boolean;
  signalExtractionRolloutPercent: number;
}

// Simple deterministic rollout based on user ID
function isInRollout(userId: string, percent: number): boolean {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  
  // Hash user ID to get deterministic 0-99 value
  const hash = simpleHash(userId) % 100;
  return hash < percent;
}

export function getLLMFeatureAccess(
  userId: string,
  flags: LLMFeatureFlags
): {
  canUseLLMPrompts: boolean;
  canUseOracle: boolean;
  canUseSignalExtraction: boolean;
} {
  return {
    canUseLLMPrompts: flags.llmPromptsEnabled && 
      isInRollout(userId, flags.llmPromptsRolloutPercent),
    canUseOracle: flags.oracleEnabled && 
      isInRollout(userId, flags.oracleRolloutPercent),
    canUseSignalExtraction: flags.signalExtractionEnabled && 
      isInRollout(userId, flags.signalExtractionRolloutPercent),
  };
}
```

**Suggested Rollout Schedule:**

| Week | LLM Prompts | Oracle | Signal Extraction |
|------|-------------|--------|-------------------|
| 1 | 10% (4 users) | 0% | 0% |
| 2 | 25% (10 users) | 10% | 0% |
| 3 | 50% | 25% | 10% |
| 4 | 100% | 50% | 25% |
| 5 | 100% | 100% | 50% |
| 6 | 100% | 100% | 100% |

**Kill Switch:**

```typescript
// Remote config (could be a simple JSON file on your server)
const REMOTE_CONFIG_URL = 'https://your-server.com/config/llm-features.json';

async function checkKillSwitch(): Promise<boolean> {
  try {
    const response = await fetch(REMOTE_CONFIG_URL);
    const config = await response.json();
    return config.llmEnabled !== false; // Default to enabled
  } catch {
    return true; // If can't reach config, keep running
  }
}

// Check periodically
setInterval(async () => {
  const enabled = await checkKillSwitch();
  if (!enabled) {
    // Disable all LLM features globally
    llmService.disable();
  }
}, 60000); // Every minute
```

---

## Part 3: Pragmatic MVP Scope

### Philosophy

Your original spec is a 6-month roadmap compressed into a "v1." For a beta with 40 users, you need to validate the core thesis:

> **Does LLM-powered reflection meaningfully improve the journaling experience?**

You don't need the full Oracle, signal extraction loop, or multi-turn dialogue to answer that question. You need ONE feature, done well.

---

### MVP Option A: Smart Prompts Only

**Scope:** Replace rule-based journal prompts with LLM-generated prompts.

**Why This:**
- Lowest risk (fallback exists)
- Touches existing UX (no new screens)
- Quick to validate (do users prefer LLM prompts?)
- Teaches you LLM integration patterns

**What You Build:**

```
Week 1:
├── LLM abstraction layer (simplified)
│   ├── Single provider (Gemini Flash)
│   ├── Basic error handling (retry + fallback)
│   └── Simple prompt registry
├── PromptGenerator service
│   ├── LLM generation with context
│   └── Rule-based fallback
└── Integration into GuidedReflectionModal

Week 2:
├── Quality tracking (basic analytics)
├── A/B test: LLM vs rule-based
└── Polish based on feedback
```

**What You Skip (For Now):**
- Oracle (all of it)
- Signal extraction
- Intelligence feedback loop
- Multi-tier context caching
- Proactive insights

**Success Metric:** 
- LLM prompts have >50% selection rate (user picks first prompt)
- Users write 20% longer entries with LLM prompts

---

### MVP Option B: Oracle Consultation Only

**Scope:** Add Oracle tab with single-turn consultation. No insights, no dialogue.

**Why This:**
- Most differentiated feature
- Clear value prop to test
- Self-contained (doesn't touch existing features)
- Users can opt-in

**What You Build:**

```
Week 1:
├── LLM abstraction layer (simplified)
├── OracleContextBuilder (essential tier only)
├── OracleService (consultation only)
└── Basic Oracle tab UI

Week 2:
├── Rate limiting (5/day)
├── "Save to Journal" flow
├── Quality tracking
└── Polish

Week 3:
├── User feedback collection
└── Iterate on prompts
```

**What You Skip (For Now):**
- Proactive insights
- Guided dialogue
- Signal extraction
- Intelligence feedback loop
- Pattern/Rich context tiers

**Success Metric:**
- Users consult Oracle 2+ times/week on average
- >40% of consultations saved to journal
- Qualitative: "This actually helped me think about my friendships"

---

### MVP Option C: Invisible Intelligence (Background Only)

**Scope:** Run signal extraction on journal entries, update Friend data, but don't surface it yet.

**Why This:**
- No UX risk (users don't see it)
- Builds data foundation for future features
- Lets you validate extraction quality before showing users
- Can run A/B test later: "Show detected themes" vs "Don't show"

**What You Build:**

```
Week 1:
├── LLM abstraction layer (simplified)
├── SignalExtractor service
│   ├── LLM extraction
│   └── Rule-based validation
├── Schema migration (Friend intelligence fields)
└── Async processing after journal save

Week 2:
├── Quality tracking
├── Manual review of extraction accuracy
└── Tune prompts based on real data
```

**What You Skip (For Now):**
- Any user-visible LLM features
- Oracle (all of it)
- Intelligence-driven UX changes
- "Needs attention" flags

**Success Metric:**
- >80% extraction accuracy (manual review of 50 entries)
- No user complaints (invisible feature)
- Build confidence in LLM integration

---

### My Recommendation: Start with Option A

**Reasoning:**

1. **Lowest risk:** If LLM prompts are bad, you fall back silently. Users never know.

2. **Fastest validation:** You'll know within 2 weeks if LLM prompts are better.

3. **Foundation for everything else:** The LLM abstraction, error handling, and quality tracking you build here are required for Oracle anyway.

4. **Quick win:** If it works, you ship a noticeably better experience with minimal effort.

5. **If it fails:** You learn that maybe your rule-based prompts were fine, and you can redirect effort to other features.

---

### MVP Architecture (Option A: Smart Prompts)

```
src/
├── shared/
│   └── services/
│       └── llm/
│           ├── types.ts              # LLMProvider interface, LLMPrompt, LLMResponse
│           ├── errors.ts             # Error classification
│           ├── gemini-provider.ts    # Gemini Flash implementation
│           ├── llm-service.ts        # Orchestration, fallback logic
│           └── prompt-registry.ts    # Versioned prompts
│
├── modules/
│   └── journal/
│       └── services/
│           ├── prompt-context.ts     # Build context for prompts
│           └── prompt-generator.ts   # LLM + fallback prompt generation
│
└── analytics/
    └── llm-quality.ts                # Track prompt usage, acceptance
```

**Key Files to Create:**

1. **`types.ts`** (~50 lines) - Interfaces only
2. **`errors.ts`** (~80 lines) - Error classification + retry logic
3. **`gemini-provider.ts`** (~100 lines) - API wrapper
4. **`llm-service.ts`** (~60 lines) - Thin orchestration
5. **`prompt-registry.ts`** (~40 lines) - Single prompt definition
6. **`prompt-context.ts`** (~80 lines) - Extract context from DB
7. **`prompt-generator.ts`** (~100 lines) - Generate prompts

**Total new code:** ~500 lines

**Changes to existing code:**
- `GuidedReflectionModal.tsx` - Use new PromptGenerator instead of existing rule-based
- Add analytics events for prompt selection

---

### MVP Timeline (Option A)

| Day | Task |
|-----|------|
| 1 | Set up Gemini API, get basic completion working in isolation |
| 2 | Build LLM abstraction layer (types, provider, service) |
| 3 | Build error handling + retry logic |
| 4 | Build PromptContextBuilder |
| 5 | Build PromptGenerator with LLM + fallback |
| 6 | Integrate into GuidedReflectionModal |
| 7 | Add quality tracking analytics |
| 8 | Test with real usage, fix bugs |
| 9 | Polish loading states, error handling UX |
| 10 | Ship to beta, monitor |

---

### What's Next After MVP

**If Smart Prompts succeed:**
1. Add Oracle consultation (2 weeks)
2. Add signal extraction (1 week)
3. Add proactive insights (1 week)
4. Add guided dialogue (2 weeks)

**If Smart Prompts fail:**
1. Analyze why (quality? latency? users don't notice?)
2. Consider if Oracle is worth building (maybe users don't want AI in this context)
3. Redirect effort to non-LLM features

---

## Summary

Your original spec is well-designed but over-scoped for a beta. The missing pieces (error handling, rate limiting, privacy, safety, testing, rollout) are real gaps that need addressing before production.

**Start with Smart Prompts.** It's 500 lines of code, 2 weeks of work, and validates the core question: do users want LLM-powered reflection?

Everything else can wait.
