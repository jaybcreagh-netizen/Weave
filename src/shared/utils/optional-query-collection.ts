import type { Model } from '@nozbe/watermelondb';
import { database } from '@/db';

export interface OptionalQueryCollection<T extends Model> {
  query: (...args: unknown[]) => { fetch: () => Promise<T[]> };
}

export function getOptionalQueryCollection<T extends Model>(
  collectionName: string
): OptionalQueryCollection<T> | null {
  try {
    const collection = database.get<T>(collectionName as never) as unknown as OptionalQueryCollection<T> | null;
    return collection && typeof collection.query === 'function' ? collection : null;
  } catch {
    return null;
  }
}
