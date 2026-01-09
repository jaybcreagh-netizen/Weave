import React, { useState, useMemo } from 'react';
import { View, Text as RNText, TouchableOpacity } from 'react-native';
import { Calendar, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { useReachOut, ContactLinker } from '@/modules/messaging';
import { CachedImage } from '@/shared/ui/CachedImage';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { icons } from 'lucide-react-native';

interface SuggestionActionSheetProps {
    suggestion: Suggestion | null;
    friend: FriendModel | null;
    isOpen: boolean;
    onClose: () => void;
    onPlan: (suggestion: Suggestion, friend: FriendModel) => void;
    onDismiss: (suggestion: Suggestion) => void;
    /**
     * Optional callback when reach out is successful.
     * If provided, the sheet will handle the reach out logic internally.
     */
    onReachOutSuccess?: (suggestion: Suggestion) => void;
}

/**
 * SuggestionActionSheet - Refined action sheet for suggestions
 * 
 * Features a clean, focused design with:
 * - Prominent friend avatar at top
 * - Inline suggestion context
 * - Elegant action buttons
 */
export function SuggestionActionSheet({
    suggestion,
    friend,
    isOpen,
    onClose,
    onPlan,
    onDismiss,
    onReachOutSuccess,
}: SuggestionActionSheetProps) {
    const { colors, tokens, typography } = useTheme();
    const [showContactLinker, setShowContactLinker] = useState(false);
    const { reachOut } = useReachOut();

    const handlePlan = () => {
        if (!suggestion || !friend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
        setTimeout(() => onPlan(suggestion, friend), 300);
    };

    const handleDismissAction = () => {
        if (!suggestion) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        setTimeout(() => onDismiss(suggestion), 300);
    };

    const handleReachOut = async () => {
        if (!friend || !suggestion) return;

        const hasContactInfo = friend.phoneNumber || friend.email;

        if (!hasContactInfo) {
            setShowContactLinker(true);
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await reachOut(friend, suggestion.subtitle);

        if (result.success) {
            onClose();
            onReachOutSuccess?.(suggestion);
        }
    };

    // Resolve photo URL for local file paths (same pattern as FriendListRow)
    // This MUST be before the early return to satisfy React's rules of hooks
    const resolvedPhotoUrl = useMemo(() => {
        const photoUrl = friend?.photoUrl;
        if (!photoUrl) return null;
        // If it's a relative path, prepend document directory
        if (!photoUrl.startsWith('file://') && !photoUrl.startsWith('/') && !photoUrl.startsWith('http')) {
            return `${FileSystem.documentDirectory}${photoUrl.replace(/^\//, '')}`;
        }
        return photoUrl;
    }, [friend?.photoUrl]);

    if (!suggestion || !friend) return null;

    // Get initials for fallback avatar
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    // Determine accent color based on suggestion urgency
    const urgencyColors = {
        critical: tokens.celebrate,
        high: tokens.primaryMuted,
        medium: tokens.primary,
        low: tokens.primary,
    };
    const accentColor = urgencyColors[suggestion.urgency || 'low'];

    // Get appropriate icon
    const iconName = (suggestion.icon && icons[suggestion.icon as keyof typeof icons])
        ? (suggestion.icon as keyof typeof icons)
        : 'Sparkles';

    const isSpecial = suggestion.urgency === 'critical';

    return (
        <AnimatedBottomSheet
            visible={isOpen}
            onClose={onClose}
            height="form"
        >
            {/* Hero Section - Friend Avatar & Context */}
            <Animated.View
                entering={FadeIn.duration(300)}
                className="items-center mb-6"
            >
                {/* Avatar with accent ring */}
                <View
                    className="relative mb-4"
                    style={{
                        shadowColor: accentColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                    }}
                >
                    {resolvedPhotoUrl ? (
                        <CachedImage
                            source={{ uri: resolvedPhotoUrl }}
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                borderWidth: 3,
                                borderColor: accentColor,
                            }}
                            contentFit="cover"
                        />
                    ) : (
                        <View
                            className="items-center justify-center"
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                backgroundColor: accentColor + '30',
                                borderWidth: 3,
                                borderColor: accentColor,
                            }}
                        >
                            <RNText
                                style={{
                                    color: accentColor,
                                    fontSize: 32,
                                    fontWeight: '800',
                                    textAlign: 'center',
                                }}
                            >
                                {getInitials(friend.name)}
                            </RNText>
                        </View>
                    )}

                    {/* Category badge overlay */}
                    <View
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full items-center justify-center"
                        style={{
                            backgroundColor: colors.card,
                            borderWidth: 2,
                            borderColor: colors.card,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                        }}
                    >
                        <Icon name={iconName} size={16} color={accentColor} />
                    </View>
                </View>

                {/* Friend name */}
                <Text
                    variant="h2"
                    weight="bold"
                    style={{
                        color: colors.foreground,
                        textAlign: 'center',
                        marginBottom: 4,
                    }}
                >
                    {friend.name}
                </Text>

                {/* Special badge if applicable */}
                {isSpecial && (
                    <View
                        className="px-3 py-1 rounded-full mb-3"
                        style={{ backgroundColor: tokens.celebrateSubtle }}
                    >
                        <Text
                            variant="caption"
                            style={{
                                color: tokens.celebrate,
                                fontSize: 10,
                                fontWeight: '700',
                                letterSpacing: 0.5,
                            }}
                        >
                            ✨ SPECIAL MOMENT
                        </Text>
                    </View>
                )}

                {/* Suggestion context */}
                <View
                    className="px-4 py-3 rounded-xl w-full"
                    style={{ backgroundColor: tokens.backgroundMuted }}
                >
                    <Text
                        variant="body"
                        weight="semibold"
                        style={{
                            color: colors.foreground,
                            textAlign: 'center',
                            marginBottom: 4,
                            fontSize: 15,
                        }}
                    >
                        {suggestion.title}
                    </Text>
                    {suggestion.subtitle && (
                        <Text
                            variant="caption"
                            style={{
                                color: colors['muted-foreground'],
                                textAlign: 'center',
                                lineHeight: 20,
                            }}
                        >
                            {suggestion.contextSnippet || suggestion.subtitle}
                        </Text>
                    )}
                </View>
            </Animated.View>

            {/* Action Buttons - Pill style matching Oracle/Plan Wizard */}
            <Animated.View
                entering={FadeInDown.delay(100).duration(300)}
                className="gap-3"
            >
                {/* Plan Weave - Primary Action */}
                <TouchableOpacity
                    onPress={handlePlan}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-center gap-2 py-3.5 px-6 rounded-full"
                    style={{
                        backgroundColor: colors.primary,
                    }}
                >
                    <Calendar color={colors['primary-foreground']} size={18} />
                    <Text
                        variant="body"
                        weight="semibold"
                        style={{
                            color: colors['primary-foreground'],
                        }}
                    >
                        Plan Weave
                    </Text>
                </TouchableOpacity>

                {/* Reach Out - Secondary/Outline Action */}
                <TouchableOpacity
                    onPress={handleReachOut}
                    activeOpacity={0.7}
                    className="flex-row items-center justify-center gap-2 py-3.5 px-6 rounded-full border"
                    style={{
                        backgroundColor: 'transparent',
                        borderColor: colors.border,
                    }}
                >
                    <MessageCircle color={colors.foreground} size={18} />
                    <Text
                        variant="body"
                        weight="semibold"
                        style={{
                            color: colors.foreground,
                        }}
                    >
                        Reach Out
                    </Text>
                </TouchableOpacity>

                {/* Dismiss - Ghost/Text Link */}
                <TouchableOpacity
                    className="items-center justify-center py-2"
                    onPress={handleDismissAction}
                    activeOpacity={0.6}
                >
                    <Text
                        variant="body"
                        style={{
                            color: colors['muted-foreground'],
                        }}
                    >
                        Dismiss
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Contact Linker Sheet */}
            {friend && (
                <ContactLinker
                    visible={showContactLinker}
                    onClose={() => setShowContactLinker(false)}
                    friend={friend}
                    onLinked={() => {
                        setShowContactLinker(false);
                        handleReachOut();
                    }}
                />
            )}
        </AnimatedBottomSheet>
    );
}
