# Overlay Architecture Migration Plan

## Document Metadata

| Property | Value |
|---|---|
| Owner | Engineering |
| Status | Proposed |
| Date | March 24, 2026 |
| Goal | Fix layering conflicts, enable multi-step flows, and establish a sustainable overlay architecture |

---

## 1. Problem Statement

The app has **66 overlay components** using a mix of four different overlay primitives:

| Primitive | Count | Layer Control | Gesture Support | Nesting |
|---|---|---|---|---|
| `StandardBottomSheet` (@gorhom) | 47 | z-index: 1000 | Native swipe | Portal-based |
| `AnimatedBottomSheet` (custom) | 3 | Modal-based | None (animation only) | N/A |
| `React Native Modal` | 6 | Native (always on top) | None | Blocks all touches below |
| Custom Reanimated overlays | 4 | Implicit | Custom | N/A |

This creates three concrete problems:

1. **iOS sheet stacking is broken.** `@gorhom/bottom-sheet` doesn't support multiple simultaneous sheets. When one sheet opens another (13+ nesting points), behavior is undefined — gestures conflict, backdrops layer incorrectly, and dismissal chains break.

2. **Multi-step flows are forced into sheets.** WeeklyReflectionModal (4 steps), PlanWizard (3 steps), GuidedReflectionSheet (3+ steps), ProfileCompletionSheet, and LinkFriendSheet all run multi-step flows inside bottom sheets. This fights the sheet metaphor (peek and act) and creates animation/gesture conflicts when steps involve scrolling, keyboards, or date pickers.

3. **Layering is unpredictable.** React Native `Modal` renders above everything natively — it can't be z-indexed relative to `@gorhom/bottom-sheet`. When JournalEntryDetailSheet (sheet) opens PlanWizard (sheet registered in GlobalModals), the `waitForSheetClose` 150ms delay is a timing hack, not a solution. If Oracle (RN Modal) triggers PlanWizard, it's Modal-on-Modal with no coordination.

---

## 2. Design Principles

1. **One overlay at a time.** The user should never see two overlays competing for attention. A queue replaces timing hacks.
2. **Match the container to the interaction.** Sheets for quick single-step actions. Full-screen flows for multi-step journeys. Routes for deep exploration.
3. **Sheets are leaves, not trees.** A bottom sheet should never open another bottom sheet. If it needs to, it's the wrong container.
4. **Centralized coordination.** All overlays go through a single coordinator that enforces the one-at-a-time rule and manages transitions.
5. **Incremental migration.** Each conversion is independently shippable. No flag day.

---

## 3. Target Architecture

### 3.1 Three Container Types

#### Bottom Sheet (`StandardBottomSheet`)
**Use for:** Single-step, dismissible interactions. The user peeks at content and either acts or dismisses.

Properties:
- 1 step only (no internal navigation)
- Swipe-to-dismiss always available
- No child overlays — actions that need another overlay close the sheet first, then the coordinator opens the next one
- Heights: `action` (35%), `form` (65%), or `full` (90%)

#### Full-Screen Flow (`FullScreenFlow` — new component)
**Use for:** Multi-step journeys with their own navigation, keyboards, and complex content.

Properties:
- Renders as a full-screen animated view (not `Modal`, not sheet)
- Internal step navigation with back button and progress indicator
- Swipe-to-dismiss disabled — explicit close/cancel button
- `hasUnsavedChanges` confirmation on close attempt
- Animated entry/exit (slide up from bottom, matching sheet feel)
- Takes full screen minus safe area

#### Route (expo-router push)
**Use for:** Deep exploration screens the user might want to navigate back from, or content that deserves its own URL.

Properties:
- Standard stack navigation with back gesture
- URL-addressable
- No overlay coordination needed

### 3.2 Overlay Coordinator

Extend the existing `popupQueue` pattern in `uiStore` into a general-purpose overlay coordinator.

