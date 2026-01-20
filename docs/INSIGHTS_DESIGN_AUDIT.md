# Insights Tab Design Audit

## Overview
The Insights tab currently consists of 4 stacked widgets in a grid. The visual rhythm feels inconsistent due to alternating header styles and interaction patterns.

| Position | Widget | Header Style | Interaction Model | Density |
|----------|--------|--------------|-------------------|---------|
| 1 | **Today's Focus** | Small (`WidgetHeader`) | List items (Rows) | High |
| 2 | **Social Season** | Large (Hero Icon + Title) | Whole card tap | Low (Poster) |
| 3 | **Your Energy** | Small (`WidgetHeader`) | Buttons in Footer | High (Grid) |
| 4 | **Journal** | Large (Hero Icon + Title) | Buttons in Body | Medium |

## Key Inconsistencies

### 1. Header Hierarchy (The "Yo-Yo" Effect)
The tab alternates between two distinct header styles:
- **Small Utility Header**: Used by Focus & Energy. Features a small icon, title, and optional action link on one line.
- **Large Hero Header**: Used by Season & Journal. Features a large 48px icon in a circle, big Serif heading, and subtitle.

**Recommendation**: Standardize headers.
- *Option A*: Adopt "Utility Header" for all. Makes the page feel like a dashboard.
- *Option B*: Adopt "Hero Header" for all. Makes the page feel like a feed/magazine.
- *Option C*: Group them? (e.g., Context vs Actions).

### 2. Interaction & Buttons
- **Focus**: Tappable rows. "Show more" text at bottom.
- **Season**: Whole card is tappable.
- **Energy**: Footer contains two pill-shaped buttons (Life Calendar, Patterns).
- **Journal**: Body contains large buttons (Reflect, Journal). Footer has a stats ticker.

**Recommendation**: Standardize "Call to Actions" (CTAs).
- Should primary actions live in the body or the footer?
- Should we use consistent button styles (e.g., all small pills in footer, or all large blocks)?

### 3. Typography & Spacing
- **Focus**: Uses `px-4 pt-4` for distinct sections. Headers are uppercase `text-xs`.
- **Season**: Uses Serif for title, Sans for subtext.
- **Energy**: Uses Serif for specific stats ("Avg: 2.8/5").
- **Journal**: Uses Serif for Prompt text.

### 4. Visual Noise
- **Focus** widget has multiple sub-headers ("UPCOMING", "COMPLETED", "TOMORROW") which adds noise.
- **Energy** widget has a visible calendar grid + stats + buttons, making it the busiest card.

## Proposals for Streamlining

### Approach 1: The "Dashboard" (Utilitarian)
Convert ALL widgets to use the **Small Utility Header**.
- **Pros**: Clean, consistent, reduces scrolling, fits more data.
- **Cons**: Less "emotional" or "aesthetic".

### Approach 2: The "Magazine" (Immersive)
Convert ALL widgets to use the **Hero Header**.
- **Pros**: Beautiful, engaging, highly distinct.
- **Cons**: Takes up more vertical space.

### Approach 3: The "Hybrid" (Grouped)
Keep large headers for "Context" (Season, Energy) and small headers for "Actions" (Focus, Journal).
- Current implementation tries this but Energy uses the small header.
- Maybe moving Energy to "Hero Header" style would balance it?

## Questions for Discussion
1. Do you prefer the "Dense Dashboard" feel or the "Spacious Magazine" feel?
2. Should the "Your Energy" widget feel more like the "Social Season" widget (a status card)?
3. Is "Today's Focus" too cluttered?
