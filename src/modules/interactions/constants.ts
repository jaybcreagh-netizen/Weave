
export const MENU_RADIUS = 88; // Reduced for compact design
export const HIGHLIGHT_THRESHOLD = 25; // Reduced from 30
export const SELECTION_THRESHOLD = 40; // Reduced from 45

// 6 most common categories for quick-touch radial menu
export const ACTIVITIES = [
    { id: 'text-call', icon: '📞', label: 'Call' },
    { id: 'meal-drink', icon: '🍽️', label: 'Meal' },
    { id: 'hangout', icon: '👥', label: 'Hang' },
    { id: 'deep-talk', icon: '💭', label: 'Talk' },
    { id: 'activity-hobby', icon: '🎨', label: 'Do' },
    { id: 'voice-note', icon: '🎤', label: 'Voice' },
];

export const itemPositions = ACTIVITIES.map((_, i) => {
    const angle = (i / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
    return { x: MENU_RADIUS * Math.cos(angle), y: MENU_RADIUS * Math.sin(angle), angle };
});