```typescript
// New types
type OverlayType = 'sheet' | 'flow' | 'celebration';

interface OverlayRequest {
  id: string;                    // Unique identifier (e.g., 'plan-wizard', 'weekly-reflection')
  type: OverlayType;
  priority: number;              // Higher = more urgent (celebrations: 100, flows: 50, sheets: 10)
  component: string;             // Component key for GlobalModals registry
  data?: Record<string, any>;    // Props to pass to the component
  interruptible?: boolean;       // Can be interrupted by higher priority (default: false)
}

interface OverlayCoordinatorState {
  activeOverlay: OverlayRequest | null;
  queue: OverlayRequest[];

  // Actions
  requestOverlay: (request: OverlayRequest) => void;
  closeOverlay: (id: string) => void;
  clearQueue: () => void;
}
```

**Rules:**
- If nothing is active → open immediately
- If something is active and new request has higher priority AND active is `interruptible` → close active, open new, re-queue active
- Otherwise → queue the new request
- On close → 300ms delay → open next from queue (sorted by priority)
- Celebrations (milestones, badges) always queue — never interrupt flows

**Migration from current system:**
- `requestPopup()` / `closePopup()` become aliases for `requestOverlay()` / `closeOverlay()` during migration
- `waitForSheetClose()` calls become `closeOverlay(currentId)` — the coordinator handles the transition timing

### 3.3 FullScreenFlow Component Spec

```typescript
interface FullScreenFlowProps {
  visible: boolean;
  onClose: () => void;

  // Navigation
  steps: number;              // Total step count (for progress indicator)
  currentStep: number;        // Current step (0-indexed)
  onBack?: () => void;        // Back button handler (hide on step 0)

  // Header
  title?: string;
  headerRight?: ReactNode;    // e.g., "Skip" or step counter

  // Safety
  hasUnsavedChanges?: boolean;
  confirmCloseMessage?: string;

  // Content
  children: ReactNode;

  // Animation
  animationType?: 'slide' | 'fade';  // Default: 'slide'
}
```

**Implementation approach:**
- Use `Animated.View` with `translateY` (matches sheet entry feel)
- Full screen with `SafeAreaView`
- Backdrop: solid background (not transparent — this owns the screen)
- Step indicator: horizontal dots or progress bar in header
- Back button: ChevronLeft icon, positioned like standard nav
- Close button: X icon on step 0 (or always, top-right)
- Keyboard handling: `KeyboardAvoidingView` with `behavior="padding"`
- Exit animation: slide down, then `onClose` fires

**Rendered in:** `GlobalModals.tsx`, same as current overlays. The coordinator manages visibility.

---

## 4. Complete Overlay Classification

### 4.1 Keep as Bottom Sheet (33 components)

These are single-step, peek-and-act interactions that fit the sheet model correctly.

