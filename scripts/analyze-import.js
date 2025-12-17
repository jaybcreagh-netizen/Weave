const fs = require('fs');

const jsonPath = 'test_data/weave-export-2025-12-17T13-31-25.json';
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

console.log(`Analyzing ${data.friends.length} friends and ${data.interactions.length} interactions...`);

const validArchetypes = [
    'Emperor', 'Empress', 'HighPriestess', 'Fool', 'Sun', 'Hermit', 'Magician', 'Lovers', 'Unknown'
];

const validTiers = ['InnerCircle', 'CloseFriends', 'Community'];

let errors = [];

// Analyze Friends
data.friends.forEach((f, i) => {
    if (!f.id) errors.push(`Friend[${i}]: Missing ID`);
    if (!f.name) errors.push(`Friend[${i}]: Missing Name`);

    // Check Archetype
    if (!validArchetypes.includes(f.archetype)) {
        errors.push(`Friend[${i}] (${f.name}): Invalid Archetype '${f.archetype}'`);
    }

    // Check Tier
    if (!validTiers.includes(f.dunbarTier)) {
        errors.push(`Friend[${i}] (${f.name}): Invalid Tier '${f.dunbarTier}'`);
    }

    // Check numbers
    if (typeof f.weaveScore !== 'number') errors.push(`Friend[${i}]: weaveScore not a number`);
    if (typeof f.resilience !== 'number') errors.push(`Friend[${i}]: resilience not a number`);

    // Check Dates
    if (isNaN(new Date(f.lastUpdated).getTime())) errors.push(`Friend[${i}]: Invalid lastUpdated date`);
});

// Analyze Interactions
data.interactions.forEach((inter, i) => {
    if (!inter.id) errors.push(`Interaction[${i}]: Missing ID`);
    if (!inter.interactionDate) errors.push(`Interaction[${i}]: Missing interactionDate`);

    if (isNaN(new Date(inter.interactionDate).getTime())) errors.push(`Interaction[${i}]: Invalid interactionDate`);

    // Check category/type
    // Add specific checks if needed
});

if (errors.length > 0) {
    console.log(`Found ${errors.length} errors:`);
    errors.slice(0, 20).forEach(e => console.log(e));
    if (errors.length > 20) console.log(`...and ${errors.length - 20} more.`);
} else {
    console.log('No schema validation errors found in static analysis.');
}
