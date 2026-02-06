import { getPrompt } from '@/shared/services/llm/prompt-registry'
import { OracleActionSchema } from '../oracle-schemas'
import { ACTION_LABELS, OracleActionType, SmartAction } from '../types'

describe('Oracle action contract', () => {
  test('add_memory is present in Oracle action schema enum', () => {
    const enumValues = (OracleActionSchema.properties?.type as { enum?: string[] } | undefined)?.enum || []
    expect(enumValues).toContain('add_memory')
  })

  test('add_memory prefill fields exist in schema', () => {
    const prefillProps = (OracleActionSchema.properties?.prefill as { properties?: Record<string, unknown> } | undefined)?.properties || {}
    expect(prefillProps).toHaveProperty('memoryType')
    expect(prefillProps).toHaveProperty('memoryTitle')
    expect(prefillProps).toHaveProperty('notes')
  })

  test('add_memory is included in action labels and types', () => {
    const actionType: OracleActionType = 'add_memory'
    expect(actionType).toBe('add_memory')
    expect(ACTION_LABELS.add_memory).toBeDefined()
  })

  test('SmartAction supports add_memory', () => {
    const action: SmartAction = {
      type: 'add_memory',
      label: 'Save note',
      data: {},
      confidence: 0.8,
    }
    expect(action.type).toBe('add_memory')
  })

  test('prompt templates include add_memory guidance', () => {
    const consultation = getPrompt('oracle_consultation')
    expect(consultation?.systemPrompt).toContain('add_memory')

    const journalDetection = getPrompt('journal_action_detection')
    expect(journalDetection?.systemPrompt).toContain('add_memory')
  })
})
