# Weave Insights Redesign — Agent Prompt

## Overview

You are tasked with redesigning the Insights dashboard of the Weave app. This is a phased refactor that introduces a new design system and rebuilds four widgets from scratch.

**Read `WEAVE_DESIGN_SYSTEM.md` thoroughly before starting any work.** It contains all specifications, visual diagrams, and requirements.

---

## Project Goals

1. **Visual Consistency** — One card style, one typography system, one spacing scale
2. **Reduced Complexity** — Fewer competing UI elements, simpler widget code
3. **Removed Gamification** — No streaks/scores, replaced with pattern visualization
4. **Native iOS Feel** — Consistent radii, warm shadows, systematic haptics
5. **Maintainability** — Reusable components, semantic tokens, <400 LOC per widget

---

## Key Files

| File | Purpose |
|------|---------|
| `src/shared/theme/tokens.ts` | Design tokens (colors, typography, spacing) |
| `WEAVE_DESIGN_SYSTEM.md` | Full specification document |
| `src/shared/hooks/useTheme.ts` | Theme hook (needs updating) |
| `app/_home.tsx` | Home screen layout |
| `src/components/home/widgets/` | Current widget implementations |

---

## Phase 0: Foundation

**Goal:** Integrate the new token system without visual changes.

### Tasks

- [ ] Update `src/shared/theme/theme.ts` to re-export from `tokens.ts`:
```typescript
export * from './tokens';
```

- [ ] Update `src/shared/hooks/useTheme.ts` to expose new API:
```typescript
import { 
  getTokens, 
  createLegacyTheme, 
  typography, 
  spacing, 
  layout, 
  radius, 
  shadows 
} from '@/shared/theme/tokens';

export const useTheme = () => {
  const isDarkMode = useUIStore((state) => state.isDarkMode);
  
  return {
    // Legacy API (backward compatible)
    ...createLegacyTheme(isDarkMode),
    
    // New API
    tokens: getTokens(isDarkMode),
    typography,
    spacing,
    layout,
    radius,
    shadows,
    isDarkMode,
  };
};
```

- [ ] Verify `Inter_500Medium` font is loaded in `app/_layout.tsx`

### Verification
- App builds without errors
- No visual changes
- `useTheme()` returns both `colors` and `tokens`

---

## Phase 1: Base Components

**Goal:** Create reusable UI primitives in `src/components/ui/`.

### Component: Card

**File:** `src/components/ui/Card.tsx`

```typescript
import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated';
  padding?: 'default' | 'large' | 'none';
  onPress?: () => void;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'default',
  onPress,
  style,
}) => {
  const { tokens, layout, radius, shadows } = useTheme();
  
  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      backgroundColor: tokens.card.background,
      borderColor: tokens.card.border,
      borderRadius: radius.lg,
    },
    padding === 'default' && { padding: layout.cardPadding },
    padding === 'large' && { padding: layout.cardPaddingLarge },
    padding === 'none' && { padding: 0 },
    variant === 'elevated' && {
      ...shadows.md,
      shadowColor: tokens.shadow.color,
      shadowOpacity: tokens.shadow.opacity.md,
    },
    style,
  ];
  
  if (onPress) {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.7}
        style={containerStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }
  
  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
```

### Component: WidgetHeader

**File:** `src/components/ui/WidgetHeader.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface WidgetHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  icon,
  title,
  subtitle,
  action,
}) => {
  const { tokens, typography, spacing } = useTheme();
  
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View>
          <Text style={[
            styles.title,
            { 
              color: tokens.foreground,
              fontSize: typography.scale.h3.fontSize,
              lineHeight: typography.scale.h3.lineHeight,
              fontFamily: typography.fonts.sansSemiBold,
            }
          ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[
              styles.subtitle,
              {
                color: tokens.foregroundMuted,
                fontSize: typography.scale.caption.fontSize,
                lineHeight: typography.scale.caption.lineHeight,
                fontFamily: typography.fonts.sans,
                marginTop: spacing[0.5],
              }
            ]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[
            styles.action,
            {
              color: tokens.primary,
              fontSize: typography.scale.label.fontSize,
              fontFamily: typography.fonts.sansSemiBold,
            }
          ]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  title: {},
  subtitle: {},
  action: {},
});
```

### Component: Stat

