
import { oracleContextBuilder, ContextTier } from '@/modules/oracle/services/context-builder';
import { SocialSeasonService } from '@/modules/intelligence/services/social-season.service';
import { database } from '@/db';

async function verifyContextV2() {
    console.log('--- Verifying Oracle Context V2 ---');

    console.log('1. Fetching Context...');
    const context = await oracleContextBuilder.buildContext([], ContextTier.PATTERN);

    console.log('2. User Profile:');
    console.log(JSON.stringify(context.userProfile, null, 2));

    console.log('3. Venue Suggestions (Season Adapted):');
    console.log(context.venueAndActivitySuggestions?.seasonAdapted);

    // Check if key fields exist
    if (context.userProfile.socialSeason) {
        console.log('✅ Social Season present:', context.userProfile.socialSeason);
    } else {
        console.error('❌ Social Season MISSING');
    }

    if (context.userProfile.socialBattery?.current) {
        console.log('✅ Social Battery present:', context.userProfile.socialBattery);
    } else {
        console.error('❌ Social Battery MISSING');
    }

    if (Array.isArray(context.userProfile.upcomingLifeEvents)) {
        console.log('✅ Upcoming Events present (Count):', context.userProfile.upcomingLifeEvents.length);
    } else {
        console.error('❌ Upcoming Events MISSING');
    }

    console.log('--- Verification Complete ---');
}

verifyContextV2().catch(console.error);
