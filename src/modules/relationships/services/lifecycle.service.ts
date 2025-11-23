// src/modules/relationships/services/lifecycle.service.ts
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

export async function checkAndApplyDormancy(): Promise<void> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const friends = await database.get<Friend>('friends').query(
    Q.where('last_updated', Q.lt(sixtyDaysAgo.getTime())),
    Q.where('is_dormant', false)
  ).fetch();

  await database.write(async () => {
    for (const friend of friends) {
      await friend.update(f => {
        f.isDormant = true;
      });
    }
  });
}

export async function reactivateFriend(id: string): Promise<void> {
  await database.write(async () => {
    const friend = await database.get<Friend>('friends').find(id);
    await friend.update(f => {
      f.isDormant = false;
      f.lastUpdated = new Date();
    });
  });
}
