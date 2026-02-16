
import { FocusGenerator } from '@/modules/intelligence/services/focus-generator';
import FriendModel from '@/db/models/Friend';

// Mock friend model
const mockFriend = {
    id: '1',
    name: 'Partner Friend',
    relationshipType: 'partner',
} as FriendModel;

const mockFriend2 = {
    id: '2',
    name: 'Regular Friend',
    relationshipType: 'friend',
} as FriendModel;

const friends = [mockFriend, mockFriend2];

// Test function
async function testHolidays() {
    console.log("Running Holiday Logic Test...");

    // 1. Test Valentine's Day Logic
    // Set date to Feb 10th
    const valentinesTestDate = new Date(new Date().getFullYear(), 1, 10);
    const valentinesHolidays = FocusGenerator.getUpcomingHolidays(
        valentinesTestDate,
        new Date(new Date().getFullYear(), 1, 20),
        friends
    );

    const valentines = valentinesHolidays.find(h => h.title === "Valentine's Day");
    if (valentines) {
        if (valentines.friend?.id === '1') {
            console.log("PASS: Valentine's Day correctly associated with Partner Friend.");
        } else {
            console.log(`FAIL: Valentine's Day associated with ${valentines.friend?.name}, expected Partner Friend.`);
        }
    } else {
        console.log("FAIL: Valentine's Day not found.");
    }

    // 2. Test General Holiday (Christmas)
    // Set date to Dec 20th
    const xmasTestDate = new Date(new Date().getFullYear(), 11, 20);
    const xmasHolidays = FocusGenerator.getUpcomingHolidays(
        xmasTestDate,
        new Date(new Date().getFullYear(), 11, 30),
        friends
    );

    const xmas = xmasHolidays.find(h => h.title === "Christmas");
    if (xmas) {
        if (!xmas.friend) {
            console.log("PASS: Christmas correctly has no friend association.");
        } else {
            console.log(`FAIL: Christmas unexpectedly associated with ${xmas.friend?.name}.`);
        }
    } else {
        console.log("FAIL: Christmas not found.");
    }
}

testHolidays().catch(console.error);
