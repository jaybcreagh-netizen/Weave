# Reflection System: Integrated Roadmap

## Where We Are Now

**Existing Roadmap (from FEATURE_ROADMAP.md):**
- ✅ Sprint 1-2: Post-Weave Reflection & Editing (Foundation)
- Sprint 3-4: Weekly Reflection Ritual
- Sprint 5-6: Context-Aware Suggestions
- Sprint 7-8: Life Events System
- Sprint 9-10: Calendar Sync

**Design Work Completed:**
1. ✅ WEAVE_REFLECTION_DESIGN.md - Original philosophy and psychology
2. ✅ ARCHETYPE_REFLECTION_PROMPTS.md - Corrected archetypes + prompts
3. ✅ INTERACTION_SYSTEM_REDESIGN.md - Simplified 8-type system
4. ✅ DEEP_WEAVE_SYSTEM.md - NLP + structured depth (no hashtags)

---

## Updated Implementation Plan

### Phase 1: Foundation (Weeks 1-3)
**Goal:** Simplify logging + add basic reflection

This combines:
- Simplified interaction types (from INTERACTION_SYSTEM_REDESIGN.md)
- Basic reflection prompts (from DEEP_WEAVE_SYSTEM.md)
- Schema changes (from original roadmap)

#### Week 1: Interaction System Redesign

**What we're building:**
- Replace Mode → Activity with single Type selection
- 8 universal types instead of 6 modes × 36 activities
- Cleaner, faster logging

**Tasks:**
- [ ] Design new interaction type selector UI
- [ ] Update schema: Replace `mode` field with `interaction_type`
- [ ] Create migration script (old mode+activity → new type)
- [ ] Update InteractionModel
- [ ] Rebuild interaction form with new flow
- [ ] Update weave engine scoring for new types
- [ ] Test migration with existing data

**Deliverable:** Users can log using 8 clear types (💬 Text/Call, 🍽️ Meal/Drink, etc.)

---

#### Week 2: Basic Reflection Prompts

**What we're building:**
- Archetype-aware prompts in manual logging
- Replace generic "Notes..." with contextual questions
- No Deep Weave yet - just smarter basic prompts

**Tasks:**
- [ ] Create `reflectionPrompts.ts` utility
- [ ] Build prompt library (8 types × 7 archetypes = 56 prompts)
- [ ] Create `ContextualReflectionInput` component
- [ ] Integrate into interaction form
- [ ] Add vibe-aware prompt variations
- [ ] Test all archetype combinations

**Example:**
```
Instead of: "Notes..."

Show: "What did you talk about over coffee?"
(For Meal/Drink + High Priestess: "What truth emerged over your meal?")
```

**Deliverable:** Smart prompts that guide meaningful reflection

---

#### Week 3: Quick-Touch Micro-Reflection

**What we're building:**
- Gentle follow-up after radial menu logging
- Optional 2-second delay → "How did that feel?"
- Single question + optional vibe

**Tasks:**
- [ ] Create `MicroReflectionSheet` component
- [ ] Integrate with CardGestureContext
- [ ] Add 2-second delay trigger
- [ ] Test skip/capture flow
- [ ] Add optional vibe selection after capture
- [ ] Polish animations

**Deliverable:** Quick-touch logs can capture depth without friction

---

### Phase 2: Deep Weave (Weeks 4-5)
**Goal:** Add optional structured depth for meaningful moments

**What we're building:**
- NLP detection of meaningful reflections
- Gentle "capture the depth?" prompt when detected
- Structured Deep Weave form with dimensions
- Context-based scoring multipliers

#### Week 4: NLP Context Detection

**Tasks:**
- [ ] Build `ContextDetector` class
- [ ] Implement depth detection patterns
- [ ] Implement emotional tone detection
- [ ] Implement vulnerability scoring
- [ ] Add context_signals to schema
- [ ] Test detection accuracy
- [ ] Integrate with scoring system

**Pattern Detection:**
```typescript
"opened up" → depth=profound, vulnerability=0.8
"laughed so hard" → tone=joyful, playfulness=0.9
"first time trying" → novelty=novel
```

**Deliverable:** System understands reflection meaning without user effort

---

