/**
 * ActivityInboxSheet
 * 
 * Unified sheet for pending Link Requests and Shared Weaves.
 * Accessed from Settings when accounts are enabled.
 */

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, FlatList, Alert } from 'react-native';
import { UserPlus, Check, X, Inbox, RefreshCw, Link2, Send, History } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text } from '@/shared/ui';
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
import { LinkMatchConfirmModal } from '@/modules/relationships/components/LinkMatchConfirmModal';
import { usePendingWeaves } from '../hooks/usePendingWeaves';
import { useSharedWeaveHistory } from '../hooks/useSharedWeaveHistory';
import { SharedWeaveCard } from './SharedWeaveCard';

interface ActivityInboxSheetProps {
    visible: boolean;
    onClose: () => void;
    onRequestHandled?: () => void;
    portalHost?: string;
}

type TabType = 'requests' | 'weaves' | 'history';

export function ActivityInboxSheet({
    visible,
    onClose,
    onRequestHandled,
    portalHost
}: ActivityInboxSheetProps) {
    const { colors, isDarkMode } = useTheme();
    const [activeTab, setActiveTab] = useState<TabType>('requests');

    // Link Requests state
    const [requests, setRequests] = useState<LinkRequest[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

    // Match confirmation modal state
    const [matchModalVisible, setMatchModalVisible] = useState(false);
    const [pendingRequest, setPendingRequest] = useState<LinkRequest | null>(null);
    const [foundMatch, setFoundMatch] = useState<MatchCandidate | null>(null);

    // Shared Weaves state
    const {
        pendingWeaves,
        isLoading: loadingWeaves,
        error: weavesError,
        refresh: refreshWeaves,
        handleAccept: handleAcceptWeave,
        handleDecline: handleDeclineWeave,
        processingId: processingWeaveId,
    } = usePendingWeaves();

    // Shared Weave History (Phase 4)
    const {
        historyWeaves,
        isLoading: loadingHistory,
        refresh: refreshHistory
    } = useSharedWeaveHistory();

    const actuallyPendingWeaves = pendingWeaves.filter(w => w.status === 'pending');

    // Load requests when sheet opens
    useEffect(() => {
        if (visible) {
            loadRequests();
            refreshWeaves();
            refreshHistory();
        }
    }, [visible]);

    const loadRequests = async () => {
        setLoadingRequests(true);
        const pending = await getPendingIncomingRequests();
        setRequests(pending);
        setLoadingRequests(false);
    };

    const handleAcceptRequest = async (request: LinkRequest) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setProcessingRequestId(request.id);

        // Check for potential matching existing friends
        const match = await findBestMatch(request.displayName);

        if (match) {
            // Found a potential match - show confirmation modal
            setPendingRequest(request);
            setFoundMatch(match);
            setMatchModalVisible(true);
            setProcessingRequestId(null);
            return;
        }

        // No match found - proceed with creating new friend
        await completeAcceptRequest(request.id, undefined);
    };

    const completeAcceptRequest = async (requestId: string, localFriendId: string | undefined) => {
        setProcessingRequestId(requestId);

        const success = await acceptLinkRequest(requestId, localFriendId, 'Community');

        if (success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onRequestHandled?.();
        } else {
            Alert.alert('Error', 'Failed to accept request. Please try again.');
        }

        setProcessingRequestId(null);
    };

    const handleConfirmMatch = (friendId: string) => {
        if (pendingRequest) {
            setMatchModalVisible(false);
            completeAcceptRequest(pendingRequest.id, friendId);
        }
        setPendingRequest(null);
        setFoundMatch(null);
    };

    const handleCreateNewFriend = () => {
        if (pendingRequest) {
            setMatchModalVisible(false);
            completeAcceptRequest(pendingRequest.id, undefined);
        }
        setPendingRequest(null);
        setFoundMatch(null);
    };

    const handleDeclineRequest = async (request: LinkRequest) => {
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
                        setProcessingRequestId(request.id);
                        const success = await declineLinkRequest(request.id);

                        if (success) {
                            setRequests(prev => prev.filter(r => r.id !== request.id));
                        }

                        setProcessingRequestId(null);
                    }
                }
            ]
        );
    };

    const renderRequestItem = ({ item }: { item: LinkRequest }) => {
        const isProcessing = processingRequestId === item.id;

        return (
            <View
                className="flex-row items-center p-4 rounded-xl mb-3"
                style={{ backgroundColor: colors.card }}
            >
                {item.photoUrl ? (
                    <CachedImage
                        source={{ uri: item.photoUrl }}
                        style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                ) : (
                    <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text className="text-lg font-bold" style={{ color: colors['muted-foreground'] }}>
                            {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View className="flex-1 ml-3">
                    <Text className="font-semibold text-base" style={{ color: colors.foreground }}>
                        {item.displayName}
                    </Text>
                    <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>
                        @{item.username}
                    </Text>
                </View>

                <View className="flex-row gap-2">
                    {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <TouchableOpacity
                                className="p-2 rounded-full"
                                style={{ backgroundColor: colors.destructive + '20' }}
                                onPress={() => handleDeclineRequest(item)}
                            >
                                <X size={18} color={colors.destructive} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="p-2 rounded-full"
                                style={{ backgroundColor: colors.primary }}
                                onPress={() => handleAcceptRequest(item)}
                            >
                                <Check size={18} color={colors['primary-foreground']} />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    };

    const renderRequestsContent = () => {
        if (loadingRequests) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            );
        }

        if (requests.length === 0) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <View
                        className="w-14 h-14 rounded-full items-center justify-center mb-3"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Link2 size={24} color={colors['muted-foreground']} />
                    </View>
                    <Text className="text-center text-base font-medium" style={{ color: colors.foreground }}>
                        No pending requests
                    </Text>
                    <Text className="text-center text-sm mt-1 px-8" style={{ color: colors['muted-foreground'] }}>
                        When someone sends you a link request, it will appear here
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderRequestItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16 }}
            />
        );
    };

    const renderWeavesContent = () => {
        if (loadingWeaves) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            );
        }

        if (weavesError) {
            return (
                <View className="flex-1 items-center justify-center py-12 px-6">
                    <Text className="text-center" style={{ color: colors.destructive }}>
                        {weavesError}
                    </Text>
                    <TouchableOpacity
                        className="mt-4 flex-row items-center gap-2"
                        onPress={refreshWeaves}
                    >
                        <RefreshCw size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary }}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (actuallyPendingWeaves.length === 0) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <View
                        className="w-14 h-14 rounded-full items-center justify-center mb-3"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Send size={24} color={colors['muted-foreground']} />
                    </View>
                    <Text className="text-center text-base font-medium" style={{ color: colors.foreground }}>
                        No shared weaves
                    </Text>
                    <Text className="text-center text-sm mt-1 px-8" style={{ color: colors['muted-foreground'] }}>
                        When friends share weaves with you, they'll appear here
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={actuallyPendingWeaves}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <SharedWeaveCard
                        weave={item}
                        onAccept={handleAcceptWeave}
                        onDecline={handleDeclineWeave}
                        isProcessing={processingWeaveId === item.id}
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16 }}
            />
        );
    };

    // HISTORY TAB (Phase 4)
    const renderHistoryContent = () => {
        if (loadingHistory) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            );
        }

        if (historyWeaves.length === 0) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <View
                        className="w-14 h-14 rounded-full items-center justify-center mb-3"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <History size={24} color={colors['muted-foreground']} />
                    </View>
                    <Text className="text-center text-base font-medium" style={{ color: colors.foreground }}>
                        No history
                    </Text>
                    <Text className="text-center text-sm mt-1 px-8" style={{ color: colors['muted-foreground'] }}>
                        Accepted and declined weaves will appear here
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={historyWeaves}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <SharedWeaveCard
                        weave={item}
                    // Read-only, no handlers passed
                    />
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16 }}
            />
        );
    };

    const requestCount = requests.length;
    const weaveCount = actuallyPendingWeaves.length;

    return (
        <>
            <StandardBottomSheet
                visible={visible}
                onClose={onClose}
                title="Activity"
                height="full"
                portalHost={portalHost}
            >
                <View className="flex-1">
                    {/* Tab Selector */}
                    <View className="flex-row mx-4 mb-4 p-1 rounded-xl" style={{ backgroundColor: colors.muted }}>
                        <TouchableOpacity
                            className="flex-1 py-2 rounded-lg items-center"
                            style={{ backgroundColor: activeTab === 'requests' ? colors.card : 'transparent' }}
                            onPress={() => setActiveTab('requests')}
                        >
                            <View className="flex-row items-center gap-2">
                                <Link2 size={16} color={activeTab === 'requests' ? colors.primary : colors['muted-foreground']} />
                                <Text
                                    className="font-medium text-xs"
                                    style={{ color: activeTab === 'requests' ? colors.foreground : colors['muted-foreground'] }}
                                >
                                    Requests{requestCount > 0 ? ` (${requestCount})` : ''}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 py-2 rounded-lg items-center"
                            style={{ backgroundColor: activeTab === 'weaves' ? colors.card : 'transparent' }}
                            onPress={() => setActiveTab('weaves')}
                        >
                            <View className="flex-row items-center gap-2">
                                <Send size={16} color={activeTab === 'weaves' ? colors.primary : colors['muted-foreground']} />
                                <Text
                                    className="font-medium text-xs"
                                    style={{ color: activeTab === 'weaves' ? colors.foreground : colors['muted-foreground'] }}
                                >
                                    Inbox{weaveCount > 0 ? ` (${weaveCount})` : ''}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 py-2 rounded-lg items-center"
                            style={{ backgroundColor: activeTab === 'history' ? colors.card : 'transparent' }}
                            onPress={() => setActiveTab('history')}
                        >
                            <View className="flex-row items-center gap-2">
                                <History size={16} color={activeTab === 'history' ? colors.primary : colors['muted-foreground']} />
                                <Text
                                    className="font-medium text-xs"
                                    style={{ color: activeTab === 'history' ? colors.foreground : colors['muted-foreground'] }}
                                >
                                    History
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {activeTab === 'requests' ? renderRequestsContent() :
                        activeTab === 'weaves' ? renderWeavesContent() : renderHistoryContent()}
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
                        isLoading={processingRequestId === pendingRequest.id}
                    />
                )
            }
        </>
    );
}
