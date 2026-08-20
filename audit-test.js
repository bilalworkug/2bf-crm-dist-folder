const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  // Check if 'allocated' is allowed by trying to set it
  const { data: testBox } = await sb.from('boxes').select('id, status').eq('status', 'in_warehouse').limit(1).single();
  if (testBox) {
    const { error } = await sb.from('boxes').update({ status: 'allocated' }).eq('id', testBox.id);
    console.log('Trying to set status=allocated:', error ? error.message : 'SUCCESS');
    // Revert
    if (!error) {
      await sb.from('boxes').update({ status: 'in_warehouse' }).eq('id', testBox.id);
    }
  } else {
    console.log('No in_warehouse box found to test.');
  }

  // Check stock_movements allowed movement_types
  const { data: smTypes } = await sb.from('stock_movements').select('movement_type');
  const uniqueTypes = [...new Set((smTypes || []).map(s => s.movement_type))];
  console.log('\nExisting movement_types:', uniqueTypes);

  // Check orders status values
  const { data: orderStatuses } = await sb.from('orders').select('status');
  const uniqueOrderStatuses = [...new Set((orderStatuses || []).map(o => o.status))];
  console.log('\nExisting order statuses:', uniqueOrderStatuses);

  await sb.auth.signOut();
}
run().catch(console.error);