| Component | Module | Current Type | Notes |
|---|---|---|---|
| FriendPickerSheet | relationships | StandardBottomSheet | Single-select picker |
| FriendDetailSheet | relationships | StandardBottomSheet | Read-only detail view. Actions that open other overlays should close this first via coordinator |
| FriendManagementModal | relationships | StandardBottomSheet | Quick management options |
| LifeEventModal | relationships | StandardBottomSheet | Single-step form |
| LinkMatchConfirmModal | relationships | StandardBottomSheet | Confirmation |
| PendingRequestsSheet | relationships | StandardBottomSheet | List view |
| ProfileCodeSheet | relationships | StandardBottomSheet | Display + share |
| UsernameSearchSheet | relationships | StandardBottomSheet | Search + results |
| WeaveUserSearchModal | relationships | StandardBottomSheet | Search + results |
| IntentionActionSheet | relationships | StandardBottomSheet | Action menu |
| AddUserByLinkSheet | relationships | StandardBottomSheet | Single step |
| InteractionDetailModal | interactions | StandardBottomSheet | Read-only detail |
| InviteFriendSheet | interactions | StandardBottomSheet | Code + share |
| PlanChoiceModal | interactions | StandardBottomSheet | Quick choice |
| PlannedWeaveDetailSheet | interactions | StandardBottomSheet | Detail view |
| SuggestionActionSheet | interactions | StandardBottomSheet | Action menu |
| CalendarNudgeModal | interactions | StandardBottomSheet | Nudge display |
| IntentionFormModal | reflection | StandardBottomSheet | Single-step form |
| EditReflectionModal | reflection | StandardBottomSheet | Single-step edit |
| CustomChipModal | reflection | StandardBottomSheet | Quick input |
| MicroReflectionSheet | reflection | StandardBottomSheet | Vibe + quick notes |
| WeeklyReflectionDetailModal | reflection | StandardBottomSheet | Read-only |
| StatsDetailSheet | reflection | StandardBottomSheet | Stats display |
| JournalEntryDetailSheet | journal | StandardBottomSheet | Detail view. Migrate action buttons to use coordinator |
| QuickCaptureSheet | journal | StandardBottomSheet | Quick capture form |
| EveningCheckinSheet | home | StandardBottomSheet | Battery check-in |
| FocusDetailSheet | home | StandardBottomSheet | Focus detail |
| SocialBatterySheet | home | StandardBottomSheet | Battery level selector |
| DigestSheet | home | AnimatedBottomSheet | Digest items |
| OracleModeSheet | oracle | StandardBottomSheet | Mode picker |
| NotificationPermissionModal | notifications | StandardBottomSheet | Permission request |
| ActivityInboxSheet | sync | StandardBottomSheet | Activity list |
| PendingWeavesSheet | sync | StandardBottomSheet | Pending items |
| BackupListSheet | backup | StandardBottomSheet | Backup list |
| AccountIncentiveModal | auth | StandardBottomSheet | Single step |
| FeedbackModal | auth | StandardBottomSheet | Feedback form |
| UpgradeModal | auth | StandardBottomSheet | Feature promo |
| SettingsModal | auth | StandardBottomSheet | Settings menu |
| SyncConflictModal | auth | StandardBottomSheet | Resolution (non-closeable) |
| SeasonExplanationModal | intelligence | StandardBottomSheet | Explanation display |
| SeasonOverrideModal | intelligence | StandardBottomSheet | Season adjustment |
| PulseSheet | intelligence | StandardBottomSheet | Pulse display |
| UnifiedCalendarModal | insights | StandardBottomSheet | Calendar view |
| DayDetailSheet | insights | StandardBottomSheet | Day detail |
| TierFitBottomSheet | insights | StandardBottomSheet | Tier explanation |
| AchievementsModal | gamification | StandardBottomSheet | Achievement grid |
| GroupListModal | groups | StandardBottomSheet | Group list |

**No changes needed** for most of these — they're already `StandardBottomSheet`. The key change is removing any nesting behavior and routing through the coordinator instead.

### 4.2 Convert to FullScreenFlow (11 components)

These are multi-step flows that should own the full screen.

| Component | Module | Current Type | Steps | Why Convert |
|---|---|---|---|---|
| **WeeklyReflectionModal** | reflection | StandardBottomSheet | 4 | Core ritual flow with writing, AI summary, stats, and calendar events. Needs dedicated space |
| **PlanWizard** | interactions | StandardBottomSheet | 3 | Category → details → confirmation. Date pickers and friend selectors fight sheet gestures |
| **GuidedReflectionSheet** | journal | StandardBottomSheet | 3+ | Topic selection → freeform/prompted → receipt. Has keyboard-heavy writing steps |
| **JournalEntryModal** | journal | StandardBottomSheet | 1 (complex) | Already has expand-to-fullscreen. Complex form with title, content, date, friends, chips. Should just be full-screen from the start |
| **EditInteractionModal** | interactions | StandardBottomSheet | 1 (complex) | Heavy form: category, date, friends, duration, notes, vibe. Date pickers and selectors are awkward in a sheet |
| **OracleSheet** | oracle | RN Modal + nested sheet | Multi-mode | Already full-screen. Convert from RN Modal to FullScreenFlow for coordinator integration |
| **ProfileCompletionSheet** | auth | StandardBottomSheet | Multi-step | Onboarding flow: photo, name, archetypes |
| **LinkFriendSheet** | relationships | StandardBottomSheet | Multi-step | Search → confirm → complete |
| **ContactDiscoverySheet** | relationships | StandardBottomSheet | Multi-step | Contact import flow |
| **DuplicateResolverModal** | relationships | StandardBottomSheet | Multi-step | Resolution flow |
| **GroupManagerModal** | groups | StandardBottomSheet | Multi-step | Group CRUD with member management |

