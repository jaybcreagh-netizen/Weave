# AI Implementation Prompt: Relationship Predictions Integration

## Task Summary
Integrate existing relationship prediction intelligence into the Weave UI by enhancing existing components (no new widgets). All prediction logic already exists in `src/modules/insights/services/` - this task is about **surfacing** that intelligence intelligently.

---

## Full Implementation Request

Please implement the **Relationship Predictions Integration** feature for the Weave app according to the comprehensive design document in `PREDICTION_INTEGRATION.md`.

### Context
- This is a React Native (Expo) app using TypeScript, WatermelonDB, and NativeWind
- All prediction logic **already exists** in `src/modules/insights/services/prediction.service.ts` and `src/modules/insights/services/pattern-detection.service.ts`
- The Friend model already tracks `typicalIntervalDays` and `toleranceWindowDays` (v21 migration)
- Current suggestion system is in `src/modules/interactions/services/suggestion-engine.service.ts`

### Implementation Requirements

#### Phase 1: Core Pattern Integration (Required)

**Task 1: Create Pattern Analysis Hook**
- Create `src/modules/insights/hooks/useFriendPattern.ts`
- Hook should accept `friendId` and return pattern data with loading state
- Query last 90 days of completed interactions
- Use existing `analyzeInteractionPattern()` function
- Subscribe to interaction changes for reactivity
- Export from `src/modules/insights/index.ts`

**Task 2: Create PatternBadge Component**
- Create `src/components/PatternBadge.tsx`
- Small badge showing "Usually Xd · Yd ago"
- Only shows when pattern is reliable (3+ interactions, 60%+ consistency)
- Color-coded: green (on track), yellow (approaching overdue), red (overdue)
- Uses `useFriendPattern` hook

**Task 3: Enhance TodaysFocusWidget with Pattern Context**
- Modify `src/components/home/widgets/TodaysFocusWidget.tsx`
- Import pattern analysis functions from insights module
- Update `fadingFriend` state to include pattern data
- Modify fading friend detection to load patterns (line ~263)
- Enhance `getFadingMessage()` to use pattern context when reliable (line ~153)
- Pass pattern to FriendFadingCard render (line ~982)

**Task 4: Add Pattern Badge to Friend Profile**
- Modify `app/friend-profile.tsx`
- Import PatternBadge component
- Add badge below friend name in header section (around line ~200-250)
- Style: `<PatternBadge friend={friend} style={{ marginTop: 8 }} />`

#### Phase 2: Network Intelligence (Optional but Recommended)

**Task 5: Verify Suggestions Integration**
- Review `src/modules/interactions/services/suggestion-engine.service.ts`
- Ensure pattern analysis is happening in `generateSuggestion()` function (line ~467)
- Verify pattern context is included in suggestion subtitles (lines 595-597, 630-633)
- This should already be working - just verify and test

**Task 6: Add Network Health Forecast Banner**
- Modify `app/_home.tsx` (Insights tab screen)
- Import `forecastNetworkHealth` from insights module
- Add state for network forecast (7-day lookahead)
- Add small banner at top showing "X friends will need attention this week"
- Banner should be subtle, color-coded, and dismissible
- Only show if friends are predicted to need attention

### Implementation Guidelines

**DO:**
- ✅ Follow existing TypeScript patterns in the codebase
- ✅ Use WatermelonDB observables for reactivity
- ✅ Add proper error handling and loading states
- ✅ Use existing theme colors via `useTheme()` hook
- ✅ Follow NativeWind styling patterns
- ✅ Add TypeScript types for all new functions
- ✅ Clean up subscriptions in useEffect cleanup
- ✅ Cache expensive pattern calculations
- ✅ Only show patterns when reliable (3+ interactions, 60%+ consistency)

**DON'T:**
- ❌ Create new widgets or major UI components
- ❌ Modify database schema (everything needed already exists)
- ❌ Change existing prediction logic in services layer
- ❌ Use `any` types (use proper TypeScript types)
- ❌ Add console.log statements (use console.error only for errors)
- ❌ Include planned/future interactions in pattern analysis (only completed)
- ❌ Make UI cluttered - enhancements should be subtle and helpful

### File Structure
```
src/
├── modules/insights/
│   ├── hooks/
│   │   └── useFriendPattern.ts         ← NEW
│   └── services/
│       ├── prediction.service.ts        ← EXISTS (use this)
│       └── pattern-detection.service.ts ← EXISTS (use this)
├── components/
│   ├── PatternBadge.tsx                 ← NEW
│   └── home/widgets/
│       └── TodaysFocusWidget.tsx        ← MODIFY
app/
├── friend-profile.tsx                   ← MODIFY
└── _home.tsx                            ← MODIFY (optional)
```

### Testing Requirements
After implementation, test:
1. Pattern badge appears on friend with 3+ interactions
2. Pattern badge color changes based on days since last interaction
3. TodaysFocusWidget messages include "Usually Xd" context when pattern exists
4. Network forecast banner shows on Insights tab (if implemented)
5. No performance degradation (patterns should be cached)
6. Loading states work correctly
7. No crashes when friend has 0 interactions

### Success Criteria
- [ ] PatternBadge component created and exported
- [ ] useFriendPattern hook created and exported
- [ ] TodaysFocusWidget shows pattern-aware messages for fading friends
- [ ] Pattern badge appears on friend profiles with reliable patterns
- [ ] Network forecast banner displays on Insights tab (optional)
- [ ] No TypeScript errors
- [ ] No new warnings in console
- [ ] All existing tests still pass
- [ ] New code follows existing patterns and conventions

### Key Existing Functions to Use
```typescript
// From src/modules/insights/services/pattern.service.ts
analyzeInteractionPattern(interactions) → FriendshipPattern

// From src/modules/insights/services/prediction.service.ts
predictFriendDrift(friend, pattern?) → FriendPrediction
generateProactiveSuggestions(friend, pattern?) → ProactiveSuggestion[]
forecastNetworkHealth(friends, daysAhead) → { currentHealth, forecastedHealth, ... }

// Helper functions
isPatternReliable(pattern) → boolean
getPatternDescription(pattern) → string
calculateToleranceWindow(pattern) → number
```

### Important Notes
1. **Performance:** Pattern calculation can be expensive. Cache results.
2. **Reliability:** Only show pattern info when `sampleSize >= 3` and `consistency >= 0.6`
3. **Date Handling:** Use `date-fns` for all date operations (already imported)
4. **Reactivity:** Use WatermelonDB `.observe()` to update on data changes
5. **Edge Cases:** Handle friends with 0 interactions gracefully (no pattern badge)

---

## Reference Documentation
Read `PREDICTION_INTEGRATION.md` for:
- Detailed implementation specs for each task
- Code examples with line numbers
- Architecture diagrams
- TypeScript type definitions
- Troubleshooting guide
- Testing requirements

---

## Output Requirements
When complete, provide:
1. Summary of changes made
2. List of files created/modified
3. Any deviations from the spec with justification
4. Testing recommendations
5. Known limitations or edge cases

---

**Priority:** Phase 1 (Tasks 1-4) is required. Phase 2 (Tasks 5-6) is optional but recommended.

**Estimated Effort:** 3-4 hours for Phase 1, +1 hour for Phase 2

**Start Implementation Now.**
