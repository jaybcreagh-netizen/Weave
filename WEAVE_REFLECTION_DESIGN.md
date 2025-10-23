# Weave Reflection System: Design & User Journey

## Philosophy

**Core Insight:** The most meaningful relationships aren't just about *frequency* of contact—they're about *quality* of connection. Numbers tell us what happened. Reflections tell us what it **meant**.

The Weave Reflection system transforms surface-level logging into a practice of **intentional relationship awareness**—capturing the texture, emotion, and meaning of human connection.

---

## Current State Analysis

### What Works ✅
- **Quick-touch logging** via radial menu (frictionless)
- **Manual logging** captures mode, activity, date, vibe, notes
- **Moon Phase vibe** adds emotional texture
- Clean, progressive disclosure UX

### What's Missing ❌
- **No prompting for reflection** - users must remember to add notes
- **Notes field is generic** - no guidance on what to capture
- **No post-quick-touch reflection** - radial menu logs and forgets
- **No quality tracking** - can't distinguish mediocre from magical weaves
- **No prompts based on context** - same experience for coffee vs deep conversation
- **No revisiting moments** - can't easily add thoughts later

---

## Design Principles

### 1. **Gentle, Not Demanding**
- Reflection is **invited**, never required
- Easy to skip without guilt
- Feels like journaling, not homework

### 2. **Contextually Intelligent**
- Different prompts for different interaction types
- Adapts to friend's archetype
- Considers relationship state (thriving vs drifting)

### 3. **Psychology-Grounded**
Based on:
- **Gratitude journaling** (Emmons & McCullough) - focusing on what went well
- **Savoring** (Bryant & Veroff) - deepening positive experiences
- **Narrative therapy** (White & Epston) - finding meaning in stories
- **Emotional granularity** (Barrett) - precise emotion words deepen awareness

### 4. **Builds Over Time**
- Each reflection adds to a rich narrative
- Users can see patterns in their relationships
- Creates a personal "relationship memoir"

---

## User Journeys

### Journey 1: Quick-Touch → Micro-Reflection

**Scenario:** User long-presses Sarah's card, drags to "☕ Coffee", releases

**Current Flow:**
1. Toast appears: "Logged Coffee with Sarah"
2. *End*

**New Flow:**
1. Toast appears: "Logged Coffee with Sarah"
2. *After 2 seconds*, bottom sheet slides up:
   ```
   ╔════════════════════════════════════╗
   ║  ✨ How did that feel?             ║
   ║                                    ║
   ║  [Skip]              [Capture →]  ║
   ╚════════════════════════════════════╝
   ```
3. **If Skip:** Dismiss, weave saved as-is
4. **If Capture:** Expand to micro-reflection prompt

**Micro-Reflection Prompt:**
```
╔══════════════════════════════════════════╗
║  Coffee with Sarah                       ║
║  ────────────────────────────────────    ║
║                                          ║
║  What made this moment special?          ║
║  ┌────────────────────────────────────┐ ║
║  │ [Voice input or text]              │ ║
║  │                                    │ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  How did it feel? (optional)             ║
║  ⭐⭐⭐⭐⭐  [Tap to rate quality]       ║
║                                          ║
║  [Skip]                    [Save ✓]     ║
╚══════════════════════════════════════════╝
```

**Key Features:**
- **Voice input option** for hands-free capture
- **Single open-ended question** (not overwhelming)
- **Quality rating** (1-5 stars) for pattern tracking
- Takes 15 seconds max

---

### Journey 2: Manual Log → Contextual Reflection

**Scenario:** User manually logs "Deep conversation over dinner" with Alex (Intellectual archetype)

**Current Flow:**
1. Select mode: "One-on-One"
2. Select activity: "Meal"
3. Select date: "Today"
4. Select vibe: "🌕 FullMoon" (amazing)
5. Add notes: [optional generic field]
6. Save

**New Flow:**
1-4. *Same as current*
5. **Instead of generic notes**, progressive reflection questions appear:

**Step 1: Quick Capture**
```
╔══════════════════════════════════════════╗
║  Capture the Moment                      ║
║  ────────────────────────────────────    ║
║                                          ║
║  What happened? (1 sentence)             ║
║  ┌────────────────────────────────────┐ ║
║  │ "We talked about career transitions"│ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  [Save] or [Add Reflection →]           ║
╚══════════════════════════════════════════╝
```

