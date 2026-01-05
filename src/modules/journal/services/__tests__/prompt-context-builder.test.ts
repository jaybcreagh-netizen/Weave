/**
 * Tests for prompt-context-builder.ts
 */

import { buildPromptContextPayload, PromptContextPayload } from '../prompt-context-builder'
import { MeaningfulWeave, FriendJournalContext } from '../journal-context-engine'
import { PromptContext } from '../journal-prompts'

describe('PromptContextBuilder', () => {
    describe('buildPromptContextPayload', () => {
        describe('with weave context', () => {
            it('should build payload from meaningful weave', () => {
                const mockWeave: MeaningfulWeave = {
                    interaction: {
                        id: 'i1',
                        interactionCategory: 'coffee',
                        activity: 'coffee',
                        note: 'Great conversation about life goals',
                        vibe: 'FullMoon',
                        duration: 'Long',
                        interactionDate: Date.now() - 3600000, // 1 hour ago
                    } as any,
                    friends: [{
                        id: 'f1',
                        name: 'Alice',
                        archetype: 'The Hermit',
                        dunbarTier: 'Inner Circle',
                    } as any],
                    meaningfulnessScore: 85,
                    meaningfulnessReasons: ['deep conversation', 'high emotional impact'],
                }

                const context: PromptContext = { type: 'weave', weave: mockWeave }
                const payload = buildPromptContextPayload(context)

                expect(payload.friendName).toBe('Alice')
                expect(payload.archetype).toBe('The Hermit')
                expect(payload.tier).toBe('Inner Circle')
                expect(payload.daysSince).toBe(0)
                expect(payload.patterns).toContain('deep conversation')
                expect(payload.recentInteraction).toContain('coffee')
            })

            it('should handle weave with no friends', () => {
                const mockWeave: MeaningfulWeave = {
                    interaction: {
                        id: 'i1',
                        interactionCategory: 'solo',
                        interactionDate: Date.now(),
                    } as any,
                    friends: [],
                    meaningfulnessScore: 50,
                    meaningfulnessReasons: [],
                }

                const context: PromptContext = { type: 'weave', weave: mockWeave }
                const payload = buildPromptContextPayload(context)

                expect(payload.friendName).toBe('a friend')
                expect(payload.archetype).toBe('Unknown')
            })
        })

        describe('with friend context', () => {
            it('should build payload from friend context', () => {
                const mockFriendContext: FriendJournalContext = {
                    friend: {
                        id: 'f1',
                        name: 'Bob',
                        archetype: 'The Sun',
                        dunbarTier: 'Close Friends',
                    } as any,
                    friendshipDuration: '2 years',
                    friendshipDurationMonths: 24,
                    totalWeaves: 45,
                    totalJournalEntries: 10,
                    recentWeaves: [{
                        id: 'i1',
                        date: new Date(Date.now() - 86400000), // 1 day ago
                        category: 'hangout',
                        activity: 'hangout',
                        notes: 'Fun times',
                        vibe: 'FullMoon',
                        duration: 'Medium',
                    }],
                    recentEntries: [],
                    detectedThemes: ['celebration', 'growth'],
                    thisMonthWeaves: 6,
                    daysSinceLastWeave: 1,
                    lastEntryDate: null,
                }

                const context: PromptContext = { type: 'friend', friendContext: mockFriendContext }
                const payload = buildPromptContextPayload(context)

                expect(payload.friendName).toBe('Bob')
                expect(payload.archetype).toBe('The Sun')
                expect(payload.tier).toBe('Close Friends')
                expect(payload.daysSince).toBe(1)
                expect(payload.patterns).toContain('themes: celebration, growth')
                expect(payload.patterns).toContain('very active this month')
            })

            it('should handle low activity friend', () => {
                const mockFriendContext: FriendJournalContext = {
                    friend: {
                        id: 'f1',
                        name: 'Carol',
                        archetype: 'The Emperor',
                        dunbarTier: 'Community',
                    } as any,
                    friendshipDuration: '6 months',
                    friendshipDurationMonths: 6,
                    totalWeaves: 3,
                    totalJournalEntries: 0,
                    recentWeaves: [],
                    recentEntries: [],
                    detectedThemes: [],
                    thisMonthWeaves: 0,
                    daysSinceLastWeave: 45,
                    lastEntryDate: null,
                }

                const context: PromptContext = { type: 'friend', friendContext: mockFriendContext }
                const payload = buildPromptContextPayload(context)

                expect(payload.patterns).toContain('reconnection after a gap')
                expect(payload.recentInteraction).toBe('No recent interactions')
            })
        })

        describe('with general context', () => {
            it('should return generic payload', () => {
                const context: PromptContext = { type: 'general' }
                const payload = buildPromptContextPayload(context)

                expect(payload.friendName).toBe('your relationships')
                expect(payload.archetype).toBe('General')
                expect(payload.tier).toBe('All')
                expect(payload.patterns).toBe('general reflection')
            })
        })
    })
})
