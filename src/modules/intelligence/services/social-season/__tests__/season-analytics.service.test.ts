jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn((callback) => callback()),
  },
}));

import { database } from '@/db';
import { SeasonAnalyticsService } from '../season-analytics.service';

describe('SeasonAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns undefined quietly when the season log collection is unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (database.get as jest.Mock).mockReturnValue(null);

    await expect(SeasonAnalyticsService.getCurrentLog()).resolves.toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
