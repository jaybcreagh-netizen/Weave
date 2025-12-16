import React from 'react';
import { router } from 'expo-router';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';

import { MilestoneCelebration } from '@/modules/gamification';
import { TrophyCabinetModal } from '@/modules/gamification';
import { EventSuggestionModal } from '@/modules/interactions';
import { WeeklyReflectionModal } from '@/modules/reflection';
import { SyncConflictModal } from '@/modules/auth';
import { PostWeaveRatingModal } from '@/modules/interactions';
import { MemoryMomentModal } from '@/modules/journal/components/MemoryMomentModal';
import { DigestSheet } from '@/modules/home/components/DigestSheet';

export function GlobalModals() {
    const {
        milestoneCelebrationData, hideMilestoneCelebration,
        isTrophyCabinetOpen, closeTrophyCabinet,
        isWeeklyReflectionOpen, closeWeeklyReflection,
        memoryMomentData, closeMemoryMoment,
        digestSheetVisible, digestItems, closeDigestSheet
    } = useGlobalUI();

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
                onClose={() => closeMemoryMoment()}
                memory={memoryMomentData?.memory || null}
                entry={memoryMomentData?.entry || null}
                friendName={memoryMomentData?.friendName}
                onReadEntry={() => {
                    const data = memoryMomentData;
                    closeMemoryMoment();

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
                    const data = memoryMomentData;
                    closeMemoryMoment();

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
                onClose={() => closeDigestSheet()}
                items={digestItems}
            />
        </>
    );
}
