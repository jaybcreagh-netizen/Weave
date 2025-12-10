# Bottom Sheet Migration Plan

This document outlines the systematic migration of all modal/sheet components to use the standardized `StandardBottomSheet` or `AnimatedBottomSheet` components.

## Overview

**Goal**: Consistent, smooth bottom sheet animations across the entire app.

**New Components**:
- `StandardBottomSheet` - Uses @gorhom/bottom-sheet (recommended for most cases)
- `AnimatedBottomSheet` - Uses Reanimated directly (for custom animation control)

**Height Variants**:
| Variant | Height | Use Case |
|---------|--------|----------|
| `action` | 35% | Quick choices, 2-3 options |
| `form` | 65% | Forms, selectors, moderate content |
| `full` | 90% | Complex content, scrollable lists |

---

## Migration Phases

### Phase 1: Already Using CustomBottomSheet (Low Risk)
These components already use @gorhom/bottom-sheet, so migration is straightforward.

| Component | File | Current | Target | Height |
|-----------|------|---------|--------|--------|
| SettingsModal | `src/components/settings-modal.tsx` | CustomBottomSheet | StandardBottomSheet | `full` |
| TierFitBottomSheet | `src/modules/insights/components/TierFitBottomSheet.tsx` | CustomBottomSheet | StandardBottomSheet | `form` |
| GroupListModal | `src/components/groups/GroupListModal.tsx` | CustomBottomSheet | StandardBottomSheet | `form` |
| LifeEventModal | `src/components/LifeEventModal.tsx` | CustomBottomSheet | StandardBottomSheet | `form` |
| FriendSelector | `src/components/FriendSelector.tsx` | CustomBottomSheet | StandardBottomSheet | `full` |

**Migration Steps**:
1. Import `StandardBottomSheet` from `@/shared/ui/Sheet`
2. Replace `CustomBottomSheet` with `StandardBottomSheet`
3. Map `snapPoints={['90%']}` to `height="full"` (etc.)
4. Remove `scrollable` prop if using default, otherwise keep it
5. Test gesture and animation behavior

---

### Phase 2: Hand-Rolled Animated Sheets (Medium Risk)
These use custom Reanimated animations. Migration requires replacing animation code.

| Component | File | Current Height | Target | Height |
|-----------|------|----------------|--------|--------|
| SocialBatterySheet | `src/components/home/SocialBatterySheet.tsx` | 50vh | AnimatedBottomSheet | `form` |
| MicroReflectionSheet | `src/components/MicroReflectionSheet.tsx` | 85% | AnimatedBottomSheet | `full` |
| IntentionActionSheet | `src/components/IntentionActionSheet.tsx` | 280px fixed | AnimatedBottomSheet | `action` |
| PostWeaveRatingModal | `src/modules/interactions/components/PostWeaveRatingModal.tsx` | auto | AnimatedBottomSheet | `form` |

**Migration Steps**:
1. Import `AnimatedBottomSheet` from `@/shared/ui/Sheet`
2. Remove local animation state (`useSharedValue`, `useAnimatedStyle`)
3. Remove custom backdrop implementation
4. Keep content/form logic, wrap in `AnimatedBottomSheet`
5. Use `onCloseComplete` for cleanup logic if needed
6. Test animation timing and keyboard behavior

---

### Phase 3: React Native Modal Components (Higher Risk)
These use `Modal` with `animationType="slide"`. Need full replacement.

| Component | File | Target | Height |
|-----------|------|--------|--------|
| YearInMoonsModal | `src/components/YearInMoons/YearInMoonsModal.tsx` | StandardBottomSheet | `full` |
| TrophyCabinetModal | `src/components/TrophyCabinetModal.tsx` | StandardBottomSheet | `full` |
| IntentionFormModal | `src/components/IntentionFormModal.tsx` | StandardBottomSheet | `form` |
| GroupManagerModal | `src/components/groups/GroupManagerModal.tsx` | StandardBottomSheet | `form` |
| EditInteractionModal | `src/components/EditInteractionModal.tsx` | StandardBottomSheet | `full` |
| EditReflectionModal | `src/components/EditReflectionModal.tsx` | StandardBottomSheet | `form` |
| InteractionDetailModal | `src/components/friend-profile/InteractionDetailModal.tsx` | StandardBottomSheet | `form` |
| PlanChoiceModal | `src/components/PlanChoiceModal.tsx` | StandardBottomSheet | `action` |
| ArchetypeLibrary | `src/components/ArchetypeLibrary.tsx` | StandardBottomSheet | `full` |
| FriendManagementModal | `src/components/FriendManagementModal.tsx` | StandardBottomSheet | `full` |

