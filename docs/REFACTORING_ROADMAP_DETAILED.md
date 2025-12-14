# Detailed Refactoring Roadmap for AI Agents

**Objective:** Migrate from `src/components` "God Folder" to Modular Architecture.
**Rule:** `src/components` must be empty by the end of this roadmap.

---

## Phase 1: Component Migration

Agents should process these batch by batch. For each file moved:
1.  Move the file.
2.  Update its relative imports (e.g. `../theme` might need to become `@/shared/theme`).
3.  Search and replace *all* references to this file in the codebase (VS Code "Replace in Files").
4.  Run `tsc --noEmit` to verify.

### 1.1 Module: Relationships
**Destination:** `src/modules/relationships/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `FriendSelector.tsx` | `src/modules/relationships/components/FriendSelector.tsx` |
| `AddFriendMenu.tsx` | `src/modules/relationships/components/AddFriendMenu.tsx` |
| `FriendBadgePopup.tsx` | `src/modules/relationships/components/FriendBadgePopup.tsx` |
| `FriendBadgeSection.tsx` | `src/modules/relationships/components/FriendBadgeSection.tsx` |
| `FriendManagementModal.tsx` | `src/modules/relationships/components/FriendManagementModal.tsx` |
| `ReciprocitySelector.tsx` | `src/modules/relationships/components/ReciprocitySelector.tsx` |
| `Tier*.tsx` (All 3 files) | `src/modules/relationships/components/` |
| `friend-profile/*.tsx` (All files) | `src/modules/relationships/components/profile/` |

### 1.2 Module: Interactions
**Destination:** `src/modules/interactions/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `EditInteractionModal.tsx` | `src/modules/interactions/components/EditInteractionModal.tsx` |
| `InteractionDetailModal.tsx` | `src/modules/interactions/components/InteractionDetailModal.tsx` |
| `PlanChoiceModal.tsx` | `src/modules/interactions/components/PlanChoiceModal.tsx` |
| `SuggestionCard.tsx` | `src/modules/interactions/components/SuggestionCard.tsx` |
| `EventSuggestionModal.tsx` | `src/modules/interactions/components/EventSuggestionModal.tsx` |

### 1.3 Module: Intelligence & Social Season
**Destination:** `src/modules/intelligence/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `Archetype*.tsx` (All 4 files) | `src/modules/intelligence/components/archetypes/` |
| `Season*.tsx` (All 3 files) | `src/modules/intelligence/components/social-season/` |
| `SocialSeason/*.tsx` | `src/modules/intelligence/components/social-season/` |
| `MoonPhaseSelector.tsx` | `src/modules/intelligence/components/MoonPhaseSelector.tsx` |

### 1.4 Module: Gamification
**Destination:** `src/modules/gamification/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `AchievementCard.tsx` | `src/modules/gamification/components/AchievementCard.tsx` |
| `AchievementsModal.tsx` | `src/modules/gamification/components/AchievementsModal.tsx` |
| `BadgeUnlockModal.tsx` | `src/modules/gamification/components/BadgeUnlockModal.tsx` |
| `TrophyCabinetModal.tsx` | `src/modules/gamification/components/TrophyCabinetModal.tsx` |
| `CelebrationAnimation.tsx` | `src/modules/gamification/components/CelebrationAnimation.tsx` |
| `MilestoneCelebration.tsx` | `src/modules/gamification/components/MilestoneCelebration.tsx` |

### 1.5 Module: Reflection
**Destination:** `src/modules/reflection/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `WeeklyReflection/*.tsx` | `src/modules/reflection/components/weekly/` |
| `ContextualReflectionInput.tsx` | `src/modules/reflection/components/ContextualReflectionInput.tsx` |
| `EditReflectionModal.tsx` | `src/modules/reflection/components/EditReflectionModal.tsx` |
| `MicroReflectionSheet.tsx` | `src/modules/reflection/components/MicroReflectionSheet.tsx` |
| `Reflection*.tsx` | `src/modules/reflection/components/` |

### 1.6 Module: Journal
**Destination:** `src/modules/journal/components/`

| Source File (in `src/components/Journal/`) | New Home |
| :--- | :--- |
| `*` (All files) | `src/modules/journal/components/` |

### 1.7 Module: Insights
**Destination:** `src/modules/insights/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `charts/*` | `src/modules/insights/components/charts/` |
| `YearInMoons/*` | `src/modules/insights/components/year-in-moons/` |
| `Insights*.tsx` | `src/modules/insights/components/` |
| `YourPatternsSection.tsx` | `src/modules/insights/components/YourPatternsSection.tsx` |
| `DigestSheet.tsx` | `src/modules/insights/components/DigestSheet.tsx` |

### 1.8 Module: Groups
**Destination:** `src/modules/groups/components/`

| Source File (in `src/components/groups/`) | New Home |
| :--- | :--- |
| `*` (All files) | `src/modules/groups/components/` |

### 1.9 Module: Auth / Settings
**Destination:** `src/modules/auth/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `settings/*` | `src/modules/auth/components/settings/` |
| `settings-modal.tsx` | `src/modules/auth/components/settings/SettingsModal.tsx` |
| `FeedbackModal.tsx` | `src/modules/auth/components/FeedbackModal.tsx` |
| `UpgradeModal.tsx` | `src/modules/auth/components/UpgradeModal.tsx` |
| `DuplicateResolverModal.tsx` | `src/modules/data-management/components/DuplicateResolverModal.tsx` |

### 1.10 Shared UI (Cleanup)
**Destination:** `src/shared/ui/` OR `src/shared/components/`

| Source File (in `src/components/`) | New Home |
| :--- | :--- |
| `ui/*` | `src/shared/ui/` (Merge with existing) |
| `WeaveIcon.tsx` | `src/shared/ui/WeaveIcon.tsx` |
| `CalendarView.tsx` | `src/shared/components/CalendarView.tsx` |
| `CustomCalendar.tsx` | `src/shared/components/CustomCalendar.tsx` |
| `GlobalYearCalendar.tsx` | `src/shared/components/GlobalYearCalendar.tsx` |
| `MonthDayPicker.tsx` | `src/shared/components/MonthDayPicker.tsx` |
| `GlobalModals.tsx` | `src/shared/components/GlobalModals.tsx` |

---

## Phase 2: Screen Extraction (App Cleanup)

Goal: `app/*.tsx` files should be thin wrappers.

### 2.1 Weave Logger
1.  **Create:** `src/modules/interactions/screens/WeaveLoggerScreen.tsx`
2.  **Action:** Move all logic and UI from `app/weave-logger.tsx`.
3.  **Update App:** `app/weave-logger.tsx` should only import the screen and render it.

### 2.2 Friend Profile
1.  **Create:** `src/modules/relationships/screens/FriendProfileScreen.tsx`
2.  **Action:** Move all logic from `app/friend-profile.tsx`.

### 2.3 Dashboard
1.  **Create:** `src/modules/home/screens/DashboardScreen.tsx`
2.  **Action:** Move `app/dashboard.tsx` content.

---

## Phase 3: Final Verification

1.  Delete `src/components`.
2.  Run `npm start -- --clear` to clear Metro cache.
3.  Run full test suite.
