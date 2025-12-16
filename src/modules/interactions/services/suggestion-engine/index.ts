import { Suggestion } from '@/shared/types/common';
import { SuggestionInput, SuggestionContext, SuggestionGenerator } from './types';
import { COOLDOWN_DAYS } from './utils';

import { PlannedWeaveGenerator } from './generators/PlannedWeaveGenerator';
import { LifeEventGenerator } from './generators/LifeEventGenerator';
import { IntentionGenerator } from './generators/IntentionGenerator';
import { ReflectionGenerator } from './generators/ReflectionGenerator';
import { DriftGenerator } from './generators/DriftGenerator'; // Critical, High, Community
import { MomentumGenerator } from './generators/MomentumGenerator';
import { MaintenanceGenerator } from './generators/MaintenanceGenerator'; // + First Weave
import { DeepenGenerator } from './generators/DeepenGenerator';
import { ReciprocityGenerator } from './generators/ReciprocityGenerator';
import { OptimizationGenerator } from './generators/OptimizationGenerator';
import { InsightGenerator } from './generators/InsightGenerator'; // Mismatch, Tier, Effectiveness

class SuggestionEngine {
    private generators: SuggestionGenerator[] = [];

    constructor() {
        this.registerGenerators();
    }

    private registerGenerators() {
        // Order matters! This replicates the waterfall logic.
        // However, since generators have internal Priority constants, 
        // we can also sort them by priority if we want to be robust.
        // For now, explicit push order is simplest and most performant.

        // 1. Planned Weaves (Past Due - Priority 1)
        this.generators.push(new PlannedWeaveGenerator());

        // 2. Life Events (Urgent - Priority 2)
        this.generators.push(new LifeEventGenerator());

        // 3. Intentions (Priority 2.5)
        this.generators.push(new IntentionGenerator());

        // 4. Critical Drift (Priority 3)
        this.generators.push(new DriftGenerator());

        // 5. Reflection (Priority 3 - wait, Critical Drift was higher in waterfall?)
        // Let's check original file.
        // Priority 1: Past Plan
        // Priority 2: Urgent Life Event
        // Priority 3: Reflection (actually it says "PRIORITY 3")
        // Priority 3 (again?): Critical Drift ("PRIORITY 3: Critical drift")
        // In original code, Reflection came BEFORE Critical Drift.

        this.generators.push(new ReflectionGenerator());

        // Generators are pushed in order of execution.
        // DriftGenerator handles Critical (3), High (4), Community (9).
        // Momentum (6)
        // Maintenance (7) + First Weave (4)
        // Deepen (8)
        // Reciprocity (10, 11)
        // Insight (12, 13, Mismatch)

        // We need to be careful with DriftGenerator since it handles multiple priorities
        // If we put it here, it handles Critical Drift (3).
        // What about "First Weave" (Priority 4)? It needs to come before High Drift (Priority 4)?
        // Original code:
        // 1. Past Plan
        // 2. Urgent Life Event
        // 3. Reflection
        // 4. Upcoming Plan (Handled by PlannedWeaveGenerator)
        // 5. Upcoming Life Event (Handled by LifeEventGenerator)
        // 2.5. Intention (Handled by IntentionGenerator)

        // Then:
        // 3. Critical Drift
        // 4. High Drift
        // 4. First Weave
        // 5. Archetype Mismatch
        // 6. Momentum
        // ...

        // Since PlannedWeaveGenerator and LifeEventGenerator encapsulate BOTH their priorities (Urgent & Upcoming),
        // placing them at the top is correct as long as they return null if not urgent/relevant.

        // The tricky part is First Weave vs High Drift.
        // In original code: Critical Drift -> High Drift -> First Weave.
        // So DriftGenerator (handling Critical & High) should come before MaintenanceGenerator (handling First Weave).

        // Momentum (6).
        this.generators.push(new MomentumGenerator());

        // Deepen (8).
        this.generators.push(new DeepenGenerator());

        // Maintenance (7).
        this.generators.push(new MaintenanceGenerator());

        // Reciprocity (10, 11).
        this.generators.push(new ReciprocityGenerator());

        // Optimization (Novelty for Power Users - Priority 45)
        this.generators.push(new OptimizationGenerator());

        // Insight (12, 13, Mismatch).
        this.generators.push(new InsightGenerator());
    }

    /**
     * Main entry point. Generates the single best suggestion for a friend.
     */
    public async generateSuggestion(input: SuggestionInput, now: Date = new Date()): Promise<Suggestion | null> {
        const context: SuggestionContext = {
            ...input,
            now,
        };

        for (const generator of this.generators) {
            try {
                const suggestion = await generator.generate(context);
                if (suggestion) {
                    return suggestion;
                }
            } catch (error) {
                console.error(`Error in generator ${generator.name}:`, error);
                // Continue to next generator on error
            }
        }

        return null;
    }

    public getCooldownDays(suggestionId: string): number {
        for (const [prefix, days] of Object.entries(COOLDOWN_DAYS)) {
            if (suggestionId.startsWith(prefix)) return days;
        }

        if (suggestionId.startsWith('portfolio')) return 7;
        if (suggestionId.startsWith('proactive-')) return 2;

        return 3; // Default
    }
}

export const suggestionEngine = new SuggestionEngine();
export const generateSuggestion = (input: SuggestionInput) => suggestionEngine.generateSuggestion(input);
export const getSuggestionCooldownDays = (id: string) => suggestionEngine.getCooldownDays(id);
