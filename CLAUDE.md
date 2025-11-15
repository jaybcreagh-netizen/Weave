# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weave is a mindful relationship companion app built with React Native and Expo. It helps users deepen their most important friendships through a structured, intelligent framework combining Dunbar's social layers with tarot archetypes. The app tracks relationship health through a "weave score" that decays over time, encouraging regular meaningful connection.

**Core Philosophy**: Local-first, privacy-focused relationship intelligence that learns and adapts to each user's unique friendship patterns.

## Core Technologies

- **Framework**: React Native with Expo SDK 54
- **Language**: TypeScript (strict mode)
- **Navigation**: `expo-router` (file-based routing in `app/` directory)
- **Database**: WatermelonDB v0.27.1 (reactive, local-first) - **single source of truth**
- **State Management**: Zustand (ephemeral UI state only)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated 4.1.1
- **Icons**: lucide-react-native
- **Calendar**: expo-calendar, react-native-calendars
- **Analytics**: PostHog (product analytics) + Sentry (error tracking)
- **Fonts**: Lora (headings), Inter (body)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platforms
npx expo run:ios
npx expo run:android

# Clear cache and restart
npm start -- --clear

# For native module issues
# 1. Stop Metro server
# 2. Delete app from device/simulator
# 3. Rebuild with npx expo run:ios or npx expo run:android
```

## Architecture Overview

### Database Layer (WatermelonDB)

**Schema Version**: v33 (current)
**Convention**: Snake_case column names in schema, camelCase in model properties

**All 20 Database Models** (`src/db/models/`):

1. **friends** - Core relationship data
   - Identity: name, photo_url, notes, relationship_type
   - Scoring: weave_score, last_updated, resilience, momentum_score
   - Life events: birthday (MM-DD), anniversary (MM-DD)
   - Adaptive learning: typical_interval_days, tolerance_window_days, category_effectiveness, outcome_count
   - Reciprocity: initiation_ratio, last_initiated_by, consecutive_user_initiations, total_user/friend_initiations
   - Dormancy: is_dormant, dormant_since
   - Sync: user_id, synced_at, sync_status, server_updated_at (v31 account infrastructure)

2. **interactions** - Logged or planned weaves
   - Core: interaction_date, interaction_type, activity, interaction_category
   - Context: duration, vibe, mode, title, location
   - Lifecycle: status (planned, pending_confirm, completed, cancelled, missed)
   - Reflection: reflection (JSON with chips, notes, depth/energy scores), note
   - Special: event_importance (low/medium/high/critical), initiator (user/friend/mutual)
   - Calendar: calendar_event_id, completion_prompted_at
   - Sync: user_id, synced_at, sync_status

3. **interaction_friends** - Many-to-many join for multi-friend interactions
   - Links: interaction_id, friend_id
   - Sync: user_id, synced_at, sync_status

4. **life_events** - Major life events and milestones
   - Types: birthday, anniversary, new_job, moving, graduation, health_event, celebration, loss, wedding, baby, other
   - Context: friend_id, event_date, title, notes
   - Importance: low, medium, high, critical
   - Detection: source (manual, keyword_detected, recurring), is_recurring
   - Reminders: reminded flag
   - Sync: user_id, synced_at, sync_status

5. **intentions** - Planned connection intentions
   - Core: description, interaction_category, status (active/converted/dismissed/fulfilled)
   - Tracking: created_at, updated_at, last_reminded_at
   - Fulfillment: linked_interaction_id, fulfilled_at, days_to_fulfillment (v29 pattern analysis)
   - Sync: user_id, synced_at, sync_status

6. **intention_friends** - Many-to-many for intentions
   - Links: intention_id, friend_id
   - Sync: user_id, synced_at, sync_status

7. **user_profile** - User settings and state
   - Social Season: current_social_season (resting/flowing/blooming), season_last_calculated, season_history (JSON)
   - Battery: social_battery_current (1-5), social_battery_last_checkin, social_battery_history (JSON)
   - Preferences: battery_checkin_enabled, battery_checkin_time (HH:mm)
   - Reflection: reflection_day (0-6), reflection_auto_show, reflection_last_snoozed
   - Sync: user_id, synced_at, sync_status

8. **practice_log** - Daily practice tracking
   - Types: log_weave, add_reflection, create_intention, plan_weave, view_reading
   - Links: practice_date (indexed), practice_type, related_id

9. **user_progress** - Achievement and streak system
   - Streaks: current_streak, best_streak, last_practice_date
   - Forgiveness (v30): last_streak_count, streak_released_date, longest_streak_ever
   - Paths: consistency_milestones, reflection_milestones, friendship_milestones (JSON arrays)
   - Progress: catalyst_progress, high_priestess_progress, scribe_progress, curator_progress
   - Achievements: total_weaves, global_achievements, hidden_achievements (JSON arrays)
   - Sync: user_id, synced_at, sync_status

10. **friend_badges** - Friend-specific badge progression
    - Types: weave_count, depth, consistency, special
    - Tiers: 1-7 progression levels
    - Tracking: badge_id, unlocked_at

11. **achievement_unlocks** - Global achievement tracking
    - Types: global, friend_badge, hidden
    - Celebration: has_been_celebrated flag
    - Links: achievement_id, related_friend_id

12. **weekly_reflections** - Weekly summary data
    - Period: week_start_date, week_end_date (indexed)
    - Metrics: total_weaves, friends_contacted, top_activity, top_activity_count, missed_friends_count
    - Gratitude: gratitude_text, gratitude_prompt, prompt_context
    - Story chips: story_chips (JSON array of selections)
    - Sync: user_id, synced_at, sync_status

13. **portfolio_snapshots** - Network health over time
    - Health: overall_health_score (0-100), snapshot_date
    - Counts: total_friends, active_friends (>30), drifting_friends (<40), thriving_friends (>80)
    - Tier averages: inner_circle_avg, close_friends_avg, community_avg
    - Activity: interactions_per_week, diversity_score (0-1)

14. **journal_entries** - Freeform journaling with tagging
    - Content: entry_date (indexed), title, content
    - Tags: story_chips (JSON), friend_ids (JSON array)
    - Sync: user_id, synced_at, sync_status

15. **custom_chips** - User-created reflection chips
    - Identity: chip_id (custom_timestamp_random), chip_type, plain_text, template
    - Types: activity, setting, people, dynamic, topic, feeling, moment, surprise
    - Analytics: usage_count, last_used_at

16. **chip_usage** - Chip usage analytics
    - Links: chip_id, interaction_id, friend_id
    - Context: chip_type, is_custom, used_at

17. **interaction_outcomes** - Effectiveness measurement for learning
    - Score tracking: score_before, score_after, score_change
    - Context: interaction_id, friend_id, category, duration, vibe, had_reflection
    - Learning: expected_impact, actual_impact, effectiveness_ratio
    - Timing: interaction_date, measured_at

18. **event_suggestion_feedback** - Calendar event suggestion learning (v33)
    - Event: calendar_event_id, event_title, event_date, event_location
    - Suggestions: suggested_friend_ids (JSON), suggested_category
    - User action: action (accepted/dismissed/corrected/snoozed), dismissal_reason
    - Corrections: corrected_friend_ids (JSON), corrected_category
    - Snooze: snoozed_until, snooze_type (friend/event-pattern/all), snoozed_friend_ids (JSON)
    - Context: emotional_rating (1-5), reflection_notes
    - Results: resulting_interaction_id
    - Learning: confidence_score (0-1), match_quality (0-1)
    - Timing: suggested_at, responded_at

19. **suggestion_events** - Suggestion analytics
    - Identity: suggestion_id, friend_id, suggestion_type
    - Context: urgency (critical/high/medium/low), action_type (log/plan/reflect)
    - Events: event_type (shown/acted/dismissed/expired), event_timestamp
    - Metrics: friend_score_at_event, days_since_last_interaction
    - Results: resulting_interaction_id, time_to_action_minutes

**Database Setup** (`src/db/db.ts`):
- Singleton `database` export
- 20 model registrations
- Migration system for schema updates

### Intelligence Engine

The app features **8 interconnected intelligence systems** that learn and adapt:

#### 1. Weave Scoring Engine (`src/lib/weave-engine.ts`)

**Core scoring logic** - the brain of the application.

**Key Functions**:
- `calculateCurrentScore(friend)` - Applies time-based decay with adaptive tolerance windows
- `calculatePointsForWeave(friend, weaveData)` - Multi-factor scoring:
  - Base category score (10-32 points)
  - Archetype affinity multiplier (0.4x-2.0x)
  - Duration modifier: Quick (0.8x), Standard (1.0x), Extended (1.2x)
  - Vibe multiplier: New Moon (0.9x) to Full Moon (1.3x)
  - Momentum bonus: 15% if active
  - Reflection quality: depth + energy scores (1-5 each)
- `logNewWeave()` - Transaction to create interaction, update scores, detect life events

**Adaptive Decay System**:
- Base rates by tier:
  - Inner Circle: 2.5 points/day (fast decay)
  - Close Friends: 1.5 points/day
  - Community: 0.5 points/day
- Modified by resilience (0.8-1.5 range)
- Learned tolerance windows from interaction patterns
- Grace periods for new relationships

#### 2. Suggestion Engine (`src/lib/suggestion-engine.ts`)

**Intelligent nudges** based on relationship state and context.

**8 Suggestion Types**:
- **critical-drift**: Friend dropping below tier threshold (1-day cooldown)
- **life-event**: Upcoming birthdays, anniversaries, major events (1-day cooldown)
- **intention-reminder**: Unfulfilled intentions getting stale
- **momentum**: Capitalize on active momentum streaks
- **archetype-mismatch**: Suggest better-aligned interaction types
- **deepen**: Encourage deeper connection methods (7-day cooldown)
- **reflect**: Prompt for reflection after significant interactions
- **maintenance**: Regular check-ins for stable relationships (3-day cooldown)

**Smart Features**:
- Cooldown periods to avoid suggestion fatigue
- Archetype-aware messaging from `archetype-content.ts`
- 30-day lookahead for life events
- Reciprocity-aware prompts
- Battery-sensitive filtering (quiet vs active modes)

#### 3. Life Event Detection (`src/lib/life-event-detection.ts`)

**NLP-based auto-detection** from notes and reflections.

**Detected Event Types** (8+):
- Wedding, baby, moving, new job, health events, graduation, loss, celebration

**Detection Method**:
- Keyword matching with context words
- Phrase pattern recognition
- Importance level assignment
- Auto-creates LifeEvent records
- Triggers in suggestions and focus widgets

#### 4. Pattern Detection (`src/lib/pattern-detection.ts`, `pattern-analyzer.ts`)

**Discovers rhythms** in friendship patterns.

**Detected Patterns**:
- Cyclical: Regular weekly/monthly interaction rhythms
- Correlation: Battery levels vs interaction quality
- Best days: Day-of-week preferences per friend
- Consistency trends: Improving vs declining engagement
- Quality patterns: Depth and energy across interaction types
- Archetype affinity: Which activities work best

**Applications**:
- Smart default suggestions
- Scheduling recommendations
- Dashboard insights

#### 5. Portfolio Analysis (`src/lib/portfolio-analyzer.ts`)

**Network-level health metrics**.

**Calculated Metrics**:
- Overall health score (weighted by tier importance)
- Active/drifting/thriving friend counts
- Tier distribution balance
- Category diversity score (0-1)
- Interactions per week average
- Imbalance detection: tier-neglect, overcommitment, monotony

**Used For**:
- Portfolio snapshots
- Dashboard widgets
- Insights and recommendations

#### 6. Reciprocity Analysis (`src/lib/reciprocity-analyzer.ts`)

**Tracks initiation balance** in friendships.

**Tracked Metrics**:
- `initiation_ratio`: 0 (always friend) to 1 (always user), 0.5 = balanced
- `consecutive_user_initiations`: Streak count
- Total initiations by each party
- `last_initiated_by`: user/friend/mutual

**Applications**:
- Suggestion messaging (encourage/wait)
- Friendship health flags
- Balance recommendations

#### 7. Effectiveness Measurement (`src/lib/feedback-analyzer.ts`)

**Learns what works** for each friendship.

**Measurement Process**:
1. Record score_before at interaction time
2. Measure score_after at next interaction or 7 days later
3. Calculate effectiveness_ratio: actual_impact / expected_impact
4. Store in `interaction_outcomes`
5. Adjust `category_effectiveness` per friend

**Adaptive Learning**:
- Category-specific effectiveness tracking
- Duration and vibe impact learning
- Reflection quality correlation
- Future scoring adjustments

#### 8. Smart Time Defaults (`src/lib/smart-defaults.ts`)

**Context-aware activity suggestions** based on time and archetype.

**Factors**:
- Time of day (hourly preferences)
- Day of week (weekend vs weekday multipliers)
- Archetype preferences
- Historical patterns
- Smart ordering for PlanWizard

**Features**:
- 9 unified interaction categories
- Time-based score boosting
- Archetype affinity integration
- Pattern-informed ranking

### State Management

**Zustand Stores** (`src/stores/`) - UI state only, WatermelonDB is source of truth

**9 Active Stores**:

1. **friendStore.ts** - Friend data with observables
   - `observeFriends()`: Subscribe to all non-dormant friends
   - `observeFriend(id)`: Single friend + paginated interactions (50/page)
   - `loadMoreInteractions(id)`: Pagination support
   - CRUD: addFriend, batchAddFriends, updateFriend, deleteFriend, batchDeleteFriends
   - Lifecycle: pause/resume observers on app background/foreground

2. **interactionStore.ts** - Interaction forms and submission
   - Form state with structured reflection
   - `addInteraction()`: Create weave, log life events, sync to calendar
   - Calendar integration: sync, delete, update events
   - Reflection system: chips + custom notes
   - Plan lifecycle: confirmPlan, updatePlanStatus
   - Event importance tracking

3. **uiStore.ts** - Modal and UI flags
   - Modal states: timeline, calendar, archetype detail
   - Toast notifications with friend context
   - MicroReflectionSheet visibility
   - Milestone celebration queue
   - Badge and achievement unlock queues
   - Dark mode toggle

4. **userProfileStore.ts** - User preferences
   - Battery check-in management
   - Social season tracking
   - Reflection preferences (day, auto-show)
   - WatermelonDB observable integration

5. **intentionStore.ts** - Intentions CRUD
   - Intention creation, updates, deletion
   - Friend relationship tracking
   - Status: active, converted, dismissed, fulfilled
   - Fulfillment tracking integration

6. **eventSuggestionStore.ts** - Calendar suggestions
   - Event scanning from device calendar
   - AI suggestion generation
   - Snoozed event management
   - Feedback collection and learning

7. **authStore.ts** - Authentication state (v31)
   - User session management
   - Account sync readiness

8. **backgroundSyncStore.ts** - Background sync config (v31)
   - Sync intervals
   - Conflict resolution preferences

9. **tutorialStore.ts** - Onboarding progress
   - Tutorial completion tracking
   - Feature discovery state

**Store Pattern**:
- Stores subscribe to WatermelonDB `.observe()` for reactive updates
- NEVER use `.fetch()` for UI-bound data
- Always unsubscribe on component unmount
- Wrap all writes in `database.write()` transactions
- Don't duplicate database state in Zustand

### Navigation Structure (`app/`)

**File-based routing** via expo-router:

**Main Routes**:
- `index.tsx` - Entry point (redirects to onboarding or home)
- `onboarding.tsx` - First-time user setup flow
- `home.tsx` - Dashboard with widget grid (TodaysFocus, SocialSeason, YearInMoons, ReflectionReady)
- `friends.tsx` - Friend list/management view
- `friend-profile.tsx` - Individual friend timeline, badges, life events
- `weave-logger.tsx` - Quick interaction logging with category picker
- `add-friend.tsx` - Add new friend form
- `edit-friend.tsx` - Edit existing friend
- `batch-add-friends.tsx` - Bulk friend import
- `global-calendar.tsx` - Calendar view of all interactions
- `permissions.tsx` - Calendar, contacts, notifications permission requests

**Root Layout** (`_layout.tsx`):
- Providers: GestureHandlerRootView, QuickWeaveProvider, ToastProvider, CardGestureProvider
- Global modals: MilestoneCelebration, TrophyCabinetModal, NotificationPermissionModal, EventSuggestionModal
- Error boundaries with Sentry integration
- Analytics: PostHog initialization
- Data migrations and user profile setup
- Notification listeners and lifecycle management

### Key Frameworks & Concepts

#### Dunbar's Layers (3 Tiers)

**Social circle framework** for prioritization:

- **Inner Circle** (~5): Closest relationships
  - Fastest decay: 2.5 points/day
  - Health threshold: 75+ (thriving), <60 (at-risk)
  - Highest suggestion priority

- **Close Friends** (~15): Important bonds
  - Medium decay: 1.5 points/day
  - Health threshold: 65+ (healthy), <50 (drifting)

- **Community** (~50): Meaningful acquaintances
  - Slow decay: 0.5 points/day
  - Health threshold: 50+ (active), <40 (fading)

#### Tarot Archetypes (8 Types)

**Personality framework** for interaction affinity:

Each archetype has unique multipliers (0.4x-2.0x) for interaction categories. See `ArchetypeMatrixV2` in `src/lib/constants.ts`.

- **Emperor**: Structure, achievement, planned events
  - Loves: Events, milestones, structured activities
  - Prefers: In-person, organized settings

- **Empress**: Comfort, nurturing, sensory experiences
  - Loves: Home, cooking, meals, cozy settings
  - Prefers: Intimate, nourishing activities

- **High Priestess**: Depth, intuition, private connection
  - Loves: Deep talks, one-on-one calls, meaningful chats
  - Prefers: Quiet, reflective interactions

- **Fool**: Spontaneity, novelty, fun
  - Loves: Texts, adventures, parties, spontaneous plans
  - Prefers: Low-pressure, playful activities

- **Sun**: Celebration, high-energy gatherings
  - Loves: Events, parties, birthdays, celebrations
  - Prefers: Group settings, joyful occasions

- **Hermit**: Solitude, one-on-one time
  - Loves: Walks, quiet hangouts, video calls, tea
  - Prefers: Calm, focused connection

- **Magician**: Creativity, collaboration, projects
  - Loves: Game nights, creative projects, achievements
  - Prefers: Interactive, engaging activities

- **Lovers**: Connection, intimacy, partnership
  - Loves: Quality time, deep connection, shared experiences
  - Prefers: Meaningful, intimate settings

#### Interaction Categories (9 Unified Categories)

**Simplified from 30+ activity types** (see `src/lib/interaction-categories.ts`):

1. **text-call** (💬) - Quick messages or calls - 10 pts
2. **voice-note** (🎤) - Async voice messages - 12 pts
3. **meal-drink** (🍽️) - Coffee, meals, drinks - 22 pts
4. **hangout** (🏠) - Casual time together - 20 pts
5. **deep-talk** (💭) - Vulnerable conversations - 28 pts
6. **event-party** (🎉) - Social gatherings - 27 pts
7. **activity-hobby** (🎨) - Shared activities - 25 pts
8. **favor-support** (🤝) - Help and support - 24 pts
9. **celebration** (🎂) - Birthdays, milestones - 32 pts

**Migration**: Old ActivityType values auto-map to new categories via `ACTIVITY_TO_CATEGORY_MAP`.

#### Interaction Lifecycle

**5 status states** for planning and tracking:

- **planned**: Future interaction scheduled
- **pending_confirm**: Plan needs user confirmation (prompted after event time)
- **completed**: Interaction confirmed and scored
- **cancelled**: Plan cancelled by user
- **missed**: Plan expired without completion

**Workflow**:
1. Create plan → `planned`
2. After event_date → `pending_confirm` + notification
3. User confirms → `completed` + score update
4. Or dismisses → `cancelled` or `missed`

#### Social Battery System

**Energy tracking** for personalized suggestions:

- **Scale**: 1-5 (depleted → energized)
- **Daily check-in**: Optional morning prompts at configured time
- **History tracking**: JSON array in user_profile
- **Applications**:
  - Filters high-energy vs low-energy suggestions
  - Influences notification timing
  - Dashboard widget display

#### Social Seasons

**Activity rhythm phases**:

- **Resting**: Low interaction period (recovery mode)
  - Gentle suggestions
  - Lower notification frequency

- **Flowing**: Moderate, sustainable pace
  - Balanced suggestions
  - Standard notifications

- **Blooming**: High activity, many connections
  - Encouraging affirmations
  - Momentum celebration

**Calculation**: Based on interactions/week over last 4 weeks, transitions with 2-week grace periods.

#### Weave Score System

**0-100 health metric** for each friendship:

- **Calculation**: Base score + recent interactions - time-based decay
- **Decay**: Daily reduction based on tier, resilience, and learned tolerance
- **Restoration**: Logging interactions adds points (category + multipliers)
- **Visual feedback**: Color coding (red < 30, yellow 30-60, green 60-80, blue 80+)
- **Momentum**: +15 point bonus (decays daily) for consecutive interactions

#### Momentum System

**Streak bonus** for active friendships:

- **Activation**: Any interaction sets momentum_score = 15
- **Decay**: -1 point per day
- **Bonus**: While active (>0), next interaction gets 15% multiplier
- **Resets**: On dormancy or extended inactivity
- **UI**: Shown as "momentum" badge on friend cards

#### Resilience

**Decay resistance factor** (0.8-1.5 range):

- **Starts**: 1.0 (neutral)
- **Increases**: Positive vibes (Waxing Gibbous, Full Moon) over time
- **Decreases**: Negative vibes (New Moon, Waning Crescent)
- **Updates**: Only after 5+ rated weaves (prevents premature adjustment)
- **Effect**: Multiplies decay rate (0.8 = slower decay, 1.5 = faster decay)

#### Dormancy

**Archive inactive friendships**:

- **Trigger**: Extended inactivity thresholds by tier
- **Managed by**: `lifecycle-manager.ts`
- **Effect**: Filtered from main dashboard, suggestions paused
- **Restoration**: Logging new interaction reactivates
- **Fields**: is_dormant (boolean), dormant_since (timestamp)

#### Life Events System

**Major milestone tracking**:

**Event Types** (10):
- birthday, anniversary, new_job, moving, graduation, health_event, celebration, loss, wedding, baby, other

**Importance Levels** (4):
- low, medium, high, critical

**Detection Sources** (3):
- manual: User-created via LifeEventModal
- keyword_detected: Auto-detected from notes via NLP
- recurring: Auto-generated for birthdays/anniversaries

**Features**:
- 30-day lookahead in suggestions
- Importance-based prioritization in TodaysFocusWidget
- Auto-reminder flags
- Integration with calendar and notifications

#### Reflection System

**Structured + freeform reflection** capture:

**Components**:
- **Story chips**: Predefined + custom tags for experiences
- **Freeform notes**: Open-text reflection
- **Depth score**: 1-5 scale for conversation/emotional depth
- **Energy score**: 1-5 scale for interaction energy/vibe
- **Contextual prompts**: Dynamic based on interaction type

**Storage**: JSON in `interactions.reflection`:
```json
{
  "chips": ["story_chip_id_1", "custom_chip_123"],
  "notes": "Freeform reflection text",
  "depthScore": 4,
  "energyScore": 3
}
```

**Applications**:
- Quality-based scoring multipliers
- Pattern detection for chip usage
- Weekly reflection summaries
- Adaptive chip suggestions

### Important Files & Directories

**Database** (`src/db/`):
- `schema.ts` - Schema v33 definition (20 tables)
- `db.ts` - Database singleton and model registration
- `models/` - 20 WatermelonDB model classes
- `migrations/` - Schema migration files

**Intelligence** (`src/lib/`):
- `weave-engine.ts` (28KB) - Core scoring and decay logic
- `suggestion-engine.ts` (35KB) - 8 suggestion types with life events
- `pattern-detection.ts`, `pattern-analyzer.ts` - Rhythm discovery
- `portfolio-analyzer.ts` - Network-level health metrics
- `reciprocity-analyzer.ts` - Initiation balance tracking
- `feedback-analyzer.ts` - Effectiveness measurement
- `life-event-detection.ts` (10KB) - NLP event detection
- `smart-defaults.ts` (11KB) - Time/archetype-based defaults
- `season-calculator.ts` - Social season phase transitions
- `achievement-tracker.ts`, `badge-tracker.ts` - Achievement system
- `constants.ts` (21KB) - All scoring parameters, matrices, thresholds
- `interaction-categories.ts` - 9 unified categories + migration map

**Analytics & Tracking**:
- `analytics.ts` - PostHog event tracking
- `trend-analyzer.ts` - Trend analysis
- `event-suggestion-learning.ts` - Calendar AI learning
- `notification-manager-enhanced.ts` (22KB) - Smart notifications
- `smart-notification-scheduler.ts` (16KB) - Timing optimization
- `notification-grace-periods.ts` - New user grace periods
- `app-state-manager.ts` - App lifecycle handling

**Reflection & Story**:
- `story-chips.ts` (37KB) - Full story chip library
- `reflection-prompts.ts` (14KB) - Dynamic prompts
- `reflection-tags.ts` (21KB) - Tag system
- `adaptive-chips.ts` (9KB) - Chip learning
- `weekly-reflection/` - Weekly reflection subsystem

**Calendar & Sync**:
- `calendar-service.ts` (12KB) - Calendar integration
- `calendar-sync-service.ts` (8KB) - Sync engine
- `background-event-sync.ts` (10KB) - Background sync with ExpoTaskManager
- `event-notifications.ts` - Event-triggered notifications

**Utilities**:
- `image-service.ts` (12KB) - Image handling (local + Supabase-ready)
- `lifecycle-manager.ts` - Dormancy and app lifecycle
- `data-export.ts`, `data-import.ts` - Data portability
- `milestone-tracker.ts` - Milestone tracking
- `achievement-definitions.ts` (10KB), `badge-definitions.ts` (8KB)

**Components** (`src/components/`):

**Dashboard Widgets** (`src/components/home/widgets/`):
- `TodaysFocusWidget.tsx` (47KB) - Multi-priority card system
  - States: pressing-event, todays-plan, streak-risk, friend-fading, upcoming-plan, quick-weave, all-clear
  - Birthday detection, life event filtering, upcoming dates, streak preservation

- `SocialSeasonWidget.tsx` (22KB) - Resting/Flowing/Blooming tracking
- `YearInMoonsWidget.tsx` (8.6KB) - Moon phase visualization
- `ReflectionReadyWidget.tsx` (2.2KB) - Weekly reflection prompts

**Forms & Input**:
- `FriendForm.tsx` (29KB) - Comprehensive friend creation/editing
- `PlanWizard.tsx` (11KB) - Multi-step plan creation (friend → category → date → reflection)
- `ContextualReflectionInput.tsx` (8.7KB) - Smart reflection with chips

**Modals & Sheets**:
- `LifeEventModal.tsx` (14KB) - Create/edit life events
- `WeeklyReflectionModal.tsx` - Guided weekly reflection
- `YearInMoonsModal.tsx` - Interactive year visualization
- `ArchetypeDetailModal.tsx`, `ArchetypeLibrary.tsx` - Archetype exploration
- `FriendBadgePopup.tsx`, `TrophyCabinetModal.tsx` - Badge celebrations
- `MicroReflectionSheet.tsx` (11KB) - Quick reflection capture
- `IntentionFormModal.tsx`, `IntentionsDrawer.tsx` - Intention management
- `NotificationPermissionModal.tsx` - Permission requests
- `CustomChipModal.tsx` - Custom reflection chip creation

**List & Timeline**:
- `FriendListRow.tsx` (11KB) - Friend card with score visualization
- `TimelineItem.tsx` - Interaction timeline item
- `CalendarView.tsx` (4.6KB) - Month calendar with interactions

**Insights & Analytics**:
- `InsightsFAB.tsx`, `InsightsSheet.tsx` - Portfolio insights
- `FocusDetailsModal.tsx` - Detailed focus state info
- `SuggestedWeaves.tsx` - Suggestion cards

**Context Providers** (`src/context/`, `src/components/`):
- `CardGestureContext` - Swipe-to-delete gesture handling
- `QuickWeaveProvider` - Global Quick Weave overlay state
- `ToastProvider` - Toast notification system

**Custom Hooks** (`src/hooks/`):
- `useSuggestions()` - Suggestion query and management
- `usePendingPlans()` - Pending plan tracking
- `useIntentions()` - Friend intention management
- `usePlanSuggestion()` - Plan recommendation logic
- `usePortfolio()` - Portfolio analysis
- `useTrendsAndPredictions()` - Trend detection and forecasting
- `useReciprocity()` - Reciprocity-aware insights
- `useEffectiveness()` - Interaction effectiveness tracking
- `useAchievements()` - Achievement progression
- `useFeatureGate()` - Feature flag management
- `useAppState()` - App lifecycle management
- `useActivityKeepAwake()` - Screen wake management
- `useFriendActionState()` - Friend action state
- `useTheme()` - Theme and color management

**Types** (`src/types/`, `src/components/types.tsx`):
- Central type definitions for all major entities
- Exported types: Tier, Archetype, InteractionType, InteractionCategory, Duration, Vibe, Importance
- Form types: FriendFormData, InteractionFormData
- Model types: Use WatermelonDB model classes directly

### Styling & Theme

**Current Approach**: NativeWind preferred for all new components

**NativeWind** (`tailwind.config.js`, `global.css`):
- Tailwind utility classes for React Native
- Configured in `babel.config.js` with `jsxImportSource: 'nativewind'`
- Theme colors accessible via useTheme() hook

**Legacy StyleSheet**:
- Some older components still use React Native StyleSheet
- **Policy**: Don't automatically refactor old components
- **When touched**: Refactor to NativeWind during modifications

**Theme** (`src/theme.ts`):
- Color palette, typography, spacing constants
- Font families: Lora (headings), Inter (body)
- Light/dark mode support via theme provider

**Component Styling Policy**:
- **All NEW components MUST use NativeWind**
- When rebuilding/modifying existing components, refactor to NativeWind
- Don't refactor components just for styling changes
- Reanimated for performance-critical animations

## Development Practices

### Working with WatermelonDB

**Critical Patterns**:

✅ **DO**:
- Always wrap writes in `database.write(async () => { ... })`
- Use `.observe()` for reactive queries in UI components
- Access related records through model methods (e.g., `friend.interactions`)
- Clean up subscriptions on component unmount
- Use `@relation` decorators for related data
- Batch related operations in single `database.write()` transaction
- Handle nullable fields with try-catch (birthday, anniversary parsing)

❌ **DON'T**:
- Never use `.fetch()` for UI-bound data (breaks reactivity)
- Never perform manual SQL joins
- Don't duplicate database state in Zustand
- Don't forget to unsubscribe from observables
- Don't mix snake_case (schema) with camelCase (models) incorrectly

**Example Observable Pattern**:
```typescript
useEffect(() => {
  const subscription = friendStore.observeFriends();
  return () => subscription?.unsubscribe();
}, []);
```

**Example Write Transaction**:
```typescript
await database.write(async () => {
  await friend.update(f => {
    f.weaveScore = newScore;
    f.lastUpdated = Date.now();
  });
});
```

### State Management Best Practices

**Zustand for UI State Only**:
- Modal visibility
- Form input state (pre-submission)
- Temporary UI flags
- Toast notifications

**WatermelonDB for Persistent Data**:
- All friends, interactions, life events, etc.
- User profile and preferences
- Achievements and progress
- Any data that survives app restart

**Store Pattern**:
1. Store subscribes to WatermelonDB observable
2. Observable updates trigger store updates
3. Components subscribe to store
4. Unsubscribe on unmount (both component and store)

### File Naming Conventions

- **Models**: PascalCase (`Friend.ts`, `Interaction.ts`)
- **Components**: PascalCase (`FriendCard.tsx`, `TodaysFocusWidget.tsx`)
- **Utilities**: kebab-case (`weave-engine.ts`, `pattern-detection.ts`)
- **Stores**: camelCase (`friendStore.ts`, `interactionStore.ts`)
- **Hooks**: camelCase with 'use' prefix (`useSuggestions.ts`, `usePortfolio.ts`)
- **Types**: PascalCase or kebab-case (`types.tsx`, `interaction-categories.ts`)

### TypeScript Practices

- **Strict mode** enabled - no implicit any
- Import types from `src/components/types.tsx` or model files
- Use WatermelonDB model classes directly (e.g., `FriendModel`, not plain objects)
- Prefer type inference where clear
- Use explicit types for function signatures and exports
- Leverage discriminated unions for status/type fields

### Error Handling

- **Error Boundaries**: Wrapped around root app in `_layout.tsx`
- **Sentry Integration**: Automatic error reporting
- **Try-Catch**: Around nullable date parsing (birthday, anniversary)
- **Graceful Degradation**: Fallbacks for missing data
- **Analytics**: Track errors via PostHog for patterns

### Analytics & Monitoring

**PostHog** (`src/lib/analytics.ts`):
- Event tracking for key user actions
- Feature flag management
- Funnel analysis
- User property tracking

**Sentry**:
- Error reporting and stack traces
- Performance monitoring
- Release tracking
- Breadcrumb trails for debugging

**Key Events Tracked**:
- Weave logged/planned
- Friend added/edited
- Suggestion shown/acted/dismissed
- Reflection completed
- Life event created
- Achievement unlocked
- Badge earned

### Performance Considerations

- **Pagination**: Interactions load 50 per page with `loadMoreInteractions()`
- **Observables**: Automatically batch updates
- **Reanimated**: Use for gesture-driven animations
- **Lazy Loading**: Components load on-demand
- **Memoization**: React.memo for expensive list items
- **Background Sync**: Off-thread calendar syncing with ExpoTaskManager

### Testing Strategy

- **Schema Migrations**: Test thoroughly before version bump
- **WatermelonDB Queries**: Verify observable subscriptions
- **Scoring Logic**: Unit test weave-engine calculations
- **Pattern Detection**: Test with sample data sets
- **UI Components**: Visual regression testing
- **Analytics**: Verify event firing in dev mode

## Collaboration Protocol

**When making changes**:

1. **Propose, Don't Impose**: Always propose code changes and await confirmation before writing
2. **Read First**: Use Read tool to get context before proposing changes
3. **Ask for Confirmation**: End proposals with explicit request for permission to proceed
4. **Proactive Problem Solving**: Flag issues but frame as proposals
5. **Assume Context**: You can reference "Dunbar's Layers," "Archetype Framework," "Weave Score," etc. without explanation

## Common Gotchas

### Database

- **Schema Version**: Currently v33 (not v8 from old docs)
- **20 Models**: Not just 3 - full ecosystem
- **Snake_case vs camelCase**: Schema uses snake_case, models use camelCase
- **Nullable Dates**: Birthday/anniversary parsing needs try-catch
- **Observe vs Fetch**: ALWAYS use `.observe()` for reactive UI, NEVER `.fetch()`
- **Transaction Boundaries**: Group related writes in single `database.write()` call
- **Dexie.js**: Legacy mention - ignore it. WatermelonDB is the only database.

### Interactions

- **Old Activity Types**: Being migrated to 9 unified categories
- **Status Lifecycle**: planned → pending_confirm → completed (not direct to completed)
- **Calendar Sync**: Auto-syncs if user granted permission
- **Event Importance**: New field for special occasions (low/medium/high/critical)
- **Initiator Tracking**: Must set for reciprocity analysis

### Scoring

- **Adaptive Decay**: Not just tier-based - learned tolerance windows
- **Category Effectiveness**: Per-friend learning adjusts future scores
- **Reflection Quality**: Depth + energy scores multiply impact
- **Momentum**: 15-point bonus, not 15% - bonus gives 15% multiplier
- **Resilience Range**: 0.8-1.5, not 0.5-2.0

### UI & State

- **Zustand for UI Only**: Don't store database records in Zustand
- **NativeWind Preferred**: Use for all new components
- **Modal Management**: Use uiStore for centralized modal state
- **Toast Context**: Toast notifications need friend context for proper display

### Lifecycle & Permissions

- **Permission Flow**: Onboarding → post-onboarding permissions page
- **Calendar Permission**: Required for event sync and suggestions
- **Notification Permission**: Graceful degradation if denied
- **App State**: Observers pause/resume on background/foreground
- **Dormancy**: Auto-applied by lifecycle-manager, check regularly

### Features

- **Life Events**: Auto-detection from notes, 30-day lookahead in suggestions
- **Social Battery**: 1-5 scale, optional daily check-in
- **Social Seasons**: Calculated from 4-week activity, 2-week grace periods
- **Reciprocity**: user/friend/mutual - track initiator for balance
- **Smart Defaults**: Time-based activity ranking in PlanWizard

### Native Modules

- **Rebuild if "not exported" errors**: Stop Metro, delete app, rebuild with `npx expo run:ios` or `npx expo run:android`
- **Clear cache**: `npm start -- --clear` for Metro cache issues
- **Calendar Integration**: expo-calendar requires native rebuild after install

## Migration Notes

### Interaction Categories Migration

**Old System** (30+ ActivityType values):
- Text, DM, Call, Video Call, Coffee, Meal, Event, Party, etc.

**New System** (9 InteractionCategory values):
- text-call, voice-note, meal-drink, hangout, deep-talk, event-party, activity-hobby, favor-support, celebration

**Migration Map**: `ACTIVITY_TO_CATEGORY_MAP` in `src/lib/interaction-categories.ts`

**Handling**:
- Existing interactions retain `interaction_type` (old ActivityType)
- New `interaction_category` field populated on next interaction
- `migrateActivityToCategory()` for conversion
- UI shows category, falls back to activity type if category null

### Schema Migrations

**Current**: v33 (event_suggestion_feedback table)

**Recent Additions** (v21-v33):
- v21: Adaptive decay (typical_interval_days, tolerance_window_days)
- v23: Category effectiveness learning
- v24: Event importance levels
- v25: Reciprocity tracking (initiation_ratio, initiator fields)
- v29: Intention fulfillment tracking
- v30: Streak forgiveness mechanics
- v31: Account sync infrastructure (user_id, synced_at, sync_status, server_updated_at)
- v33: Event suggestion feedback table

**Migration Process**:
1. Update `schema.ts` version number
2. Add migration file in `src/db/migrations/`
3. Test migration on dev database
4. Update CLAUDE.md with changes
5. Test app startup with migration applied

## Future Considerations

**Planned Features** (not yet implemented):
- Multi-device sync via v31 account infrastructure
- Location coordinates for interactions (Phase 2)
- AI-powered reflection prompts
- Friend groups and network visualization
- Export/import refinements
- Advanced pattern insights
- Relationship health forecasting

**Migration Path**:
- Account sync backend (Supabase ready)
- Image upload to cloud (currently local-only)
- Conflict resolution for multi-device
- Server-side intelligence augmentation

## Quick Reference

### Key Directories
```
/app/                      # Routes (expo-router)
/src/db/                   # Database (20 models, schema v33)
/src/lib/                  # Intelligence engines (66 utilities)
/src/stores/               # Zustand stores (9 stores)
/src/components/           # React Native components (99+)
/src/hooks/                # Custom hooks (16)
/src/types/                # TypeScript types
```

### Key Commands
```bash
npm start                  # Start dev server
npx expo run:ios           # Build and run iOS
npx expo run:android       # Build and run Android
npm start -- --clear       # Clear Metro cache
```

### Key Files
```
src/db/schema.ts           # Schema v33 (20 tables)
src/lib/weave-engine.ts    # Core scoring logic
src/lib/suggestion-engine.ts # 8 suggestion types
src/lib/constants.ts       # All parameters and matrices
src/stores/friendStore.ts  # Friend data management
app/_layout.tsx            # Root layout with providers
```

### Key Patterns
```typescript
// Observable subscription
const subscription = collection.query().observe();
// ... later
subscription.unsubscribe();

// Write transaction
await database.write(async () => {
  await record.update(r => { r.field = value; });
});

// Zustand store
const friends = friendStore.use.friends();
```

---

**This document is the source of truth for Weave's architecture.** Keep it updated as the codebase evolves.
