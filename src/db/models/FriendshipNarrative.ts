import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

export default class FriendshipNarrative extends Model {
    static table = 'friendship_narratives';

    @field('friend_id') friendId!: string;
    @text('current_chapter') currentChapter!: string;
    @date('chapter_started_at') chapterStartedAt!: Date;
    @date('friendship_start_date') friendshipStartDate!: Date;
    @text('generated_narrative_json') generatedNarrativeJson!: string;

    @readonly @date('created_at') createdAt!: Date;
    @readonly @date('updated_at') updatedAt!: Date;

    get generatedNarrative() {
        try {
            return this.generatedNarrativeJson ? JSON.parse(this.generatedNarrativeJson) : null;
        } catch {
            return null;
        }
    }
}
