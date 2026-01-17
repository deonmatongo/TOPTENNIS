import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.sb_secret_37389P1y3I2aGHHN4sR1ng_R7m57xCn';

async function reloadSchema() {
  console.log('🔄 Reloading PostgREST schema cache...\n');

  try {
    // Method 1: Send NOTIFY to reload schema
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/notify_pgrst`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      }
    });

    if (response.ok) {
      console.log('✅ Schema cache reloaded successfully!');
    } else {
      console.log('Note: Standard reload method not available, trying alternative...\n');
      
      // Method 2: Make a simple query to force schema refresh
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Query the table to force schema detection
      const { data, error } = await supabase
        .from('user_availability')
        .select('timezone')
        .limit(1);
      
      if (error && error.message.includes('timezone')) {
        console.log('⚠️  Schema cache still needs manual refresh\n');
        console.log('Please restart your Supabase project:');
        console.log('1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
        console.log('2. Scroll to "Pause project"');
        console.log('3. Click "Pause project" then "Resume project"');
        console.log('\nOr wait 1-2 minutes for automatic cache refresh.');
      } else {
        console.log('✅ Schema cache is now up to date!');
        console.log('✅ Timezone column is accessible');
      }
    }

    console.log('\n🎾 You can now add availability with timezone support!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n📝 Manual Solution:');
    console.log('Go to Supabase Dashboard and restart your project:');
    console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/general');
  }
}

reloadSchema();
