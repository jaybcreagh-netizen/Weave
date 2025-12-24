import React from 'react';
import { isFuture } from 'date-fns';
import { Interaction, InteractionCategory, Friend } from '@/shared/types/legacy-types';
import IntentionModel from '@/db/models/Intention';
import { StructuredReflection } from '@/modules/interactions';
import { InteractionDetailModal } from '@/modules/interactions';
import { EditReflectionModal } from '@/modules/reflection';
import { EditInteractionModal } from '@/modules/interactions';
import { PlanChoiceModal } from '@/modules/interactions';
import { PlanWizard, PlanService, PlannedWeaveDetailSheet } from '@/modules/interactions';
import InteractionModel from '@/db/models/Interaction';
import { IntentionFormModal } from '@/modules/reflection';
import { IntentionsDrawer } from '@/modules/relationships/components/IntentionsDrawer';
import { IntentionActionSheet } from '@/modules/relationships/components/IntentionActionSheet';
import { LifeEventModal } from '@/modules/relationships/components/LifeEventModal';
import FriendBadgePopup from '@/modules/relationships/components/FriendBadgePopup';
import { TierFitBottomSheetWrapper } from './TierFitBottomSheetWrapper';
import { useFriendProfileModals } from '@/modules/relationships';

import { Intention } from '@/shared/types/legacy-types';

interface FriendProfileModalsProps {
    friend: Friend;
    modals: ReturnType<typeof useFriendProfileModals>;
    friendIntentions: Intention[];
    selectedInteraction: Interaction | null; // Reactive selected interaction
    updateReflection: (id: string, reflection: StructuredReflection) => Promise<void>;
    updateInteraction: (id: string, updates: any) => Promise<void>; // Using any to avoid Model vs DTO conflicts
    createIntention: (friendIds: string[], description: string, category?: InteractionCategory) => Promise<void>;
    dismissIntention: (id: string) => Promise<void>;
    deleteWeave: (id: string) => Promise<void>;
    refreshLifeEvents: () => Promise<void>;
}

export function FriendProfileModals({
    friend,
    modals,
    friendIntentions,
    selectedInteraction, // Deconstruct explicit prop
    updateReflection,
    updateInteraction,
    createIntention,
    dismissIntention,
    deleteWeave,
    refreshLifeEvents,
}: FriendProfileModalsProps) {
    const {
        setSelectedInteraction, // Still need setter trigger
        editingReflection,
        setEditingReflection,
        editingInteraction,
        setEditingInteraction,
        showPlanChoice,
        setShowPlanChoice,
        showPlanWizard,
        setShowPlanWizard,
        showIntentionForm,
        setShowIntentionForm,
        showIntentionsDrawer,
        setShowIntentionsDrawer,
        selectedIntentionForAction,
        setSelectedIntentionForAction,
        showLifeEventModal,
        setShowLifeEventModal,
        editingLifeEvent,
        setEditingLifeEvent,
        showBadgePopup,
        setShowBadgePopup,
        showTierFitSheet,
        setShowTierFitSheet,
        handleEditInteraction,
    } = modals;

    return (
        <>
            <InteractionDetailModal
                interaction={selectedInteraction as any}
                isOpen={selectedInteraction !== null}
                onClose={() => setSelectedInteraction(null)}
                friendName={friend.name}
                onEditReflection={(interaction) => {
                    setSelectedInteraction(null);
                    // Add delay to allow modal to close (iOS race condition)
                    setTimeout(() => {
                        setEditingReflection(interaction as any);
                    }, 500);
                }}
                onEdit={(interaction) => {
                    handleEditInteraction(interaction as any);
                }}
                onDelete={async (id) => {
                    await deleteWeave(id);
                    setSelectedInteraction(null);
                }}
                onUpdate={updateInteraction}
            />

            <EditReflectionModal
                interaction={editingReflection as any}
                isOpen={editingReflection !== null}
                onClose={() => setEditingReflection(null)}
                onSave={async (id, reflection, vibe) => {
                    // Update reflection
                    await updateReflection(id, reflection);

                    // Update vibe if changed
                    if (vibe !== undefined) {
                        await updateInteraction(id, { vibe });
                    }
                }}
                friendArchetype={friend?.archetype as any}
            />

            <EditInteractionModal
                interaction={editingInteraction as any}
                isOpen={editingInteraction !== null && !showPlanWizard && !isFuture(new Date(editingInteraction?.interactionDate || 0))}
                onClose={() => setEditingInteraction(null)}
                onSave={updateInteraction as any}
            />

            {/* PlannedWeaveDetailSheet - for editing future weaves */}
            {editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) && (
                <PlannedWeaveDetailSheet
                    visible={editingInteraction !== null && isFuture(new Date(editingInteraction.interactionDate))}
                    onClose={() => setEditingInteraction(null)}
                    interaction={editingInteraction as unknown as InteractionModel}
                    onDelete={deleteWeave}
                    onUpdate={updateInteraction}
                />
            )}

            <PlanChoiceModal
                isOpen={showPlanChoice}
                onClose={() => setShowPlanChoice(false)}
                onSetIntention={() => {
                    setShowPlanChoice(false);
                    setTimeout(() => {
                        setShowIntentionForm(true);
                    }, 500);
                }}
                onSchedulePlan={() => {
                    setShowPlanChoice(false);
                    setTimeout(() => {
                        if (friend) {
                            setShowPlanWizard(true);
                        }
                    }, 500);
                }}
            />

            {friend && (
                <PlanWizard
                    visible={showPlanWizard && !editingInteraction}
                    onClose={() => {
                        setShowPlanWizard(false);
                        setEditingInteraction(null);
                    }}
                    initialFriend={friend as any}
                />
            )}

            <IntentionFormModal
                isOpen={showIntentionForm}
                friendName={friend.name}
                onClose={() => setShowIntentionForm(false)}
                onSave={async (description, category) => {
                    await createIntention(
                        [friend.id],
                        description || '',
                        category,
                    );
                }}
            />

            <IntentionsDrawer
                intentions={friendIntentions}
                isOpen={showIntentionsDrawer}
                onClose={() => setShowIntentionsDrawer(false)}
                onIntentionPress={(intention) => {
                    setSelectedIntentionForAction(intention as any);
                }}
            />

            <IntentionActionSheet
                intention={selectedIntentionForAction as any}
                isOpen={selectedIntentionForAction !== null}
                onClose={() => setSelectedIntentionForAction(null)}
                onSchedule={async (intention) => {
                    await PlanService.convertIntentionToPlan(intention.id);
                    setSelectedIntentionForAction(null);
                    setShowPlanWizard(true);
                }}
                onDismiss={async (intention) => {
                    await dismissIntention(intention.id);
                    setSelectedIntentionForAction(null);
                }}
            />

            <LifeEventModal
                visible={showLifeEventModal}
                onClose={() => {
                    setShowLifeEventModal(false);
                    setEditingLifeEvent(null);
                    refreshLifeEvents();
                }}
                friendId={friend.id}
                existingEvent={editingLifeEvent as any}
            />

            {friend && (
                <FriendBadgePopup
                    visible={showBadgePopup}
                    onClose={() => setShowBadgePopup(false)}
                    friendId={friend.id}
                    friendName={friend.name}
                />
            )}

            {friend && showTierFitSheet && (
                <TierFitBottomSheetWrapper
                    friendId={friend.id}
                    visible={showTierFitSheet}
                    onDismiss={() => setShowTierFitSheet(false)}
                />
            )}
        </>
    );
}