#### Week 5: Deep Weave Form

**Tasks:**
- [ ] Design Deep Weave prompt trigger
- [ ] Create `DeepWeaveForm` component
- [ ] Build dimension selectors (Conversation, Energy, Connection)
- [ ] Add archetype-specific dimension options
- [ ] Implement multi-step progressive disclosure
- [ ] Add "memorable moment" capture
- [ ] Save deep_weave_data to schema
- [ ] Calculate Deep Weave scoring bonuses

**Deliverable:** Optional rich capture for peak moments

---

### Phase 3: Insights & Editing (Week 6)
**Goal:** Surface patterns + allow retrospection

**What we're building:**
- Edit past reflections with retrospective prompts
- Pattern recognition in friend profiles
- Peak moments highlighting

#### Week 6: Patterns & Editing

**Tasks:**
- [ ] Add "Reflect" button to InteractionDetailModal
- [ ] Create `ReflectionEditor` component
- [ ] Build pattern analysis for friend profiles
- [ ] Create `FriendshipPattern` display component
- [ ] Show "Peak Moments" in timeline
- [ ] Add "Your connection thrives on..." insights
- [ ] Test editing flow

**Deliverable:** Users can add depth later + see relationship patterns

---

## How This Fits the Original Roadmap

### Original Sprint 1-2: Post-Weave Reflection & Editing
**Now becomes Phases 1-3 (Weeks 1-6):**

**Why longer?**
- We're also redesigning the core interaction system (not just adding reflection)
- Adding NLP intelligence (more sophisticated than originally planned)
- Building Deep Weave structured form (richer than basic reflection)

**Original scope:**
- Schema changes ✅
- Edit interaction flow ✅
- Reflection prompt after quick-touch ✅

**Enhanced scope:**
- Simplified 8-type system (reduces cognitive load)
- Archetype-aware contextual prompts (smarter)
- NLP context detection (invisible intelligence)
- Deep Weave optional depth (for peak moments)
- Pattern recognition (insights over time)

---

### What Stays the Same

**Sprint 3-4: Weekly Reflection Ritual** (Weeks 7-9)
- No changes needed
- This already designed in original roadmap
- Builds on reflection foundation we're creating

**Sprint 5-6: Context-Aware Suggestions** (Weeks 10-12)
- Enhanced by pattern data from Deep Weave
- Suggestions can reference detected patterns:
  - "You and Sarah have deep talks over coffee - invite her?"

**Sprint 7-8: Life Events** (Weeks 13-14)
- No changes needed

**Sprint 9-10: Calendar Sync** (Weeks 15-17)
- No changes needed

---

## Updated Timeline Visual

```
PHASE 1: FOUNDATION (Weeks 1-3)
├─ Week 1: Simplify Interaction Types ▓▓▓▓▓▓▓
├─ Week 2: Basic Contextual Prompts  ▓▓▓▓▓▓▓
└─ Week 3: Micro-Reflection          ▓▓▓▓▓▓▓

PHASE 2: DEEP WEAVE (Weeks 4-5)
├─ Week 4: NLP Context Detection     ▓▓▓▓▓▓▓
└─ Week 5: Deep Weave Form           ▓▓▓▓▓▓▓

PHASE 3: INSIGHTS (Week 6)
└─ Week 6: Patterns & Editing        ▓▓▓▓▓▓▓

[Original Roadmap Continues]
PHASE 4: WEEKLY RITUAL (Weeks 7-9)   ░░░░░░░
PHASE 5: SUGGESTIONS (Weeks 10-12)   ░░░░░░░
PHASE 6: LIFE EVENTS (Weeks 13-14)   ░░░░░░░
PHASE 7: CALENDAR SYNC (Weeks 15-17) ░░░░░░░
```

---

## What We're NOT Building (Yet)

### Defer to Future:
- **Voice memos** - Audio reflections (cool, but not essential)
- **Emotion tags UI** - NLP handles this invisibly
- **Reflection timeline view** - Can wait until we have more data
- **AI summaries** - Way future, needs API integration
- **Share reflections** - Social features come later

### Why defer?
Focus on core value:
1. ✅ Make logging easy and meaningful
2. ✅ Capture depth without friction
3. ✅ Surface patterns that matter

