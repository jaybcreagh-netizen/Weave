# Weave Visual Design Brief

## Purpose

This document is a basic design handoff for external web designers. It summarizes the app's current visual system, product shape, and interface language based on the codebase source of truth.

Primary source: `src/shared/theme/tokens.ts`

## Brand Summary

Weave is a private, relationship-focused companion app. The product tone is reflective, calm, intimate, and slightly editorial rather than "productivity SaaS" or "social network."

Core brand qualities:

- Warm
- Thoughtful
- Human
- Quietly intelligent
- Slightly ritualistic
- Clean, but not sterile

The light theme is the clearest expression of the product brand: soft paper backgrounds, stone neutrals, amber-brown actions, serif headings, and restrained UI chrome. Dark mode exists as a richer, more mystical variant with plum-charcoal surfaces and aged-gold accents.

## Visual Style Direction

Designers should treat the UI as an "editorial relationship sanctuary."

Key style cues:

- Warm off-white backgrounds instead of pure white
- Soft stone borders instead of hard gray dividers
- Amber-brown as the main call-to-action color
- Serif display moments for emotion, reflection, and emphasis
- Sans-serif for all functional UI
- Rounded cards and bottom sheets with gentle elevation
- Data visualizations that feel soft and interpretive, not corporate
- Accent gradients and symbolic visuals used sparingly for seasons, archetypes, and reflective moments

Avoid:

- Bright neon palettes
- Cold blue enterprise UI styling
- Harsh black-on-white contrast
- Overly dense dashboards
- Techy futuristic styling

## Archetype Philosophy

The archetype system is one of Weave's most distinctive ideas, but it should be understood as a relational language, not a personality test and not fortune-telling.

Core philosophy:

- Archetypes describe how people tend to connect, support, and show up in friendship
- They are symbolic shorthand for real social patterns
- They should feel insightful, flattering, and usable
- They are not fixed identities or rigid labels
- Every archetype is valid; none should be framed as a problem archetype
- The tarot framing adds poetry and memory, but the product logic stays grounded in lived behavior

In practice, archetypes help the app answer questions like:

- What kind of quality time feels most natural here?
- What kind of support does this person tend to value?
- What kind of reconnection prompt would feel most aligned?
- What mood should this card, profile, or prompt carry?

Design guidance:

- Treat archetypes as tonal lenses, not costume themes
- Use them to shape copy, accent color, iconography, and illustration mood
- Keep the UI readable and practical even when the language becomes symbolic
- Let the symbolism clarify the relationship dynamic rather than overwhelm it

### Active Archetypes

| Archetype | Core Meaning | Relationship Quality | Visual Mood |
| --- | --- | --- | --- |
| The Hermit | Depth, reflection, solitude | Quiet one-on-one presence, patient bonds | Still, spacious, contemplative |
| The Sun | Joy, celebration, warmth | Group energy, radiance, visible affection | Bright, open, glowing |
| The Empress | Nurturing, comfort, care | Meals, tenderness, thoughtful tending | Soft, abundant, tactile |
| The Emperor | Structure, reliability, rhythm | Plans, consistency, intentional effort | Solid, ordered, grounded |
| The Fool | Play, spontaneity, novelty | Adventure, surprise, movement | Light, kinetic, curious |
| The Magician | Creativity, transformation | Projects, ideas, making things together | Inventive, spark-like, dynamic |
| The High Priestess | Intuition, emotional truth, depth | Insightful conversation, subtle attunement | Quietly luminous, inward, observant |
| The Lovers | Intimacy, reciprocity, harmony | Closeness, mutual care, meaningful bond | Softly magnetic, balanced, heartfelt |

Important nuance:

- The Lovers should read as intimacy and relational harmony, not only romance
- The Hermit should feel peaceful and deep, not lonely or cold
- The Emperor should feel reliable and intentional, not controlling
- The High Priestess should feel emotionally intelligent, not vague mysticism
- The Fool should feel playful and alive, not chaotic

## Esoteric Layer

Weave does have an esoteric layer, but it should be restrained and emotionally intelligent. The right reference point is "symbolic reflective companion," not fantasy game UI.