**File:** `src/components/ui/Stat.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface StatProps {
  value: string | number;
  label: string;
  trend?: 'up' | 'down' | 'stable';
  size?: 'default' | 'small';
}

export const Stat: React.FC<StatProps> = ({
  value,
  label,
  trend,
  size = 'default',
}) => {
  const { tokens, typography, spacing } = useTheme();
  
  const valueStyle = size === 'default' 
    ? typography.scale.stat 
    : typography.scale.statSmall;
  
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? tokens.success : trend === 'down' ? tokens.destructive : tokens.foregroundMuted;
  
  return (
    <View style={styles.container}>
      <View style={styles.valueRow}>
        <Text style={[
          {
            color: tokens.foreground,
            fontSize: valueStyle.fontSize,
            lineHeight: valueStyle.lineHeight,
            fontFamily: typography.fonts.serifBold,
          }
        ]}>
          {value}
        </Text>
        {trend && (
          <TrendIcon size={size === 'default' ? 16 : 14} color={trendColor} style={{ marginLeft: spacing[1] }} />
        )}
      </View>
      <Text style={[
        {
          color: tokens.foregroundMuted,
          fontSize: typography.scale.caption.fontSize,
          lineHeight: typography.scale.caption.lineHeight,
          fontFamily: typography.fonts.sans,
          marginTop: spacing[0.5],
        }
      ]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
```

### Component: ListItem

**File:** `src/components/ui/ListItem.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface ListItemProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  showDivider?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  showChevron = false,
  showDivider = true,
}) => {
  const { tokens, typography, spacing } = useTheme();
  
  const content = (
    <View style={[
      styles.container,
      { paddingVertical: spacing[3] },
      showDivider && { borderBottomWidth: 1, borderBottomColor: tokens.borderSubtle },
    ]}>
      {leading && (
        <View style={styles.leading}>
          {leading}
        </View>
      )}
      
      <View style={styles.content}>
        <Text style={[
          {
            color: tokens.foreground,
            fontSize: typography.scale.body.fontSize,
            lineHeight: typography.scale.body.lineHeight,
            fontFamily: typography.fonts.sans,
          }
        ]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[
            {
              color: tokens.foregroundMuted,
              fontSize: typography.scale.bodySmall.fontSize,
              lineHeight: typography.scale.bodySmall.lineHeight,
              fontFamily: typography.fonts.sans,
              marginTop: spacing[0.5],
            }
          ]}>
            {subtitle}
          </Text>
        )}
      </View>
      
      {(trailing || showChevron) && (
        <View style={styles.trailing}>
          {trailing}
          {showChevron && <ChevronRight size={20} color={tokens.foregroundSubtle} />}
        </View>
      )}
    </View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  
  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
});
```

### Component: ProgressBar