**Step 2: Deeper Reflection** (optional, if user taps "Add Reflection")
```
╔══════════════════════════════════════════╗
║  Deepen Your Reflection                  ║
║  ────────────────────────────────────    ║
║                                          ║
║  💡 What idea from Alex most resonated?  ║
║  ┌────────────────────────────────────┐ ║
║  │                                    │ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  🌱 What did this conversation reveal?   ║
║  ┌────────────────────────────────────┐ ║
║  │                                    │ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  Quality: ⭐⭐⭐⭐⭐                      ║
║                                          ║
║  [Save ✓]                                ║
╚══════════════════════════════════════════╝
```

**Archetype-Specific Prompts:**

**Intellectual (Alex):**
- 💡 What idea from {name} most resonated with you?
- 🌱 What did this conversation reveal about life right now?

**Conversationalist:**
- 💬 What story did {name} share that stuck with you?
- ❤️ What did you learn about {name} today?

**Adventurer:**
- ⚡ What was the highlight of this experience?
- 🌄 How did this make you feel alive?

**Supporter:**
- 🤝 How did {name} show up for you (or you for them)?
- 💙 What made you feel supported in this moment?

**Collaborator:**
- 🎨 What did you create or build together?
- 🔥 What energy did this spark in you?

**Celebrator:**
- 🎉 What made this moment joyful?
- ✨ What will you remember a year from now?

---

### Journey 3: Editing Past Weaves

**Scenario:** User sees interaction in timeline, taps it, remembers something meaningful

**Current Flow:**
1. Tap interaction → Detail modal opens
2. See basic info (date, activity, notes)
3. No way to add reflection

**New Flow:**
1. Tap interaction → Detail modal opens
2. **New "Reflect" button** appears at bottom
3. Tap → Opens reflection sheet with context-aware prompts

**Edit Reflection View:**
```
╔══════════════════════════════════════════╗
║  Dinner with Alex                        ║
║  March 15, 2024 • 3 days ago            ║
║  ────────────────────────────────────    ║
║                                          ║
║  [Existing note shown here]              ║
║                                          ║
║  ┌────────────────────────────────────┐ ║
║  │ Add more thoughts...               │ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  💭 Looking back, what did this mean?    ║
║  ┌────────────────────────────────────┐ ║
║  │                                    │ ║
║  └────────────────────────────────────┘ ║
║                                          ║
║  Quality: ⭐⭐⭐⭐☆  [Tap to adjust]     ║
║                                          ║
║  [Save Changes]                          ║
╚══════════════════════════════════════════╝
```

---

## Reflection Prompt Library

### By Vibe (Moon Phase)

**🌕 FullMoon / 🌔 WaxingGibbous (Peak quality):**
- ✨ What made this moment magical?
- 💫 What will you remember about this a year from now?
- 🙏 What are you grateful for from this time together?

**🌓 FirstQuarter / 🌒 WaxingCrescent (Good, growing):**
- 🌱 What positive shift did you notice in your connection?
- ❤️ What did {name} do that made you smile?
- 💛 What felt easy and natural about this?

**🌘 WaningCrescent / 🌑 NewMoon (Challenging):**
- 🤔 What felt off or difficult?
- 🌿 What could strengthen this friendship?
- 💙 What do you need from this relationship right now?

### By Mode

**One-on-One (Depth & focus):**
- 💭 What did you learn about {name} today?
- 🎯 What vulnerable thing was shared?
- 🌟 What surprised you?

**Group Flow (Shared energy):**
- ⚡ What was the group's vibe?
- 😄 Who brought what energy to the gathering?
- 🔗 What connections deepened?

**Celebration (Marking moments):**
- 🎊 What are you celebrating about {name}?
- 📸 What image/moment do you want to remember?
- 💕 How did you honor this milestone?

**Quick Touch (Light connection):**
- 💬 What did you chat about?
- 😊 How did this brighten your day?
- 🔗 What's one thing you want to follow up on?

### By Relationship State

**Thriving (Score > 70):**
- 💚 What makes this friendship feel so strong right now?
- 🌟 How has {name} been showing up lately?
- 🙌 What do you love about how this relationship feels?

