import { database } from '@/db'
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service'
import { InsightGenerator } from '../insight-generator'
import { oracleService } from '../oracle-service'

jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
    },
}))

jest.mock('@/modules/intelligence/services/intelligence-capabilities.service', () => ({
    intelligenceCapabilitiesService: {
        getCapabilities: jest.fn(),
    },
}))

jest.mock('../oracle-service', () => ({
    oracleService: {
        synthesizeInsights: jest.fn(),
    },
}))

describe('InsightGenerator', () => {
    const mockProfile = {
        proactiveInsightsEnabled: true,
        insightFrequency: 'biweekly',
        suppressedInsightRules: '[]',
    }

    beforeEach(() => {
        jest.clearAllMocks()

        ;(database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_profile') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue([mockProfile]),
                }
            }

            return {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
                fetchCount: jest.fn().mockResolvedValue(0),
            }
        })

        ;(oracleService.synthesizeInsights as jest.Mock).mockResolvedValue(undefined)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('skips daily generation when background proactive insights are disabled', async () => {
        ;(intelligenceCapabilitiesService.getCapabilities as jest.Mock).mockResolvedValue({
            proactiveInsightsEnabled: false,
            remoteInsightPolishEnabled: false,
        })

        const generateFriendSignalsSpy = jest.spyOn(InsightGenerator as any, 'generateFriendSignals')

        await InsightGenerator.generateDailyInsights()

        expect(generateFriendSignalsSpy).not.toHaveBeenCalled()
        expect(oracleService.synthesizeInsights).not.toHaveBeenCalled()
    })

    it('filters suppressed rules before daily synthesis', async () => {
        ;(database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_profile') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue([{
                        ...mockProfile,
                        suppressedInsightRules: JSON.stringify(['friend_drift']),
                    }]),
                }
            }

            return {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
                fetchCount: jest.fn().mockResolvedValue(0),
            }
        })

        ;(intelligenceCapabilitiesService.getCapabilities as jest.Mock).mockResolvedValue({
            proactiveInsightsEnabled: true,
            remoteInsightPolishEnabled: false,
        })

        jest.spyOn(InsightGenerator as any, 'shouldGenerateInsights').mockResolvedValue(true)
        jest.spyOn(InsightGenerator as any, 'generateFriendSignals').mockResolvedValue([
            { type: 'drifting', friendId: 'friend-1', data: {}, priority: 3 },
            { type: 'deepening', friendId: 'friend-2', data: {}, priority: 2 },
        ])
        jest.spyOn(InsightGenerator as any, 'generatePatternSignals').mockResolvedValue([])
        jest.spyOn(InsightGenerator as any, 'generateUserSignals').mockResolvedValue([])

        await InsightGenerator.generateDailyInsights()

        expect(oracleService.synthesizeInsights).toHaveBeenCalledWith(
            [{ type: 'deepening', friendId: 'friend-2', data: {}, priority: 2 }],
            {
                useRemotePolish: false,
                allowFallback: true,
            }
        )
    })

    it('allows on-demand generation even when cadence is set to on-demand', async () => {
        ;(database.get as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_profile') {
                return {
                    query: jest.fn().mockReturnThis(),
                    fetch: jest.fn().mockResolvedValue([{
                        ...mockProfile,
                        insightFrequency: 'on_demand',
                    }]),
                }
            }

            return {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
                fetchCount: jest.fn().mockResolvedValue(0),
            }
        })

        ;(intelligenceCapabilitiesService.getCapabilities as jest.Mock).mockResolvedValue({
            localProactiveInsightsEnabled: true,
            remoteInsightPolishEnabled: false,
        })

        jest.spyOn(InsightGenerator as any, 'generateFriendSignals').mockResolvedValue([
            { type: 'journal_positive', friendId: 'friend-7', data: {}, priority: 2 },
        ])
        jest.spyOn(InsightGenerator as any, 'generatePatternSignals').mockResolvedValue([])
        jest.spyOn(InsightGenerator as any, 'generateUserSignals').mockResolvedValue([])
        jest.spyOn(InsightGenerator as any, 'generateLifeEventSignals').mockResolvedValue([])
        jest.spyOn(InsightGenerator as any, 'generateJournalBasedSignals').mockResolvedValue([])

        await InsightGenerator.generateOnDemand()

        expect(oracleService.synthesizeInsights).toHaveBeenCalledWith(
            [{ type: 'journal_positive', friendId: 'friend-7', data: {}, priority: 2 }],
            {
                useRemotePolish: false,
                skipRecentCooldown: true,
                allowFallback: true,
            }
        )
    })
})
