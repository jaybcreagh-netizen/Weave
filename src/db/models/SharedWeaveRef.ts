/**
 * SharedWeaveRef Model
 * 
 * Links a local Interaction to a cloud SharedWeave.
 * Tracks the relationship and sync status for shared weaves.
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class SharedWeaveRef extends Model {
    static table = 'shared_weave_refs'

    // Reference to local Interaction
    @text('interaction_id') interactionId!: string

    // Reference to Supabase shared_weaves.id
    @text('server_weave_id') serverWeaveId!: string

    // Who created the shared weave (Supabase user_profiles.id)
    @text('created_by_user_id') createdByUserId!: string

    // Did the current user create this shared weave?
    @field('is_creator') isCreator!: boolean

    // Status of this user's participation
    // 'pending' | 'accepted' | 'declined' | 'expired'
    @text('status') status!: 'pending' | 'accepted' | 'declined' | 'expired'

    // When the weave was shared to server
    @field('shared_at') sharedAt!: number

    // NEW Phase 4: Permissions
    @text('role') role?: 'viewer' | 'editor'
    @field('can_participant_edit') canParticipantEdit?: boolean

    // When this user responded (accepted/declined)
    @field('responded_at') respondedAt?: number

    // Timestamps
    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
