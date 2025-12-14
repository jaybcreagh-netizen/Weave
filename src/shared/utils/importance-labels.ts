/**
 * Brand-aligned display labels for importance and urgency levels.
 * 
 * Internal database values remain unchanged ('low', 'medium', 'high', 'critical')
 * to avoid database migrations. Only display labels are transformed here.
 * 
 * Language Philosophy:
 * - Avoid anxiety-inducing words: "critical", "urgent", "attention needed"
 * - Use warm, celebratory language: "special", "meaningful", "notable"
 * - Frame events as opportunities, not obligations
 */

export const IMPORTANCE_DISPLAY_LABELS: Record<string, { label: string; description: string }> = {
    low: { label: 'Light', description: 'A small moment' },
    medium: { label: 'Notable', description: 'Worth remembering' },
    high: { label: 'Significant', description: 'A major moment' },
    critical: { label: 'Special', description: 'A milestone to celebrate' },
};

export const URGENCY_DISPLAY_LABELS: Record<string, string> = {
    critical: 'Special',
    high: 'Soon',
    medium: '',
    low: '',
};

/**
 * Get the user-facing label for an importance level.
 * Falls back to the raw value if not found.
 */
export function getImportanceLabel(importance: string): string {
    return IMPORTANCE_DISPLAY_LABELS[importance]?.label || importance;
}

/**
 * Get the user-facing description for an importance level.
 */
export function getImportanceDescription(importance: string): string {
    return IMPORTANCE_DISPLAY_LABELS[importance]?.description || '';
}

/**
 * Get the badge label for an urgency level.
 * Returns null if no badge should be shown (for medium/low urgency).
 */
export function getUrgencyBadgeLabel(urgency: string): string | null {
    const label = URGENCY_DISPLAY_LABELS[urgency];
    return label || null;
}
