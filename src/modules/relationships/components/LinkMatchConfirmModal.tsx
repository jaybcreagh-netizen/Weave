/**
 * Link Match Confirm Modal
 * 
 * Shown when accepting a link request matches an existing offline friend.
 * Allows user to confirm if they're the same person or create a new one.
 */

import React from 'react';
import { View, Modal, TouchableOpacity, Image } from 'react-native';
import { Link2, UserPlus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import Friend from '@/db/models/Friend';
import { MatchCandidate } from '../services/friend-matching.service';

interface LinkMatchConfirmModalProps {
    visible: boolean;
    onClose: () => void;
    /** The incoming link request details */
    incomingRequest: {
        displayName: string;
        username: string;
        photoUrl?: string;
    };
    /** The potential matching local friend */
    match: MatchCandidate;
    /** Called when user confirms this is the same person */
    onConfirmLink: (friendId: string) => void;
    /** Called when user says this is NOT the same person */
    onCreateNew: () => void;
    /** Whether an action is currently processing */
    isLoading?: boolean;
}

export function LinkMatchConfirmModal({
    visible,
    onClose,
    incomingRequest,
    match,
    onConfirmLink,
    onCreateNew,
    isLoading = false,
}: LinkMatchConfirmModalProps) {
    const { colors, isDarkMode } = useTheme();

    const handleConfirmLink = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onConfirmLink(match.friend.id);
    };

    const handleCreateNew = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onCreateNew();
    };

    const getMatchReasonText = () => {
        switch (match.matchReason) {
            case 'phone_match':
                return 'Phone number matches';
            case 'exact_name':
                return 'Name matches exactly';
            case 'similar_name':
                return 'Name is similar';
            case 'combined':
                return 'Phone & name match';
            default:
                return 'Possible match';
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                className="flex-1 items-center justify-center px-6"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
                <View
                    className="w-full max-w-sm rounded-2xl p-5"
                    style={{ backgroundColor: colors.card }}
                >
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                            Same person?
                        </Text>
                        <TouchableOpacity onPress={onClose} disabled={isLoading}>
                            <X size={20} color={colors['muted-foreground']} />
                        </TouchableOpacity>
                    </View>

                    {/* Description */}
                    <Text className="text-sm mb-5" style={{ color: colors['muted-foreground'] }}>
                        We found a friend that might be the same person. Link them to preserve your interaction history.
                    </Text>

                    {/* Comparison Cards */}
                    <View className="flex-row gap-3 mb-5">
                        {/* Incoming Request */}
                        <Card className="flex-1 p-3 items-center">
                            {incomingRequest.photoUrl ? (
                                <Image
                                    source={{ uri: incomingRequest.photoUrl }}
                                    className="w-12 h-12 rounded-full mb-2"
                                    style={{ backgroundColor: colors.muted }}
                                />
                            ) : (
                                <View
                                    className="w-12 h-12 rounded-full mb-2 items-center justify-center"
                                    style={{ backgroundColor: colors.primary + '20' }}
                                >
                                    <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                                        {incomingRequest.displayName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <Text className="text-sm font-semibold text-center" style={{ color: colors.foreground }}>
                                {incomingRequest.displayName}
                            </Text>
                            <Text className="text-xs text-center" style={{ color: colors['muted-foreground'] }}>
                                @{incomingRequest.username}
                            </Text>
                            <View className="mt-2 px-2 py-1 rounded-full" style={{ backgroundColor: colors.primary + '20' }}>
                                <Text className="text-xs" style={{ color: colors.primary }}>Incoming</Text>
                            </View>
                        </Card>

                        {/* Existing Friend */}
                        <Card className="flex-1 p-3 items-center">
                            {match.friend.photoUrl ? (
                                <Image
                                    source={{ uri: match.friend.photoUrl }}
                                    className="w-12 h-12 rounded-full mb-2"
                                    style={{ backgroundColor: colors.muted }}
                                />
                            ) : (
                                <View
                                    className="w-12 h-12 rounded-full mb-2 items-center justify-center"
                                    style={{ backgroundColor: colors.accent + '20' }}
                                >
                                    <Text className="text-lg font-bold" style={{ color: colors.accent }}>
                                        {match.friend.name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <Text className="text-sm font-semibold text-center" style={{ color: colors.foreground }}>
                                {match.friend.name}
                            </Text>
                            <Text className="text-xs text-center" style={{ color: colors['muted-foreground'] }}>
                                {match.friend.tier}
                            </Text>
                            <View className="mt-2 px-2 py-1 rounded-full" style={{ backgroundColor: colors.accent + '20' }}>
                                <Text className="text-xs" style={{ color: colors.accent }}>Existing</Text>
                            </View>
                        </Card>
                    </View>

                    {/* Match Reason Badge */}
                    <View className="items-center mb-4">
                        <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.muted }}>
                            <Text className="text-xs" style={{ color: colors.foreground }}>
                                {getMatchReasonText()} • {Math.round(match.confidence * 100)}% confidence
                            </Text>
                        </View>
                    </View>

                    {/* Actions */}
                    <View className="gap-3">
                        <Button
                            label="Yes, link them"
                            icon={<Link2 size={16} color={colors['primary-foreground']} />}
                            onPress={handleConfirmLink}
                            disabled={isLoading}
                        />
                        <Button
                            variant="outline"
                            label="No, create new friend"
                            icon={<UserPlus size={16} color={colors.foreground} />}
                            onPress={handleCreateNew}
                            disabled={isLoading}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
