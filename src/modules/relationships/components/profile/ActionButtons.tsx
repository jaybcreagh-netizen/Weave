import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui';

interface ActionButtonsProps {
    buttonsOpacity: SharedValue<number>;
    onLogWeave: () => void;
    onPlanWeave: () => void;
    onJournal: () => void;
}

export function ActionButtons({
    buttonsOpacity,
    onLogWeave,
    onPlanWeave,
    onJournal,
}: ActionButtonsProps) {
    const { colors } = useTheme();

    const buttonsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
    }));

    const shadowStyle = {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    };

    return (
        <View className="px-5 pb-3">
            <Animated.View
                style={[
                    { flexDirection: 'row', gap: 12 },
                    buttonsAnimatedStyle
                ]}
            >
                {/* Log Weave Button */}
                <View style={[{ flex: 1, borderRadius: 12 }, shadowStyle]}>
                    <TouchableOpacity
                        onPress={onLogWeave}
                        activeOpacity={0.8}
                        style={{ borderRadius: 12, overflow: 'hidden' }}
                    >
                        <LinearGradient
                            colors={[colors.primary, `${colors.primary}DD`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                                height: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 8,
                            }}
                        >
                            <View
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                    borderBottomLeftRadius: 100,
                                    borderBottomRightRadius: 100,
                                }}
                            />
                            <Text
                                className="text-[13px] font-semibold tracking-wide text-center"
                                style={{ color: colors['primary-foreground'] }}
                                numberOfLines={1}
                            >
                                Log Weave
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Journal Button */}
                <View style={[{ flex: 1, borderRadius: 12, backgroundColor: colors.card }, shadowStyle]}>
                    <TouchableOpacity
                        onPress={onJournal}
                        activeOpacity={0.8}
                        style={{ borderRadius: 12, overflow: 'hidden' }}
                    >
                        <View
                            style={{
                                height: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 8,
                                backgroundColor: colors.card,
                            }}
                        >
                            <View
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                    borderBottomLeftRadius: 100,
                                    borderBottomRightRadius: 100,
                                }}
                            />
                            <Text
                                className="text-[13px] font-semibold tracking-wide text-center"
                                style={{ color: colors.foreground }}
                                numberOfLines={1}
                            >
                                Journal
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Plan Weave Button */}
                <View style={[{ flex: 1, borderRadius: 12 }, shadowStyle]}>
                    <TouchableOpacity
                        onPress={onPlanWeave}
                        activeOpacity={0.8}
                        style={{ borderRadius: 12, overflow: 'hidden' }}
                    >
                        <LinearGradient
                            colors={[colors.secondary, `${colors.secondary}CC`]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{
                                height: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingHorizontal: 8,
                            }}
                        >
                            <View
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    height: '50%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                    borderBottomLeftRadius: 100,
                                    borderBottomRightRadius: 100,
                                }}
                            />
                            <Text
                                className="text-[13px] font-semibold tracking-wide text-center"
                                style={{ color: colors.foreground }}
                                numberOfLines={1}
                            >
                                Plan Weave
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </View>
    );
}
