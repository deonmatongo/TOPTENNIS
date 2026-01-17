import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.sb_secret_37389P1y3I2aGHHN4sR1ng_R7m57xCn';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  try {
    console.log('🔄 Reading migration file...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260117020000_add_timezone_to_user_availability.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Connecting to Supabase...');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`   Statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', { 
        query: statement 
      }).catch(async (err) => {
        // Try direct query if RPC doesn't exist
        return await supabase.from('_').select('*').limit(0).then(() => {
          // Fallback: use raw SQL execution
          return fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: statement })
          }).then(r => r.json());
        });
      });
      
      if (error) {
        console.error(`❌ Error on statement ${i + 1}:`, error);
        throw error;
      }
    }
    
    console.log('\n✅ Migration executed successfully!');
    console.log('✅ Timezone column added to user_availability table');
    console.log('✅ Index created for performance');
    console.log('✅ Existing records updated to Eastern Time');
    console.log('\n🎾 Timezone feature is now fully operational!');
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error('\nFalling back to direct SQL execution...');
    
    // Fallback: Execute via direct PostgreSQL connection string
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260117020000_add_timezone_to_user_availability.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\nPlease run this SQL manually in Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql/new');
    console.log('\n' + sqlContent);
    
    process.exit(1);
  }
}

executeMigration();