Extra features can wait until core is solid.

---

## Decision Points

### Week 1 Decision: Migration Strategy

**Question:** How to migrate existing data?

**Options:**
1. **Automatic migration** - Map old mode+activity → new types
2. **User review** - Show migration, let users adjust
3. **Fresh start** - Archive old, start new system

**Recommendation:** Option 1 (automatic) with logging
- Most seamless for users
- Can always add manual review later if issues arise

**Migration Map:**
```typescript
'one-on-one + Coffee' → 'meal-drink'
'one-on-one + Walk' → 'hangout'
'one-on-one + Chat' → 'deep-talk' (if note suggests depth)
'celebration + Birthday' → 'celebration'
'quick-touch + Text' → 'text-call'
// etc.
```

---

### Week 4 Decision: NLP Accuracy Threshold

**Question:** How confident does NLP need to be before triggering Deep Weave prompt?

**Options:**
1. **High confidence** (80%+) - Rarely triggers, very accurate
2. **Medium confidence** (60%+) - Triggers more, some false positives
3. **Low confidence** (40%+) - Triggers often, learns from user

**Recommendation:** Start with Medium (60%)
- Triggers for genuinely meaningful reflections
- Users can always skip if wrong
- Adjust based on user feedback

---

### Week 5 Decision: Deep Weave Optional vs Required

**Question:** Should Deep Weave be required for FullMoon vibes?

**Options:**
1. **Always optional** - Never force
2. **Required for FullMoon** - Ensure peak moments captured
3. **Strongly suggested** - Gentle pressure, can skip

**Recommendation:** Always optional (Option 1)
- Friction kills engagement
- Trust users to know when depth matters
- Some FullMoon moments are joyful but not deep

---

## Success Metrics (Revisited)

### Phase 1 Success (Week 3):
- **Logging speed:** Average time to log decreases by 30%
- **Reflection rate:** 50%+ of manual logs include reflection text
- **User feedback:** "New types make sense" (80%+ agree)
- **Migration success:** 95%+ of old interactions map cleanly

### Phase 2 Success (Week 5):
- **NLP accuracy:** 70%+ of detected "profound" moments are actually meaningful
- **Deep Weave adoption:** 15%+ of FullMoon vibes trigger Deep Weave completion
- **False positive rate:** <20% of Deep Weave prompts feel irrelevant
- **Scoring improvement:** Deep Weave interactions score 1.3-1.5× higher

### Phase 3 Success (Week 6):
- **Pattern accuracy:** Users recognize displayed patterns (80%+ "yes that's us")
- **Editing adoption:** 10%+ of users edit/add reflections to past weaves
- **Peak moments engagement:** Users tap peak moments to revisit (20%+ weekly)

---

## Risk Mitigation

### Risk 1: Type simplification loses nuance
**Concern:** 8 types too broad, users miss old categories

**Mitigation:**
- Deep Weave dimensions capture lost nuance
- NLP detects context from reflection text
- Add dimension: "What setting?" (home, outdoors, public, etc.)

---

### Risk 2: NLP detection inaccurate
**Concern:** False positives annoy users, false negatives miss depth

**Mitigation:**
- Start with conservative thresholds
- Easy skip on false positives
- Track accuracy, tune patterns
- Manual Deep Weave trigger always available

---

### Risk 3: Deep Weave too complex
**Concern:** Multi-step form feels like work

**Mitigation:**
- Maximum 3 screens, progressive disclosure
- Each screen optional (can save at any point)
- Visual progress indicator
- Can skip and come back later

---

### Risk 4: Migration breaks existing data
**Concern:** Users lose history or see wrong mappings

**Mitigation:**
- Comprehensive testing with real data samples
- Backup before migration
- Log all migrations for review
- Support manual correction if needed

---

## Resource Requirements

### Development Time:
- **Phase 1:** 3 weeks (1 developer)
- **Phase 2:** 2 weeks (1 developer)
- **Phase 3:** 1 week (1 developer)
- **Total:** 6 weeks for complete reflection system

### Dependencies:
- No new packages needed (maybe basic NLP library)
- Use existing: WatermelonDB, Reanimated, React Native core

