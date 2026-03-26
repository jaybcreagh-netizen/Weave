jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
  },
}));

jest.mock('@/shared/services/logger.service', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { database } from '@/db';
import { logger } from '@/shared/services/logger.service';
import { valueAlignment } from '../value-alignment.service';

describe('valueAlignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty values without logging when optional journal collections are unavailable', async () => {
    (database.get as jest.Mock).mockReturnValue(null);

    await expect(valueAlignment.getUserTopValues()).resolves.toEqual([]);
    await expect(valueAlignment.getFriendValues('friend-1')).resolves.toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
