# Module Encapsulation Violations - Complete List

This document lists all instances where files are importing directly from internal module paths instead of using the public API exported via module `index.ts` files.

## Summary

**Total Files with Violations: 15**
**Total Import Violations: 22+**

---

## 🔴 Application Layer (app/) - 4 Files

### 1. `app/weave-logger.tsx`

**Line 7:**
```typescript
❌ import { calculateDeepeningLevel } from '@/modules/intelligence/services/deepening.service';
```

**Should be:**
```typescript
✅ import { calculateDeepeningLevel } from '@/modules/intelligence';
```

---

### 2. `app/_friends.tsx`

**Line 9:**
```typescript
❌ import { FriendListRow } from '@/modules/relationships/components/FriendListRow';
```

**Should be:**
```typescript
✅ import { FriendListRow } from '@/modules/relationships';
```

---

### 3. `app/friend-profile.tsx`

**Line 31:**
```typescript
❌ import { useFriendProfileData } from '@/modules/relationships/hooks/useFriendProfileData';
```

**Line 32:**
```typescript
❌ import { useFriendTimeline } from '@/modules/relationships/hooks/useFriendTimeline';
```

**Should be:**
```typescript
✅ import { useFriendProfileData, useFriendTimeline } from '@/modules/relationships';
```

---

## 🟠 Components Layer (src/components/) - 5 Files

### 4. `src/components/settings-modal.tsx` (6 violations)

**Lines 12-17:**
```typescript
❌ import { useUserProfileStore } from '@/modules/auth/store/user-profile.store';
❌ import * as CalendarService from '@/modules/interactions/services/calendar.service';
❌ import * as DataExportService from '@/modules/auth/services/data-export';
❌ import * as DataImportService from '@/modules/auth/services/data-import';
❌ import { useBackgroundSyncStore } from '@/modules/auth/store/sync.store';
❌ import * as BackgroundEventSync from '@/modules/auth/services/background-event-sync';
```

**Should be:**
```typescript
✅ import {
  useUserProfileStore,
  DataExportService,
  DataImportService,
  useBackgroundSyncStore,
  BackgroundEventSync
} from '@/modules/auth';
✅ import { CalendarService } from '@/modules/interactions';
```

---

### 5. `src/components/FriendBadgePopup.tsx`

**Line 37:**
```typescript
❌ import { analyzeInteractionPattern } from '@/modules/insights/services/pattern.service';
```

**Should be:**
```typescript
✅ import { analyzeInteractionPattern } from '@/modules/insights';
```

---

### 6. `src/components/QuickWeaveProvider.tsx`

**Line 3:**
```typescript
❌ import { QuickWeaveOverlay } from '@/modules/interactions/components/QuickWeaveOverlay';
```

**Should be:**
```typescript
✅ import { QuickWeaveOverlay } from '@/modules/interactions';
```

---

### 7. `src/components/home/widgets/TodaysFocusWidget.tsx`

**Line 29:**
```typescript
❌ import { useUserProfileStore } from '@/modules/auth/store/user-profile.store';
```

**Should be:**
```typescript
✅ import { useUserProfileStore } from '@/modules/auth';
```

---

### 8. `src/components/home/widgets/SocialSeasonWidget.tsx`

**Line 10:**
```typescript
❌ import { useUserProfileStore } from '@/modules/auth/store/user-profile.store';
```

**Should be:**
```typescript
✅ import { useUserProfileStore } from '@/modules/auth';
```

---

## 🟡 Context Layer (src/context/) - 1 File

### 9. `src/context/CardGestureContext.tsx`

**Line 7:**
```typescript
❌ import { useQuickWeave } from '@/modules/interactions/hooks/useQuickWeave';
```

**Should be:**
```typescript
✅ import { useQuickWeave } from '@/modules/interactions';
```

---

## 🔵 Cross-Module Imports (Modules importing from other modules) - 6 Files

### 10. `src/modules/intelligence/services/scoring.service.ts`

**Line 13:**
```typescript
❌ import { getLearnedEffectiveness } from '@/modules/insights/services/effectiveness.service';
```

**Should be:**
```typescript
✅ import { getLearnedEffectiveness } from '@/modules/insights';
```

**Note:** Intelligence module accessing Insights module - verify this is appropriate module dependency.

---

### 11. `src/modules/notifications/services/smart-notification-scheduler.ts`

**Line 13:**
```typescript
❌ import { generateSuggestion } from '@/modules/interactions/services/suggestion-engine.service';
```

**Should be:**
```typescript
✅ import { generateSuggestion } from '@/modules/interactions';
```

---

### 12. `src/modules/notifications/services/notification-manager-enhanced.ts`

