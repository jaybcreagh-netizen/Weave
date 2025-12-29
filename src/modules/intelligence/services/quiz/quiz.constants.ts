/**
 * Archetype Quiz Constants
 * 
 * Question text and scoring matrix based on design spec.
 * Uses a slider-based binary choice with weighted point distribution.
 */

import type { Archetype } from '@/shared/types/common';

// Partial archetype points - not all archetypes receive points per question
export type ArchetypePoints = Partial<Record<Archetype, number>>;

export interface QuizQuestion {
    id: number;
    scenario: string;
    optionA: {
        text: string;
        points: ArchetypePoints;
    };
    optionB: {
        text: string;
        points: ArchetypePoints;
    };
    /** Bespoke labels for slider positions [0,1,2,3,4] */
    sliderLabels: [string, string, string, string, string];
}

/**
 * 8 Questions with scenario-based framing
 * Each question has two options with associated archetype points
 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: 1,
        scenario: "It's Friday evening. You're free. You feel most recharged...",
        optionA: {
            text: "One-on-one, fully present with someone",
            points: { Hermit: 3, HighPriestess: 2, Empress: 2 },
        },
        optionB: {
            text: "At a gathering, feeding off the energy",
            points: { Sun: 3, Fool: 2, Emperor: 2, Lovers: 1 },
        },
        sliderLabels: [
            "Intimacy recharges me",
            "I prefer one-on-one",
            "Depends on my mood",
            "I prefer groups",
            "Group energy fills me up",
        ],
    },
    {
        id: 2,
        scenario: "A close friend is going through a hard time. Your instinct is to...",
        optionA: {
            text: "Talk it through - help them process and find clarity",
            points: { HighPriestess: 3 },
        },
        optionB: {
            text: "Take care of them - cook, comfort, show up physically",
            points: { Empress: 3 },
        },
        sliderLabels: [
            "...listen and talk",
            "...mostly talk it out",
            "...a bit of both",
            "...mostly show up",
            "...show up with care",
        ],
    },
    {
        id: 3,
        scenario: "Between seeing someone, you prefer to stay in touch via...",
        optionA: {
            text: "Text - memes, links, quick check-ins",
            points: { Hermit: 3, Magician: 2 },
        },
        optionB: {
            text: "Voice - calls, voice notes, longer messages",
            points: { HighPriestess: 2, Lovers: 2, Empress: 1 },
        },
        sliderLabels: [
            "...quick texts",
            "...mostly text",
            "...whatever works",
            "...mostly voice",
            "...calls and voice notes",
        ],
    },
    {
        id: 4,
        scenario: "Your favourite time with friends usually involves...",
        optionA: {
            text: "Doing something - activities, adventures, creating",
            points: { Fool: 2, Magician: 3, Emperor: 2, Sun: 1 },
        },
        optionB: {
            text: "Being together - talking, eating, existing in the same space",
            points: { Empress: 2, Lovers: 2, HighPriestess: 2, Hermit: 2 },
        },
        sliderLabels: [
            "...doing things together",
            "...usually activities",
            "...a mix of both",
            "...usually just being",
            "...simply being together",
        ],
    },
    {
        id: 5,
        scenario: "At a gathering, you're usually...",
        optionA: {
            text: "Seeking depth - drawn to the meaningful conversations",
            points: { Lovers: 3, HighPriestess: 2 },
        },
        optionB: {
            text: "The energy - people orbit around you",
            points: { Sun: 3, Emperor: 2 },
        },
        sliderLabels: [
            "...finding the deep chats",
            "...seeking depth",
            "...depends on my mood",
            "...often the centre",
            "...bringing the energy",
        ],
    },
    {
        id: 6,
        scenario: "When it comes to making plans, you prefer...",
        optionA: {
            text: "Keeping it loose - you'd rather decide in the moment",
            points: { Fool: 3, Magician: 2 },
        },
        optionB: {
            text: "Things in the calendar - you like knowing what's happening",
            points: { Emperor: 3, Empress: 2, Sun: 1 },
        },
        sliderLabels: [
            "...keeping it spontaneous",
            "...mostly loose",
            "...flexible either way",
            "...mostly planned",
            "...having it scheduled",
        ],
    },
    {
        id: 7,
        scenario: "In close friendships, what matters more...",
        optionA: {
            text: "Ease - you're not tracking, you just show up",
            points: { Hermit: 2, Fool: 2, Empress: 1 },
        },
        optionB: {
            text: "Balance - you value reciprocity and notice the give and take",
            points: { Lovers: 3, Emperor: 1 },
        },
        sliderLabels: [
            "...I just show up",
            "...mostly ease",
            "...somewhere in between",
            "...I notice reciprocity",
            "...balance matters to me",
        ],
    },
    {
        id: 8,
        scenario: "You're more energised by...",
        optionA: {
            text: "Creating something together - a project, an idea",
            points: { Magician: 3 },
        },
        optionB: {
            text: "Experiencing something together - adventure, novelty",
            points: { Fool: 3, Sun: 1 },
        },
        sliderLabels: [
            "...making and building",
            "...leaning creative",
            "...both equally",
            "...leaning adventure",
            "...exploring and doing",
        ],
    },
];

/**
 * Result copy for each archetype
 */
