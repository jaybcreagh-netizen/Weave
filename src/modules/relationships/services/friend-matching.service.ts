/**
 * Friend Matching Service
 * 
 * Finds potential matches between incoming link requests and existing local friends.
 * Used to prevent duplicate friend creation when accepting link requests.
 */

import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

export interface MatchCandidate {
    friend: Friend;
    confidence: number; // 0-1 score
    matchReason: 'exact_name' | 'similar_name' | 'phone_match' | 'combined';
}

/**
 * Normalize a name for comparison:
 * - Lowercase
 * - Remove extra whitespace
 * - Trim
 */
function normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a phone number for comparison:
 * - Remove all non-numeric characters
 * - Handle country code variations
 */
function normalizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    // If starts with 1 and has 11 digits, strip the leading 1 (US country code)
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return cleaned.slice(1);
    }

    return cleaned;
}

/**
 * Calculate name similarity score (0-1)
 * Uses a simple approach: exact match = 1, contains = 0.7, first/last name match = 0.5
 */
function calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);

    // Exact match
    if (n1 === n2) {
        return 1.0;
    }

    // One contains the other (e.g., "John Smith" contains "John")
    if (n1.includes(n2) || n2.includes(n1)) {
        return 0.7;
    }

    // Check if first names match
    const parts1 = n1.split(' ');
    const parts2 = n2.split(' ');

    if (parts1[0] === parts2[0]) {
        return 0.5;
    }

    // Check if any word matches (could be last name)
    const hasCommonWord = parts1.some(p1 => parts2.some(p2 => p1 === p2 && p1.length > 2));
    if (hasCommonWord) {
        return 0.4;
    }

    return 0;
}

/**
 * Find potential matching local friends for an incoming link request
 * 
 * @param displayName - Display name from the link request
 * @param phoneNumber - Optional phone number from the link request (if shared)
 * @returns Sorted array of match candidates (highest confidence first)
 */
export async function findPotentialMatches(
    displayName: string,
    phoneNumber?: string
): Promise<MatchCandidate[]> {
    try {
        // Fetch all local friends that are NOT already linked
        const friends = await database.get<Friend>('friends')
            .query(
                Q.or(
                    Q.where('link_status', null),
                    Q.where('link_status', '')
                )
            )
            .fetch();

        const candidates: MatchCandidate[] = [];
        const normalizedPhone = phoneNumber ? normalizePhone(phoneNumber) : null;

        for (const friend of friends) {
            let confidence = 0;
            let matchReason: MatchCandidate['matchReason'] = 'similar_name';

            // Check phone match first (highest priority)
            if (normalizedPhone && friend.phoneNumber) {
                const friendNormalizedPhone = normalizePhone(friend.phoneNumber);
                if (friendNormalizedPhone === normalizedPhone && normalizedPhone.length >= 7) {
                    confidence = 0.95;
                    matchReason = 'phone_match';
                }
            }

            // Check name similarity
            const nameSimilarity = calculateNameSimilarity(displayName, friend.name);

            if (confidence > 0 && nameSimilarity > 0.3) {
                // Phone match + name match = very high confidence
                confidence = Math.min(0.99, confidence + nameSimilarity * 0.05);
                matchReason = 'combined';
            } else if (nameSimilarity >= 1.0) {
                // Exact name match
                confidence = 0.90;
                matchReason = 'exact_name';
            } else if (nameSimilarity >= 0.5) {
                // Good name match
                confidence = nameSimilarity * 0.7;
                matchReason = 'similar_name';
            } else if (nameSimilarity >= 0.3) {
                // Weak name match
                confidence = nameSimilarity * 0.5;
                matchReason = 'similar_name';
            }

            // Only include if confidence is above threshold
            if (confidence >= 0.3) {
                candidates.push({
                    friend,
                    confidence,
                    matchReason,
                });
            }
        }

        // Sort by confidence descending
        candidates.sort((a, b) => b.confidence - a.confidence);

        // Return top 5 candidates
        return candidates.slice(0, 5);

    } catch (error) {
        console.error('[FriendMatching] Error finding matches:', error);
        return [];
    }
}

/**
 * Check if there's a high-confidence match that should trigger the confirmation modal
 * 
 * @param displayName - Display name from the link request
 * @param phoneNumber - Optional phone number
 * @returns The best match if confidence >= 0.7, otherwise null
 */
export async function findBestMatch(
    displayName: string,
    phoneNumber?: string
): Promise<MatchCandidate | null> {
    const matches = await findPotentialMatches(displayName, phoneNumber);

    if (matches.length > 0 && matches[0].confidence >= 0.7) {
        return matches[0];
    }

    return null;
}
