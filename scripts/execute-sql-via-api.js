async function executeSQLMigration() {
  console.log('🔄 Executing SQL migration via Supabase API...\n');

  const projectRef = 'qrhladnnblgbobcnxjsz';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMDk3MjU2NSwiZXhwIjoyMDM2NTQ4NTY1fQ.sb_secret_37389P1y3I2aGHHN4sR1ng_R7m57xCn';

  const sql = `
-- Check if column exists first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'user_availability' 
      AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.user_availability 
    ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
    
    RAISE NOTICE 'Timezone column added';
  ELSE
    RAISE NOTICE 'Timezone column already exists';
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_availability_timezone 
ON public.user_availability(timezone);

-- Update existing records
UPDATE public.user_availability 
SET timezone = 'America/New_York' 
WHERE timezone IS NULL;
  `.trim();

  try {
    const response = await fetch(`https://${projectRef}.supabase.co/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await response.text();
    console.log('Response:', result);

    if (!response.ok) {
      console.log('\n⚠️  API execution not available\n');
      console.log('📋 MANUAL SOLUTION REQUIRED:');
      console.log('\nPlease run this SQL in your Supabase Dashboard:');
      console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql/new\n');
      console.log('Copy and paste this SQL:\n');
      console.log('----------------------------------------');
      console.log(sql);
      console.log('----------------------------------------\n');
      console.log('After running the SQL:');
      console.log('1. Wait 2-3 minutes for schema cache to refresh');
      console.log('2. Or restart your project again');
      console.log('3. Then try adding availability');
    } else {
      console.log('✅ Migration executed successfully!');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n📋 MANUAL SOLUTION:');
    console.log('Run this SQL in Supabase Dashboard SQL Editor:');
    console.log('https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/sql/new\n');
    console.log(sql);
  }
}

executeSQLMigration();