export const ARCHETYPE_RESULTS: Record<Archetype, {
    title: string;
    oneLiner: string;
    description: string;
}> = {
    Hermit: {
        title: "The Hermit",
        oneLiner: "You value depth over frequency.",
        description: "Your friendships are intimate, patient, and don't need constant tending. You'd rather share a passion or sit in comfortable silence than make small talk. Friends come to you when they want something real.",
    },
    HighPriestess: {
        title: "The High Priestess",
        oneLiner: "You're the friend people come to for clarity.",
        description: "You hold space. You listen deeply. Your friendships are built on emotional honesty and meaningful conversation. People trust you with their inner world, and you honour that.",
    },
    Empress: {
        title: "The Empress",
        oneLiner: "You nurture through presence.",
        description: "You show love by showing up - with food, with comfort, with care. Your home is a haven for your people. You create warmth wherever you go, and friendships flourish around you.",
    },
    Emperor: {
        title: "The Emperor",
        oneLiner: "You bring structure to connection.",
        description: "You're the one who makes plans happen. Reliable, consistent, and intentional - your friendships have rhythm because you create it. People know they can count on you.",
    },
    Magician: {
        title: "The Magician",
        oneLiner: "You connect through creation.",
        description: "Your best friendships involve making something together - ideas, projects, possibilities. You're energised by collaboration and inspired by people who challenge you to grow.",
    },
    Fool: {
        title: "The Fool",
        oneLiner: "You're the spark.",
        description: "Life is an adventure, and your friendships are part of the journey. You say yes, suggest the unexpected, and pull people out of their routines. With you, things happen.",
    },
    Sun: {
        title: "The Sun",
        oneLiner: "You bring the joy.",
        description: "Your energy is magnetic. You light up rooms, gather people together, and turn ordinary moments into celebrations. Friendships with you feel like sunshine.",
    },
    Lovers: {
        title: "The Lovers",
        oneLiner: "You seek true connection.",
        description: "You're drawn to depth within the social world. At any gathering, you're having the realest conversation in the room. You notice the give and take, and you value friends who meet you there.",
    },
    Unknown: {
        title: "Adaptable",
        oneLiner: "You're fluid in your connection style.",
        description: "You adapt your friendship style to the person and moment. There's no single archetype that defines you - you bring different energies to different relationships.",
    },
};

/**
 * Slider position values (0-4)
 */
export const SLIDER_POSITIONS = {
    HARD_LEFT: 0,
    LEFT_LEANING: 1,
    CENTER: 2,
    RIGHT_LEANING: 3,
    HARD_RIGHT: 4,
} as const;

export type SliderPosition = typeof SLIDER_POSITIONS[keyof typeof SLIDER_POSITIONS];
