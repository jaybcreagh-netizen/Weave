import { calculatePointsForWeave } from '../services/scoring.service';
import { VibeMultipliers } from '../constants';

// Mock FriendModel
const mockFriend: any = {
    id: 'test-friend',
    archetype: 'Sun',
    momentumScore: 0,
    momentumLastUpdated: new Date(),
    outcomeCount: 0,
};

console.log('--- Verifying Scoring Enhancements ---');

// 1. Verify Vibe Multipliers
console.log('\n1. Verifying Vibe Multipliers');
const pointsFullMoon = calculatePointsForWeave(mockFriend, {
    category: 'text-call',
    duration: 'Standard',
    vibe: 'FullMoon',
    interactionHistoryCount: 0,
});
console.log(`FullMoon Points (Expected > 14): ${pointsFullMoon}`);

const pointsNewMoon = calculatePointsForWeave(mockFriend, {
    category: 'text-call',
    duration: 'Standard',
    vibe: 'NewMoon',
    interactionHistoryCount: 0,
});
console.log(`NewMoon Points (Expected < 9): ${pointsNewMoon}`);

// 2. Verify Affinity Bonus
console.log('\n2. Verifying Affinity Bonus');
const pointsNormal = calculatePointsForWeave(mockFriend, {
    category: 'text-call',
    duration: 'Standard',
    vibe: 'WaxingCrescent',
    interactionHistoryCount: 4,
});
console.log(`Normal Points (History 4): ${pointsNormal}`);

const pointsBonus = calculatePointsForWeave(mockFriend, {
    category: 'text-call',
    duration: 'Standard',
    vibe: 'WaxingCrescent',
    interactionHistoryCount: 5,
});
console.log(`Bonus Points (History 5): ${pointsBonus}`);

const ratio = pointsBonus / pointsNormal;
console.log(`Ratio (Expected ~1.15): ${ratio.toFixed(2)}`);

if (pointsFullMoon > 14 && pointsNewMoon < 9 && Math.abs(ratio - 1.15) < 0.05) {
    console.log('\n✅ SUCCESS: All checks passed!');
} else {
    console.log('\n❌ FAILURE: Some checks failed.');
}
