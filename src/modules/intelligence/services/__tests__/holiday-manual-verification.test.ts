import { FocusGenerator } from '@/modules/intelligence/services/focus-generator';
import FriendModel from '@/db/models/Friend';

const partnerFriend = {
  id: '1',
  name: 'Partner Friend',
  relationshipType: 'partner',
} as FriendModel;

const regularFriend = {
  id: '2',
  name: 'Regular Friend',
  relationshipType: 'friend',
} as FriendModel;

describe('holiday manual verification', () => {
  it('associates Valentine\'s Day with a partner and keeps Christmas unassigned', () => {
    const friends = [partnerFriend, regularFriend];
    const year = new Date().getFullYear();

    const valentinesHolidays = FocusGenerator.getUpcomingHolidays(
      new Date(year, 1, 10),
      new Date(year, 1, 20),
      friends
    );
    const valentines = valentinesHolidays.find(holiday => holiday.title === "Valentine's Day");

    expect(valentines).toBeDefined();
    expect(valentines?.friend?.id).toBe('1');

    const christmasHolidays = FocusGenerator.getUpcomingHolidays(
      new Date(year, 11, 20),
      new Date(year, 11, 30),
      friends
    );
    const christmas = christmasHolidays.find(holiday => holiday.title === 'Christmas');

    expect(christmas).toBeDefined();
    expect(christmas?.friend).toBeFalsy();
  });
});
