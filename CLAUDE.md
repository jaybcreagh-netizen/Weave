# CLAUDE.md

This file provides guidance to AI agents (Claude, Gemini, etc.) when working with code in this repository.

---

## 1. Project Overview

### Vision & Purpose

Weave is a **mindful relationship companion** designed to combat loneliness, social isolation, and burnout in the modern age. We are not building another social network. Instead, we are creating a private, intelligent tool that helps people deepen the quality of their most important friendships with intention and awareness.

Our vision is to pioneer a new category of digital wellness focused on **social health**. In an era of superficial digital interactions, Weave helps users move from passive, reactive socializing to proactive, meaningful connection. It's a private sanctuary that makes the invisible ebb and flow of relationships visible and actionable, transforming the mental chore of "keeping in touch" into a calm and rewarding ritual.

### Target Audience

We are building Weave for **Millennial and Gen Z urban professionals**.

This audience lives at the intersection of two conflicting realities: they manage busy, complex social calendars while being the generations most acutely feeling the effects of loneliness and social burnout. They value deep, authentic connections but lack the mental bandwidth to consistently nurture them.

Weave acts as a **"second brain" for relationships**, alleviating the guilt of letting time slip by and providing a structured, gentle framework to invest limited social energy where it matters most.

---

## 2. Core Frameworks

Weave's architecture is grounded in established science and enriched with an intuitive, qualitative layer.

### Dunbar's Layers (The Scientific Foundation)

The app's structural backbone is derived from anthropologist Robin Dunbar's **Social Brain Hypothesis**. This provides a scientifically-validated framework for prioritizing social energy:

| Layer | Size | Description | Decay Rate |
|-------|------|-------------|------------|
| **Inner Circle** | ~5 | Core support system | ~2.5 pts/day |
| **Close Friends** | ~15 | Cherished, important bonds | ~1.5 pts/day |
| **Community** | ~50 | Meaningful acquaintances | ~0.5 pts/day |

This structure informs the entire intelligence engine, tailoring insights and reminders based on the distinct needs of each relational layer.

### Tarot Archetypes (The Intuitive Soul)

While Dunbar's Number provides quantitative structure, our **7 Tarot Archetypes** provide the qualitative, intuitive soul. This symbolic language defines the unique energetic dynamic of each friendship, allowing the intelligence layer to offer emotionally intelligent insights.

| Archetype | Energy | Affinity |
|-----------|--------|----------|
| **The Sun** | Celebration, shared joy | Group activities, events |
| **The Hermit** | Quality one-on-one time | Deep conversations, slower decay |
| **The Emperor** | Structure, mutual respect | Consistency, scheduled meetups |
| **The Fool** | Spontaneity, adventure | Novel experiences, surprises |
| **The Empress** | Nurturing, care | Acts of support, thoughtful gestures |
| **The Magician** | Creativity, collaboration | Projects, brainstorming |
| **The High Priestess** | Depth, intuition | Meaningful conversation, emotional support |

---

## 3. Core Technologies

- **Framework**: React Native with Expo SDK 52+
- **Language**: TypeScript (strict mode)
- **Navigation**: `expo-router` (file-based routing in `app/` directory)
- **Database**: WatermelonDB (reactive, local-first) - **single source of truth**
- **State Management**: WatermelonDB observables + React Query (data), Zustand (UI state)
- **Query/Cache**: React Query (`@tanstack/react-query`) - derived data, async state
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Design Tokens**: `src/shared/theme/tokens.ts`
- **Animations**: React Native Reanimated
- **Lists**: FlashList (`@shopify/flash-list`) - for high-performance lists
- **Bottom Sheets**: `@gorhom/bottom-sheet`
- **Icons**: lucide-react-native

---

## 4. Architecture Overview

The project uses a **Modular Architecture** where features are encapsulated in `src/modules/` and shared code resides in `src/shared/`.

### Modular Structure (`src/modules/`)

Each module contains its own components, services, stores, and utilities. Cross-module communication happens via the public API (exported from `index.ts`) or the Event Bus.

**Key Modules:**
- `relationships`: Friend management, profiles, image handling
- `interactions`: Weave logging, planning, suggestions
- `intelligence`: Scoring logic, decay, resilience, social season (pure business logic)
- `gamification`: Badges, achievements, streaks
- `insights`: Analytics, portfolio analysis, effectiveness scoring
- `auth`: User profile, settings, background sync
- `reflection`: Weekly reflection, contextual prompts
- `notifications`: Push notifications, reminders
- `groups`: Group weave management

