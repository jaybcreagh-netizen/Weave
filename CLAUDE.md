# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weave is a mindful relationship companion app built with React Native and Expo. It helps users deepen their most important friendships through a structured, intelligent framework combining Dunbar's social layers with tarot archetypes. The app tracks relationship health through a "weave score" that decays over time, encouraging regular meaningful connection.

The project uses a **Modular Architecture** where features are encapsulated in `src/modules/` and shared code resides in `src/shared/`.

## Core Technologies

- **Framework**: React Native with Expo SDK 54+
- **Language**: TypeScript (strict mode)
- **Navigation**: `expo-router` (file-based routing in `app/` directory)
- **Database**: WatermelonDB (reactive, local-first) - **single source of truth**
- **State Management**: Zustand (ephemeral UI state & module stores)
- **Query/Cache**: React Query (`@tanstack/react-query`) - for complex data requirements
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated
- **Lists**: FlashList (`@shopify/flash-list`) - for high-performance lists
- **Icons**: lucide-react-native

## Development Commands

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

## Architecture Overview

### Modular Structure (`src/modules/`)

The codebase is organized into feature modules. Each module contains its own components, services, stores, and utilities. Cross-module communication happens via the public API (exported from `index.ts`) or the Event Bus.

**Key Modules:**
- `relationships`: Friend management, profiles, image handling
- `interactions`: Weave logging, planning, suggestions
- `intelligence`: Scoring logic, decay, resilience, social season (pure business logic)
- `gamification`: Badges, achievements, streaks
- `insights`: Analytics, portfolio analysis, effectiveness scoring
- `auth`: User profile, settings, background sync
- `reflection`: Weekly reflection, contextual prompts

**Shared Code (`src/shared/`):**
- `components`: Generic UI components (buttons, modals, etc.)
- `services`: Global services (Analytics, AppState)
- `lib`: Utilities, constants, helper functions
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
- `ScoringService`: Calculates points for new interactions considering archetype, duration, vibe, and group size.
- `DecayService`: Applies time-based decay to weave scores based on tier and resilience.
- `ResilienceService`: Adjusts decay resistance based on interaction quality.
- `SocialSeasonService`: Determines the user's social phase (Resting, Balanced, Blooming).

**Decay System**:
- Inner Circle: ~2.5 points/day
- Close Friends: ~1.5 points/day
- Community: ~0.5 points/day

### State Management

**Zustand Stores** (inside modules):
- Stores manage UI state and wrap service calls.
- They often subscribe to WatermelonDB observables or React Query hooks.
- Examples: `useRelationshipsStore`, `useInteractionsStore`.

**React Query**:
- Used for complex derived data or expensive calculations that don't fit well into WatermelonDB's observable pattern.

### Navigation Structure (`app/`)

File-based routing via expo-router:
- `(tabs)`: Main tab navigation (Dashboard, Calendar, Settings)
- `friend-profile.tsx`: Individual friend detail view
- `weave-logger.tsx`: Log interaction flow
- `global-calendar.tsx`: Calendar view
- `_layout.tsx`: Root layout with providers

### Key Frameworks

**Dunbar's Layers** (3 tiers):
- Inner Circle (~5): Closest relationships
- Close Friends (~15): Important bonds
- Community (~50): Meaningful acquaintances

**Tarot Archetypes** (7 types):
Each archetype has unique affinity multipliers for interaction types.
- **Emperor**: Structure, achievement
- **Empress**: Comfort, nurturing
- **High Priestess**: Depth, intuition
- **Fool**: Spontaneity, fun
- **Sun**: Celebration, energy
- **Hermit**: Solitude, one-on-one
- **Magician**: Creativity, collaboration

## Development Practices

### Working with Modules
- **Encapsulation**: Modules should only export their public API via `index.ts`. Avoid deep imports into other modules (e.g., `import ... from '@/modules/other/internal/file'`).
- **Services**: Put business logic in `services/`. Services should be pure functions or stateless classes where possible.
- **Stores**: Use Zustand for state.
- **Components**: Module-specific components stay within the module.

### Working with WatermelonDB
- **Writes**: Always wrap writes in `database.write(async () => { ... })`.
- **Observables**: Use `.observe()` for reactive updates.
- **Performance**: Use `prepareCreate`/`prepareUpdate` and `batch` for multiple operations.

### Styling
- **NativeWind**: Use Tailwind classes for styling.
- **Theme**: Use the `useTheme` hook for dynamic colors (light/dark mode).

### Testing
- **Jest**: Run tests with `npm test`.
- **Mocks**: WatermelonDB and Native Modules are mocked in `jest.setup.js`.
- **Unit Tests**: Co-located in `__tests__` directories within modules.

### Linting
- **ESLint**: Run `npx eslint .` to check for issues.
- **Strict Mode**: No unused variables, no `any` types (where possible).
- **Imports**: `require` is forbidden in favor of `import` (except in config files).

## Common Gotchas

- **Native Modules**: If you see "WMDatabaseBridge is not defined" in tests, ensure the mock in `jest.setup.js` is correct.
- **FlashList**: Use `estimatedItemSize` for performance.
- **React Query**: Remember to invalidate queries after mutations if they rely on WatermelonDB data that changed.
- **Circular Dependencies**: Use the `Shared` module for common code to avoid cycles between feature modules.