**Maintenance (40-70):**
- 🌱 What would deepen this connection?
- 💛 What does {name} bring to your life?
- 🔄 What rhythm feels right for staying connected?

**Drifting (< 40):**
- 💭 Why did you reach out today?
- 🌿 What does this friendship need right now?
- ❤️ What do you miss about being closer?

---

## Quality Rating System

### 5-Star Scale (Optional but Valuable)

**⭐ (1 star)** - Felt forced or draining
**⭐⭐ (2 stars)** - Fine, but unremarkable
**⭐⭐⭐ (3 stars)** - Good, enjoyable time
**⭐⭐⭐⭐ (4 stars)** - Really meaningful
**⭐⭐⭐⭐⭐ (5 stars)** - Deeply nourishing, peak moment

### Why Track Quality?

1. **Pattern Recognition:** Notice what activities/settings create the best connections
2. **Prioritization:** Focus energy on high-quality friendship modes
3. **Archetype Validation:** See if archetype-matched activities actually feel better
4. **Relationship Health:** Quality matters more than frequency
5. **Gratitude Practice:** Reflecting on 5-star moments builds appreciation

### Quality Over Time View

In friend profile, show:
```
Last 10 Weaves:
⭐⭐⭐⭐⭐ Dinner conversation
⭐⭐⭐⭐☆ Coffee catch-up
⭐⭐⭐☆☆ Quick text check-in
⭐⭐⭐⭐⭐ Hike together

Average Quality: 4.2 ⭐
Peak Activity: Deep conversations over meals
```

---

## Data Schema Changes

### Interactions Table Extensions

```typescript
interactions table (current):
  - interaction_date: number
  - interaction_type: string
  - duration: string (optional)
  - vibe: string (optional)
  - note: string (optional)
  - activity: string
  - status: string
  - mode: string

interactions table (new fields):
  + reflection: string (optional)          // Main reflection text
  + reflection_prompts: string[] (optional) // Which prompts were answered
  + quality_rating: number (optional)      // 1-5 stars
  + emotion_tags: string[] (optional)      // e.g., ["joyful", "deep", "easy"]
  + last_edited: number (optional)         // Timestamp of last reflection edit
  + voice_memo_url: string (optional)      // For audio reflections (future)
```

---

## UI Components Needed

### 1. `MicroReflectionSheet.tsx`
Bottom sheet for quick-touch follow-up
- Appears 2 seconds after quick-touch
- Single question + quality rating
- Voice input option
- Easy skip

### 2. `ContextualReflectionForm.tsx`
Multi-step form for manual logging
- Step 1: Quick capture (always)
- Step 2: Deep reflection (optional)
- Archetype-aware prompts
- Vibe-aware prompts

### 3. `ReflectionEditor.tsx`
For editing existing interactions
- Shows existing notes/reflection
- "Add more thoughts" field
- Retrospective prompt: "Looking back, what did this mean?"
- Quality adjustment

### 4. `QualityRatingPicker.tsx`
Interactive 5-star component
- Haptic feedback on selection
- Descriptions on long-press
- Animates on rating change

### 5. `ReflectionPromptSelector.tsx`
Smart prompt chooser
- Considers: archetype, mode, vibe, relationship state
- Returns 1-3 contextual questions
- Avoids repetition

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Schema migration (add reflection fields)
- [ ] Update Interaction model
- [ ] Create `QualityRatingPicker` component
- [ ] Add basic reflection field to manual log form

### Phase 2: Quick-Touch Enhancement (Week 1)
- [ ] Create `MicroReflectionSheet` component
- [ ] Integrate with CardGestureContext
- [ ] Add 2-second delay trigger after quick-touch
- [ ] Implement skip/capture flow

### Phase 3: Contextual Prompts (Week 2)
- [ ] Build prompt library (archetype + mode + vibe)
- [ ] Create `ReflectionPromptSelector` utility
- [ ] Integrate prompts into manual log form
- [ ] Create `ContextualReflectionForm` component

### Phase 4: Editing & Retrospection (Week 2)
- [ ] Add "Reflect" button to InteractionDetailModal
- [ ] Create `ReflectionEditor` component
- [ ] Support editing past reflections
- [ ] Add "last_edited" timestamp tracking

