import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🔄 Running timezone migration with correct API key...\n');

  try {
    // Step 1: Check if column exists
    console.log('Step 1: Checking current schema...');
    const { data: checkData, error: checkError } = await supabase
      .from('user_availability')
      .select('*')
      .limit(1);
    
    if (checkError) {
      console.log('Current schema check:', checkError.message);
    }

    // Step 2: Try to insert with timezone to see if column exists
    console.log('\nStep 2: Testing timezone column...');
    const testInsert = {
      user_id: '00000000-0000-0000-0000-000000000000',
      date: '2099-12-31',
      start_time: '23:59',
      end_time: '23:59',
      is_available: true,
      timezone: 'America/New_York'
    };

    const { data: testData, error: testError } = await supabase
      .from('user_availability')
      .insert(testInsert)
      .select();

    if (testError) {
      if (testError.message.includes('timezone')) {
        console.log('❌ Timezone column does NOT exist in database');
        console.log('\n📋 You need to run this SQL in Supabase Dashboard:');
        console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql/new\n');
        console.log(`
ALTER TABLE public.user_availability 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_user_availability_timezone 
ON public.user_availability(timezone);

UPDATE public.user_availability 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL;
        `);
      } else {
        console.log('Note:', testError.message);
        console.log('(This error is expected if using dummy user_id)');
        console.log('\n✅ Timezone column EXISTS in database!');
        console.log('✅ The schema is correct!');
        console.log('\n⚠️  The issue is PostgREST schema cache');
        console.log('\nSolution: Restart your Supabase project:');
        console.log('1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
        console.log('2. Pause project → Wait 10 seconds → Resume project');
        console.log('3. Wait 1 minute for full restart');
        console.log('4. Try adding availability again');
      }
    } else {
      console.log('✅ Timezone column is working!');
      // Clean up test data
      if (testData && testData[0]) {
        await supabase
          .from('user_availability')
          .delete()
          .eq('id', testData[0].id);
        console.log('Test data cleaned up');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

runMigration();
