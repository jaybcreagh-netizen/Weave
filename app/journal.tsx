import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    JournalHome,
    QuickCaptureSheet,
    GuidedReflectionModal,
    FriendshipArcView,
    JournalEntryModal,
} from '@/components/Journal';
import { WeeklyReflectionDetailModal } from '@/components/WeeklyReflection/WeeklyReflectionDetailModal';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

export default function JournalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: string; friendId?: string; weaveId?: string }>();

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    const [showGuided, setShowGuided] = useState(params.mode === 'guided');
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(params.friendId || null);
    const [prefilledText, setPrefilledText] = useState<string>('');
    const [prefilledFriendIds, setPrefilledFriendIds] = useState<string[]>([]);

    // Selection state
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);

    const handleArcEntryPress = async (id: string, type: 'journal' | 'reflection') => {
        try {
            if (type === 'journal') {
                const entry = await database.get<JournalEntry>('journal_entries').find(id);
                setSelectedEntry(entry);
            } else if (type === 'reflection') {
                const reflection = await database.get<WeeklyReflection>('weekly_reflections').find(id);
                setSelectedReflection(reflection);
            }
        } catch (error) {
            console.error('Error fetching entry:', error);
        }
    };

    return (
        <>
            {selectedFriendId ? (
                <FriendshipArcView
                    friendId={selectedFriendId}
                    onBack={() => {
                        if (params.friendId) {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/');
                            }
                        } else {
                            setSelectedFriendId(null);
                        }
                    }}
                    onEntryPress={handleArcEntryPress}
                    onWriteAbout={(friendId, friendName) => {
                        setPrefilledFriendIds([friendId]);
                        setSelectedFriendId(null);
                        setShowGuided(true);
                    }}
                />
            ) : (
                <JournalHome
                    onNewEntry={(mode) => {
                        if (mode === 'quick') setShowQuickCapture(true);
                        else setShowGuided(true);
                    }}
                    onEntryPress={(entry) => {
                        if ('weekStartDate' in entry) {
                            setSelectedReflection(entry as WeeklyReflection);
                        } else {
                            setSelectedEntry(entry as JournalEntry);
                        }
                    }}
                    onFriendArcPress={(friendId) => {
                        setSelectedFriendId(friendId);
                    }}
                    onMemoryAction={(memory) => {
                        // Handle memory action (read entry, write about friend, etc.)
                        console.log('Memory action:', memory);
                    }}
                />
            )}

            <QuickCaptureSheet
                visible={showQuickCapture}
                onClose={() => setShowQuickCapture(false)}
                onExpandToFull={(text, friendIds) => {
                    setPrefilledText(text);
                    setPrefilledFriendIds(friendIds);
                    setShowQuickCapture(false);
                    setShowGuided(true);
                }}
            />

            <GuidedReflectionModal
                visible={showGuided}
                onClose={() => {
                    setShowGuided(false);
                    setPrefilledText('');
                    setPrefilledFriendIds([]);
                }}
                onSave={(entry) => {
                    console.log('Saved:', entry);
                }}
                prefilledWeaveId={params.weaveId}
                prefilledText={prefilledText}
                prefilledFriendIds={prefilledFriendIds}
            />

            {/* Entry Viewers */}
            <JournalEntryModal
                isOpen={!!selectedEntry}
                onClose={() => setSelectedEntry(null)}
                entry={selectedEntry}
                onSave={() => {
                    // Refresh data if needed, or just close
                    setSelectedEntry(null);
                }}
            />

            <WeeklyReflectionDetailModal
                isOpen={!!selectedReflection}
                onClose={() => setSelectedReflection(null)}
                reflection={selectedReflection}
            />
        </>
    );
}
