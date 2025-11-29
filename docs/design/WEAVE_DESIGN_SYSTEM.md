# Weave Insights Redesign: Design System & Migration Roadmap

> **Document Version:** 1.0  
> **Last Updated:** November 2025  
> **Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Design Tokens](#3-design-tokens)
4. [Typography System](#4-typography-system)
5. [Spacing & Layout](#5-spacing--layout)
6. [Component Specifications](#6-component-specifications)
7. [Widget Redesign Specifications](#7-widget-redesign-specifications)
8. [Removed & Consolidated Elements](#8-removed--consolidated-elements)
9. [Migration Roadmap](#9-migration-roadmap)
10. [Success Metrics](#10-success-metrics)
11. [Reference Files](#11-reference-files)

---

## 1. Overview

### 1.1 Current Problems

The existing Insights dashboard suffers from:

- **Visual inconsistency** — Gradient cards, flat cards, cards with shadows, cards without. No unified card language.
- **Competing hierarchies** — FocusPill, forecast banner, SuggestedWeaves, and widget grid all compete for attention.
- **Typography chaos** — Mixed use of Lora/Inter, inconsistent font sizes across widgets.
- **Spacing inconsistency** — Different padding systems in different components.
- **Excessive gamification** — Streaks and scores that may incentivize logging over actual connection.
- **Missing iOS native feel** — No consistent corner radius system, no systematic haptic patterns.

### 1.2 Design Direction

**"Quiet Confidence with Warmth"**

- **Light Mode:** Warm, earthy, handcrafted — aged paper, natural linen, afternoon sun
- **Dark Mode:** Refined mystical — warm shadows, aged gold, contemplative depth

The goal is an interface that feels like a trusted companion, not a flashy dashboard.

### 1.3 Widget Architecture

| Widget | Purpose | Priority |
|--------|---------|----------|
| **Today's Focus** | Mission Control — plans, suggestions, actions | Primary (most interactive) |
| **Social Season** | Portfolio Health — engagement, network performance | Secondary (glanceable) |
| **Your Energy** | Personal Wellness — battery tracking, reflection | Secondary (personal) |
| **Network Alignment** | Network Fit — tier alignment analysis | Tertiary (analytical) |

---

## 2. Design Principles

### 2.1 Core Philosophy

1. **Content over chrome** — Every pixel communicates information or creates breathing room. No decoration for decoration's sake.

2. **Consistent rhythm** — Same spacing, same corners, same shadows everywhere. Predictability builds trust.

3. **Warm neutrals** — Not stark white/black. Cream, warm grays, soft shadows that feel handmade.

4. **Typography does the work** — Hierarchy from type size/weight, not color or boxes.

5. **Color is meaning** — When color appears, it means something (urgency, category, emotion). Never decorative.

### 2.2 Gamification Philosophy

**Remove explicit gamification. Keep pattern visualization.**

- ❌ Streak counters ("5-day streak!")
- ❌ Achievement language
- ❌ Points/scores as goals
- ✅ Activity history (dots showing what happened, not achievements)
- ✅ Pattern visibility (trends without scoring)
- ✅ Gentle accountability ("It's been 3 weeks since you saw Sam")

The difference: "Look at your accomplishments" → "Here's what's been happening in your life"

---

## 3. Design Tokens

### 3.1 Color System

Tokens are defined in `src/shared/theme/tokens.ts`.

#### Light Mode Palette

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#FDFCFA` | Page background (warm off-white) |
| `backgroundElevated` | `#FFFFFF` | Cards, elevated surfaces |
| `backgroundSubtle` | `#F7F5F2` | Input backgrounds, subtle sections |
| `backgroundMuted` | `#FFFBEB` | Highlighted sections |
| `foreground` | `#1C1917` | Primary text |
| `foregroundMuted` | `#78716C` | Secondary text |
| `foregroundSubtle` | `#A8A29E` | Tertiary text, placeholders |
| `border` | `#E7E5E4` | Card borders |
| `borderSubtle` | `#F5F5F4` | Inner dividers |
| `primary` | `#92400E` | Primary actions (amber-brown) |
| `primaryMuted` | `#D97706` | Icons, secondary emphasis |

#### Dark Mode Palette (Refined Mystical)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#1A1618` | Page background (warm plum-charcoal) |
| `backgroundElevated` | `#252022` | Cards (warm aubergine) |
| `backgroundSubtle` | `#2D2628` | Subtle sections |
| `foreground` | `#F5F2ED` | Primary text (warm cream) |
| `foregroundMuted` | `#9A9298` | Secondary text (dusty lavender) |
| `border` | `#3D3539` | Card borders (plum-gray) |
| `primary` | `#D4A855` | Primary actions (aged gold) |

#### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `success` | `#059669` | `#34D399` | Positive states |
| `warning` | `#D97706` | `#FBBF24` | Caution states |
| `destructive` | `#DC2626` | `#F87171` | Error/danger states |
| `info` | `#0284C7` | `#38BDF8` | Informational states |

#### Special: Mystic Accent (Dark Mode Only)

Use **sparingly** for special moments:

| Token | Value | Usage |
|-------|-------|-------|
| `mystic.glow` | `#A78BFA` | Moon phase illustrations |
| `mystic.accent` | `#8B5CF6` | Achievement unlocks |
| `mystic.subtle` | `#2E1F47` | Subtle backgrounds |

### 3.2 Accessing Tokens

```typescript
// Legacy API (backward compatible)
import { getTheme } from '@/shared/theme/tokens';
const { colors } = getTheme(isDarkMode);
colors.primary // works

// New API (preferred)
import { getTokens } from '@/shared/theme/tokens';
const tokens = getTokens(isDarkMode);
tokens.primary // string
tokens.card.background // nested access
```

---

## 4. Typography System

### 4.1 Font Families

| Name | Font | Usage |
|------|------|-------|
| `serif` | Lora_400Regular | — |
| `serifBold` | Lora_700Bold | Widget titles, stats, display text ONLY |
| `sans` | Inter_400Regular | Body text, descriptions |
| `sansMedium` | Inter_500Medium | Emphasis within body |
| `sansSemiBold` | Inter_600SemiBold | Labels, buttons, UI elements |

**Rule:** Never mix fonts within a sentence.

### 4.2 Type Scale

| Name | Size | Line Height | Font | Usage |
|------|------|-------------|------|-------|
| `displayLarge` | 32px | 40px | Lora Bold | Hero moments only |
| `h1` | 24px | 32px | Lora Bold | Page titles |
| `h2` | 20px | 28px | Lora Bold | Widget titles |
| `h3` | 17px | 24px | Inter SemiBold | Section headers |
| `bodyLarge` | 17px | 26px | Inter Regular | Prominent body text |
| `body` | 15px | 22px | Inter Regular | Default body text |
| `bodySmall` | 13px | 18px | Inter Regular | Secondary descriptions |
| `label` | 13px | 16px | Inter SemiBold | Form labels, buttons |
| `labelSmall` | 11px | 14px | Inter SemiBold | Uppercase labels (0.5 letter-spacing) |
| `caption` | 12px | 16px | Inter Regular | Helper text, timestamps |
| `stat` | 28px | 34px | Lora Bold | Primary statistics |
| `statSmall` | 20px | 26px | Lora Bold | Secondary statistics |

---

## 5. Spacing & Layout

### 5.1 Spacing Scale

Base unit: 4px

| Token | Value | Common Usage |
|-------|-------|--------------|
| `spacing[1]` | 4px | Tight gaps |
| `spacing[2]` | 8px | Inline gaps, item gaps |
| `spacing[3]` | 12px | Card gaps, section padding |
| `spacing[4]` | 16px | Card padding |
| `spacing[5]` | 20px | Screen padding, large card padding |
| `spacing[6]` | 24px | Section gaps |
| `spacing[8]` | 32px | Large section gaps |

### 5.2 Layout Constants

| Token | Value | Usage |
|-------|-------|-------|
| `layout.screenPadding` | 20px | Horizontal screen edges |
| `layout.cardPadding` | 16px | Standard card internal padding |
| `layout.cardPaddingLarge` | 20px | Hero/primary card padding |
| `layout.cardGap` | 12px | Gap between cards |
| `layout.sectionGap` | 24px | Gap between widget sections |
| `layout.itemGap` | 8px | Gap between list items |

### 5.3 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius.xs` | 4px | Badges, small buttons |
| `radius.sm` | 8px | Buttons, inputs |
| `radius.md` | 12px | List items, inner cards |
| `radius.lg` | 16px | Cards, modals |
| `radius.xl` | 20px | Hero cards, sheets |
| `radius.full` | 9999px | Pills, avatars |

### 5.4 Shadows

All shadows use warm colors (`stone[900]` in light, `black` in dark).

| Token | Offset | Radius | Opacity (Light) | Usage |
|-------|--------|--------|-----------------|-------|
| `shadows.sm` | 0, 1 | 2px | 3% | Subtle lift |
| `shadows.md` | 0, 2 | 8px | 5% | Cards |
| `shadows.lg` | 0, 4 | 16px | 8% | Elevated/hero cards |

---

## 6. Component Specifications

### 6.1 Card Component

**File:** `src/components/ui/Card.tsx`

```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'interactive';
  padding?: 'default' | 'large' | 'none';
  onPress?: () => void;
}
```

| Variant | Background | Border | Shadow |
|---------|------------|--------|--------|
| `default` | `card.background` | 1px `card.border` | None |
| `elevated` | `card.background` | 1px `card.border` | `shadows.md` |
| `interactive` | `card.background` | 1px `card.border` | `shadows.md` + press feedback |

**Specs:**
- Border radius: `radius.lg` (16px)
- Padding: `layout.cardPadding` (16px) or `layout.cardPaddingLarge` (20px)

### 6.2 Widget Header

**File:** `src/components/ui/WidgetHeader.tsx`

```typescript
interface WidgetHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}
```

**Visual Specs:**
- Icon: 20×20, color `foregroundMuted`
- Title: `typography.h3` (17px Inter SemiBold)
- Subtitle: `typography.caption`, `foregroundMuted`
- Action: `typography.label`, `primary`
- Gap icon→title: `spacing[2]` (8px)
- Margin bottom: `spacing[3]` (12px)

### 6.3 Stat Display

**File:** `src/components/ui/Stat.tsx`

```typescript
interface StatProps {
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'stable';
  size?: 'default' | 'small';
}
```

**Visual Specs (default):**
- Value: `typography.stat` (28px Lora Bold), `foreground`
- Label: `typography.caption` (12px), `foregroundMuted`
- Stack vertically, gap: `spacing[1]` (4px)

### 6.4 List Item

**File:** `src/components/ui/ListItem.tsx`

```typescript
interface ListItemProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'compact';
}
```

**Visual Specs:**
- Padding vertical: `spacing[3]` (12px)
- Leading width: 40px (centered)
- Title: `typography.body` (15px), `foreground`
- Subtitle: `typography.bodySmall` (13px), `foregroundMuted`
- Gap leading→content: `spacing[3]` (12px)
- Divider: 1px `borderSubtle` (except last item)

### 6.5 Button Styles

**Primary Button:**
- Background: `primary`
- Text: `primaryForeground`, `typography.label`
- Padding: 12px vertical, 16px horizontal
- Radius: `radius.sm` (8px)

**Secondary/Ghost Button:**
- Background: transparent
- Text: `primary`, `typography.label`
- No border (text button style)

---

## 7. Widget Redesign Specifications

### 7.1 Today's Focus (Mission Control)

**Purpose:** The primary interactive widget. Shows what needs attention today.

**New Structure:**
```
┌─────────────────────────────────────────────┐
│ CARD: Elevated variant                      │
├─────────────────────────────────────────────┤
│                                             │
│ Today's Focus                    [See all →]│
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ ◉  Coffee with Sam              10:30am │ │
│ │    [Confirm]  [Reschedule]              │ │
│ ├─────────────────────────────────────────┤ │
│ │ ○  Call Mom                      2:00pm │ │
│ │    [Confirm]  [Reschedule]              │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                             │
│ 💡 3 suggestions                   [View →] │
│                                             │
│ 🎂 Sam's birthday tomorrow         [View →] │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes:**
- ❌ Remove gradient hero cards entirely
- ✅ Plans shown as list items with inline actions
- ✅ Suggestions/events collapsed to single-line summaries
- ✅ Expansion happens in modal/sheet, not inline
- ✅ "See all" opens dedicated sheet

**States:**
1. **Has plans today:** Show plans with confirm/reschedule
2. **No plans, has suggestions:** Show suggestion summaries
3. **All clear:** Simple "You're all caught up" with checkmark

**Target Lines of Code:** <400 (down from 1000+)

### 7.2 Social Season (Portfolio Health)

**Purpose:** Quick glance at engagement health. Not a game.

**New Structure:**
```
┌─────────────────────────────────────────────┐
│ CARD: Default variant                       │
├─────────────────────────────────────────────┤
│                                             │
│ 🌗  Balanced Season               [About →] │
│     Your connections are steady             │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  This Week                              │ │
│ │  M   T   W   T   F   S   S              │ │
│ │  ●   ●   ○   ●   ·   ·   ·              │ │
│ │                                         │ │
│ │  4 connections  ·  72% network health   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes:**
- ❌ Remove "X-day streak!" language
- ❌ Remove explicit gamification
- ✅ Activity dots as history (not achievement)
- ✅ Single-line stats
- ✅ Season explanation in "About" modal

**Activity Dot Legend:**
- `●` Filled = Had activity (color: `foreground`)
- `○` Outline = No activity, day passed (color: `foregroundSubtle`)
- `·` Small dot = Future day (color: `borderSubtle`)

### 7.3 Your Energy (Personal Wellness)

**Purpose:** Battery tracking and self-reflection. Most personal widget.

**New Structure:**
```
┌─────────────────────────────────────────────┐
│ CARD: Default variant                       │
├─────────────────────────────────────────────┤
│                                             │
│ Your Energy                  November 2025  │
│                                             │
│   S   M   T   W   T   F   S                 │
│  [Moon phase grid — 2 weeks]                │
│                                             │
│  Avg: 3.2/5  ·  12 check-ins this month    │
│                                             │
│ ┌───────────────────┐ ┌───────────────────┐ │
│ │   📖 Journal      │ │   🌙 Full Year    │ │
│ └───────────────────┘ └───────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ Rename "Year in Moons" → "Your Energy" (clearer)
- ✅ Keep moon visualization (unique and meaningful)
- ✅ Simplify stats to single line
- ✅ Two equal action buttons
- ❌ Remove "Tap to expand" badge

### 7.4 Network Alignment (Network Fit)

**Purpose:** Are people in the right tiers? Surface misalignments.

**New Structure:**
```
┌─────────────────────────────────────────────┐
│ CARD: Default variant                       │
├─────────────────────────────────────────────┤
│                                             │
│ Network Alignment                    7 / 10 │
│                                             │
│ ┌──────────────────────────────────────┐    │
│ │ ████████████████████░░░░░░  70%     │    │
│ └──────────────────────────────────────┘    │
│                                             │
│ 8 aligned  ·  2 need attention              │
│                                             │
│                            [Review network →]│
│                                             │
└─────────────────────────────────────────────┘
```

**Key Changes:**
- ✅ Much simpler — score, bar, summary, action
- ❌ Remove inline suggestions (move to dedicated screen)
- ❌ Remove stat grid (redundant)
- ✅ Single CTA

---

## 8. Removed & Consolidated Elements

| Current Element | Decision | Rationale |
|-----------------|----------|-----------|
| `FocusPill` | **Remove** | Redundant with Today's Focus |
| Forecast Banner | **Remove** | Merge into Network Alignment or Today's Focus |
| `SuggestedWeaves` | **Consolidate** | Move into Today's Focus suggestions section |
| Gradient hero cards | **Remove** | Replace with elevated card variant |
| Streak counters | **Remove** | Replace with non-gamified activity history |
| Inline expansion animations | **Remove** | Use modal/sheet for details |
| Multiple stat boxes | **Simplify** | Single-line stat summaries |

---

## 9. Migration Roadmap

### Phase 0: Foundation (1-2 days)

**Goal:** Set up design system infrastructure without visible changes.

- [ ] Verify `src/shared/theme/tokens.ts` is properly integrated
- [ ] Update `useTheme` hook to expose new `getTokens()` API
- [ ] Create `DESIGN_SYSTEM.md` reference in repo (this document)
- [ ] Add `Inter_500Medium` font if not already loaded

**Files to modify:**
- `src/shared/hooks/useTheme.ts`
- `app/_layout.tsx` (font loading)

**No visible changes to users.**

---

### Phase 1: Base Components (2-3 days)

**Goal:** Build reusable UI primitives.

- [ ] Create `src/components/ui/Card.tsx`
- [ ] Create `src/components/ui/WidgetHeader.tsx`
- [ ] Create `src/components/ui/Stat.tsx`
- [ ] Create `src/components/ui/ListItem.tsx`
- [ ] Create `src/components/ui/ProgressBar.tsx`
- [ ] Create `src/components/ui/Button.tsx` (or update existing)
- [ ] Create `src/components/ui/Divider.tsx`

**Testing:**
- Create a test screen or Storybook stories to verify components

**No visible changes to users.**

---

### Phase 2: Simplify Home Layout (1 day)

**Goal:** Clean up home screen structure.

- [ ] Remove `FocusPill` from `app/_home.tsx`
- [ ] Remove forecast banner from `app/_home.tsx`
- [ ] Remove `SuggestedWeaves` as separate component
- [ ] Update `HomeWidgetGrid` spacing to use new tokens
- [ ] Update `HomeWidgetBase` to use new Card component

**Files to modify:**
- `app/_home.tsx`
- `src/components/home/HomeWidgetGrid.tsx`
- `src/components/home/HomeWidgetBase.tsx`

**Visible change:** Home screen is cleaner, fewer competing elements.

---

### Phase 3: Today's Focus Redesign (3-4 days)

**Goal:** Rebuild the primary widget.

- [ ] Create `src/components/home/widgets/TodaysFocusWidgetV2.tsx`
- [ ] Implement list-based plan display using `ListItem`
- [ ] Implement collapsed suggestions row
- [ ] Implement collapsed events row  
- [ ] Create `src/components/FocusDetailSheet.tsx` for expanded view
- [ ] Handle all priority states (plans, suggestions, all-clear)
- [ ] Remove gradient card logic
- [ ] Test all states thoroughly
- [ ] Swap old widget for new in `_home.tsx`
- [ ] Delete old `TodaysFocusWidget.tsx`

**Visible change:** Today's Focus is completely redesigned.

---

### Phase 4: Social Season Redesign (2 days)

**Goal:** Simplify portfolio health widget.

- [ ] Create `src/components/home/widgets/SocialSeasonWidgetV2.tsx`
- [ ] Implement simplified header with season icon
- [ ] Implement non-gamified activity dots row
- [ ] Implement single-line stats (remove streak language)
- [ ] Update `SocialSeasonModal` to match new design language
- [ ] Swap old widget for new
- [ ] Delete old widget

**Visible change:** Social Season is cleaner, less gamified.

---

### Phase 5: Your Energy Redesign (2 days)

**Goal:** Polish personal wellness widget.

- [ ] Rename widget from "Year in Moons" to "Your Energy"
- [ ] Refactor `YearInMoonsWidget` or create V2
- [ ] Simplify to 2-week view as default
- [ ] Implement single-line stats
- [ ] Style action buttons consistently
- [ ] Update `YearInMoonsModal` to match design language
- [ ] Swap widget

**Visible change:** Energy widget is more focused.

---

### Phase 6: Network Alignment Redesign (1-2 days)

**Goal:** Minimal, actionable network health.

- [ ] Create `src/components/home/widgets/NetworkAlignmentWidgetV2.tsx`
- [ ] Implement score + progress bar
- [ ] Implement summary line
- [ ] Single CTA button
- [ ] Swap old widget for new
- [ ] Delete old `NetworkBalanceWidget.tsx`

**Visible change:** Network widget is simplified.

---

### Phase 7: Polish & QA (2-3 days)

**Goal:** Consistency pass and bug fixes.

- [ ] Audit all widgets for consistent spacing
- [ ] Audit all typography usage (Lora only for titles/stats)
- [ ] Audit all color usage (no hardcoded hex values)
- [ ] Test dark mode thoroughly (refined mystical palette)
- [ ] Test on different screen sizes (iPhone SE → iPhone Pro Max)
- [ ] Performance audit (removed animations should help)
- [ ] Accessibility audit (contrast ratios, touch targets ≥44pt)
- [ ] Test haptic feedback patterns

---

### Phase 8: Cleanup (1 day)

**Goal:** Remove old code.

- [ ] Delete V1 widget files
- [ ] Remove unused styles
- [ ] Remove unused imports
- [ ] Update component index files
- [ ] Remove old `theme.ts` if fully migrated to `tokens.ts`
- [ ] Final code review

---

## 10. Success Metrics

### Visual Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Unique card styles | 4+ | 1 |
| Hardcoded colors | Many | 0 |
| Font size variations | 8+ | Use scale only |
| Border radius values | 6+ | 6 (from scale) |

### Code Metrics

| Metric | Before | Target |
|--------|--------|--------|
| `TodaysFocusWidget.tsx` lines | 1000+ | <400 |
| Total widget code | ~2500 lines | <1200 lines |
| Shared UI components | Few | 6+ reusable |

### UX Metrics

| Metric | Target |
|--------|--------|
| Time to scan dashboard | <3 seconds |
| Primary action clarity | Obvious what to do |
| Cognitive load | Reduced (fewer competing elements) |

---

## 11. Reference Files

### New Files to Create

```
src/
├── shared/
│   └── theme/
│       └── tokens.ts           ✅ Created
├── components/
│   └── ui/
│       ├── Card.tsx            Phase 1
│       ├── WidgetHeader.tsx    Phase 1
│       ├── Stat.tsx            Phase 1
│       ├── ListItem.tsx        Phase 1
│       ├── ProgressBar.tsx     Phase 1
│       ├── Button.tsx          Phase 1
│       └── Divider.tsx         Phase 1
│   └── home/
│       └── widgets/
│           ├── TodaysFocusWidgetV2.tsx      Phase 3
│           ├── SocialSeasonWidgetV2.tsx     Phase 4
│           ├── YourEnergyWidget.tsx         Phase 5
│           └── NetworkAlignmentWidgetV2.tsx Phase 6
│   └── FocusDetailSheet.tsx    Phase 3
```

### Files to Modify

```
src/shared/hooks/useTheme.ts    Phase 0
app/_layout.tsx                 Phase 0 (fonts)
app/_home.tsx                   Phase 2
src/components/home/HomeWidgetGrid.tsx    Phase 2
src/components/home/HomeWidgetBase.tsx    Phase 2
```

### Files to Delete (Phase 8)

```
src/components/home/widgets/TodaysFocusWidget.tsx
src/components/home/widgets/SocialSeasonWidget.tsx
src/components/home/widgets/YearInMoonsWidget.tsx
src/components/home/widgets/NetworkBalanceWidget.tsx
src/components/home/widgets/FocusPill.tsx
src/components/home/widgets/ReflectionReadyWidget.tsx (consolidate)
```

---

## Appendix: Quick Reference

### Color Usage Cheatsheet

```typescript
// Backgrounds
tokens.background          // Page background
tokens.backgroundElevated  // Cards
tokens.backgroundSubtle    // Inputs, subtle sections
tokens.backgroundMuted     // Highlighted areas

// Text
tokens.foreground          // Primary text
tokens.foregroundMuted     // Secondary text
tokens.foregroundSubtle    // Tertiary/placeholder

// Interactive
tokens.primary             // Buttons, links
tokens.primaryForeground   // Text on primary buttons
tokens.border              // Card borders
tokens.borderFocus         // Focus rings
```

### Typography Usage Cheatsheet

```typescript
// Lora (serif) — ONLY for:
- Widget titles (h2)
- Statistics (stat, statSmall)
- Display text (displayLarge) — rare

// Inter (sans) — Everything else:
- Body text (body, bodySmall, bodyLarge)
- Labels and buttons (label, labelSmall)
- Captions (caption)
- Section headers (h3)
```

### Spacing Cheatsheet

```typescript
// Common patterns
screenPadding: 20px        // layout.screenPadding
cardPadding: 16px          // layout.cardPadding
cardGap: 12px              // layout.cardGap
itemGap: 8px               // layout.itemGap
sectionGap: 24px           // layout.sectionGap
```

---

*End of Document*
