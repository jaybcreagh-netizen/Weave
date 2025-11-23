import { updateResilience } from '../services/resilience.service';
import FriendModel from '@/db/models/Friend';
import { Vibe } from '@/shared/types/common';

describe('Resilience Service', () => {
  let mockFriend: Partial<FriendModel>;

  beforeEach(() => {
    mockFriend = {
      resilience: 1.0,
      ratedWeavesCount: 5, // Assume friend is eligible for updates
    };
  });

  it('does not update resilience if ratedWeavesCount is less than 5', () => {
    mockFriend.ratedWeavesCount = 4;
    const newResilience = updateResilience(mockFriend as FriendModel, 'FullMoon');
    expect(newResilience).toBeNull();
  });

  it('does not update resilience if vibe is null', () => {
    const newResilience = updateResilience(mockFriend as FriendModel, null);
    expect(newResilience).toBeNull();
  });

  it('increases resilience for a positive vibe (FullMoon)', () => {
    const newResilience = updateResilience(mockFriend as FriendModel, 'FullMoon');
    expect(newResilience).toBeCloseTo(1.008);
  });

  it('increases resilience for a positive vibe (WaxingGibbous)', () => {
    const newResilience = updateResilience(mockFriend as FriendModel, 'WaxingGibbous');
    expect(newResilience).toBeCloseTo(1.008);
  });

  it('decreases resilience for a negative vibe (NewMoon)', () => {
    const newResilience = updateResilience(mockFriend as FriendModel, 'NewMoon');
    expect(newResilience).toBeCloseTo(0.995);
  });

  it('does not change resilience for neutral vibes', () => {
    const newResilience = updateResilience(mockFriend as FriendModel, 'FirstQuarter');
    expect(newResilience).toBeNull(); // No change means null is returned
  });

  it('clamps the resilience score at the maximum of 1.5', () => {
    mockFriend.resilience = 1.495;
    const newResilience = updateResilience(mockFriend as FriendModel, 'FullMoon');
    expect(newResilience).toBe(1.5);
  });

  it('clamps the resilience score at the minimum of 0.8', () => {
    mockFriend.resilience = 0.803;
    const newResilience = updateResilience(mockFriend as FriendModel, 'NewMoon');
    expect(newResilience).toBe(0.8);
  });

  it('returns null if the resilience does not change after calculation', () => {
    mockFriend.resilience = 1.5;
    const newResilience = updateResilience(mockFriend as FriendModel, 'FullMoon');
    expect(newResilience).toBeNull();
  });
});
