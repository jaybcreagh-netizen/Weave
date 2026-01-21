export const AUTH_TIMEOUTS = {
    OTP_SEND: 30000,      // SMS should arrive quickly, but allow 30s for latency
    OTP_VERIFY: 30000,    // Verification can take longer
    PROFILE_UPDATE: 10000, // DB operations
    PHONE_UPDATE: 30000   // Phone operations go through SMS provider, need more time
} as const;

export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    operation: string
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${operation} timed out`)), ms)
        )
    ]);
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelayMs?: number;
        shouldRetry?: (error: any) => boolean;
    } = {}
): Promise<T> {
    const { maxRetries = 2, baseDelayMs = 1000, shouldRetry = () => true } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries || !shouldRetry(error)) throw error;

            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Unreachable');
}

/**
 * Format phone number for display with partial masking
 * "+14155551234" -> "+1 •••-•••-1234"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
    if (!phone) return 'Not set';

    // Keep country code and last 4 digits visible
    const cleaned = phone.replace(/[^0-9+]/g, '');

    if (cleaned.length < 8) return phone; // Too short to mask meaningfully

    const countryCode = cleaned.startsWith('+')
        ? cleaned.slice(0, cleaned.length > 11 ? 3 : 2) // +1 or +44 etc
        : '';
    const lastFour = cleaned.slice(-4);

    return `${countryCode} •••-•••-${lastFour}`;
}

/**
 * Normalize phone number to E.164 format using google-libphonenumber
 */
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

export function normalizePhone(phone: string, countryCode = 'US'): string | null {
    try {
        const phoneUtil = PhoneNumberUtil.getInstance();
        const number = phoneUtil.parseAndKeepRawInput(phone, countryCode);

        if (!phoneUtil.isValidNumber(number)) {
            return null;
        }

        return phoneUtil.format(number, PhoneNumberFormat.E164);
    } catch (e) {
        return null;
    }
}