**Shared Code (`src/shared/`):**
- `components`: Generic UI components
- `ui`: Design system primitives (Button, Text, Card, Icon, Input)
- `theme`: Design tokens and theme configuration
- `services`: Global services (Analytics, AppState)
- `utils`: Generic utilities, constants, helper functions
- `types`: Global type definitions

### Database Layer (WatermelonDB)

**Primary Models** (`src/db/models/`):
- `Friend`: Core user relationship data with intelligence fields
- `Interaction`: Logged or planned interactions with friends
- `InteractionFriend`: Many-to-many join table
- `LifeEvent`: Significant events for friends
- `Intention`: User intentions/goals for relationships

**Schema** (`src/db/schema.ts`):
- Snake_case column names in schema, camelCase in models
- Controlled via migrations in `src/db/migrations/`

### Intelligence Engine (`src/modules/intelligence/`)

The core scoring logic. **This is the brain of the application.**

**Key Services**:
- `ScoringService`: Calculates points for new interactions considering archetype, duration, vibe, and group size
- `DecayService`: Applies time-based decay to weave scores based on tier and resilience
- `ResilienceService`: Adjusts decay resistance based on interaction quality
- `SocialSeasonService`: Determines the user's social phase (Resting, Balanced, Blooming)

### State Management

**Architecture Decision**: We evaluated replacing Zustand with React Context for UI state and **rejected it** due to performance concerns. Context does not support selective subscriptions - any state change triggers re-renders in ALL consuming components.

#### Data Layer (WatermelonDB + React Query)

**WatermelonDB Observables** - Primary source of truth for persistent data:
- Use `.observe()` for reactive UI updates
- Components subscribe directly to model observables
- Use `observable-hooks` package for cleaner integration (e.g., `useObservableState`)

**React Query** - Derived and async data:
- Derived/computed data from WatermelonDB
- Async operations and caching
- Complex aggregations that don't fit the observable pattern

#### UI State Layer (Zustand)

**Why Zustand over Context**: Zustand's selector pattern enables granular subscriptions:
```typescript
// GOOD: Only re-renders when `isQuickWeaveOpen` changes
const isOpen = useUIStore(state => state.isQuickWeaveOpen);

// BAD (Context pattern): Re-renders on ANY of 37 state changes
const { isQuickWeaveOpen } = useGlobalUI(); // Don't do this
```

**Core UI Stores**:
- `src/shared/stores/uiStore.ts` - Modal states, toast queue, quick weave, theme, gamification celebrations
- `src/shared/stores/tutorialStore.ts` - Onboarding flags, tutorial completion state

**Auth Module Stores** (`src/modules/auth/store/`):
- `auth.store.ts` - Authentication state
- `user-profile.store.ts` - User profile with battery check-in, reflection settings
- `sync.store.ts` - Sync status and conflict tracking

#### UIEventBus (Imperative Triggers)

For triggering UI actions from non-React code (notification handlers, background tasks):

```typescript
import { UIEventBus } from '@/shared/services/ui-event-bus';

// From a notification handler or background service:
UIEventBus.emit({ type: 'OPEN_DIGEST_SHEET', items: digestItems });
UIEventBus.emit({ type: 'SHOW_TOAST', message: 'Friend nurtured!' });
UIEventBus.emit({ type: 'FRIEND_NURTURED', friendId: '123' });
```

The `uiStore` subscribes to these events and updates state accordingly. This bridges non-React contexts (notification handlers, background sync) with React UI.

#### Auth Module Context (Focused, OK)

Small, focused contexts are acceptable when they change infrequently:
- `AuthContext` - User session, authentication state (changes rarely)
- `SyncConflictContext` - Conflict resolution state (changes rarely)

These are wrapped in `AppProviders.tsx` and are fine because they don't suffer from the "37 useState" problem.

### Navigation Structure (`app/`)

File-based routing via expo-router:
- `(tabs)`: Main tab navigation (Dashboard, Calendar, Settings)
- `friend-profile.tsx`: Individual friend detail view
- `weave-logger.tsx`: Log interaction flow
- `global-calendar.tsx`: Calendar view
- `_layout.tsx`: Root layout with providers

