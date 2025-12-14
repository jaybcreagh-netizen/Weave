import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    JournalHome,
    QuickCaptureSheet,
    GuidedReflectionModal,
    FriendshipArcView,
    JournalEntryModal,
} from '@/modules/journal/components';
import { WeeklyReflectionDetailModal } from '@/modules/reflection';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

export default function JournalScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        mode?: string;
        friendId?: string;
        weaveId?: string;
        openEntryId?: string;
        openEntryType?: string;
        prefilledText?: string;
        prefilledFriendIds?: string;
    }>();

    const [showQuickCapture, setShowQuickCapture] = useState(false);
    const [showGuided, setShowGuided] = useState(params.mode === 'guided');
    const [selectedFriendId, setSelectedFriendId] = useState<string | null>(params.friendId || null);
    const [prefilledText, setPrefilledText] = useState<string>('');
    const [prefilledFriendIds, setPrefilledFriendIds] = useState<string[]>([]);

    // Selection state
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);

    // Deep link handling
    React.useEffect(() => {
        const handleDeepLink = async () => {
            // Handle opening specific entry
            if (params.openEntryId) {
                try {
                    if (params.openEntryType === 'reflection') {
                        const reflection = await database.get<WeeklyReflection>('weekly_reflections').find(params.openEntryId);
                        setSelectedReflection(reflection);
                    } else {
                        // Default to journal
                        const entry = await database.get<JournalEntry>('journal_entries').find(params.openEntryId);
                        setSelectedEntry(entry);
                    }
                } catch (error) {
                    console.error('Error opening linked entry:', error);
                }
            }

            // Handle prefilled guided reflection
            if (params.mode === 'guided') {
                if (params.prefilledText) {
                    setPrefilledText(params.prefilledText);
                }
                if (params.prefilledFriendIds) {
                    setPrefilledFriendIds(params.prefilledFriendIds.split(',').filter(Boolean));
                }
                setShowGuided(true);
            }
        };

        handleDeepLink();
    }, [params.openEntryId, params.mode]); // Don't depend on params object directly to avoid loops

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
                    onClose={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    }}
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
                    onMemoryAction={async (memory) => {
                        // Fetch full data needed for the modal
                        const { getMemoryForNotification } = require('@/modules/journal/services/journal-context-engine');
                        const { useUIStore } = require('@/shared/stores/uiStore');

                        const type = memory.id.includes('reflection') ? 'reflection' : 'journal';
                        const data = await getMemoryForNotification(memory.relatedEntryId!, type);

                        if (data) {
                            useUIStore.getState().openMemoryMoment(data);
                        }
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
                    // Add delay to allow sheet to close before opening modal to avoid race condition
                    // "Attempt to present ... whose view is not in the window hierarchy"
                    setTimeout(() => {
                        setShowGuided(true);
                    }, 500);
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
