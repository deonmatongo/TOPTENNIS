import { createClient } from '@supabase/supabase-js';

// Using the correct anon key from your client.ts file
const supabaseUrl = 'https://qrhladnnblgbobcnxjsz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY';

console.log('🔄 Executing timezone migration...\n');
console.log('This will add the timezone column to your database.\n');

const sql = `
ALTER TABLE public.user_availability 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_user_availability_timezone 
ON public.user_availability(timezone);

UPDATE public.user_availability 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL;
`;

console.log('📋 SQL to execute:');
console.log('----------------------------------------');
console.log(sql);
console.log('----------------------------------------\n');

console.log('⚠️  The anon key cannot execute DDL (ALTER TABLE) commands.');
console.log('Only the service_role key or direct SQL execution can do this.\n');

console.log('🔧 REQUIRED ACTION:');
console.log('\n1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql/new');
console.log('\n2. Copy and paste this SQL:\n');
console.log(sql);
console.log('\n3. Click "Run" (or press Ctrl+Enter)');
console.log('\n4. You should see: "Success. No rows returned"');
console.log('\n5. Then restart your project:');
console.log('   - Go to Settings → General');
console.log('   - Click "Pause project"');
console.log('   - Wait 10 seconds');
console.log('   - Click "Resume project"');
console.log('   - Wait 1 minute for restart');
console.log('\n6. Try adding availability in your app');
console.log('\n✨ The timezone feature will then work perfectly!');
