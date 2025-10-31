# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weave is a mindful relationship companion app built with React Native and Expo. It helps users deepen their most important friendships through a structured, intelligent framework combining Dunbar's social layers with tarot archetypes. The app tracks relationship health through a "weave score" that decays over time, encouraging regular meaningful connection.

## Core Technologies

- **Framework**: React Native with Expo SDK 54+
- **Language**: TypeScript (strict mode)
- **Navigation**: `expo-router` (file-based routing in `app/` directory)
- **Database**: WatermelonDB (reactive, local-first) - **single source of truth**
- **State Management**: Zustand (ephemeral UI state only)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Animations**: React Native Reanimated
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

# Clear cache and restart
npm start -- --clear

# For native module issues
# 1. Stop Metro server
# 2. Delete app from device/simulator
# 3. Rebuild with npx expo run:ios or npx expo run:android
```

## Architecture Overview

### Database Layer (WatermelonDB)

**Primary Models** (`src/db/models/`):
- `Friend`: Core user relationship data with intelligence fields
- `Interaction`: Logged or planned interactions with friends
- `InteractionFriend`: Many-to-many join table

**Schema** (`src/db/schema.ts`):
- Version 8 (current)
- Snake_case column names in schema, camelCase in models
- Important Friend fields:
  - `weave_score`: Current relationship health (0-100)
  - `last_updated`: Last score modification timestamp
  - `resilience`: Score decay resistance (0.8-1.5)
  - `momentum_score`: Bonus for consecutive interactions
  - `is_dormant`: Archived relationship flag

**Database Setup** (`src/db.ts`):
- Singleton `database` export
- Model registration
- Seed data for testing

### Intelligence Engine (`src/lib/weave-engine.ts`)

The core scoring logic. **This is the brain of the application.**

**Key Functions**:
- `calculateCurrentScore(friend)`: Applies time-based decay to weave score
- `calculatePointsForWeave(friend, weaveData)`: Calculates points for new interaction considering:
  - Base interaction score
  - Archetype affinity multiplier
  - Duration modifier
  - Vibe (moon phase) multiplier
  - Momentum bonus (15% if active)
- `logNewWeave(friends, weaveData, database)`: Transaction to create interaction and update all friend scores

**Decay System**:
- Scores decay daily based on Dunbar tier and resilience
- Inner Circle: 2.5 points/day (fast decay)
- Close Friends: 1.5 points/day
- Community: 0.5 points/day (slow decay)

### State Management

**Zustand Stores** (`src/stores/`):
- `friendStore`: Manages friends data with WatermelonDB observables
  - `observeFriends()`: Subscribe to all friends
  - `observeFriend(id)`: Subscribe to single friend + interactions
  - CRUD operations wrapped in `database.write()`
- `interactionStore`: Interaction form state and submission logic
- `uiStore`: Modal visibility, UI flags (e.g., `isQuickWeaveOpen`)

**Store Pattern**:
- Stores subscribe to WatermelonDB observables
- Use `.observe()` for reactive updates
- Always unsubscribe on unmount
- Wrap writes in `database.write()` transactions

### Navigation Structure (`app/`)

File-based routing via expo-router:
- `index.tsx`: Initial route (redirects to onboarding or dashboard)
- `onboarding.tsx`: First-time user flow
- `dashboard.tsx`: Main view with tier tabs and friend cards
- `friend-profile.tsx`: Individual friend detail view
- `add-friend.tsx`: Add new friend form
- `edit-friend.tsx`: Edit existing friend
- `interaction-form.tsx`: Log or plan interaction (Quick Weave)
- `_layout.tsx`: Root layout with providers

### Key Frameworks

**Dunbar's Layers** (3 tiers):
- Inner Circle (~5): Closest relationships, fastest decay
- Close Friends (~15): Important bonds
- Community (~50): Meaningful acquaintances

**Tarot Archetypes** (7 types):
Each archetype has unique affinity multipliers for interaction types (see `ArchetypeMatrixV2` in `src/lib/constants.ts`):
- **Emperor**: Structure, achievement, planned events (loves Events, Milestones)
- **Empress**: Comfort, nurturing, sensory experiences (loves Home, Cooking, Dinner Party)
- **High Priestess**: Depth, intuition, private connection (loves Call, Chat, Tea Time)
- **Fool**: Spontaneity, novelty, fun (loves Text, DM, Adventure, Party)
- **Sun**: Celebration, high-energy gatherings (loves Events, Parties, Birthdays)
- **Hermit**: Solitude, one-on-one time (loves Chat, Walk, Video Call, Tea Time)
- **Magician**: Creativity, collaboration, projects (loves Game Night, Milestone, Achievement)

### Important Files & Directories

**Constants** (`src/lib/constants.ts`):
- Decay rates, interaction scores, duration modifiers, vibe multipliers
- `ArchetypeMatrixV2`: Full matrix of archetype × interaction type multipliers
- `archetypeData`: Archetype metadata (icons, descriptions)
- `tierMap`, `tierColors`, `archetypeIcons`, `modeIcons`, `moonPhasesData`

**Components** (`src/components/`):
- Component files use PascalCase filenames
- **Styling Policy**:
  - **All NEW components MUST use NativeWind** (Tailwind classes)
  - When rebuilding/modifying existing components, refactor styling to NativeWind
  - Don't automatically refactor old components just for styling changes
  - Legacy components may still use StyleSheet until they're touched
- Reanimated for performance-critical animations
- Key components: `FriendCard`, `QuickWeaveOverlay`, `CalendarView`, `SettingsModal`

**Context Providers** (`src/context/`, `src/components/`):
- `CardGestureContext`: Shared gesture handling for swipe-to-delete
- `QuickWeaveProvider`: Global Quick Weave overlay state
- `ToastProvider`: Toast notifications

**Lifecycle Management** (`src/lib/lifecycle-manager.ts`):
- `checkAndApplyDormancy()`: Marks friends dormant after extended inactivity

**Types** (`src/components/types.tsx`):
- Central type definitions
- Exported types: `Tier`, `Archetype`, `InteractionType`, `Duration`, `Vibe`
- `FriendFormData`, `MockContact`

### Styling & Theme

**Theme** (`src/theme.ts`):
- StyleSheet-based theme object
- Font families: Lora (headings), Inter (body)
- Colors, typography, spacing constants

**NativeWind** (`tailwind.config.js`, `global.css`):
- Tailwind utility classes for React Native
- Configured in `babel.config.js` with `jsxImportSource: 'nativewind'`

## Key Concepts

### Weave Score System
- 0-100 scale representing relationship health
- Decays daily based on tier and resilience
- Restored by logging interactions
- Visual feedback through color and UI states

### Interaction Types & Scoring
- 40+ interaction types with unique base scores (5-30 points)
- Modified by archetype affinity (0.4x-2.0x)
- Duration modifiers: Quick (0.8x), Standard (1.0x), Extended (1.2x)
- Vibe (moon phase) multipliers: New Moon (0.9x) to Full Moon (1.3x)

### Momentum System
- 15-point bonus score that decays daily
- Activated on each interaction
- Adds 15% multiplier to next interaction if still active

### Resilience
- Slows decay rate (0.8-1.5 range)
- Increases with positive vibes (Waxing Gibbous, Full Moon)
- Decreases with negative vibes (New Moon)
- Only updates after 5+ rated weaves

### Dormancy
- Friends become dormant after prolonged inactivity
- Managed by `lifecycle-manager.ts`
- Filtered out of main dashboard view

## Development Practices

### Working with WatermelonDB
- Always wrap writes in `database.write(async () => { ... })`
- Use `.observe()` for reactive queries, not `.fetch()`
- Access related records through model methods, not manual joins
- Clean up subscriptions on component unmount

### State Updates
- WatermelonDB handles persistence; Zustand handles UI state
- Don't duplicate database state in Zustand
- Use observables to keep Zustand synced with database

### File Naming
- Models: PascalCase (`Friend.ts`)
- Components: PascalCase (`FriendCard.tsx`)
- Utilities: kebab-case (`weave-engine.ts`)
- Stores: camelCase (`friendStore.ts`)

### TypeScript
- Strict mode enabled
- Import types from `src/components/types.tsx`
- Model types: Use WatermelonDB model classes directly (e.g., `FriendModel`)

## Collaboration Protocol (from GEMINI.md)

When making changes:
1. **Propose, Don't Impose**: Always propose code changes and await confirmation before writing
2. **Read First**: Use Read tool to get context before proposing changes
3. **Ask for Confirmation**: End proposals with explicit request for permission to proceed
4. **Proactive Problem Solving**: Flag issues but frame as proposals
5. **Assume Context**: You can reference "Dunbar's Layers," "Archetype Framework," "Weave Score," etc. without explanation

## Common Gotchas

- **Dexie.js**: Legacy dependency, ignore it. WatermelonDB is the only database.
- **Snake_case vs camelCase**: Schema uses snake_case, models use camelCase
- **Native Module Warnings**: Rebuild app if "not exported" errors occur
- **Zustand for UI only**: Don't store database records in Zustand
- **Transaction Boundaries**: Group related writes in single `database.write()` call
- **Observe vs Fetch**: Always use `.observe()` for reactive updates, not `.fetch()`
- remember the plan for the new logging/planning redesign for now