The esoteric layer currently comes through:

- Tarot archetype naming
- The Oracle product language
- Moon-phase and seasonal metaphors
- Ritual-like moments of pause, reflection, and interpretation
- Small symbolic accents around insight, memory, and pattern recognition

### How To Express It

- Use symbolic motifs sparingly: moons, halos, stars, threads, rings, constellations, card-like framing
- Let gold, mystic violet, and soft glows appear mainly in Oracle or special reflection contexts
- Keep most screens grounded in the warm editorial base palette
- Prefer subtle sacredness over theatrical mysticism
- Use calm whitespace and measured composition so special moments feel intentional

### Good Esoteric References

- Modern tarot editorial design
- Quiet ritual objects
- Moon journals
- Natural textures like linen, paper, dusk gradients, soft metallic accents
- Symbol systems that feel intimate and handcrafted

### Avoid For This Brand

- Halloween occult styling
- Dense astrology charts everywhere
- Crystal-shop visual clichés
- Aggressive cosmic neon gradients
- Blackletter fonts or gothic horror cues
- Overloaded celestial decoration on every screen

### Recommended Esoteric UI Cues

- Oracle surfaces can feel slightly more ceremonial than the rest of the app
- Use one symbolic mark well rather than many symbols at once
- Consider card frames, circular seals, subtle star glyphs, or moon markers
- Keep interactions focused and intentional, more like consulting a wise guide than chatting with a bot
- Pair symbolic visuals with concrete, grounded language

## Core Fonts

Canonical loaded font families:

- `Lora` for reflective/editorial emphasis
- `Inter` for all functional UI

Canonical loaded weights:

- `Lora_400Regular`
- `Lora_700Bold`
- `Inter_400Regular`
- `Inter_500Medium`
- `Inter_600SemiBold`

Note: `Solway` is installed in dependencies but is not part of the active shared design system. External design work should treat Lora + Inter as the approved font pair.

## Font Roles

| Role | Font | Weight | Size / Line Height | Usage |
| --- | --- | --- | --- | --- |
| Display Large | Lora | 700 | 32 / 40 | Hero lines, onboarding hooks, key reflective moments |
| H1 | Lora | 700 | 24 / 32 | Main screen titles |
| H2 | Lora | 700 | 20 / 28 | Section titles, modal titles |
| H3 | Lora | 700 | 17 / 24 | Widget headers, sub-sections |
| Body Large | Inter | 400 | 17 / 26 | Lead body copy, onboarding support text |
| Body | Inter | 400 | 15 / 22 | Standard paragraph and list text |
| Body Small | Inter | 400 | 13 / 18 | Secondary UI copy |
| Label | Inter | 500-600 | 13 / 16 | Buttons, tabs, actionable UI labels |
| Label Small | Inter | 500-600 | 11 / 14, tracking 0.5 | Overlines, pill labels, compact UI labels |
| Caption | Inter | 400 | 12 / 16 | Metadata, helper text, supporting notes |
| Stat | Lora | 700 | 28 / 34 | Large numeric highlights |
| Stat Small | Lora | 700 | 20 / 26 | Smaller highlighted metrics |

Typography rules:

- Use Lora only for titles, stats, and emotionally resonant text.
- Use Inter for buttons, tabs, labels, body copy, forms, and metadata.
- Do not mix serif and sans within the same short sentence or control.
- Keep typography airy and readable; this UI is reflective, not compressed.

## Color Tokens

### Primary Light Theme

| Token | Hex | Use |
| --- | --- | --- |
| Background | `#FDFCFA` | App shell, default page background |
| Background Elevated | `#F7F5F2` | Raised surfaces, grouped sections |
| Background Subtle | `#F7F5F2` | Soft section fills |
| Background Muted | `#F5F5F4` | Inactive chips, muted containers |
| Foreground | `#1C1917` | Primary text |
| Foreground Muted | `#78716C` | Secondary text |
| Foreground Subtle | `#A8A29E` | Tertiary text, inactive indicators |
| Border | `#EFEBE6` | Standard dividers and card borders |
| Border Subtle | `#F5F5F4` | Inner separators |
| Border Focus | `#D97706` | Focus ring / active field border |
| Primary | `#92400E` | Main CTA, active states |
| Primary Hover | `#78350F` | Hover / pressed state |
| Primary Foreground | `#FFFFFF` | Text on primary buttons |
| Primary Muted | `#D97706` | Accent text, warm emphasis |
| Primary Subtle | `#FEF3C7` | Light accent backgrounds |
| Secondary | `#E7E5E4` | Secondary buttons, neutral chips |
| Secondary Hover | `#D6D3D1` | Pressed neutral state |
| Secondary Foreground | `#292524` | Text on secondary controls |

