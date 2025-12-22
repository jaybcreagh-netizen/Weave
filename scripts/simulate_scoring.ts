
/**
 * Simulation script to verify the mathematical soundness of the Buffered Score system.
 * Run with: npx ts-node scripts/simulate_scoring.ts
 */

const BUFFER_CAP = 150;
const DISPLAY_CAP = 100;
const DECAY_RATE = 1.5; // Approx for Close Friends

interface SimFriend {
    id: string;
    storedScore: number; // The new "raw" score (capped at 150)
    lastUpdated: number; // Days ago
}

// 1. Display Score Calculation
function getDisplayScore(friend: SimFriend, currentDay: number): number {
    const daysSince = currentDay - friend.lastUpdated;
    const decay = daysSince * DECAY_RATE;
    const decayedScore = Math.max(0, friend.storedScore - decay);
    return Math.min(DISPLAY_CAP, decayedScore);
}

// 2. Score Update Logic (Add/Subtract)
function updateScore(friend: SimFriend, points: number, currentDay: number): void {
    // First, apply decay up to "now" to get the new baseline
    const daysSince = currentDay - friend.lastUpdated;
    const decay = daysSince * DECAY_RATE;

    // Apply decay to stored score
    let newStored = Math.max(0, friend.storedScore - decay);

    // Add new points
    newStored += points;

    // Apply Buffer Cap
    friend.storedScore = Math.min(BUFFER_CAP, newStored);
    friend.lastUpdated = currentDay;
}

// 3. Deletion Logic (The core fix)
function deleteInteraction(friend: SimFriend, pointsToRemove: number): void {
    // Simply subtract from stored score
    // In the real app, we might need to handle backward decay if deleting old events, 
    // but for the "Cap Problem", simple subtraction is the key behavior to test.
    friend.storedScore = Math.max(0, friend.storedScore - pointsToRemove);
}

// === SCENARIOS ===

function runSimulation() {
    console.log("=== SCORING SIMULATION ===");
    console.log(`Buffer Cap: ${BUFFER_CAP}, Display Cap: ${DISPLAY_CAP}, Decay Rate: ${DECAY_RATE}/day\n`);

    // Scenario 1: The "100 Cap" Problem
    console.log("--- Scenario 1: The '100 Cap' Problem ---");
    const s1: SimFriend = { id: 's1', storedScore: 95, lastUpdated: 0 };
    console.log(`Start: Stored=${s1.storedScore}, Display=${getDisplayScore(s1, 0)}`);

    // User logs big interaction (+30)
    updateScore(s1, 30, 0);
    console.log(`Add 30pts: Stored=${s1.storedScore}, Display=${getDisplayScore(s1, 0)}`);

    // Verification: Stored should be 125, Display 100.
    if (s1.storedScore !== 125 || getDisplayScore(s1, 0) !== 100) console.error("FAILED: Score accumulation incorrect");
    else console.log("PASSED: Score accumulated correctly past display cap");

    // User deletes it
    deleteInteraction(s1, 30);
    console.log(`Delete 30pts: Stored=${s1.storedScore}, Display=${getDisplayScore(s1, 0)}`);

    // Verification: Should return to 95
    if (s1.storedScore === 95 && getDisplayScore(s1, 0) === 95) console.log("PASSED: Returned to original score (Fixed!)");
    else console.error(`FAILED: Expected 95, got Stored=${s1.storedScore}`);

    console.log("");

    // Scenario 2: Decay works on buffered score
    console.log("--- Scenario 2: Decay on Buffered Score ---");
    const s2: SimFriend = { id: 's2', storedScore: 125, lastUpdated: 0 }; // Starting at hidden 125
    console.log(`Day 0: Stored=${s2.storedScore}, Display=${getDisplayScore(s2, 0)}`);

    // Fast forward 10 days (15 pts decay)
    // 125 - 15 = 110. Display should still be 100.
    console.log(`Day 10 (should decay 15pts internal): Display=${getDisplayScore(s2, 10)}`);
    if (getDisplayScore(s2, 10) === 100) console.log("PASSED: User still sees 100 (buffered)");
    else console.error(`FAILED: Expected 100, got ${getDisplayScore(s2, 10)}`);

    // Fast forward 20 days (30 pts decay total)
    // 125 - 30 = 95. Display should now drop.
    console.log(`Day 20 (should decay 30pts internal): Display=${getDisplayScore(s2, 20)}`);
    if (getDisplayScore(s2, 20) === 95) console.log("PASSED: Score finally dropped below 100");
    else console.error(`FAILED: Expected 95, got ${getDisplayScore(s2, 20)}`);

    console.log("");

    // Scenario 3: Hitting the Buffer Cap
    console.log("--- Scenario 3: Hitting the Buffer Cap ---");
    const s3: SimFriend = { id: 's3', storedScore: 140, lastUpdated: 0 };
    console.log(`Start: Stored=${s3.storedScore}`);

    updateScore(s3, 50, 0); // Try to add 50 (would be 190)
    console.log(`Add 50pts: Stored=${s3.storedScore}, Display=${getDisplayScore(s3, 0)}`);

    if (s3.storedScore === 150) console.log("PASSED: Hard capped at 150");
    else console.error(`FAILED: Expected 150, got ${s3.storedScore}`);

    // Verify decay from full buffer
    // Needs (150 - 100) = 50 pts of decay to show change
    // 50 / 1.5 = 33.3 days
    const daysToDrop = Math.ceil(50 / 1.5) + 1;
    console.log(`Checking display after ${daysToDrop} days...`);
    const futureDisplay = getDisplayScore(s3, daysToDrop);
    console.log(`Display=${futureDisplay}`);

    if (futureDisplay < 100) console.log("PASSED: Eventually decays below 100");
    else console.error("FAILED: Infinite immunity?");

}

runSimulation();
