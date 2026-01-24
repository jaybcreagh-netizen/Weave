
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import SocialBatteryLog from '@/db/models/SocialBatteryLog'
import { logger } from '@/shared/services/logger.service'

export type PersonaType = 'Strategist' | 'Empath' | 'Wildcard' | 'Standard'

export interface DailyPersona {
    type: PersonaType
    focus: string
    systemInstruction: string
}

export interface TriangulationCandidate {
    friendId: string
    reason: string
    archetype: string
    healthScore: number // Derived from vibe/interactions
}

export interface IntelligenceContext {
    persona: DailyPersona
    candidates: TriangulationCandidate[]
    blindspots: string[]
}

class IntelligenceEnhancerService {

    /**
     * Get the persona for the current day
     */
    getDailyPersona(): DailyPersona {
        const day = new Date().getDay() // 0 = Sunday, 1 = Monday...

        // Monday: Strategist
        if (day === 1) {
            return {
                type: 'Strategist',
                focus: 'Health Scores, Efficiency, Planning',
                systemInstruction: 'Adopt the persona of "The Strategist". Focus on optimizing social health scores, efficient interactions, and planning ahead. Be practical and forward-looking.'
            }
        }

        // Wednesday: Empath
        if (day === 3) {
            return {
                type: 'Empath',
                focus: 'Emotional Resonance, Battery Management',
                systemInstruction: 'Adopt the persona of "The Empath". Focus on how interactions feel, emotional safety, and protecting the user\'s social battery. Be nurturing and intuitive.'
            }
        }

        // Friday: Wildcard
        if (day === 5) {
            return {
                type: 'Wildcard',
                focus: 'Spontaneity, Novelty, Reconnection',
                systemInstruction: 'Adopt the persona of "The Wildcard". Encourage spontaneity, breaking patterns, and reaching out to people outside the usual rotation. Be bold and fun.'
            }
        }

        // Default
        return {
            type: 'Standard',
            focus: 'Balanced Relationship Health',
            systemInstruction: 'Maintain a balanced, supportive, and grounded persona.'
        }
    }

    /**
     * Find "Triangulation" candidates - friends who fit specific criteria 
     * based on current user state (Battery) and Friend Archetypes
     */
    async getTriangulationCandidates(batteryLevel: number): Promise<TriangulationCandidate[]> {
        try {
            const friends = await database.get<Friend>('friends').query(
                Q.where('is_dormant', false)
            ).fetch()

            const candidates: TriangulationCandidate[] = []

            // Helper to get simple health score (0-100 placeholder for now)
            // In real app, might use `weave_score` or compute fro interactions
            const getHealthScore = (f: Friend) => f.weaveScore || 50

            if (batteryLevel <= 2) {
                // LOW BATTERY: Needs "Low Friction" or "Nurturing" (Empress, High Priestess, Hermit)
                // Must have high health (safe friends)
                const nurturing = friends.filter(f =>
                    ['The Empress', 'The High Priestess', 'The Hermit'].includes(f.archetype || '') &&
                    getHealthScore(f) > 60 // "Safe" friend
                )

                nurturing.forEach(f => candidates.push({
                    friendId: f.id,
                    archetype: f.archetype || 'Unknown',
                    healthScore: getHealthScore(f),
                    reason: `Low Battery Match: ${f.name} is a ${f.archetype} (low energy/nurturing) and you have a strong bond.`
                }))
            } else if (batteryLevel >= 4) {
                // HIGH BATTERY: Needs "High Energy" or "Novelty" (Sun, Fool, Magician)
                const highEnergy = friends.filter(f =>
                    ['The Sun', 'The Fool', 'The Magician'].includes(f.archetype || '')
                )

                highEnergy.forEach(f => candidates.push({
                    friendId: f.id,
                    archetype: f.archetype || 'Unknown',
                    healthScore: getHealthScore(f),
                    reason: `High Battery Match: You have energy to burn, and ${f.name} (${f.archetype}) matches that vibe.`
                }))
            } else {
                // MEDIUM BATTERY: "The Magician" (Collaborative) or "The Emperor" (Structured)
                const stable = friends.filter(f =>
                    ['The Magician', 'The Emperor'].includes(f.archetype || '')
                )
                stable.forEach(f => candidates.push({
                    friendId: f.id,
                    archetype: f.archetype || 'Unknown',
                    healthScore: getHealthScore(f),
                    reason: `Stable Energy Match: ${f.name} (${f.archetype}) offers good engagement without being overwhelming.`
                }))
            }

            // Shuffle and take top 3 to prevent same suggestions
            return candidates.sort(() => 0.5 - Math.random()).slice(0, 3)

        } catch (e) {
            logger.warn('IntelligenceEnhancer', 'Failed to get triangulation candidates', e)
            return []
        }
    }

    /**
     * Identify Blindspots (High scored friends ignored for > 30 days)
     */
    async getBlindspots(): Promise<string[]> {
        try {
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

            // Friends with High Score but No Interaction in 30 days
            const neglected = await database.get<Friend>('friends').query(
                Q.where('weave_score', Q.gte(70)), // Assuming 0-100 scale
                Q.or(
                    Q.where('last_interaction_date', Q.lt(thirtyDaysAgo)),
                    Q.where('last_interaction_date', null)
                ),
                Q.take(3)
            ).fetch()

            return neglected.map(f =>
                `Blindspot Alert: ${f.name} has a high connection score but hasn't been seen in over 30 days. Why?`
            )

        } catch (e) {
            logger.warn('IntelligenceEnhancer', 'Failed to get blindspots', e)
            return []
        }
    }
}

export const intelligenceEnhancer = new IntelligenceEnhancerService()
