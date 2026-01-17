import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.sb_secret_37389P1y3I2aGHHN4sR1ng_R7m57xCn';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function notifySchemaReload() {
  console.log('🔄 Sending NOTIFY command to reload PostgREST schema...\n');

  try {
    // Execute SQL NOTIFY command to reload schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "NOTIFY pgrst, 'reload schema';"
    }).catch(async () => {
      // If exec_sql doesn't exist, try direct SQL execution
      console.log('Attempting alternative method...\n');
      
      // Try to create a function that sends the NOTIFY
      const createFn = await supabase.rpc('exec_sql', {
        sql: `
          DO $$
          BEGIN
            NOTIFY pgrst, 'reload schema';
          END $$;
        `
      });
      
      return createFn;
    });

    if (error) {
      console.log('⚠️  Automatic reload not available\n');
    } else {
      console.log('✅ NOTIFY command sent successfully');
      console.log('⏳ Waiting for schema cache to update...\n');
      
      // Wait for cache to update
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('📋 MANUAL SOLUTION (Recommended):');
    console.log('\nTo ensure the schema cache is fully reloaded:');
    console.log('1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
    console.log('2. Scroll down and click "Pause project"');
    console.log('3. Wait 10 seconds');
    console.log('4. Click "Resume project"');
    console.log('\nThis takes ~1 minute and guarantees the schema cache is refreshed.');
    console.log('\n✨ After restart, the timezone feature will work perfectly!');

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n📝 Please restart your Supabase project manually:');
    console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
  }
}

notifySchemaReload();
