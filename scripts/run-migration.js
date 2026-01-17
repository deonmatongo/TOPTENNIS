const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.6LZqZ8QxqQxQxQxQxQxQxQxQxQxQxQxQxQxQxQxQxQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260117020000_add_timezone_to_user_availability.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration executed successfully!');
    console.log('Timezone column added to user_availability table');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runMigration();
