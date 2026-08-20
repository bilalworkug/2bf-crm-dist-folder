const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('--- Phase 9 Verification ---');
  
  // 1. Check if correction_records table exists
  const { error: tableError } = await supabase.from('correction_records').select('id').limit(1);
  if (tableError && tableError.code === '42P01') {
    console.error('❌ correction_records table does not exist. Did you apply the migration?');
    return;
  }
  console.log('✅ correction_records table exists');

  // 2. Check if RPCs exist
  const rpcs = ['fn_correct_production_box', 'fn_correct_warehouse_box', 'fn_reverse_dispatch'];
  
  for (const rpc of rpcs) {
    const { error: rpcError } = await supabase.rpc(rpc, {});
    if (rpcError && rpcError.message.includes('Could not find the function')) {
      console.error(`❌ RPC ${rpc} does not exist.`);
    } else {
      console.log(`✅ RPC ${rpc} exists`);
    }
  }

  // 3. Test Unauthorized Access
  console.log('\n--- Testing Unauthorized Access ---');
  const { error: unauthError } = await supabase.rpc('fn_correct_production_box', {
    p_barcode: 'TEST1234',
    p_new_product_id: '00000000-0000-0000-0000-000000000000',
    p_reason: 'Test'
  });
  
  if (unauthError && (unauthError.message.includes('Not authenticated') || unauthError.message.includes('permission'))) {
    console.log('✅ Unauthorized access correctly blocked by database');
  } else {
    console.error('❌ Unauthorized access test failed:', unauthError);
  }

  console.log('\nAll basic schema and security verification checks completed.');
}

verify().catch(console.error);
