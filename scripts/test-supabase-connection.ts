/**
 * Supabase Connection Test
 * 
 * Temporarily enables features and tests the connection.
 * Run with: npx ts-node scripts/test-supabase-connection.ts
 */

// Temporarily override feature flags for testing
process.env.EXPO_PUBLIC_ACCOUNTS_ENABLED = 'true';

import { getSupabaseClient, isSupabaseConfigured } from '../src/shared/services/supabase-client';

async function testConnection() {
    console.log('\n🔌 Testing Supabase Connection...\n');

    // Check configuration
    console.log('1. Checking configuration...');
    if (!isSupabaseConfigured()) {
        console.error('❌ Supabase not configured. Check .env file.');
        process.exit(1);
    }
    console.log('   ✅ Environment variables found');

    // Get client (need to temporarily enable feature flag)
    console.log('\n2. Getting Supabase client...');

    // Override the feature flag check temporarily
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(
        process.env.EXPO_PUBLIC_SUPABASE_URL!,
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );

    if (!client) {
        console.error('❌ Failed to create client');
        process.exit(1);
    }
    console.log('   ✅ Client created');

    // Test tables exist
    console.log('\n3. Testing table access...');

    const tables = ['user_profiles', 'friend_links', 'shared_weaves', 'shared_weave_participants'];

    for (const table of tables) {
        try {
            const { error } = await client.from(table).select('id').limit(0);
            if (error) {
                console.log(`   ⚠️  ${table}: ${error.message}`);
            } else {
                console.log(`   ✅ ${table}: accessible`);
            }
        } catch (e) {
            console.log(`   ❌ ${table}: ${e}`);
        }
    }

    // Test auth
    console.log('\n4. Testing auth...');
    const { data: { session } } = await client.auth.getSession();
    console.log(`   Session: ${session ? 'Active' : 'None (expected for anonymous)'}`);

    console.log('\n✅ Connection test complete!\n');
    console.log('Next steps:');
    console.log('  1. Set up auth providers in Supabase Dashboard');
    console.log('  2. Enable feature flags in feature-flags.ts');
    console.log('  3. Implement auth UI\n');
}

testConnection().catch(console.error);
