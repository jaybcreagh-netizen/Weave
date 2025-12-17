
import { generateJournalPrompts, getBestPrompt } from '../journal-prompts';
import { MeaningfulWeave, FriendJournalContext } from '../journal-context-engine';

describe('Journal Prompts Service', () => {
    describe('generateJournalPrompts', () => {
        describe('Weave Context', () => {
            it('should generate deep conversation prompt', () => {
                const mockWeave: MeaningfulWeave = {
                    interaction: {
                        id: 'i1',
                        interactionCategory: 'deep-talk',
                        note: 'some notes',
                        vibe: 'Neutral',
                        duration: 'Medium',
                    } as any,
                    friends: [{ id: 'f1', name: 'Alice' } as any],
                    meaningfulnessScore: 50,
                    meaningfulnessReasons: [],
                };

                const prompts = generateJournalPrompts({ type: 'weave', weave: mockWeave });
                const mainPrompt = prompts.find(p => p.id === 'deep_conversation');

                expect(mainPrompt).toBeDefined();
                expect(mainPrompt?.relatedWeaveId).toBe('i1');
            });

            it('should generate high vibe prompt', () => {
                const mockWeave: MeaningfulWeave = {
                    interaction: {
                        id: 'i2',
                        interactionCategory: 'hangout',
                        note: '',
                        vibe: 'FullMoon',
                        duration: 'Medium',
                    } as any,
                    friends: [{ id: 'f1', name: 'Alice' } as any],
                    meaningfulnessScore: 50,
                    meaningfulnessReasons: [],
                };

                const prompts = generateJournalPrompts({ type: 'weave', weave: mockWeave });
                expect(prompts.some(p => p.id === 'high_vibe')).toBe(true);
            });
        });

        describe('Friend Context', () => {
            it('should generate frequent contact prompt', () => {
                const mockContext: FriendJournalContext = {
                    friend: { id: 'f1', name: 'Bob' } as any,
                    thisMonthWeaves: 6,
                    recentWeaves: [],
                    totalWeaves: 10,
                    daysSinceLastWeave: 1,
                    friendshipDurationMonths: 5,
                    totalJournalEntries: 2,
                    recentEntries: [],
                    detectedThemes: [],
                    lastEntryDate: null,
                    friendshipDuration: '5 months'
                };

                const prompts = generateJournalPrompts({ type: 'friend', friendContext: mockContext });
                expect(prompts.some(p => p.id === 'frequent_contact')).toBe(true);
            });

            it('should generate long friendship prompt', () => {
                const mockContext: FriendJournalContext = {
                    friend: { id: 'f1', name: 'Bob' } as any,
                    thisMonthWeaves: 1,
                    friendshipDurationMonths: 25, // > 24
                    recentWeaves: [],
                    totalWeaves: 10,
                    daysSinceLastWeave: 1,
                    totalJournalEntries: 2,
                    recentEntries: [],
                    detectedThemes: [],
                    lastEntryDate: null,
                    friendshipDuration: '2 years'
                };

                const prompts = generateJournalPrompts({ type: 'friend', friendContext: mockContext });
                expect(prompts.some(p => p.id === 'long_friendship')).toBe(true);
            });
        });

        describe('General Context', () => {
            it('should return 3 random prompts', () => {
                const prompts = generateJournalPrompts({ type: 'general' });
                expect(prompts).toHaveLength(3);
                expect(prompts[0].type).toBe('general');
            });
        });
    });

    describe('getBestPrompt', () => {
        it('should return the first generated prompt', () => {
            const mockContext: FriendJournalContext = {
                friend: { id: 'f1', name: 'Bob' } as any,
                thisMonthWeaves: 6, // triggers priority 100
                recentWeaves: [],
                totalWeaves: 10,
                daysSinceLastWeave: 1,
                friendshipDurationMonths: 5,
                totalJournalEntries: 2,
                recentEntries: [],
                detectedThemes: [],
                lastEntryDate: null,
                friendshipDuration: '5 months'
            };

            const prompt = getBestPrompt({ type: 'friend', friendContext: mockContext });
            expect(prompt.id).toBe('frequent_contact');
        });
    });
});
