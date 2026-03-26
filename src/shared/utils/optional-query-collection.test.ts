jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
  },
}));

import { database } from '@/db';
import { getOptionalQueryCollection } from './optional-query-collection';

describe('getOptionalQueryCollection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the collection is unavailable', () => {
    (database.get as jest.Mock).mockReturnValue(null);

    expect(getOptionalQueryCollection('missing_collection')).toBeNull();
  });

  it('returns null when database.get throws for an optional collection', () => {
    (database.get as jest.Mock).mockImplementation(() => {
      throw new Error('missing collection');
    });

    expect(getOptionalQueryCollection('missing_collection')).toBeNull();
  });

  it('returns the collection when query access is available', () => {
    const query = jest.fn();
    (database.get as jest.Mock).mockReturnValue({ query });

    const collection = getOptionalQueryCollection('existing_collection');

    expect(collection).toEqual({ query });
  });
});
