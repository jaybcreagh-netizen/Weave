
const { differenceInDays } = require('date-fns');

const now = new Date('2025-12-15T23:00:00');
const tomorrowEarly = new Date('2025-12-16T01:00:00');
const tomorrowLater = new Date('2025-12-16T10:00:00');

console.log(`Now: ${now.toISOString()}`);
console.log(`Tomorrow Early: ${tomorrowEarly.toISOString()}`);
console.log(`Diff Early: ${differenceInDays(tomorrowEarly, now)}`);

console.log(`Tomorrow Later: ${tomorrowLater.toISOString()}`);
console.log(`Diff Later: ${differenceInDays(tomorrowLater, now)}`);
