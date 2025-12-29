/**
 * Quiz Service
 * 
 * Scoring algorithm and result calculation based on design spec.
 * Uses weighted slider positions to distribute points between options.
 */

import type { Archetype } from '@/shared/types/common';
import {
    QUIZ_QUESTIONS,
    ArchetypePoints,
    SliderPosition,
    SLIDER_POSITIONS
} from './quiz.constants';

export interface QuizAnswer {
    questionId: number;
    sliderValue: SliderPosition; // 0-4
}

export interface ArchetypeScores {
    Hermit: number;
    HighPriestess: number;
    Empress: number;
    Emperor: number;
    Magician: number;
    Fool: number;
    Sun: number;
    Lovers: number;
}

export interface QuizResult {
    primary: Archetype;
    secondary: Archetype;
    scores: ArchetypeScores;
    percentages: Record<Archetype, number>;
    isBlend: boolean;
}

/**
 * Initial scores with all archetypes at 0
 */
function initialScores(): ArchetypeScores {
    return {
        Hermit: 0,
        HighPriestess: 0,
        Empress: 0,
        Emperor: 0,
        Magician: 0,
        Fool: 0,
        Sun: 0,
        Lovers: 0,
    };
}

/**
 * Calculate weighted points based on slider position
 * 
 * Uses curved weighting so extremes matter more:
 * | Slider Position | Points to A | Points to B |
 * |-----------------|-------------|-------------|
 * | Hard Left (0)   | 100%        | 0%          |
 * | Left-Leaning (1)| 80%         | 20%         |
 * | Centre (2)      | 50%         | 50%         |
 * | Right-Leaning(3)| 20%         | 80%         |
 * | Hard Right (4)  | 0%          | 100%        |
 */
function calculatePoints(
    sliderValue: SliderPosition,
    optionAPoints: ArchetypePoints,
    optionBPoints: ArchetypePoints
): ArchetypePoints {
    // Curved weighting: extremes (0,4) get full points, center gets 50/50
    // Use quadratic curve for stronger differentiation
    const normalized = sliderValue / 4; // 0 to 1
    const bWeight = normalized < 0.5
        ? 2 * normalized * normalized  // 0 to 0.5 maps to 0 to 0.5 (curved)
        : 1 - 2 * (1 - normalized) * (1 - normalized); // 0.5 to 1 maps to 0.5 to 1 (curved)
    const aWeight = 1 - bWeight;

    const result: ArchetypePoints = {};

    // Apply A weights
    for (const [archetype, points] of Object.entries(optionAPoints)) {
        result[archetype as Archetype] = (result[archetype as Archetype] || 0) + points * aWeight;
    }

    // Apply B weights
    for (const [archetype, points] of Object.entries(optionBPoints)) {
        result[archetype as Archetype] = (result[archetype as Archetype] || 0) + points * bWeight;
    }

    return result;
}

/**
 * Merge two score objects
 */
function mergeScores(a: ArchetypeScores, points: ArchetypePoints): ArchetypeScores {
    const result = { ...a };
    for (const [archetype, value] of Object.entries(points)) {
        if (value !== undefined) {
            result[archetype as keyof ArchetypeScores] += value;
        }
    }
    return result;
}

/**
 * Calculate quiz results from answers
 */
export function calculateQuizResults(answers: QuizAnswer[]): QuizResult {
    // 1. Sum weighted points from all answers
    let scores = initialScores();

    for (const answer of answers) {
        const question = QUIZ_QUESTIONS.find(q => q.id === answer.questionId);
        if (!question) continue;

        const points = calculatePoints(
            answer.sliderValue,
            question.optionA.points,
            question.optionB.points
        );
        scores = mergeScores(scores, points);
    }

    // 2. Sort archetypes by score
    const sorted = Object.entries(scores)
        .filter(([archetype]) => archetype !== 'Unknown')
        .sort(([, a], [, b]) => b - a);

    const primary = sorted[0][0] as Archetype;
    const secondary = sorted[1][0] as Archetype;
    const primaryScore = sorted[0][1];
    const secondaryScore = sorted[1][1];

    // 3. Check for blend (within 1.5 points - generous blending)
    const isBlend = Math.abs(primaryScore - secondaryScore) <= 1.5;

    // 4. Calculate total for percentages
    const totalTopThree = sorted[0][1] + sorted[1][1] + sorted[2][1];

    // 5. Calculate percentages (normalized to top 3)
    const percentages: Record<Archetype, number> = {
        Hermit: 0,
        HighPriestess: 0,
        Empress: 0,
        Emperor: 0,
        Magician: 0,
        Fool: 0,
        Sun: 0,
        Lovers: 0,
        Unknown: 0,
    };

    for (const [archetype, score] of sorted) {
        percentages[archetype as Archetype] = Math.round((score / totalTopThree) * 100);
    }

    return {
        primary,
        secondary,
        scores,
        percentages,
        isBlend,
    };
}

/**
 * Check if all answers are centered (user might be rushing)
 */
export function areAllAnswersCentered(answers: QuizAnswer[]): boolean {
    return answers.every(a => a.sliderValue === SLIDER_POSITIONS.CENTER);
}

/**
 * Get the top 3 archetypes with percentages for display
 */
export function getTopThreeArchetypes(result: QuizResult): Array<{
    archetype: Archetype;
    percentage: number;
}> {
    return Object.entries(result.percentages)
        .filter(([archetype]) => archetype !== 'Unknown')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([archetype, percentage]) => ({
            archetype: archetype as Archetype,
            percentage,
        }));
}
