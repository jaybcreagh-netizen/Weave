import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { getFriendsForBrowsing } from '@/modules/journal';
import FriendModel from '@/db/models/Friend';
import { Users, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface JournalFriendListProps {
    onFriendArcPress: (friendId: string) => void;
}

interface FriendWithEntries {
    friend: FriendModel;
    entryCount: number;
    lastEntryDate: Date | null;
    recentActivityIndicator: 'high' | 'medium' | 'low';
}

export function JournalFriendList({ onFriendArcPress }: JournalFriendListProps) {
    const { colors } = useTheme();
    const [friends, setFriends] = useState<FriendWithEntries[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            const data = await getFriendsForBrowsing();
            setFriends(data);
        } catch (error) {
            console.error('Error loading friends for journal:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatEntryDate = (date: Date): string => {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const renderActivityIndicator = (level: 'high' | 'medium' | 'low') => {
        const dots = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
        return (
            <View className="flex-row gap-0.5">
                {[...Array(3)].map((_, i) => (
                    <View
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                            backgroundColor: i < dots ? colors.primary : colors.border,
                        }}
                    />
                ))}
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            <View className="px-5">
                {friends.length === 0 ? (
                    <View className="items-center justify-center py-16">
                        <Users size={40} color={colors['muted-foreground']} />
                        <Text
                            className="text-lg mt-4 text-center"
                            style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
                        >
                            No friendships documented yet
                        </Text>
                        <Text
                            className="text-sm mt-2 text-center"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                            Tag friends in your entries to see them here
                        </Text>
                    </View>
                ) : (
                    <>
                        <Text
                            className="text-xs uppercase tracking-wide mb-4"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
                        >
                            Your Friendships
                        </Text>

                        {friends.map((item, index) => (
                            <Animated.View
                                key={item.friend.id}
                                entering={FadeInDown.delay(index * 30).duration(300)}
                            >
                                <TouchableOpacity
                                    onPress={() => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        onFriendArcPress(item.friend.id);
                                    }}
                                    className="mb-3 p-4 rounded-2xl flex-row items-center"
                                    style={{
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    {/* Avatar */}
                                    <View
                                        className="w-12 h-12 rounded-full items-center justify-center mr-3"
                                        style={{ backgroundColor: colors.muted }}
                                    >
                                        <Text
                                            className="text-lg"
                                            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                                        >
                                            {item.friend.name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>

                                    {/* Info */}
                                    <View className="flex-1">
                                        <Text
                                            className="text-base"
                                            style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                                        >
                                            {item.friend.name}
                                        </Text>
                                        <View className="flex-row items-center gap-2 mt-0.5">
                                            <Text
                                                className="text-sm"
                                                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                            >
                                                {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
                                            </Text>
                                            {item.lastEntryDate && (
                                                <>
                                                    <Text style={{ color: colors.border }}>·</Text>
                                                    <Text
                                                        className="text-sm"
                                                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                                    >
                                                        Last: {formatEntryDate(item.lastEntryDate)}
                                                    </Text>
                                                </>
                                            )}
                                        </View>
                                    </View>

                                    {/* Activity indicator */}
                                    <View className="items-center">
                                        {renderActivityIndicator(item.recentActivityIndicator)}
                                    </View>

                                    <ChevronRight size={20} color={colors['muted-foreground']} className="ml-2" />
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </>
                )}
            </View>

            {/* Bottom padding */}
            <View className="h-24" />
        </ScrollView>
    );
}