### Testing:
- Unit tests for NLP detection patterns
- Integration tests for scoring calculations
- User testing after each phase
- Migration testing with real data

---

## Rollout Strategy

### Beta Testing (Week 6):
- Internal dogfooding first
- 10-20 external beta users
- Gather feedback on:
  - Type clarity
  - Prompt relevance
  - Deep Weave value
  - Pattern accuracy

### Phased Rollout (Week 7+):
- 25% of users (monitor issues)
- 50% of users (if metrics good)
- 100% rollout (if no major issues)

### Communication:
- In-app tutorial for new types
- Changelog: "Simpler logging, deeper reflection"
- Highlight: "Your weaves are now smarter"

---

## What This Achieves

By end of Week 6, users will have:

1. **Simpler Logging**
   - One-tap type selection (vs 2-step mode→activity)
   - 8 clear categories (vs confusing 36 options)
   - Faster, more intuitive

2. **Smarter Prompts**
   - Archetype-aware questions
   - Vibe-aware variations
   - Guides meaningful capture

3. **Invisible Intelligence**
   - NLP reads natural language
   - Detects depth, vulnerability, novelty
   - Adjusts scores automatically

4. **Optional Depth**
   - Deep Weave for peak moments
   - Structured dimensions when desired
   - Never required, always available

5. **Pattern Recognition**
   - "Your connection thrives on..."
   - Peak moments highlighted
   - Insights over time

6. **Retrospection**
   - Edit past reflections
   - Add depth later
   - Build relationship memoir

---

## Then What? (Week 7+)

With this foundation, the rest of the roadmap gets **easier and better**:

### Weekly Reflection (Weeks 7-9):
- Uses pattern data: "You haven't had a deep talk with Sarah in 3 weeks"
- References peak moments: "Remember that coffee conversation?"
- Suggests based on what works: "Your best connections happen over meals"

### Suggestions (Weeks 10-12):
- Powered by Deep Weave insights
- "Sarah values deep conversations - invite her for coffee?"
- "You and Marcus always laugh together - plan something fun?"

### Life Events (Weeks 13-14):
- Context detection helps: "struggled with" → suggest adding life event
- Patterns show impact: "Quality dropped after job change"

### Calendar Sync (Weeks 15-17):
- NLP helps categorize calendar events
- "Coffee with Sarah" → auto-suggests type: Meal/Drink
- Pre-fills reflection prompt

---

## Summary: The Plan

### What's Different from Original:
- **Broader scope:** Redesigning interaction system, not just adding reflection
- **More sophisticated:** NLP + Deep Weave vs basic notes
- **Slightly longer:** 6 weeks instead of 2-3 weeks

### Why It's Worth It:
- Foundation is **much stronger**
- System is **genuinely intelligent**
- User experience is **significantly better**
- Future features **work better** with this foundation

### What's the Same:
- Still prioritizing reflection/editing first
- Still focusing on user value over features
- Still iterative and user-tested
- Rest of roadmap unchanged

---

## Ready to Build?

**Immediate Next Steps (Week 1, Day 1):**

1. **Design Review** (1 day)
   - Review 8 interaction types with stakeholders
   - Finalize icon choices
   - Confirm migration strategy

2. **Schema Design** (1 day)
   - Update interactions table
   - Plan migration script
   - Write migration tests

3. **Start Building** (Day 3)
   - New interaction type selector UI
   - Migration logic
   - Updated models

**First Milestone:** Week 1 Friday - New logging system working with test data

**Ship Phase 1:** Week 3 - Simplified logging + contextual prompts live

**Ship Phase 2:** Week 5 - Deep Weave + NLP live

**Ship Phase 3:** Week 6 - Patterns + editing live

Then continue with original roadmap (Weekly Ritual, etc.)

---

## Conclusion

The reflection system design work has **evolved the original plan** in a great direction:

**From:** "Add a reflection field and some prompts"

**To:** "Intelligent relationship awareness system with invisible NLP, optional depth, and pattern recognition"

**Timeline Impact:** +3-4 weeks

**Value Impact:** 5-10× better than original plan

**Foundation Impact:** Makes everything else in roadmap stronger

**Worth it?** Absolutely.

Let's build this. 🎯
