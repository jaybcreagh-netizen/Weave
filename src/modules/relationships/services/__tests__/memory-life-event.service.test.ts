jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
  },
}))

import { startOfDay } from 'date-fns'
import {
  buildLifeEventPrefillFromMemory,
  deriveMemoryTemporalMetadata,
} from '../memory-life-event.service'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

describe('memory-life-event.service', () => {
  it('sets upcoming expiration to 7 days after effective date', () => {
    const effectiveDate = startOfDay(new Date('2026-03-10T15:30:00.000Z')).getTime()

    const temporal = deriveMemoryTemporalMetadata(
      'upcoming',
      'Trip',
      'Weekend getaway',
      {
        selectedEffectiveDate: effectiveDate,
      },
    )

    expect(temporal.effectiveDate).toBe(effectiveDate)
    expect(temporal.expiresAt).toBe(effectiveDate + (7 * ONE_DAY_MS))
  })

  it('sets context expiration to 90 days from now', () => {
    const now = new Date('2026-02-05T14:00:00.000Z')

    const temporal = deriveMemoryTemporalMetadata('context', 'Sensitive topic', 'Be gentle', {
      now,
    })

    expect(temporal.effectiveDate).toBeUndefined()
    expect(temporal.expiresAt).toBe(startOfDay(now).getTime() + (90 * ONE_DAY_MS))
  })

  it('does not set expiration for general memories', () => {
    const temporal = deriveMemoryTemporalMetadata('general', 'General note', 'Remember this')

    expect(temporal.effectiveDate).toBeUndefined()
    expect(temporal.expiresAt).toBeUndefined()
  })

  it('builds life-event prefill from upcoming memory with effective date', () => {
    const effectiveDate = startOfDay(new Date('2026-08-17T09:00:00.000Z')).getTime()

    const prefill = buildLifeEventPrefillFromMemory({
      type: 'upcoming',
      title: 'Trip to Seattle',
      content: 'Book dinner for first night',
      effectiveDate,
    })

    expect(prefill).not.toBeNull()
    expect(prefill?.source).toBe('memory')
    expect(prefill?.title).toBe('Trip to Seattle')
    expect(prefill?.eventDate).toBe(new Date(effectiveDate).toISOString())
  })

  it('returns null prefill for non-upcoming/non-milestone memories', () => {
    const prefill = buildLifeEventPrefillFromMemory({
      type: 'context',
      title: 'Family stress',
      content: 'Keep check-ins low pressure',
    })

    expect(prefill).toBeNull()
  })
})