### Light Theme Status / Domain Colors

| Token | Hex | Use |
| --- | --- | --- |
| Success | `#059669` | Healthy state, confirmed success |
| Warning | `#D97706` | Caution, active attention |
| Destructive | `#DC2626` | Delete, danger |
| Info | `#0284C7` | Informational indicators |
| Celebrate | `#10B981` | Birthdays, milestones, celebratory moments |
| Tier Inner | `#EAB308` | Inner circle indicator |
| Tier Close | `#9CA3AF` | Close friends indicator |
| Tier Community | `#CD7F32` | Community tier indicator |
| Weave Vibrant | `#10B981` | Strong relationship status |
| Weave Stable | `#F59E0B` | Stable relationship status |
| Weave Fading | `#A8A29E` | Fading / lower-energy status |

### Dark Theme

| Token | Hex | Use |
| --- | --- | --- |
| Background | `#14101F` | Main app background |
| Background Elevated | `#241C33` | Cards and sheets |
| Background Subtle | `#2D233D` | Inner surfaces |
| Background Muted | `#241C33` | Muted containers |
| Foreground | `#F5F2ED` | Primary text |
| Foreground Muted | `#9D8CB0` | Secondary text |
| Foreground Subtle | `#6B5A8A` | Tertiary text |
| Border | `#392E4D` | Standard border |
| Border Subtle | `#2D233D` | Soft divider |
| Border Focus | `#D4A855` | Focus / active border |
| Primary | `#D4A855` | Main CTA in dark mode |
| Primary Hover | `#C9985A` | Hover / pressed state |
| Primary Foreground | `#14101F` | Text on gold buttons |
| Primary Muted | `#C9985A` | Accent text |
| Primary Subtle | `#5C4D3D` | Subtle gold-tinted fill |
| Secondary | `#392E4D` | Neutral dark control fill |
| Secondary Hover | `#4D3E66` | Pressed neutral dark state |
| Secondary Foreground | `#F5F2ED` | Text on secondary controls |

### Seasonal Accent Gradients

These are secondary expressive accents, not the base UI palette.

Light mode:

- Resting: `#78716C` to `#57534E`
- Balanced: `#D97706` to `#B45309`
- Blooming: `#059669` to `#047857`

Dark mode:

- Resting: `#4D3E66` to `#392E4D`
- Balanced: `#D4A855` to `#C9985A`
- Blooming: `#34D399` to `#10B981`

## UI Element Guidance

### Backgrounds

- Default screens should sit on the base background color.
- Elevated modules such as cards, sheets, and grouped panels should use elevated backgrounds.
- Muted backgrounds are best for inactive pills, tab chips, quiet placeholders, and subtle segmentation.

### Cards

- Card fill should be near-background, not dramatically separated.
- Cards should feel like paper panels or quiet containers.
- Use `16-20px` corner radius.
- Borders are preferred over heavy shadows.
- Shadows should be soft and low-opacity.

### Buttons

- Primary button: solid warm amber-brown fill with white text in light mode, gold fill with dark text in dark mode.
- Secondary button: neutral filled surface with dark text.
- Outline button: transparent background with soft border.
- Ghost button: transparent background, text-first action.

### Inputs

- Inputs should use the card/background surface, never bright white.
- Borders should be subtle by default and warm on focus.
- Placeholder text should be tertiary, not low-contrast body text.

### Tabs, Chips, Pills

- Active state: primary fill with high-contrast text/icon.
- Inactive state: muted surface with muted text/icon.
- Rounded pill shapes are preferred over hard segmented controls.

