import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';

/**
 * Derive a display title for a journal entry.
 * Priority: 1) entry.title  2) first meaningful phrase from content  3) date fallback
 */
export function getDisplayTitle(entry: JournalEntry): string {
    // 1. Use explicit title if set
    if (entry.title && entry.title.trim().length > 0) {
        return entry.title;
    }

    const content = (entry.content || '').trim();
    if (!content) {
        return formatDateFallback(entry.entryDate);
    }

    // 2. Try first line if it's a reasonable title length
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length >= 5 && firstLine.length <= 60 && firstLine.split(/\s+/).length >= 2) {
        // Trim trailing punctuation that looks odd as a title
        return firstLine.replace(/[.…]+$/, '').trim();
    }

    // 3. Extract first sentence
    const sentenceMatch = content.match(/^(.+?)[.!?]/);
    if (sentenceMatch) {
        const sentence = sentenceMatch[1].trim();
        if (sentence.length >= 5 && sentence.length <= 60) {
            return sentence;
        }
    }

    // 4. Truncate content to first ~50 chars at a word boundary
    if (content.length > 10) {
        const truncated = content.slice(0, 50).replace(/\s+\S*$/, '');
        if (truncated.length >= 10) {
            return truncated + '...';
        }
    }

    // 5. Date fallback
    return formatDateFallback(entry.entryDate);
}

function formatDateFallback(entryDate: number): string {
    const date = new Date(entryDate);
    return date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });
}

// ============================================================================
// BACKFILL
// ============================================================================

let hasBackfilled = false;

/**
 * One-time backfill: persist heuristic titles for all entries that lack one.
 * Safe to call multiple times — only runs once per app session.
 */
export async function backfillEntryTitles(): Promise<void> {
    if (hasBackfilled) return;
    hasBackfilled = true;

    try {
        const untitled = await database
            .get<JournalEntry>('journal_entries')
            .query(
                Q.or(
                    Q.where('title', null),
                    Q.where('title', ''),
                ),
            )
            .fetch();

        if (untitled.length === 0) return;

        const updates = untitled
            .map(entry => {
                const title = deriveTitle(entry.content, entry.entryDate);
                if (!title) return null;
                return entry.prepareUpdate(rec => {
                    rec.title = title;
                });
            })
            .filter(Boolean);

        if (updates.length > 0) {
            await database.write(async () => {
                await database.batch(...updates as any[]);
            });
            console.log(`[title-utils] Backfilled ${updates.length} entry titles`);
        }
    } catch (error) {
        console.warn('[title-utils] Backfill failed:', error);
        // Allow retry next session
        hasBackfilled = false;
    }
}

/**
 * Extract a title from content without needing a full JournalEntry model.
 * Used by the backfill to avoid re-reading models.
 */
function deriveTitle(content: string | undefined, entryDate: number): string | null {
    const text = (content || '').trim();
    if (!text) return null;

    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length >= 5 && firstLine.length <= 60 && firstLine.split(/\s+/).length >= 2) {
        return firstLine.replace(/[.…]+$/, '').trim();
    }

    const sentenceMatch = text.match(/^(.+?)[.!?]/);
    if (sentenceMatch) {
        const sentence = sentenceMatch[1].trim();
        if (sentence.length >= 5 && sentence.length <= 60) {
            return sentence;
        }
    }

    if (text.length > 10) {
        const truncated = text.slice(0, 50).replace(/\s+\S*$/, '');
        if (truncated.length >= 10) {
            return truncated + '...';
        }
    }

    return null;
}