### 4.3 Convert to Route (4 components)

These are deep exploration screens that deserve their own URL.

| Component | Module | Current Type | Why Convert |
|---|---|---|---|
| **TrophyCabinetModal** | gamification | StandardBottomSheet | 3-tab exploration (global, hidden, friend). Rich enough for a screen |
| **YearInMoonsModal** | intelligence | StandardBottomSheet | Year calendar + patterns. Complex visualization |
| **ArchetypeDetailModal** | intelligence | RN Modal | Currently uses BlurView. Could be a beautiful standalone screen |
| **ArchetypeLibrary** | intelligence | StandardBottomSheet | All archetypes grid. Exploration-oriented |

### 4.4 Convert from RN Modal to Coordinator-Managed (6 components)

These currently use React Native `Modal` and need to integrate with the coordinator.

| Component | Current Type | Target Type | Notes |
|---|---|---|---|
| **EventSuggestionModal** | RN Modal (animated) | FullScreenFlow or Sheet | Auto-sequences multiple events. Could be a sheet per event via coordinator queue |
| **MemoryMomentModal** | RN Modal | Sheet | Simple display + 2 actions. Classic sheet use case |
| **MilestoneCelebration** | RN Modal | Celebration overlay | Keep as full-screen celebration but register with coordinator |
| **BadgeUnlockModal** | RN Modal (queued) | Celebration overlay | Already has queue in uiStore. Move queue to coordinator |
| **QuickWeaveOverlay** | RN Modal (radial menu) | Keep as-is | Unique radial gesture UI. Doesn't conflict with sheets (force-closes them already) |
| **PostWeaveRatingModal** | AnimatedBottomSheet | Sheet | Simple rating. Convert to StandardBottomSheet |

---

## 5. Nesting Chain Fixes

These are the 13+ nesting points that create layering conflicts today. Each one needs a specific fix.

### Chain 1: JournalEntryDetailSheet → Multiple Overlays
**Current:** Sheet opens PlanWizard, IntentionFormModal, GuidedReflectionSheet, OracleSheet, LifeEventModal via `waitForSheetClose()` hack.

**Fix:** Action buttons call `coordinator.closeOverlay('journal-detail')` then `coordinator.requestOverlay({ id: 'plan-wizard', ... })`. The coordinator handles the transition timing. Remove `waitForSheetClose()`.

### Chain 2: FriendDetailSheet → LifeEventModal / EditReflectionModal
**Current:** Sheet opens sheets directly.

**Fix:** Same pattern — close then request via coordinator.

### Chain 3: OracleSheet → History Panel (Nested StandardBottomSheet)
**Current:** Uses PortalHost inside RN Modal. Works but is fragile.

**Fix:** Convert Oracle to `FullScreenFlow`. History panel becomes internal navigation state (slide-in panel), not a nested sheet. Or keep it as a sheet but rendered via the flow's own portal context.

### Chain 4: FriendSelector → GroupManagerModal
**Current:** Sheet inside sheet.

