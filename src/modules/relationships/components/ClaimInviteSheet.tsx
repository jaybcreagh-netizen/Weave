import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { Icon } from '@/shared/ui/Icon';
import { useUIStore } from '@/shared/stores/uiStore';

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

// RPC Response type
interface ClaimInviteResponse {
    weave_snapshot: any;
    creator_id: string;
    creator_name: string;
    friend_name: string;
}

interface ClaimInviteSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialCode?: string;
}

export const ClaimInviteSheet: React.FC<ClaimInviteSheetProps> = ({
    visible,
    onClose,
    onSuccess,
    initialCode
}) => {
    const [code, setCode] = useState(initialCode || '');

    // Update code if initialCode changes when reopening
    React.useEffect(() => {
        if (visible && initialCode) {
            setCode(initialCode);
        }
    }, [visible, initialCode]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [claimedData, setClaimedData] = useState<ClaimInviteResponse | null>(null);

    const showToast = useUIStore((state) => state.showToast);

    const processClaimedInvite = async (data: ClaimInviteResponse) => {
        try {
            await database.write(async () => {
                const { creator_id, creator_name, weave_snapshot } = data;

                // 1. Find or Create Friend
                const friendsCollection = database.get<FriendModel>('friends');
                const existingFriends = await friendsCollection.query(
                    Q.where('linked_user_id', creator_id)
                ).fetch();

                let friend: FriendModel;

                if (existingFriends.length > 0) {
                    friend = existingFriends[0];
                    // Optional: Update name if needed, but respect user's local name usually
                } else {
                    friend = await friendsCollection.create((f) => {
                        f.name = creator_name || 'New Friend';
                        f.linkedUserId = creator_id;
                        f.linkStatus = 'linked';
                        f.dunbarTier = 'Community'; // Default
                        // Initialize other fields as needed
                        f.resilience = 1;
                        f.ratedWeavesCount = 0;
                        f.momentumScore = 0;
                        f.consecutiveUserInitiations = 0;
                        f.totalUserInitiations = 0;
                        f.totalFriendInitiations = 0;
                        f.initiationRatio = 0.5;
                        f.outcomeCount = 0;
                    });
                }

                // 2. Create Interaction from Snapshot
                if (weave_snapshot) {
                    const interactionsCollection = database.get<InteractionModel>('interactions');
                    const newInteraction = await interactionsCollection.create((i) => {
                        i.title = weave_snapshot.title || 'Shared Weave';
                        i.interactionDate = new Date(weave_snapshot.interaction_date || Date.now());
                        i.location = weave_snapshot.location;
                        i.activity = weave_snapshot.activity;
                        i.duration = weave_snapshot.duration;
                        i.vibe = weave_snapshot.vibe;
                        i.note = weave_snapshot.note;
                        i.mode = weave_snapshot.mode;
                        i.interactionType = weave_snapshot.interaction_type || 'planned';
                        i.eventImportance = weave_snapshot.event_importance;
                        i.interactionCategory = weave_snapshot.interaction_category;
                        i.status = 'planned'; // Default for shared weave
                    });

                    // 3. Link Interaction to Friend
                    const joinCollection = database.get<InteractionFriend>('interaction_friends');
                    await joinCollection.create((join) => {
                        join.interaction.set(newInteraction);
                        join.friend.set(friend);
                    });
                }
            });
            console.log('Claimed invite processed successfully');
        } catch (err) {
            console.error('Error processing claimed invite:', err);
            // Non-fatal, user still claimed it on server, but local sync might be needed
            showToast('Invite claimed, but local setup failed. Try syncing.', 'System');
        }
    };

    const handleClaim = async () => {
        if (!code || code.length < 6) return;

        setIsLoading(true);
        setError(null);
        const supabase = getSupabaseClient();

        if (!supabase) {
            setError('Connection error');
            setIsLoading(false);
            return;
        }

        try {
            const { data, error: rpcError } = await supabase.rpc('claim_invite', {
                p_code: code,
            });

            if (rpcError) throw rpcError;

            // Expecting array response from RPC returning TABLE
            const results = data as ClaimInviteResponse[];
            if (results && results.length > 0) {
                const result = results[0];

                // Process local data creation
                await processClaimedInvite(result);

                setClaimedData(result);
                showToast('Invite claimed successfully!', result.creator_name);

                if (onSuccess) onSuccess();
            } else {
                throw new Error('Invalid code');
            }
        } catch (err: any) {
            console.error('Error claiming invite:', err);
            setError(err.message || 'Failed to claim invite');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setCode('');
        setClaimedData(null);
        setError(null);
        onClose();
    };

    // Success View
    if (claimedData) {
        return (
            <StandardBottomSheet
                visible={visible}
                onClose={handleClose}
                title="Welcome to Weave!"
                snapPoints={['50%'] as any}
            >
                <View className="flex-1 px-6 pt-4 pb-8 items-center justify-between">
                    <View className="items-center w-full space-y-4">
                        <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-2">
                            <Icon name="Check" size={32} color="#166534" />
                        </View>

                        <Text variant="h3" className="text-center">
                            You're connected with {claimedData.creator_name || 'your friend'}!
                        </Text>

                        <Text variant="body" className="text-center text-gray-500">
                            We've set up your shared space properly. You can now see the weave they planned.
                        </Text>
                    </View>

                    <Button
                        label="Awesome, let's go!"
                        onPress={handleClose}
                        variant="primary"
                        fullWidth
                        size="lg"
                    />
                </View>
            </StandardBottomSheet>
        );
    }

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={handleClose}
            title="Redeem Invite"
            snapPoints={['50%', '90%'] as any}
        >
            <View className="flex-1 px-6 pt-4 pb-8 justify-between">
                <View className="space-y-6">
                    <Text variant="body" className="text-gray-500">
                        Enter the 6-character code shared by your friend to join their Weave.
                    </Text>

                    <View>
                        <Input
                            value={code}
                            onChangeText={(text) => {
                                setCode(text.toUpperCase());
                                setError(null);
                            }}
                            placeholder="e.g. A1B2C3"
                            autoCapitalize="characters"
                            maxLength={6}
                            label="Invite Code"
                            error={error || undefined}
                        />
                    </View>
                </View>

                <View className="space-y-3 safe-mb">
                    <Button
                        label={isLoading ? 'Verifying...' : 'Redeem Code'}
                        onPress={handleClaim}
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={isLoading}
                        disabled={!code || code.length < 6 || isLoading}
                    />
                    <Button
                        label="Cancel"
                        onPress={handleClose}
                        variant="ghost"
                        fullWidth
                        disabled={isLoading}
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
};
