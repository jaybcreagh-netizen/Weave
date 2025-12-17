import React from 'react';
import { router } from 'expo-router';
import { useUIStore } from '@/shared/stores/uiStore';

import { MilestoneCelebration } from '@/modules/gamification';
import { TrophyCabinetModal } from '@/modules/gamification';
import { EventSuggestionModal } from '@/modules/interactions';
import { WeeklyReflectionModal } from '@/modules/reflection';
import { SyncConflictModal } from '@/modules/auth';
import { PostWeaveRatingModal } from '@/modules/interactions';
import { MemoryMomentModal } from '@/modules/journal';
import { DigestSheet } from '@/modules/home';

export function GlobalModals() {
    const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
    const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
    const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
    const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);
    const isWeeklyReflectionOpen = useUIStore((state) => state.isWeeklyReflectionOpen);
    const closeWeeklyReflection = useUIStore((state) => state.closeWeeklyReflection);
    const memoryMomentData = useUIStore((state) => state.memoryMomentData);
    const digestSheetVisible = useUIStore((state) => state.digestSheetVisible);
    const digestItems = useUIStore((state) => state.digestItems);

    return (
        <>
            {/* Global Milestone Celebration Modal */}
            <MilestoneCelebration
                visible={milestoneCelebrationData !== null}
                milestone={milestoneCelebrationData}
                onClose={hideMilestoneCelebration}
            />

            <TrophyCabinetModal
                visible={isTrophyCabinetOpen}
                onClose={closeTrophyCabinet}
            />

            {/* Global Event Suggestion Modal */}
            <EventSuggestionModal />

            {/* Weekly Reflection Modal */}
            <WeeklyReflectionModal
                isOpen={isWeeklyReflectionOpen}
                onClose={closeWeeklyReflection}
            />

            {/* Sync Conflict Modal */}
            <SyncConflictModal />

            {/* Post Weave Rating Modal */}
            <PostWeaveRatingModal />

            {/* Memory Moment Modal */}
            <MemoryMomentModal
                visible={!!memoryMomentData}
                onClose={() => useUIStore.getState().closeMemoryMoment()}
                memory={memoryMomentData?.memory || null}
                entry={memoryMomentData?.entry || null}
                friendName={memoryMomentData?.friendName}
                onReadEntry={() => {
                    const data = useUIStore.getState().memoryMomentData;
                    useUIStore.getState().closeMemoryMoment();

                    if (data?.memory?.relatedEntryId) {
                        router.push({
                            pathname: '/journal',
                            params: {
                                openEntryId: data.memory.relatedEntryId,
                                openEntryType: data.memory.type.includes('reflection') || data.memory.id.includes('reflection') ? 'reflection' : 'journal'
                            }
                        });
                    } else {
                        router.push('/journal');
                    }
                }}
                onWriteAbout={() => {
                    const data = useUIStore.getState().memoryMomentData;
                    useUIStore.getState().closeMemoryMoment();

                    if (data) {
                        router.push({
                            pathname: '/journal',
                            params: {
                                prefilledText: `Thinking about this memory: "${data.memory.title}"...\n\n`,
                                prefilledFriendIds: data.friendId ? [data.friendId] : undefined
                            }
                        });
                    } else {
                        router.push('/journal');
                    }
                }}
            />

            {/* Evening Digest Sheet */}
            <DigestSheet
                isVisible={digestSheetVisible}
                onClose={() => useUIStore.getState().closeDigestSheet()}
                items={digestItems}
            />
        </>
    );
}
