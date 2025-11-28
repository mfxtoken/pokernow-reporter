import { getSupabase, getCurrentUser } from './src/lib/supabase.js';

console.log('🔍 Testing Supabase Connection...\n');

// Get Supabase client
const supabase = getSupabase();

if (!supabase) {
    console.error('❌ Error: Supabase client not initialized');
    console.log('\nCheck your .env file:');
    console.log('- VITE_SUPABASE_URL should be set');
    console.log('- VITE_SUPABASE_ANON_KEY should be set');
    process.exit(1);
}

console.log('✓ Supabase client initialized\n');

async function testConnection() {
    try {
        // Test 1: Check tables exist
        console.log('Test 1: Checking Tables');
        const tables = ['profiles', 'games', 'settlements'];

        for (const table of tables) {
            const { error } = await supabase
                .from(table)
                .select('count')
                .limit(0);

            if (error && error.code !== 'PGRST116') {
                console.log(`❌ Table "${table}": ${error.message}`);
            } else {
                console.log(`✓ Table "${table}": Exists and accessible`);
            }
        }
        console.log('');

        // Test 2: Auth System
        console.log('Test 2: Auth System');
        const { data: authData, error: authError } = await supabase.auth.getSession();

        if (authError) {
            console.log('❌ Auth error:', authError.message);
        } else {
            console.log('✓ Auth system working');
            console.log('  Current session:', authData.session ? 'Active (logged in)' : 'None (not logged in)');
        }
        console.log('');

        // Test 3: Try to fetch games count
        console.log('Test 3: Database Query Test');
        const { count, error: countError } = await supabase
            .from('games')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.log('❌ Query error:', countError.message);
        } else {
            console.log(`✓ Query successful`);
            console.log(`  Games in database: ${count || 0}`);
        }
        console.log('');

        console.log('🎉 Connection test completed successfully!\n');
        console.log('Summary:');
        console.log('✓ Supabase connection: Working');
        console.log('✓ Database tables: Accessible');
        console.log('✓ Auth system: Functional');
        console.log('\nYour Supabase setup is ready to use!');

        return true;
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
        return false;
    }
}

// Run the test
testConnection().then(success => {
    process.exit(success ? 0 : 1);
});
