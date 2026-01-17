import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.qrhladnnblgbobcnxjsz',
  password: 'toptennis2026@',
  ssl: { rejectUnauthorized: false }
});

async function applyMigration() {
  console.log('🔄 Connecting to database...\n');

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if column exists
    console.log('Step 1: Checking if timezone column exists...');
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'user_availability' 
        AND column_name = 'timezone';
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Timezone column already exists\n');
    } else {
      console.log('⚠️  Timezone column does NOT exist\n');
      
      console.log('Step 2: Adding timezone column...');
      await client.query(`
        ALTER TABLE public.user_availability 
        ADD COLUMN timezone TEXT DEFAULT 'America/New_York';
      `);
      console.log('✅ Timezone column added\n');
    }

    // Create index
    console.log('Step 3: Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_availability_timezone 
      ON public.user_availability(timezone);
    `);
    console.log('✅ Index created\n');

    // Update existing records
    console.log('Step 4: Updating existing records...');
    const updateResult = await client.query(`
      UPDATE public.user_availability 
      SET timezone = 'America/New_York' 
      WHERE timezone IS NULL;
    `);
    console.log(`✅ Updated ${updateResult.rowCount} records\n`);

    // Verify column exists
    console.log('Step 5: Verifying column...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'user_availability' 
        AND column_name = 'timezone';
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful!');
      console.log('   Column details:', verifyResult.rows[0]);
      console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!\n');
      console.log('Now you need to reload the PostgREST schema cache:');
      console.log('1. Go to: https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/settings/api');
      console.log('2. Click "Reload schema cache" button (if available)');
      console.log('3. Or wait 2-3 minutes for automatic cache refresh');
      console.log('\nThen try adding availability again!');
    } else {
      console.log('❌ Verification failed - column not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Details:', error);
  } finally {
    await client.end();
  }
}

applyMigration();