**Migration Steps**:
1. Replace `Modal` with `StandardBottomSheet`
2. Remove `animationType`, `presentationStyle` props
3. Map `visible` to `visible`, `onRequestClose` to `onClose`
4. Wrap content in appropriate layout (may need to adjust padding)
5. Test on both iOS and Android

---

### Phase 4: Weave Logger Sub-components
These are pickers/selectors within the Weave Logger flow.

| Component | File | Target | Height |
|-----------|------|--------|--------|
| CustomCalendar | `src/components/weave-logger/CustomCalendar.tsx` | StandardBottomSheet | `form` |
| ReciprocitySelector | `src/components/weave-logger/ReciprocitySelector.tsx` | AnimatedBottomSheet | `action` |
| MoonPhaseSelector (if modal) | `src/components/MoonPhaseSelector.tsx` | AnimatedBottomSheet | `action` |

---

### Phase 5: Journal Components

| Component | File | Target | Height |
|-----------|------|--------|--------|
| QuickCaptureSheet | `src/components/journal/QuickCaptureSheet.tsx` | AnimatedBottomSheet | `form` |
| GuidedReflectionModal | `src/components/journal/GuidedReflectionModal.tsx` | StandardBottomSheet | `full` |
| JournalEntryModal | `src/components/journal/JournalEntryModal.tsx` | StandardBottomSheet | `full` |
| WeeklyReflectionDetailModal | TBD | StandardBottomSheet | `full` |

---

### Phase 6: Special Cases (Evaluate Case-by-Case)

These require careful evaluation - they may have unique requirements.

| Component | File | Decision |
|-----------|------|----------|
| QuickWeaveOverlay | `src/modules/interactions/components/QuickWeaveOverlay.tsx` | **KEEP AS-IS** - Radial menu is a unique interaction |
| MilestoneCelebration | `src/components/MilestoneCelebration.tsx` | **KEEP AS-IS** - Full-screen celebration animation |
| CelebrationAnimation | `src/components/CelebrationAnimation.tsx` | **KEEP AS-IS** - Particle overlay |
| WeeklyReflectionModal | TBD | **EVALUATE** - Complex multi-step flow |
| PlanWizard | `src/components/PlanWizard.tsx` | **EVALUATE** - Multi-step wizard |
| BadgeUnlockModal | `src/components/BadgeUnlockModal.tsx` | **KEEP AS-IS** - Top drawer notification, different pattern |
| DigestSheet | TBD | AnimatedBottomSheet | `form` |

---

## Migration Priority Order

1. **Start with Phase 1** - Low risk, validates the new components work
2. **Then Phase 2** - High-traffic components, biggest UX impact
3. **Then Phase 3** - Largest batch, systematic replacement
4. **Then Phase 4-5** - Secondary flows
5. **Evaluate Phase 6** - Case-by-case decisions

---

## Testing Checklist

For each migrated component, verify:

- [ ] Sheet opens with smooth slide-up animation
- [ ] Sheet closes with smooth slide-down animation
- [ ] Backdrop fades in/out correctly
- [ ] Tapping backdrop closes sheet
- [ ] Swipe-down gesture closes sheet (if enabled)
- [ ] Keyboard avoidance works correctly
- [ ] Content scrolls properly (if scrollable)
- [ ] Close button works
- [ ] Form state is preserved during keyboard show/hide
- [ ] Works on both iOS and Android

---

## Rollback Plan

If issues arise:
1. The old `CustomBottomSheet` is still exported as a legacy component
2. Each migration can be reverted independently
3. Keep migration PRs small and focused (one phase at a time)

---

## Success Metrics

After migration is complete:
- All sheets use consistent spring animation (damping: 28, stiffness: 220)
- All sheets have consistent border radius (24px)
- All sheets have consistent backdrop opacity (0.5)
- No more direct `Modal` usage for sheet-style UIs
- Reduced code duplication (no more hand-rolled animations)