### Icons

- Main icon set is rounded stroke-based (`lucide-react-native`).
- Default icon size is generally `16-24px`.
- Most icons should use muted text color until active.
- Accent color should be reserved for active tabs, CTA cues, and meaningful signals.

### Motion

Motion in the app is subtle and calm:

- Staggered fade-in on dashboard widgets
- Small upward translate on entry
- Gentle pulse for loading or important state
- No fast, flashy transitions

For the web, use motion to support calmness and clarity, not spectacle.

## Spacing and Shape

| Token | Value |
| --- | --- |
| Screen Padding | `20px` |
| Standard Card Padding | `16px` |
| Large Card Padding | `20px` |
| Card Gap | `12px` |
| Section Gap | `24px` |
| Item Gap | `8px` |
| Inline Gap | `8px` |

Corner radius system:

| Token | Value | Typical Use |
| --- | --- | --- |
| XS | `4px` | Tiny badges, micro-elements |
| SM | `8px` | Inputs, compact buttons |
| MD | `12px` | List items, internal panels |
| LG | `16px` | Standard cards |
| XL | `20px` | Hero cards, bottom sheets |
| Full | `9999px` | Pills, avatars, circular actions |

## Product Overview

Weave is a personal relationship management app built around maintaining friendships intentionally.

Primary product loops:

1. Plan
2. Log
3. Reflect

### Core Features

- Onboarding that frames the app as a "social brain" for keeping in touch
- Dashboard with insight widgets like Today's Focus, Your Pulse, and Journal
- Circle management for friends across tiers: Inner, Close, Community
- Add, search, filter, sort, and link friends
- Plan interactions and log completed "weaves"
- Journal feed with quick capture and guided reflection
- Weekly reflection flow
- Friend-specific relationship arcs and memory surfaces
- Unified calendar combining social battery, weaves, plans, and drift detection
- Social battery check-ins and "social season" states
- Archetype system and archetype quiz
- Oracle / insight assistant for contextual prompts and guidance
- Optional account, syncing, linking, and sharing features

## Design Ideas For Web Translation

### 1. Dashboard / Home

The best web translation is a soft editorial dashboard, not a rigid analytics console.

Recommended direction:

- Desktop: 2-column or 3-column modular dashboard
- Mobile web: stacked full-width cards
- Hero modules should feel like journal panels or reflective widgets
- Use cards generously, but keep them visually quiet

### 2. Circle / Relationship Map

The friend dashboard should emphasize tiers and relationship health.

Recommended direction:

- Use tiered sections or segmented lanes for Inner / Close / Community
- Make cards scan-friendly with avatar, status, and one-line context
- Use muted surfaces and colored indicators rather than large blocks of strong color

### 3. Journal

The journal area should feel more like a modern editorial notebook than a notes app.

Recommended direction:

- Serif headings, generous spacing, quiet metadata
- Timeline/feed layout for entries
- Reflection cards with soft emphasis styling
- Calendar filters and friend filters available but visually secondary

### 4. Calendar / Pulse

The calendar is one of the most distinctive product surfaces.

Recommended direction:

- Use a soft monthly grid with layered states
- Represent energy levels and check-ins with moon-like or circular fills
- Overlay completed weaves, planned events, and drift alerts as subtle markers
- Preserve a feeling of interpretation and rhythm, not only raw data

### 5. Oracle / Intelligence Surfaces

These views should feel slightly more ceremonial, but still restrained.

Recommended direction:

- Use elevated sheets, warm accent glows, and a little more visual focus
- Keep copy-led presentation
- Avoid sci-fi AI styling
- The intelligence layer should feel wise and calm, not robotic

## Summary For Designers

If a designer needs one sentence:

Weave should feel like a warm, editorial, relationship sanctuary built from paper-toned backgrounds, serif moments, soft stone neutrals, and restrained amber accents.

If a designer needs three rules:

- Use Lora only for meaningful emphasis; use Inter for everything functional.
- Anchor the light theme in warm cream + stone + amber, not pure white + blue.
- Keep interfaces calm, spacious, rounded, and emotionally literate.
