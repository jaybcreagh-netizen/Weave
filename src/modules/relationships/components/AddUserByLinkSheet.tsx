import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Check, AlertCircle } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { createLinkedFriend, WeaveUserSearchResult } from '@/modules/relationships';
import FriendModel from '@/db/models/Friend';

interface AddUserByLinkSheetProps {
    visible: boolean;
    onClose: () => void;
    userId?: string;
}

export const AddUserByLinkSheet: React.FC<AddUserByLinkSheetProps> = ({
    visible,
    onClose,
    userId,
}) => {
    const { colors } = useTheme();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<WeaveUserSearchResult | null>(null);
    const [existingFriend, setExistingFriend] = useState<FriendModel | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (visible && userId) {
            checkUserAndFriendship(userId);
        } else {
            resetState();
        }
    }, [visible, userId]);

    const resetState = () => {
        setUser(null);
        setExistingFriend(null);
        setError(null);
        setLoading(false);
        setIsAdding(false);
    };

    const checkUserAndFriendship = async (targetUserId: string) => {
        setLoading(true);
        setError(null);
        const supabase = getSupabaseClient();

        try {
            if (!supabase) throw new Error('Not authenticated');

            // 1. Check local DB for existing friend
            const friendsCollection = database.get<FriendModel>('friends');
            const existingLinks = await friendsCollection.query(
                Q.where('linked_user_id', targetUserId)
            ).fetch();

            if (existingLinks.length > 0) {
                setExistingFriend(existingLinks[0]);
                setLoading(false);
                return;
            }

            // 2. Fetch User Profile from Supabase
            // We need a helper for this or direct query
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('id, username, display_name, avatar_url')
                .eq('id', targetUserId)
                .single();

            if (profileError || !profile) {
                setError('User not found');
            } else {
                setUser({
                    id: profile.id,
                    username: profile.username,
                    displayName: profile.display_name,
                    avatarUrl: profile.avatar_url,
                    matchScore: 0 // Irrelevant here
                });
            }

        } catch (err: any) {
            console.error('Error fetching user for link:', err);
            setError('Failed to load user');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFriend = async () => {
        if (!user) return;
        setIsAdding(true);
        try {
            const friend = await createLinkedFriend(user, 'Community');
            if (friend) {
                onClose();
                // Navigate to new friend profile
                setTimeout(() => {
                    router.push({ pathname: '/friend-profile', params: { friendId: friend.id } });
                }, 300);
            }
        } catch (err) {
            console.error('Error adding friend via link:', err);
            setError('Failed to add friend');
        } finally {
            setIsAdding(false);
        }
    };

    const handleViewProfile = () => {
        if (existingFriend) {
            onClose();
            router.push({ pathname: '/friend-profile', params: { friendId: existingFriend.id } });
        }
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title={existingFriend ? 'Friend Found' : 'Add Friend'}
            height="auto"
        >
            <View className="p-6 gap-6 items-center">
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                ) : error ? (
                    <View className="items-center gap-2">
                        <AlertCircle size={48} color={colors.destructive} />
                        <Text className="text-center text-muted-foreground">{error}</Text>
                        <Button onPress={onClose} variant="ghost">Close</Button>
                    </View>
                ) : existingFriend ? (
                    <View className="items-center gap-4 w-full">
                        <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center">
                            <Check size={32} color="green" />
                        </View>
                        <View className="items-center">
                            <Text className="text-xl font-bold">{existingFriend.name}</Text>
                            <Text className="text-muted-foreground">Is already in your circle</Text>
                        </View>
                        <Button onPress={handleViewProfile} className="w-full">
                            View Profile
                        </Button>
                    </View>
                ) : user ? (
                    <View className="items-center gap-6 w-full">
                        {/* Avatar Placeholder */}
                        <View className="w-24 h-24 rounded-full bg-muted items-center justify-center">
                            <Text className="text-2xl font-bold text-muted-foreground">
                                {(user.displayName || user.username).charAt(0).toUpperCase()}
                            </Text>
                        </View>

                        <View className="items-center">
                            <Text className="text-2xl font-bold font-lora-bold">
                                {user.displayName || user.username}
                            </Text>
                            <Text className="text-muted-foreground">
                                @{user.username}
                            </Text>
                        </View>

                        <Button
                            onPress={handleAddFriend}
                            className="w-full"
                            isLoading={isAdding}
                            icon={<UserPlus size={18} color="white" />}
                        >
                            Add to Weave
                        </Button>
                    </View>
                ) : null}
            </View>
        </StandardBottomSheet>
    );
};
