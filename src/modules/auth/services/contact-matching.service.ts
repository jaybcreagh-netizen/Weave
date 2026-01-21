import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { normalizePhone } from '@/modules/auth/services/auth-utils';

export type ContactMatch = {
    userId: string;
    displayName: string;
    photoUrl?: string;
    phone: string; // The plain text phone we found (from device), not the one from DB
};

export class ContactMatchingService {
    /**
     * Request permission and fetch contacts
     */
    static async getContacts(): Promise<Contacts.Contact[]> {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permission to access contacts was denied');
        }

        const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        });

        return data;
    }

    /**
     * Normalize phone number to E.164 format using shared utility
     */
    static normalizePhone(phone: string, countryCode = 'US'): string | null {
        return normalizePhone(phone, countryCode);
    }

    /**
     * Compute SHA-256 hash of a phone number
     */
    static async hashPhone(phone: string): Promise<string> {
        return await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            phone
        );
    }

    /**
     * Find matches securely
     * 1. Get local contacts
     * 2. Normalize and Hash them
     * 3. Send hashes to Edge Function
     * 4. Receive matches
     */
    static async findMatches(): Promise<ContactMatch[]> {
        try {
            const client = getSupabaseClient();
            if (!client) {
                console.warn('[ContactMatching] Supabase client not available');
                return [];
            }

            console.log('[ContactMatching] Requesting permissions...');
            const contacts = await this.getContacts();
            console.log(`[ContactMatching] Found ${contacts.length} contacts`);

            const phoneMap = new Map<string, Contacts.Contact>();
            const hashes: string[] = [];
            const hashToPlainPhone = new Map<string, string>();

            for (const contact of contacts) {
                if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) continue;

                for (const phoneNumber of contact.phoneNumbers) {
                    const normalized = this.normalizePhone(phoneNumber.number || '');
                    if (normalized) {
                        const hash = await this.hashPhone(normalized);
                        hashes.push(hash);
                        // Map hash back to the contact so we can display their name
                        // We use the first valid number for simplicity
                        if (!phoneMap.has(hash)) {
                            phoneMap.set(hash, contact);
                            hashToPlainPhone.set(hash, normalized); // Store normalized plain phone for results
                        }
                    }
                }
            }

            console.log(`[ContactMatching] Hashed ${hashes.length} numbers. Sending to server...`);

            // Call Supabase Edge Function
            const { data, error } = await client.functions.invoke('match-contacts', {
                body: { phone_hashes: hashes },
            });

            if (error) {
                console.error('[ContactMatching] Edge Function error:', error);
                throw error;
            }

            if (!data || !data.matches) return [];

            console.log(`[ContactMatching] Received ${data.matches.length} matches`);

            // Map results back to local contact info
            return data.matches.map((match: any) => {
                const originalContact = phoneMap.get(match.phone_hash);
                return {
                    userId: match.user_id,
                    displayName: originalContact?.name || 'Unknown Contact',
                    photoUrl: match.photo_url,
                    phone: hashToPlainPhone.get(match.phone_hash) || '',
                };
            });

        } catch (error) {
            console.error('[ContactMatching] Failed to find matches:', error);
            return [];
        }
    }
}