### Phase 5: Quality Insights (Week 3)
- [ ] Create quality analytics in friend profile
- [ ] "Peak moments" timeline filter
- [ ] Quality trends visualization
- [ ] Archetype-quality correlation insights

---

## Success Metrics

### Adoption Metrics
- **% of quick-touches with reflection** (Goal: 40%+)
- **% of manual logs with reflection** (Goal: 70%+)
- **Avg reflection length** (Goal: 20+ words)
- **% of weaves with quality rating** (Goal: 60%+)

### Engagement Metrics
- **Reflections edited later** (Goal: 15%+)
- **Time spent on reflection** (Goal: 30 sec avg)
- **Users returning to read reflections** (Goal: 50%+ weekly)

### Quality Metrics
- **Average quality rating** (Baseline: establish)
- **Correlation: quality × archetype match** (Expect: positive)
- **User-reported value** ("Reflections make this meaningful")

---

## Example: Full Journey Walkthrough

**Scenario:** Emma has coffee with her friend Jordan (Conversationalist archetype), scores 72 (healthy)

### Step 1: Quick-Touch Log
Emma long-presses Jordan's card → drags to ☕ Coffee → releases
- Toast: "Logged Coffee with Jordan"

### Step 2: Micro-Reflection Prompt (2 sec later)
Bottom sheet slides up:
```
✨ How did that feel?

[Skip]              [Capture →]
```

Emma taps **Capture →**

### Step 3: Micro-Reflection
```
Coffee with Jordan
────────────────────

What made this moment special?
┌─────────────────────────────┐
│ Jordan opened up about her  │
│ relationship struggles - we │
│ talked for 2 hours!         │
└─────────────────────────────┘

How did it feel?
⭐⭐⭐⭐⭐  [taps 5 stars]

[Skip]                [Save ✓]
```

Emma taps **Save ✓**

### Step 4: Saved!
- Weave Score: +12 points (coffee × 2hr duration × full moon vibe × 5-star quality bonus)
- Toast: "Reflection saved 💚"

### 3 Days Later: Emma Reviews

Emma opens Jordan's profile → taps the coffee interaction

**Detail Modal shows:**
```
☕ Coffee with Jordan
March 15, 2024

────────────────────

Your Reflection:
"Jordan opened up about her relationship struggles -
we talked for 2 hours!"

Quality: ⭐⭐⭐⭐⭐

[Edit Reflection]  [Share Memory]
```

Emma taps **Edit Reflection**

```
Add more thoughts...
┌─────────────────────────────┐
│ This reminded me why Jordan │
│ is such a special friend -  │
│ she trusts me with the hard │
│ stuff. Felt really close.   │
└─────────────────────────────┘

💭 Looking back, what did this mean?
┌─────────────────────────────┐
│ A reminder that depth takes │
│ time - we carved out space  │
│ and didn't rush.            │
└─────────────────────────────┘

[Save Changes]
```

---

## Psychology Deep Dive: Why This Works

### 1. **Savoring** (Bryant & Veroff, 2007)
Intentionally reflecting on positive experiences **deepens** them and increases wellbeing. By prompting reflection immediately after a weave, we help users "savor" the connection.

### 2. **Gratitude Journaling** (Emmons & McCullough, 2003)
Regular gratitude practice increases relationship satisfaction. Reflection prompts like "What made this special?" are disguised gratitude prompts.

### 3. **Emotional Granularity** (Barrett, 2017)
The more precisely we can name emotions, the better we regulate them. Quality ratings + reflection help users develop emotional awareness about relationships.

### 4. **Narrative Identity** (McAdams, 2001)
We make sense of our lives through stories. Reflections become a "relationship memoir" that helps users see patterns, growth, and meaning in their connections.

### 5. **Mindfulness** (Kabat-Zinn)
Reflection prompts are mini-mindfulness exercises: "What was meaningful?" requires present-moment awareness. Over time, this builds relational mindfulness.

---

## Conclusion

This reflection system transforms Weave from a **tracking tool** into a **relationship awareness practice**. It's the difference between:

**Without Reflection:**
- "I had coffee with Jordan 3 days ago."

**With Reflection:**
- "I had a deeply meaningful 2-hour conversation with Jordan where she trusted me with her relationship struggles. It reminded me that our best connections happen when we create unhurried space. These moments are what make this friendship irreplaceable."

That's the soul of relationships. That's what we're building.
