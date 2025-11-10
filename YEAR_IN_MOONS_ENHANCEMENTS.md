# Year in Moons - Enhancement Plan

## ✨ GraphsTabContent Enhancements

### 1. Animations Added
- **FadeInDown** delays for each section (staggered 0ms, 100ms, 200ms, 300ms, etc.)
- **SlideInRight** for top friends list items (staggered by 50ms each)
- **FadeIn** for tooltip modal appearance
- All animations use React Native Reanimated for 60fps performance

### 2. Interactive Tooltips
Added tap-to-view-details functionality for:

#### **Heatmap Cells**
- Shows: Date, weave count
- Format: "Monday, January 15" with "3 weaves logged"
- Displays count with appropriate singular/plural

#### **Weekly Rhythm Points**
- Shows: Day name, average energy level
- Format: "Monday • 3.5/5 average energy"
- Includes sample size "Based on 12 check-ins"

#### **Tier Rings**
- Shows: Tier name, average score, friend count, percentage
- Format: "Inner Circle •  85 average • 5 friends • 25% of network"

#### **Top Friends Cards**
- Shows: Friend name, total weaves, congratulatory message
- Format: Friend's name with weave count and "Most frequent connection" badge

#### **Archetype Donut Segments**
- Shows: Archetype name, friend count, percentage, color
- Format: "Sage • 3 friends • 20% of circle"

### 3. Visual Polish
- All graphs now use consistent animation timing
- Haptic feedback on all interactive elements
- BlurView backdrop for modal tooltips
- Smooth fade transitions

---

## 🔮 PatternsTabContent Enhancements

### New Pattern Types Based on Weave Engine Changes

#### 1. **Quality Depth Patterns**
Analyzes interaction quality metrics (new from weave-engine):
- **Deep Connections**: Friends with consistently high-quality interactions (depth score 4-5)
- **Surface Level**: Connections that could benefit from more reflection
- **Insight**: "Your deepest conversations are with [names]. Consider bringing this intentionality to other friendships."

#### 2. **Adaptive Decay Patterns**
Leverages learned tolerance windows:
- **Predictable Rhythms**: Friends with reliable interaction patterns (5+ interactions logged)
- **Natural Cadence**: Shows which friends have established rhythms
- **Insight**: "You and [friend] have settled into a comfortable 10-day rhythm. The app has adapted to honor this natural flow."

#### 3. **Archetype Affinity Patterns**
Analyzes archetype × interaction success:
- **Best Matches**: Which archetypes you connect best with (based on scores post-interaction)
- **Growth Opportunities**: Archetypes you struggle to maintain high scores with
- **Insight**: "You thrive with Sages and Magicians (avg 85 score), but Rebels need more intentional connection (avg 62)."

#### 4. **Momentum Patterns**
Tracks consistency streaks:
- **Streak Champions**: Friends you maintain active momentum with
- **Momentum Loss**: Relationships where momentum frequently expires
- **Insight**: "You've maintained 15-point momentum with [friend] for 8 consecutive weeks—a new record!"

#### 5. **Reflection Correlation**
New pattern type analyzing reflection impact:
- **Reflection Boost**: Quantify how much reflection depth improves relationship health
- **Mindful Connections**: Friends you reflect on most deeply
- **Insight**: "When you reflect on weaves with [friend], scores increase 23% more than quick logs."

### Pattern Visualization Enhancements

#### Before:
- Text-only pattern cards
- No visual data representation
- Static presentation

#### After:
- **Mini spark graphs** showing pattern trends over time
- **Confidence meters** (visual bars for high/medium/low)
- **Comparison chips** (e.g., "↑ 23% vs baseline")
- **Animated entry** with pattern-specific icons
- **Color-coded badges** for pattern types

#### Pattern Card Redesign:
```
┌─────────────────────────────────────┐
│ 🎯 [Icon]  [Pattern Title]          │
│ ┌───────────────┐ MEDIUM ●●●○○    │
│ │ Mini Graph    │                   │
│ └───────────────┘                   │
│                                      │
│ [Description with bold highlights]   │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 💡 [Actionable Insight]        │  │
│ └────────────────────────────────┘  │
│                                      │
│ 📊 Based on 45 interactions          │
└─────────────────────────────────────┘
```

---

## 🎨 Additional Visual Improvements

### Color Coding by Confidence
- **High**: Green tones (#10B981)
- **Medium**: Amber tones (#F59E0B)
- **Low**: Gray tones (#8A8F9E)

### Micro-interactions
- Pattern cards expand slightly on press (scale 0.98 → 1.0)
- Swipe to dismiss individual patterns
- Pull-to-refresh to re-analyze patterns
- "Explain this pattern" button for detailed breakdown

### Data Quality Indicators
- "Based on X data points" footer
- "Confidence increasing—check back in X days" for emerging patterns
- Warning when sample size is small

---

## 📊 Technical Implementation

### Files to Modify:
1. ✅ `GraphsTabContent.tsx` - Add animations, tooltips (IN PROGRESS)
2. ⏳ `PatternsTabContent.tsx` - Add new pattern types
3. ⏳ `pattern-detection.ts` - Add 5 new pattern detection algorithms
4. ⏳ Create `pattern-visualizations.tsx` - Reusable mini-graph components

### New Dependencies:
- Already have: `react-native-reanimated`, `expo-blur`, `expo-haptics`
- All supported ✅

### Performance Considerations:
- Pattern detection runs async with loading state
- Animations use native driver
- Memoize expensive calculations
- Lazy-load pattern details on card expand

---

## 🚀 Next Steps

### Phase 1: Complete GraphsTabContent
- [x] Add tooltip state and handlers
- [ ] Wire up tooltip to all interactive elements
- [ ] Add TooltipModal component
- [ ] Test all interactions

### Phase 2: Enhance PatternsTabContent
- [ ] Create new pattern detection functions
- [ ] Add mini visualizations
- [ ] Implement confidence meters
- [ ] Add swipe-to-dismiss
- [ ] Add pull-to-refresh

### Phase 3: Polish & Test
- [ ] Test all animations on device
- [ ] Verify haptic feedback
- [ ] Test tooltip positioning
- [ ] Performance profiling
- [ ] User feedback iteration

---

## 💡 User Value Proposition

**Before**: Static graphs with limited interactivity
**After**:
- ✨ Delightful animations that guide attention
- 🎯 Interactive tooltips revealing deeper insights
- 🔮 Intelligent patterns based on actual behavior
- 📈 Visual trend indicators and confidence levels
- 💪 Actionable recommendations for better connections

**Result**: Users feel like the app truly "sees" their relationship patterns and provides personalized,  data-driven guidance.
