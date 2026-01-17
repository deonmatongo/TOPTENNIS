import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.sb_secret_37389P1y3I2aGHHN4sR1ng_R7m57xCn';

async function forceSchemaReload() {
  console.log('🔄 Forcing complete schema reload...\n');

  try {
    // Send NOTIFY to reload PostgREST schema
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'X-PostgREST-Schema-Reload': 'true'
      }
    });

    console.log('Step 1: Sent schema reload signal');

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify the column exists by querying directly
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Step 2: Verifying timezone column exists...');
    
    const { data, error } = await supabase
      .from('user_availability')
      .select('id, timezone')
      .limit(1);
    
    if (error) {
      if (error.message.includes('timezone')) {
        console.log('\n⚠️  PostgREST cache still not updated\n');
        console.log('The column exists in the database but PostgREST needs a restart.');
        console.log('\n🔧 SOLUTION: Restart your Supabase project:');
        console.log('1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
        console.log('2. Click "Pause project"');
        console.log('3. Wait 10 seconds');
        console.log('4. Click "Resume project"');
        console.log('\nThis will take about 1 minute and will fully reload the schema cache.');
        process.exit(1);
      } else {
        console.log('Error:', error.message);
      }
    } else {
      console.log('✅ Timezone column is accessible!');
      console.log('✅ Schema cache is up to date!');
      console.log('\n🎾 You can now add availability with timezone support!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Manual restart required:');
    console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
  }
}

forceSchemaReload();