### Design System (`src/shared/ui/` & `src/shared/theme/`)

**Shared UI Components:**
- `Text`: Typography component with variant support
- `Button`: Primary interaction element (solid, outline, ghost variants)
- `Card`: Container component
- `Icon`: Lucide icon wrapper
- `Input`: Form input component

**Design Tokens** (`src/shared/theme/tokens.ts`):
- Color palette (light/dark themes defined)
- Typography scales
- Spacing system
- Border radius values

**Current Styling Reality** (hybrid approach):
- `tailwind.config.ts` imports from `tokens.ts` (single source of truth)
- **However**: Only light theme is mapped to Tailwind classes currently
- Shared UI components use a **hybrid pattern**:
  - `className` for layout/spacing (NativeWind)
  - `style` prop + `useTheme()` hook for colors (runtime dark mode)
- This hybrid approach exists because pure Tailwind dark mode isn't fully configured

**Technical Debt:**
- 87 files still use `StyleSheet.create`
- 2400+ inline `style={}` usages across codebase
- Dark mode in Tailwind config needs CSS variables or NativeWind dark strategy

---

## 5. Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platforms
npx expo run:ios
npx expo run:android

# Run tests
npm test

# Run linting
npx eslint .

# Clear cache and restart
npm start -- --clear
```

**Note on Native Modules:** If a warning appears about a "native view manager... not being exported":
1. Stop the Metro server
2. Delete the old app build from the device/simulator
3. Run `npx expo run:ios` or `npx expo run:android` to create a fresh build

---

## 6. Development Practices

### Working with Modules
- **Encapsulation**: Modules should only export their public API via `index.ts`. **NEVER** import deeply from another module (e.g., `import ... from '@/modules/other/internal/file'`)
- **Feature Logic**: All feature logic belongs in `src/modules/`
- **Shared Helpers**: Generic helpers belong in `src/shared/`
- **Services**: Put business logic in `services/`. Services should be pure functions or stateless classes where possible
- **Persistent State**: Use WatermelonDB observables + React Query for data
- **UI State**: Use Zustand stores with selectors for modal/toast/animation state
- **Components**: Module-specific components stay within the module

### Working with WatermelonDB
- **Writes**: Always wrap writes in `database.write(async () => { ... })`
- **Observables**: Use `.observe()` for reactive updates
- **Performance**: Use `prepareCreate`/`prepareUpdate` and `batch` for multiple operations

### Styling (Hybrid Approach)
- **Layout/Spacing**: Use NativeWind `className` with Tailwind utilities
- **Colors**: Use `useTheme()` hook + inline `style` prop (until dark mode is solved in Tailwind)
- **Tokens**: Never hardcode hex values. Reference `tokens.ts` via Tailwind classes or `useTheme()`
- **Shared UI**: Prefer `@/shared/ui` components (Text, Button, Card, Icon, Input) over raw RN primitives
- **New Components**: Follow the hybrid pattern in existing shared components
- **Migration**: When touching legacy files, opportunistically replace `StyleSheet.create` with `className`

### Testing
- **Jest**: Run tests with `npm test`
- **Mocks**: WatermelonDB and Native Modules are mocked in `jest.setup.js`
- **Unit Tests**: Co-located in `__tests__` directories within modules

### Linting
- **ESLint**: Run `npx eslint .` to check for issues
- **Strict Mode**: No unused variables, no `any` types (where possible)
- **Imports**: `require` is forbidden in favor of `import` (except in config files)

---

## 7. Active Initiatives

### UI Standardization (In Progress)

See `docs/REFACTORING_ROADMAP.md` for the full plan.

**Completed:**
- ✅ Design tokens defined in `src/shared/theme/tokens.ts`
- ✅ `tailwind.config.ts` imports from tokens (light theme)
- ✅ Core shared UI components created (Text, Button, Card, Icon, Input)

**In Progress:**
- 🔄 Migrating components to use `@/shared/ui` primitives
- 🔄 Replacing `StyleSheet.create` with NativeWind `className`

**Next Up:**
- 🎯 Implement NativeWind `dark:` modifier classes for dark mode
- 🎯 Update `tailwind.config.ts` to support dark theme tokens
- 🎯 Then migrate from hybrid approach to pure Tailwind color classes

**Migration Priority:**
1. High-usage components (SuggestionCard, ArchetypeCard)
2. Modal components (EditInteractionModal, etc.)
3. Remaining `StyleSheet.create` files (87 total)

### State Management (Decision Made)

**Decision:** Keep Zustand for UI state management. React Context was evaluated and rejected.

**Why Context Failed:**
- A monolithic `GlobalUIContext` with 37 `useState` calls would cause all 15+ consuming components to re-render on ANY state change
- Zustand's selector pattern (`useUIStore(state => state.specificField)`) only re-renders when that specific field changes
- Performance difference is significant for high-frequency UI state (modals, toasts, gestures)

**Current Architecture:**
- `src/shared/stores/uiStore.ts` - Core UI state (modals, toasts, quick weave, theme)
- `src/shared/stores/tutorialStore.ts` - Tutorial/onboarding flags
- `src/modules/auth/store/` - Auth, user profile, sync state
- `src/shared/services/ui-event-bus.ts` - Imperative triggers from non-React code

**New Auth Hooks** (use alongside stores):
- `useUserProfile()` - WatermelonDB observable-based profile access
- `useSocialBatteryStats()` - Battery statistics
- `useAuth()` - From AuthContext for session info

---

## 8. AI Collaboration Protocol

### Guiding Principles

1. **Understand before acting**
   - Read relevant code before modifying
   - Never propose changes to code you haven't read

2. **Present options**
   - When solving non-trivial problems, present **3 solution approaches** with trade-offs
   - Let the user choose the direction before implementing
   - For trivial fixes (typos, obvious bugs), proceed directly

3. **Scope awareness**
   - Small, contained fixes: proceed and explain
   - Architectural changes or multi-file refactors: outline plan first
   - When uncertain about scope, ask

4. **Preserve intent**
   - Don't over-engineer or add unrequested features
   - A bug fix doesn't need surrounding code cleaned up
   - Keep solutions simple and focused on the task

5. **Surface trade-offs**
   - Be explicit about pros/cons of approaches
   - Flag potential breaking changes before making them
   - Mention if a change affects other parts of the codebase

6. **Fail fast, communicate clearly**
   - If blocked or uncertain, say so immediately
   - Don't guess at requirements; ask for clarification
   - If you spot a problem, raise it as a proposal

### Example Workflow

**For a bug fix:**
```
1. Read the relevant file(s)
2. Identify the issue
3. If trivial → fix and explain
4. If non-trivial → present 3 approaches, await decision, then implement
```

**For a new feature:**
```
1. Understand the requirement
2. Explore related code for patterns
3. Present 3 implementation approaches with trade-offs
4. After user selection, implement incrementally
5. Surface any discovered issues along the way
```

---

## 9. Common Gotchas

- **Native Modules**: If you see "WMDatabaseBridge is not defined" in tests, ensure the mock in `jest.setup.js` is correct
- **FlashList**: Use `estimatedItemSize` for performance
- **React Query**: Remember to invalidate queries after mutations if they rely on WatermelonDB data that changed
- **Circular Dependencies**: Use the `Shared` module for common code to avoid cycles between feature modules
- **NativeWind**: Ensure `className` is passed correctly; some RN components don't support it natively
- **Bottom Sheets**: Use `@gorhom/bottom-sheet` components, not raw modals, for slide-up panels

## 10. Strict Architectural Rules

**CRITICAL**: All AI agents must adhere to these rules when creating or moving files.

### 10.1 The "God Folder" Ban
- `src/components/` is **deprecated**. Do not add new files here.
- All components must reside in:
  - `src/shared/ui/` (primitives like Buttons, Inputs)
  - `src/shared/components/` (generic complex components)
  - `src/modules/[module-name]/components/` (feature logic)

### 10.2 Module Anatomy
Every feature module in `src/modules/` must follow this structure:
- `components/`: UI components
- `screens/`: Full-page screens (exported to `app/`)
- `services/`: Business logic & DB calls
- `hooks/`: Custom React hooks
- `types/`: Module-specific types
- `index.ts`: The ONLY public entry point

### 10.3 Thin Routes
- Files in `app/` must be **thin wrappers**.
- They should only:
  1. Parse URL parameters
  2. Render a Screen component from `src/modules/.../screens/`
- **Never** write complex logic or UI trees inside `app/` files.