**Line 24:**
```typescript
❌ import { STORY_CHIPS } from '@/modules/reflection/services/story-chips.service';
```

**Should be:**
```typescript
✅ import { STORY_CHIPS } from '@/modules/reflection';
```

---

### 13. `src/modules/auth/services/background-event-sync.ts`

**Line 3:**
```typescript
❌ import { scanCalendarEvents } from '@/modules/interactions/services/event-scanner';
```

**Line 4:**
```typescript
❌ import { getCalendarSettings } from '@/modules/interactions/services/calendar.service';
```

**Should be:**
```typescript
✅ import { scanCalendarEvents, getCalendarSettings } from '@/modules/interactions';
```

---

### 14. `src/modules/interactions/services/event-scanner.ts`

**Line 11:**
```typescript
❌ import {
  classifyEvent,
  extractNamesFromTitle,
  matchHolidayDate,
  type EventType,
  type EventImportance,
} from '@/modules/reflection/services/keyword-dictionary';
```

**Should be:**
```typescript
✅ import {
  classifyEvent,
  extractNamesFromTitle,
  matchHolidayDate,
  type EventType,
  type EventImportance,
} from '@/modules/reflection';
```

---

### 15. `src/modules/reflection/services/oracle/oracle-service.ts`

**Line 2:**
```typescript
❌ import { supabase } from '@/modules/auth/services/supabase.service';
```

**Should be:**
```typescript
✅ import { supabase } from '@/modules/auth';
```

---

## 📊 Violation Breakdown by Category

### By Importing Location:
- **App routes (app/)**: 4 files, 4 violations
- **Components (src/components/)**: 5 files, 8 violations
- **Context (src/context/)**: 1 file, 1 violation
- **Modules (cross-module imports)**: 6 files, 9 violations

### By Target Module:
- **@/modules/auth**: 7 violations (5 unique files importing)
- **@/modules/interactions**: 6 violations (5 unique files importing)
- **@/modules/relationships**: 3 violations (3 unique files importing)
- **@/modules/intelligence**: 1 violation (1 unique file importing)
- **@/modules/insights**: 2 violations (2 unique files importing)
- **@/modules/reflection**: 3 violations (3 unique files importing)

### Most Common Violations:
1. **Importing stores directly** (`store/user-profile.store`, `store/sync.store`)
2. **Importing services directly** (`services/*.service.ts`)
3. **Importing hooks directly** (`hooks/use*.ts`)
4. **Importing components directly** (`components/*.tsx`)

---

## 🔧 Fix Strategy

### Phase 1: Update Module index.ts Files
Ensure each module's `index.ts` exports all public APIs:
- ✅ Stores (if they're meant to be public)
- ✅ Services (public methods only)
- ✅ Hooks
- ✅ Components (that are meant to be used outside the module)
- ✅ Types
- ✅ Constants

### Phase 2: Refactor Imports by Layer
1. **App routes first** (4 files)
2. **Components second** (5 files)
3. **Cross-module imports last** (6 files) - These require careful review of dependencies

### Phase 3: Prevent Future Violations
Add ESLint rule:
```javascript
'no-restricted-imports': [
  'error',
  {
    patterns: [
      '@/modules/*/services/*',
      '@/modules/*/store/*',
      '@/modules/*/hooks/*',
      '@/modules/*/components/*',
      '@/modules/*/utils/*'
    ]
  }
]
```

---

## ⚠️ Module Dependency Concerns

The following cross-module imports suggest potential architectural issues:

1. **intelligence → insights** (scoring.service.ts)
   - Intelligence module depends on Insights module
   - Consider if this creates circular dependency risk

2. **notifications → interactions** (smart-notification-scheduler.ts)
   - Notifications generating suggestions - appropriate?

3. **notifications → reflection** (notification-manager-enhanced.ts)
   - Accessing STORY_CHIPS constant

4. **auth → interactions** (background-event-sync.ts)
   - Background sync accessing calendar/events

5. **interactions → reflection** (event-scanner.ts)
   - Event scanner using reflection's keyword dictionary

6. **reflection → auth** (oracle-service.ts)
   - Oracle accessing Supabase service

**Recommendation:** Review these dependencies to ensure they're intentional and don't create circular dependencies.

---

## 📝 Notes

- All violations break the modular architecture principle: "Modules should only export their public API via index.ts"
- Many violations import from `store/` or `services/` - these may not be exported in module index.ts yet
- Some imports use namespace imports (`import * as`), others use named imports
- Cross-module imports need careful review to avoid circular dependencies

---

**Generated:** 2025-11-25
**Status:** Ready for refactoring
