/**
 * Username Search Sheet (Unified Add Friend)
 * 
 * Combined bottom sheet for searching Weave users or adding friends manually.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/modules/auth';
import {
    createFriend,
    FriendFormData
} from '@/modules/relationships';
import { FriendForm } from './FriendForm';
import { WeaveUserSearchModal } from './WeaveUserSearchModal';

interface UsernameSearchSheetProps {
    visible: boolean;
    onClose: () => void;
    onFriendCreated: (friendId: string) => void;
    onAddManually?: () => void;
}

export function UsernameSearchSheet({
    visible,
    onClose,
    onFriendCreated,
}: UsernameSearchSheetProps) {
    const { colors } = useTheme();
    const { isAuthenticated } = useAuth();

    // Controls the visibility of the "Search on Weave" center popup
    const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

    const handleManualSave = async (friendData: FriendFormData) => {
        const friend = await createFriend(friendData, 'manual');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Close the sheet after saving
        onClose();

        if (friend) {
            onFriendCreated(friend.id);
        }
    };

    const handleSwitchToManual = () => {
        setIsSearchModalVisible(false);
    };

    return (
        <>
            <StandardBottomSheet
                visible={visible}
                onClose={onClose}
                title="Add Friend"
                height="full"
                scrollable={true}
            >
                <View className="flex-1 px-4">
                    {/* Fake Search Input - Triggers Center Modal */}
                    {/* Only show if authenticated */}
                    {isAuthenticated && (
                        <TouchableOpacity
                            className="flex-row items-center gap-2 mb-6"
                            activeOpacity={0.8}
                            onPress={() => setIsSearchModalVisible(true)}
                        >
                            <View className="flex-1 flex-row items-center rounded-xl px-3 h-12" style={{ backgroundColor: colors.muted }}>
                                <Search size={18} color={colors['muted-foreground']} />
                                <Text className="ml-2 flex-1" style={{ color: colors['muted-foreground'] }}>
                                    Find on Weave network...
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Manual Form (Default Content) */}
                    <View style={{ flex: 1 }}>
                        <FriendForm
                            onSave={handleManualSave}
                            embedded={true}
                            visible={visible}
                        // No initialName passed here, as main search is now separate
                        // If they start searching in modal and switch to manual, we *could* pass it there?
                        // Yes, let's see if we can pass query from modal back to here?
                        // For simplicity, just showing form fresh is fine.
                        />
                    </View>
                </View>
            </StandardBottomSheet>

            {/* Center Popup for Search */}
            <WeaveUserSearchModal
                visible={isSearchModalVisible}
                onClose={() => setIsSearchModalVisible(false)}
                onFriendCreated={(friendId) => {
                    onClose(); // Close the main sheet too if friend added via search
                    onFriendCreated(friendId);
                }}
                onSwitchToManual={handleSwitchToManual}
            />
        </>
    );
}
