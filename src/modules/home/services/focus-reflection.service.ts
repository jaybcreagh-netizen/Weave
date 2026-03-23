import {
    calculateWeeklySummary,
    generateContextualPrompts,
    selectBestPrompt,
    type ContextualPrompt,
} from '@/modules/reflection'
import {
    oracleContextBuilder,
    oracleService,
    ContextTier,
} from '@/modules/oracle'

export interface FocusReflectionPrompt extends ContextualPrompt {
    source: 'local' | 'oracle'
}

const LOCAL_FALLBACK_PROMPT: FocusReflectionPrompt = {
    prompt: 'What kind of connection would help you feel a little more grounded today?',
    context: 'Gentle daily reflection',
    source: 'local',
}

export async function getLocalFocusReflection(): Promise<FocusReflectionPrompt> {
    try {
        const summary = await calculateWeeklySummary()
        const prompts = generateContextualPrompts(summary)

        if (prompts.length === 0) {
            return LOCAL_FALLBACK_PROMPT
        }

        const prompt = selectBestPrompt(prompts)
        return {
            ...prompt,
            source: 'local',
        }
    } catch (error) {
        console.warn('[FocusReflection] Failed to generate local reflection, using fallback:', error)
        return LOCAL_FALLBACK_PROMPT
    }
}

export async function getRemoteFocusReflection(
    options: {
        contextTier?: ContextTier
        timeoutMs?: number
    } = {}
): Promise<FocusReflectionPrompt | null> {
    const {
        contextTier = ContextTier.PATTERN,
        timeoutMs = 8000,
    } = options

    try {
        const oracleContext = await oracleContextBuilder.buildContext([], contextTier)
        const reflectionText = await Promise.race([
            oracleService.generateDailyReflection(oracleContext),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
        ])

        const prompt = reflectionText?.trim()
        if (!prompt) {
            return null
        }

        return {
            prompt,
            context: 'Oracle Insight',
            source: 'oracle',
        }
    } catch (error) {
        console.log('[FocusReflection] Remote reflection unavailable, keeping local prompt:', error)
        return null
    }
}
