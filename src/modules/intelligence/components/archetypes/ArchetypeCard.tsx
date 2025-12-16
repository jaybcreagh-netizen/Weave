import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { type Archetype } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { archetypeData, ARCHETYPE_GRADIENTS } from '@/shared/constants/constants';
import { Text } from '@/shared/ui/Text';
import { ArchetypeIcon } from './ArchetypeIcon';

interface ArchetypeCardProps {
  archetype: Archetype;
  isSelected?: boolean;
  onSelect?: (archetype: Archetype) => void;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

export function ArchetypeCard({
  archetype,
  isSelected = false,
  onSelect,
  onPress,
  style,
  className,
}: ArchetypeCardProps) {
  const { setArchetypeModal } = useGlobalUI();
  const { colors } = useTheme();
  const data = archetypeData[archetype];

  if (!data) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (onSelect) {
      onSelect(archetype);
    }
  };

  const handleLongPress = () => {
    setArchetypeModal(archetype);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const gradient = ARCHETYPE_GRADIENTS[archetype] || ['#6b7280', '#4b5563'];
  const textColor = isSelected ? colors.primary : colors.foreground;

  // Merge default className with prop className
  const containerClass = `relative rounded-2xl items-center justify-center p-3 w-full min-h-[180px] overflow-hidden ${className || ''}`;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      className={containerClass}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderWidth: isSelected ? 3 : 0,
          borderColor: isSelected ? gradient[0] : 'transparent',
          shadowColor: isSelected ? gradient[0] : '#000',
          shadowOpacity: isSelected ? 0.4 : 0.05,
          shadowOffset: isSelected ? { width: 0, height: 6 } : { width: 0, height: 2 },
          shadowRadius: isSelected ? 16 : 8,
          elevation: isSelected ? 8 : 2,
          transform: [{ scale: pressed ? 0.98 : isSelected ? 1.03 : 1 }],
        },
        style
      ]}
    >
      {/* Gradient Background - more prominent when selected */}
      <LinearGradient
        colors={[...gradient.map(c => c + (isSelected ? 'E6' : '10')), 'transparent'] as any}
        className="absolute inset-0"
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Content */}
      <View className="relative z-10 items-center" style={{ opacity: isSelected ? 1 : 0.8 }}>
        {/* Tarot Card SVG via ArchetypeIcon */}
        <View
          className="mb-3 items-center justify-center rounded-xl bg-card"
          style={{
            width: 80,
            height: 120,
            shadowColor: gradient[0],
            shadowOpacity: isSelected ? 0.4 : 0.1,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            elevation: isSelected ? 4 : 2,
            paddingTop: 0 // ArchetypeIcon might need adjustment
          }}
        >
          {/* Note: ArchetypeIcon takes size, but SVGs inside might be sized differently.
              The original used width 80 height 120. ArchetypeIcon takes 'size' (square).
              But SVGs like EmperorSvg usually scale. Let's try size={80}.
              However, card aspect ratio is 2:3. 
              If ArchetypeIcon renders a square SVG, it might look odd if we want 2:3.
              Let's check ArchetypeIcon implementation again.
              It sets width={size} height={size}.
              The original code passed width=80 height=120 to createElement default.
              So I should probably NOT use ArchetypeIcon if I want non-square?
              OR I update ArchetypeIcon to accept width/height.
              Let's check ArchetypeIcon.tsx again.
              It uses `width: size, height: size`.
              I will pass `size={100}` and let it conform to container?
              Or I'll stick to the previous map logic if preserving 2:3 ratio is critical.
              The tarot cards are definitely rectangular.
              I'll just reuse the SVG map logic within ArchetypeCard for now to avoid breaking the aspect ratio,
              OR I can update ArchetypeIcon to accept width/height props.
              Refactoring ArchetypeIcon seems better.
          */}
          <ArchetypeIcon archetype={archetype} width={80} height={120} color={colors.foreground} />
        </View>

        <Text
          variant="body"
          weight="semibold"
          className="text-center text-xs mb-0.5"
          style={{ color: textColor }}
        >
          {data.name.replace("The ", "")}
        </Text>
        <Text
          variant="caption"
          className="text-center text-[10px] leading-[14px] px-1"
          style={{ color: colors['muted-foreground'] }}
          numberOfLines={1}
        >
          {data.essence}
        </Text>
      </View>
    </Pressable>
  );
}