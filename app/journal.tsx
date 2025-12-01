import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    JournalHome,
    QuickCaptureSheet,
    GuidedReflectionModal,
    FriendshipArcView,
} from '@/components/Journal';

export default function JournalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: string; friendId?: string; weaveId?: string }>();

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    const [showGuided, setShowGuided] = useState(params.mode === 'guided');
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(params.friendId || null);

    // If viewing a friend's arc
    if (selectedFriendId) {
        return (
            <FriendshipArcView
                friendId={selectedFriendId}
                onBack={() => {
                    if (params.friendId) {
                        router.back();
                    } else {
                        setSelectedFriendId(null);
                    }
                }}
                onEntryPress={(id, type) => {
                    // Navigate to entry detail
                    // For now, maybe just log or show a modal?
                    console.log('Entry pressed:', id, type);
                }}
                onWriteAbout={(friendId, friendName) => {
                    setSelectedFriendId(null);
                    setShowGuided(true);
                    // Pass friend context to guided modal
                    // Note: GuidedReflectionModal might need props for pre-selecting friend
                }}
            />
        );
    }

    return (
        <>
            <JournalHome
                onNewEntry={(mode) => {
                    if (mode === 'quick') setShowQuickCapture(true);
                    else setShowGuided(true);
                }}
                onEntryPress={(entry) => {
                    // Navigate to entry detail
                    console.log('Entry pressed:', entry);
                }}
                onFriendArcPress={(friendId) => {
                    setSelectedFriendId(friendId);
                }}
                onMemoryAction={(memory) => {
                    // Handle memory action (read entry, write about friend, etc.)
                    console.log('Memory action:', memory);
                }}
            />

            <QuickCaptureSheet
                visible={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
                onExpandToFull={(text, friendIds) => {
                    setShowQuickCapture(false);
                    setShowGuided(true);
                    // Pass text/friends to guided modal
                    // Note: GuidedReflectionModal might need props for pre-filling
                }}
            />

            <GuidedReflectionModal
                visible={showGuided}
                onClose={() => setShowGuided(false)}
                onSave={(entry) => {
                    console.log('Saved:', entry);
                }}
                prefilledWeaveId={params.weaveId}
            />
        </>
    );
}