**File:** `src/components/ui/ProgressBar.tsx`

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  height = 6,
}) => {
  const { tokens, radius } = useTheme();
  
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const fillColor = color || tokens.primary;
  
  return (
    <View style={[
      styles.track,
      {
        height,
        borderRadius: height / 2,
        backgroundColor: tokens.borderSubtle,
      }
    ]}>
      <View style={[
        styles.fill,
        {
          width: `${clampedProgress}%`,
          height,
          borderRadius: height / 2,
          backgroundColor: fillColor,
        }
      ]} />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {},
});
```

### Component: Button

**File:** `src/components/ui/Button.tsx`

```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'small';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  style,
}) => {
  const { tokens, typography, radius, spacing } = useTheme();
  
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };
  
  const getBackgroundColor = () => {
    if (disabled) return tokens.secondary;
    switch (variant) {
      case 'primary': return tokens.primary;
      case 'secondary': return tokens.secondary;
      case 'ghost': return 'transparent';
    }
  };
  
  const getTextColor = () => {
    if (disabled) return tokens.foregroundMuted;
    switch (variant) {
      case 'primary': return tokens.primaryForeground;
      case 'secondary': return tokens.secondaryForeground;
      case 'ghost': return tokens.primary;
    }
  };
  
  const paddingVertical = size === 'default' ? spacing[3] : spacing[2];
  const paddingHorizontal = size === 'default' ? spacing[4] : spacing[3];
  
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.7}
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          borderRadius: radius.sm,
          paddingVertical,
          paddingHorizontal,
        },
        variant === 'ghost' && { paddingHorizontal: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <Text style={[
          {
            color: getTextColor(),
            fontSize: typography.scale.label.fontSize,
            lineHeight: typography.scale.label.lineHeight,
            fontFamily: typography.fonts.sansSemiBold,
            textAlign: 'center',
          }
        ]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Component: Divider

**File:** `src/components/ui/Divider.tsx`

```typescript
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface DividerProps {
  variant?: 'default' | 'subtle';
  spacing?: number;
}

export const Divider: React.FC<DividerProps> = ({
  variant = 'default',
  spacing: spacingProp,
}) => {
  const { tokens, spacing } = useTheme();
  
  const marginVertical = spacingProp ?? spacing[3];
  const color = variant === 'subtle' ? tokens.borderSubtle : tokens.border;
  
  return (
    <View style={{
      height: 1,
      backgroundColor: color,
      marginVertical,
    }} />
  );
};
```

### Create Index File

**File:** `src/components/ui/index.ts`

```typescript
export { Card } from './Card';
export { WidgetHeader } from './WidgetHeader';
export { Stat } from './Stat';
export { ListItem } from './ListItem';
export { ProgressBar } from './ProgressBar';
export { Button } from './Button';
export { Divider } from './Divider';
```

### Verification
- All components render without errors
- Components respond to dark mode correctly
- TypeScript has no errors

---

## Phase 2: Simplify Home Layout

**Goal:** Remove redundant elements from the home screen.

### Tasks

- [ ] In `app/_home.tsx`, remove:
  - `FocusPill` component and import
  - `forecastBanner` (the network forecast View)
  - `SuggestedWeaves` component and import

- [ ] Update `HomeWidgetBase.tsx` to use the new `Card` component internally

- [ ] Update `HomeWidgetGrid.tsx` to use `layout.cardGap` for spacing

### Before (in `_home.tsx`):
```tsx
return (
  <>
    {networkForecast && (...)} {/* REMOVE */}
    <FocusPill /> {/* REMOVE */}
    <SuggestedWeaves /> {/* REMOVE */}
    <HomeWidgetGrid widgets={widgets} />
    ...
  </>
);
```

### After:
```tsx
return (
  <>
    <HomeWidgetGrid widgets={widgets} />
    ...
  </>
);
```

### Verification
- Home screen renders with only the widget grid
- No errors or missing imports
- Visual appearance is cleaner (fewer elements)

---

## Phase 3-6: Widget Rebuilds

For each widget, follow this pattern:

1. **Create V2 file** — Don't modify the original yet
2. **Implement new design** — Use base components from `src/components/ui/`
3. **Test thoroughly** — All states, both color modes
4. **Swap in `_home.tsx`** — Replace old component with new
5. **Delete old file** — Clean up

### Widget Priority Order

1. **Phase 3: Today's Focus** (3-4 days) — Most complex, most important
2. **Phase 4: Social Season** (2 days) — Remove gamification
3. **Phase 5: Your Energy** (2 days) — Rename from Year in Moons
4. **Phase 6: Network Alignment** (1-2 days) — Simplest

### Key Design Rules for All Widgets

1. **No gradient backgrounds** — Use `Card` component with `variant="elevated"` for emphasis
2. **No hardcoded colors** — Always use `tokens.colorName`
3. **No inline font styles** — Use `typography.scale.x` and `typography.fonts.x`
4. **No random spacing** — Use `spacing[n]` or `layout.x`
5. **No streak/score language** — Show data as history, not achievement
6. **Expansion in sheets** — Don't expand cards inline, use bottom sheets

### Target Metrics

| Widget | Current LOC | Target LOC |
|--------|-------------|------------|
| TodaysFocus | 1000+ | <400 |
| SocialSeason | ~400 | <200 |
| YourEnergy | ~300 | <200 |
| NetworkAlignment | ~250 | <150 |

---

## Phase 7: Polish & QA

### Checklist

- [ ] All widgets use consistent `Card` component
- [ ] All text uses `typography.scale` (no raw fontSize)
- [ ] All colors use `tokens` (no hex values)
- [ ] All spacing uses `spacing` or `layout` (no magic numbers)
- [ ] Dark mode looks correct (refined mystical, not broken)
- [ ] Touch targets are ≥44pt
- [ ] Haptic feedback on all buttons
- [ ] No console warnings or errors

### Screen Size Testing
- iPhone SE (small)
- iPhone 14 (medium)  
- iPhone 14 Pro Max (large)

---

## Phase 8: Cleanup

- [ ] Delete old widget files (V1 versions)
- [ ] Delete `FocusPill.tsx`
- [ ] Delete unused styles and imports
- [ ] Remove old `theme.ts` if fully migrated
- [ ] Update any remaining component imports

---

## Reference Commands

```bash
# Run the app
npx expo start

# Type check
npx tsc --noEmit

# Find hardcoded colors (should be 0 after refactor)
grep -r "#[0-9A-Fa-f]\{6\}" src/components/home/widgets/

# Find hardcoded font sizes (should be 0 after refactor)
grep -r "fontSize: [0-9]" src/components/home/widgets/
```

---

## Questions?

Refer to `WEAVE_DESIGN_SYSTEM.md` for:
- Exact color values
- Typography specifications  
- Component visual specs
- Widget layout diagrams

If something is ambiguous, prioritize:
1. Simplicity over features
2. Consistency over uniqueness
3. Native feel over custom animations
