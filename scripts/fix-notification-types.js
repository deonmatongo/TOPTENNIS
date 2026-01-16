const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNotificationTypes() {
  console.log('Connecting to Supabase...');
  
  const sql = `
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
      CHECK (type IN (
        'friend_request',
        'message_received', 
        'match_invite',
        'match_confirmed',
        'match_cancelled',
        'match_accepted',
        'match_declined',
        'match_rescheduled',
        'booking_confirmed',
        'booking_cancelled',
        'league_update',
        'system_notification'
      ));
  `;

  try {
    // Note: This requires the SQL to be executed via Supabase dashboard or a service role key
    // The anon key doesn't have permissions to alter table constraints
    console.log('\n⚠️  This script requires database admin access.');
    console.log('\nPlease run the following SQL in your Supabase SQL Editor:');
    console.log('Dashboard: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql\n');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log('\nAfter running the SQL, your invite accept/decline functionality will work!\n');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixNotificationTypes();
