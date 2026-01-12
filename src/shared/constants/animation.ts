/**
 * Global Animation Constants
 * 
 * Standardized spring configurations to ensure a consistent, premium feel across the app.
 * Avoid using ad-hoc spring configs in individual components.
 */

export const SPRINGS = {
    /**
     * Premium, tight feel. Little to no bounce.
     * Use for: Modals, Sheets, Cards entering, Overlay transitions.
     */
    PREMIUM: {
        damping: 30,
        stiffness: 300,
        mass: 1,
    },

    /**
     * Slightly more playful, but still controlled.
     * Use for: Small interactive elements, toggles, icon scales.
     */
    PLAYFUL: {
        damping: 20,
        stiffness: 200,
        mass: 1,
    },

    /**
     * Maximum stability. No bounce.
     * Use for: Opacity fades combined with transforms, purely structural shifts.
     */
    STABLE: {
        damping: 40,
        stiffness: 300,
        mass: 1,
    },
} as const;