**Fix:** Convert GroupManagerModal to `FullScreenFlow` (it's multi-step CRUD). FriendSelector action button closes picker, coordinator opens GroupManager.

### Chain 5: WeeklyReflectionModal → PlannedWeaveDetailSheet
**Current:** Step 4 (CalendarEventsStep) can open plan details.

**Fix:** As a FullScreenFlow, WeeklyReflection can render plan details inline (expandable card) rather than opening a separate sheet.

### Chain 6: QuickCaptureSheet → GuidedReflectionSheet
**Current:** Sheet opens sheet.

**Fix:** Close QuickCapture, coordinator opens GuidedReflection as FullScreenFlow.

### Chain 7: QuickCaptureSheet → InsightReceipt
**Current:** Save triggers InsightReceipt.

**Fix:** InsightReceipt is informational — keep as a sheet. QuickCapture closes on save, coordinator opens InsightReceipt sheet.

### Chain 8: GuidedReflectionSheet → InsightReceiptExpanded
**Current:** Flow completion triggers receipt.

**Fix:** As a FullScreenFlow, the receipt becomes the final step of the flow (inline), not a separate overlay.

### Chain 9: EditInteractionModal → FriendSelector / DateTimePicker
**Current:** Sheet opens pickers.

**Fix:** As a FullScreenFlow, pickers can render inline or as sub-screens within the flow's navigation.

### Chain 10: PlanWizard → FriendSelector / DateTimePicker
**Current:** Sheet opens pickers.

**Fix:** Same as above — inline within the FullScreenFlow.

### Chain 11: UnifiedCalendarModal → DayDetailSheet
**Current:** Calendar sheet opens day detail sheet.

**Fix:** Close calendar, coordinator opens day detail. Or convert calendar to a route (it's exploration-oriented enough).

### Chain 12: YearInMoonsModal → SocialBatterySheet
**Current:** Modal opens sheet.

**Fix:** Convert YearInMoons to a route. Battery sheet opens independently via coordinator.

### Chain 13: EventSuggestionModal → FriendSelector
**Current:** Modal opens picker.

**Fix:** Convert to sheet or flow. If sheet: close, coordinator opens picker, then re-opens suggestion with updated data. If flow: picker is inline.

---

## 6. Phase Plan

### Phase 1: Overlay Coordinator (Foundation)

**Goal:** Replace the timing hacks with a proper coordination system.

**Tasks:**
1. Define `OverlayRequest` and `OverlayCoordinatorState` types
2. Implement `requestOverlay()` and `closeOverlay()` in uiStore (alongside existing `requestPopup`/`closePopup`)
3. Add `activeOverlay` and `queue` state with priority sorting
4. Migrate `requestPopup`/`closePopup` to use the new coordinator internally
5. Add `OVERLAY_TRANSITION_DELAY` constant (300ms) to replace hardcoded 150ms/500ms
6. Update GlobalModals to read from `activeOverlay` for coordinated overlays
7. Remove `waitForSheetClose()` from JournalEntryDetailSheet and replace with coordinator calls

**Acceptance criteria:**
- Existing popup coordinator behavior unchanged (social battery, weekly reflection)
- JournalEntryDetailSheet action buttons use coordinator instead of timing hacks
- No two overlays visible simultaneously when using coordinator

**Estimate:** Small — mostly state management refactoring.

### Phase 2: FullScreenFlow Component

**Goal:** Build the shared component for multi-step flows.

**Tasks:**
1. Create `src/shared/ui/Flow/FullScreenFlow.tsx` with:
   - Animated slide-up entry/exit (matching sheet feel)
   - Step indicator (dots or progress bar)
   - Header with back button, title, close button
   - `hasUnsavedChanges` confirmation
   - `SafeAreaView` + `KeyboardAvoidingView` wrapping
2. Create `src/shared/ui/Flow/types.ts` and `constants.ts`
3. Export from `src/shared/ui/Flow/index.ts`
4. Register component type in coordinator (`type: 'flow'`)
5. Add to GlobalModals rendering logic

**Acceptance criteria:**
- FullScreenFlow renders cleanly on iOS and Android
- Step navigation with animated transitions
- Keyboard handling works for text inputs
- Back button and close button work with unsaved changes guard
- Coordinator can open/close FullScreenFlow

**Estimate:** Medium — new component but straightforward.

### Phase 3: High-Impact Conversions (Fix the Worst Layering)

**Goal:** Convert the overlays that cause the most user-facing layering bugs.

**Priority order (based on frequency of layering conflicts):**

#### 3a: PlanWizard → FullScreenFlow
- Already 3 steps with internal step animation
- Move FriendSelector and DateTimePicker inline
- Register with coordinator as `{ id: 'plan-wizard', type: 'flow', priority: 50 }`
- Update all trigger points (FocusDetailSheet, JournalEntryDetailSheet, WeeklyReflection CalendarEventsStep, friend profiles)

#### 3b: WeeklyReflectionModal → FullScreenFlow
- 4 steps already well-separated (ReflectionPromptStep, OracleSummaryStep, WeekSnapshotStep, CalendarEventsStep)
- Convert step navigation from sheet snap points to flow steps
- Keep popup coordinator integration via the overlay coordinator
- PlannedWeaveDetailSheet opens inline instead of nested

#### 3c: GuidedReflectionSheet → FullScreenFlow
- Multi-step: TopicSelection → Freeform/Prompted → Receipt
- InsightReceiptExpanded becomes the final step
- QuickCaptureSheet closes before this opens

#### 3d: OracleSheet → FullScreenFlow
- Already full-screen. Replace RN Modal wrapper with FullScreenFlow
- Internal PortalHost for history panel stays (or becomes slide-in panel)
- Coordinator manages Oracle lifecycle

#### 3e: JournalEntryModal → FullScreenFlow
- Already has expand-to-fullscreen toggle. Just make it always full-screen
- Complex form benefits from more space
- Remove expand/collapse logic

**Acceptance criteria:**
- All 5 components render as FullScreenFlow
- No `waitForSheetClose()` calls remain for these components
- No RN Modal usage for these components
- Coordinator manages all transitions

**Estimate:** Large — 5 component conversions with integration point updates.

### Phase 4: Remaining Conversions

**Goal:** Clean up the rest.

#### 4a: EditInteractionModal → FullScreenFlow
- Heavy form with multiple sub-pickers
- Convert pickers to inline selection within the flow

#### 4b: ProfileCompletionSheet → FullScreenFlow
- Onboarding flow, multi-step

#### 4c: LinkFriendSheet, ContactDiscoverySheet, DuplicateResolverModal → FullScreenFlow
- Multi-step relationship flows

#### 4d: GroupManagerModal → FullScreenFlow
- CRUD flow with member management

#### 4e: MemoryMomentModal, PostWeaveRatingModal → StandardBottomSheet
- Convert from RN Modal/AnimatedBottomSheet to StandardBottomSheet
- Register with coordinator

#### 4f: TrophyCabinetModal, YearInMoonsModal → Routes
- Create `app/trophy-cabinet.tsx` and `app/year-in-moons.tsx` (thin wrappers)
- Move components to respective module `screens/` directories

#### 4g: MilestoneCelebration, BadgeUnlockModal → Coordinator-managed celebrations
- Keep full-screen celebration UX
- Move queue logic from uiStore badge queue to coordinator with `type: 'celebration'`

**Acceptance criteria:**
- Zero React Native `Modal` imports outside of infrastructure code
- All overlays managed by coordinator or rendered as routes
- No overlay nesting — all chains resolved

**Estimate:** Large — many components but each conversion is formulaic after Phase 3 establishes the pattern.

### Phase 5: Cleanup and Polish

**Goal:** Remove all legacy overlay code and hacks.

**Tasks:**
1. Remove `waitForSheetClose()` utility entirely
2. Remove `AnimatedBottomSheet` component (all uses migrated to StandardBottomSheet or FullScreenFlow)
3. Collapse `requestPopup`/`closePopup` into `requestOverlay`/`closeOverlay` (remove old API)
4. Remove individual boolean flags from uiStore (e.g., `isWeeklyReflectionOpen`) — coordinator's `activeOverlay.id` replaces them
5. Audit remaining `InteractionManager.runAfterInteractions` delays — remove overlay-related ones
6. Update `UIEventBus` events to use coordinator (e.g., `OPEN_WEEKLY_REFLECTION` calls `requestOverlay`)
7. Document the overlay architecture in CLAUDE.md

**Acceptance criteria:**
- No timing hacks for overlay transitions
- Single overlay state management system
- Zero React Native `Modal` imports in feature code

---

## 7. FullScreenFlow Step Transition Patterns

For components converting from sheets to flows, here's how step transitions should work:

### Pattern A: Sequential Steps (PlanWizard, WeeklyReflection)
```
Step 1 → Step 2 → Step 3 → [Complete/Close]
  ←back   ←back   ←back
```
- `currentStep` increments/decrements
- Back button visible on steps 1+
- Close (X) always available, triggers `hasUnsavedChanges` check
- Final step has "Done" / "Save" action

### Pattern B: Branching Steps (GuidedReflection)
```
TopicSelection → Freeform Writing  → Receipt
              → Prompted Reflection → Receipt
```
- Step count is dynamic based on branch
- Progress indicator shows current position in chosen branch
- Back navigates within the branch

### Pattern C: Mode-Based (Oracle)
```
[Mode Selection] → Consultation Mode
                → Go Deeper Mode
                → Plan Next Steps Mode
```
- No linear step count
- Back returns to mode selection or closes
- Internal mode state replaces step counter

---

## 8. Coordinator Integration with UIEventBus

Services and notification handlers currently use UIEventBus to open overlays. Update these to work with the coordinator:

```typescript
// Current
UIEventBus.emit({ type: 'OPEN_WEEKLY_REFLECTION' });

// New (in GlobalModals subscriber)
case 'OPEN_WEEKLY_REFLECTION':
  requestOverlay({
    id: 'weekly-reflection',
    type: 'flow',
    priority: 40,
    component: 'WeeklyReflectionFlow',
  });
  break;
```

The UIEventBus itself doesn't change — only the handler in GlobalModals routes through the coordinator instead of directly setting uiStore booleans.

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| FullScreenFlow feel different from sheets | Users notice the UX shift | Match entry/exit animation to sheet timing. Keep the same spring config. Test with users |
| Coordinator queue feels slow | 300ms delay between overlays is perceptible | Tune delay. Consider 200ms. Allow 0ms for same-type replacements |
| Large migration surface area | Regression risk across 66 components | Phase 3 proves the pattern on 5 high-impact components before Phase 4 applies it everywhere |
| FriendSelector/DateTimePicker inline in flows | These pickers are reused across 10+ flows | Build them as embeddable components (not overlays) that work inside FullScreenFlow |
| Coordinator complexity | More state to manage than current approach | Keep it simple — just a queue with priority. No sagas, no state machines |

---

## 10. First Tickets

| # | Title | Phase | Size |
|---|---|---|---|
| OVR-001 | Define OverlayRequest types and coordinator state in uiStore | 1 | S |
| OVR-002 | Implement requestOverlay/closeOverlay with queue and priority | 1 | M |
| OVR-003 | Migrate JournalEntryDetailSheet actions to coordinator | 1 | S |
| OVR-004 | Build FullScreenFlow component | 2 | M |
| OVR-005 | Convert PlanWizard to FullScreenFlow | 3 | M |
| OVR-006 | Convert WeeklyReflectionModal to FullScreenFlow | 3 | L |
| OVR-007 | Convert GuidedReflectionSheet to FullScreenFlow | 3 | M |
| OVR-008 | Convert OracleSheet to FullScreenFlow | 3 | L |
| OVR-009 | Convert JournalEntryModal to FullScreenFlow | 3 | M |
| OVR-010 | Migrate remaining multi-step overlays (Phase 4 batch) | 4 | XL |
| OVR-011 | Convert TrophyCabinet and YearInMoons to routes | 4 | S |
| OVR-012 | Remove AnimatedBottomSheet, waitForSheetClose, legacy popup API | 5 | M |
