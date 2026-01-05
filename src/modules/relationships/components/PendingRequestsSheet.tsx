/**
 * Pending Requests Sheet
 * 
 * Sheet showing incoming link requests with accept/decline actions.
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { UserPlus, Check, X, Link } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text, Button } from '@/shared/ui';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    getPendingIncomingRequests,
    acceptLinkRequest,
    declineLinkRequest,
    LinkRequest
} from '@/modules/relationships/services/friend-linking.service';
import {
    findBestMatch,
    MatchCandidate,
} from '@/modules/relationships/services/friend-matching.service';
import { LinkMatchConfirmModal } from './LinkMatchConfirmModal';

interface PendingRequestsSheetProps {
    visible: boolean;
    onClose: () => void;
    onRequestHandled?: () => void;
}

export function PendingRequestsSheet({
    visible,
    onClose,
    onRequestHandled
}: PendingRequestsSheetProps) {
    const { colors } = useTheme();
    const [requests, setRequests] = useState<LinkRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Match confirmation modal state
    const [matchModalVisible, setMatchModalVisible] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<LinkRequest | null>(null);
    const [foundMatch, setFoundMatch] = useState<MatchCandidate | null>(null);
    const [selectedTier, setSelectedTier] = useState<'InnerCircle' | 'CloseFriends' | 'Community'>('Community');

    // Load requests when sheet opens
    useEffect(() => {
        if (visible) {
            loadRequests();
        }
    }, [visible]);

    const loadRequests = async () => {
        setLoading(true);
        const pending = await getPendingIncomingRequests();
        setRequests(pending);
        setLoading(false);
    };

    const handleAccept = async (request: LinkRequest) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const processAccept = async (tier: 'InnerCircle' | 'CloseFriends' | 'Community') => {
            setProcessingId(request.id);

            // Check for potential matching existing friends
            const match = await findBestMatch(request.displayName);

            if (match) {
                // Found a potential match - show confirmation modal
                setPendingRequest(request);
                setFoundMatch(match);
                setSelectedTier(tier);
                setMatchModalVisible(true);
                setProcessingId(null);
                return;
            }

            // No match found - proceed with creating new friend
            await completeAcceptRequest(request.id, undefined, tier);
        };

        Alert.alert(
            'Add Friend',
            `Which circle does ${request.displayName} belong to?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Community', onPress: () => processAccept('Community') },
                { text: 'Close Friends', onPress: () => processAccept('CloseFriends') },
                { text: 'Inner Circle', onPress: () => processAccept('InnerCircle') },
            ]
        );
    };

    const completeAcceptRequest = async (
        requestId: string,
        localFriendId: string | undefined,
        tier: 'InnerCircle' | 'CloseFriends' | 'Community'
    ) => {
        setProcessingId(requestId);
        const success = await acceptLinkRequest(requestId, localFriendId, tier);

        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onRequestHandled?.();
        } else {
            Alert.alert('Error', 'Failed to accept request. Please try again.');
        }
        setProcessingId(null);
    };

    const handleConfirmMatch = (friendId: string) => {
        if (pendingRequest) {
            setMatchModalVisible(false);
            completeAcceptRequest(pendingRequest.id, friendId, selectedTier);
        }
        setPendingRequest(null);
        setFoundMatch(null);
    };

    const handleCreateNewFriend = () => {
        if (pendingRequest) {
            setMatchModalVisible(false);
            completeAcceptRequest(pendingRequest.id, undefined, selectedTier);
        }
        setPendingRequest(null);
        setFoundMatch(null);
    };

    const handleDecline = async (request: LinkRequest) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Alert.alert(
            'Decline Request',
            `Are you sure you want to decline the link request from ${request.displayName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: async () => {
                        setProcessingId(request.id);
                        const success = await declineLinkRequest(request.id);

                        if (success) {
                            setRequests(prev => prev.filter(r => r.id !== request.id));
                        }

                        setProcessingId(null);
                    }
                }
            ]
        );
    };

    const renderRequestItem = ({ item }: { item: LinkRequest }) => {
        const isProcessing = processingId === item.id;

        return (
            <View
                className="flex-row items-center p-4 rounded-xl mb-3"
                style={{ backgroundColor: colors.card }}
            >
                {/* Profile Photo */}
                {item.photoUrl ? (
                    <CachedImage
                        source={{ uri: item.photoUrl }}
                        style={{ width: 56, height: 56, borderRadius: 28 }}
                    />
                ) : (
                    <View
                        className="w-14 h-14 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text className="text-xl font-bold" style={{ color: colors['muted-foreground'] }}>
                            {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* User Info */}
                <View className="flex-1 ml-3">
                    <Text className="font-semibold text-base" style={{ color: colors.foreground }}>
                        {item.displayName}
                    </Text>
                    <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
                        @{item.username}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: colors['muted-foreground'] }}>
                        Wants to connect with you
                    </Text>
                </View>

                {/* Action Buttons */}
                <View className="flex-row gap-2">
                    {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <TouchableOpacity
                                className="p-2 rounded-full"
                                style={{ backgroundColor: colors.destructive + '20' }}
                                onPress={() => handleDecline(item)}
                            >
                                <X size={20} color={colors.destructive} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="p-2 rounded-full"
                                style={{ backgroundColor: colors.primary }}
                                onPress={() => handleAccept(item)}
                            >
                                <Check size={20} color={colors['primary-foreground']} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    return (
        <>
            <StandardBottomSheet
                visible={visible}
                onClose={onClose}
                title="Link Requests"
                height="form"
            >
                <View className="flex-1 px-4">
                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : requests.length > 0 ? (
                        <FlatList
                            data={requests}
                            keyExtractor={item => item.id}
                            renderItem={renderRequestItem}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <View className="flex-1 items-center justify-center">
                            <UserPlus size={48} color={colors['muted-foreground']} />
                            <Text className="text-center mt-4 text-lg font-medium" style={{ color: colors.foreground }}>
                                No pending requests
                            </Text>
                            <Text className="text-center text-sm mt-2" style={{ color: colors['muted-foreground'] }}>
                                When someone sends you a link request, it will appear here
                            </Text>
                        </View>
                    )}
                </View>
            </StandardBottomSheet>

            {/* Match Confirmation Modal */}
            {
                pendingRequest && foundMatch && (
                    <LinkMatchConfirmModal
                        visible={matchModalVisible}
                        onClose={() => {
                            setMatchModalVisible(false);
                            setPendingRequest(null);
                            setFoundMatch(null);
                        }}
                        incomingRequest={{
                            displayName: pendingRequest.displayName,
                            username: pendingRequest.username,
                            photoUrl: pendingRequest.photoUrl,
                        }}
                        match={foundMatch}
                        onConfirmLink={handleConfirmMatch}
                        onCreateNew={handleCreateNewFriend}
                        isLoading={processingId === pendingRequest.id}
                    />
                )
            }
        </>
    );
}
