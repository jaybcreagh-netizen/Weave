import React from 'react';
import { Interaction, InteractionCategory, Friend } from '@/shared/types/legacy-types';
import { FriendShape, InteractionShape } from '@/shared/types/derived';
import IntentionModel from '@/db/models/Intention';
import { StructuredReflection } from '@/shared/types/common';
import { InteractionDetailModal } from '@/modules/interactions/components/InteractionDetailModal';
import { EditReflectionModal } from '@/modules/reflection/components/EditReflectionModal';
import { EditInteractionModal } from '@/modules/interactions/components/EditInteractionModal';
import { PlanChoiceModal } from '@/modules/interactions/components/PlanChoiceModal';
import { PlanWizard } from '@/modules/interactions/components/PlanWizard';
import { PlannedWeaveDetailSheet } from '@/modules/interactions/components/PlannedWeaveDetailSheet';
import * as PlanService from '@/modules/interactions/services/plan.service';
import InteractionModel from '@/db/models/Interaction';
import { IntentionFormModal } from '@/modules/reflection/components/IntentionFormModal';
import { IntentionsDrawer } from '@/modules/relationships/components/IntentionsDrawer';
import { IntentionActionSheet } from '@/modules/relationships/components/IntentionActionSheet';
import { LifeEventModal } from '@/modules/relationships/components/LifeEventModal';

import { TierFitBottomSheetWrapper } from './TierFitBottomSheetWrapper';
import { useFriendProfileModals } from '@/modules/relationships';
import { FriendDetailSheet } from '../FriendDetailSheet';
import { InviteFriendSheet } from '@/modules/interactions/components/InviteFriendSheet';
import FriendMemoryModel from '@/db/models/FriendMemory';
import FriendMemoryCandidateModel from '@/db/models/FriendMemoryCandidate';

import { Intention } from '@/shared/types/legacy-types';

interface FriendProfileModalsProps {
    friend: FriendShape;
    modals: ReturnType<typeof useFriendProfileModals>;
    friendIntentions: Intention[];
    lifeEventPrefill?: {
        eventType?: string;
        title?: string;
        notes?: string;
        eventDate?: string;
        source?: 'oracle' | 'memory';
    } | null;
    selectedInteraction: InteractionShape | null; // Reactive selected interaction
    friendMemories: FriendMemoryModel[];
    friendMemoryCandidates: FriendMemoryCandidateModel[];
    onAddMemory: () => void;
    onEditMemory: (memory: FriendMemoryModel) => void;
    onReviewMemorySuggestions: () => void;
    onDismissAllMemorySuggestions: () => void;
    onCreateLifeEventFromMemory: (prefill: {
        eventType?: string;
        title?: string;
        notes?: string;
        eventDate?: string;
        source?: 'memory';
    }) => void;
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
    lifeEventPrefill,
    selectedInteraction, // Deconstruct explicit prop
    friendMemories,
    friendMemoryCandidates,
    onAddMemory,
    onEditMemory,
    onReviewMemorySuggestions,
    onDismissAllMemorySuggestions,
    onCreateLifeEventFromMemory,
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

        showTierFitSheet,
        setShowTierFitSheet,
        handleEditInteraction,
        showInviteSheet,
        setShowInviteSheet,
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
                friendId={friend?.id}
                friendName={friend?.name}
            />

            {/* EditInteractionModal - for editing past/completed weaves */}
            <EditInteractionModal
                interaction={editingInteraction as any}
                isOpen={editingInteraction !== null && !showPlanWizard && editingInteraction?.status === 'completed'}
                onClose={() => setEditingInteraction(null)}
                onSave={updateInteraction as any}
            />

            {/* PlannedWeaveDetailSheet - for editing planned weaves (by status, not date) */}
            {editingInteraction && (editingInteraction.status === 'planned' || editingInteraction.status === 'pending_confirm') && (
                <PlannedWeaveDetailSheet
                    visible={true}
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
                    initialFriend={friend}
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
                onDeleteIntention={dismissIntention}
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
                prefill={lifeEventPrefill || undefined}
            />



            {friend && showTierFitSheet && (
                <TierFitBottomSheetWrapper
                    friendId={friend.id}
                    visible={showTierFitSheet}
                    onDismiss={() => setShowTierFitSheet(false)}
                />
            )}

            {friend && (
                <FriendDetailSheet
                    isVisible={modals.showFriendDetailSheet}
                    onClose={() => modals.setShowFriendDetailSheet(false)}
                    friendId={friend.id}
                    memories={friendMemories}
                    memoryCandidates={friendMemoryCandidates}
                    onAddMemory={onAddMemory}
                    onEditMemory={onEditMemory}
                    onReviewMemorySuggestions={onReviewMemorySuggestions}
                    onDismissAllMemorySuggestions={onDismissAllMemorySuggestions}
                    onCreateLifeEventFromMemory={onCreateLifeEventFromMemory}
                />
            )}

            {friend && (
                <InviteFriendSheet
                    visible={showInviteSheet}
                    onClose={() => setShowInviteSheet(false)}
                    friendName={friend.name}
                    friendLocalId={friend.id}
                // No weave data for pure friend invite
                />
            )}
        </>
    );
}
