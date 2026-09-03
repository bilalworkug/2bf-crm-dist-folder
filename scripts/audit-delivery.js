const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  console.log('=== DELIVERY AUDIT ===\n');

  // 1. Check deliveries table
  const { data: d1, error: e1 } = await sb.from('deliveries').select('*').limit(1);
  console.log('1. deliveries table:', e1 ? `ERROR: ${e1.message}` : `OK (rows: ${d1.length}, columns: ${d1.length > 0 ? Object.keys(d1[0]) : 'empty table'})`);

  // 2. Check delivery_items table
  const { data: d2, error: e2 } = await sb.from('delivery_items').select('*').limit(1);
  console.log('2. delivery_items table:', e2 ? `ERROR: ${e2.message}` : `OK (rows: ${d2.length}, columns: ${d2.length > 0 ? Object.keys(d2[0]) : 'empty table'})`);

  // 3. Check fn_deliver_box
  const { error: e3 } = await sb.rpc('fn_deliver_box', { p_barcode: 'x', p_order_id: '00000000-0000-0000-0000-000000000001', p_delivery_id: '00000000-0000-0000-0000-000000000001', p_user_id: '00000000-0000-0000-0000-000000000001', p_user_role: 'admin' });
  console.log('3. fn_deliver_box:', e3 ? (e3.message.includes('schema cache') || e3.message.includes('Could not find') ? 'DOES NOT EXIST' : `EXISTS (error: ${e3.message})`) : 'EXISTS (no error)');

  // 4. Check fn_complete_delivery
  const { error: e4 } = await sb.rpc('fn_complete_delivery', { p_delivery_id: '00000000-0000-0000-0000-000000000001', p_receiver_name: 'test', p_receiver_phone: '123', p_notes: 'test', p_user_id: '00000000-0000-0000-0000-000000000001', p_user_role: 'admin' });
  console.log('4. fn_complete_delivery:', e4 ? (e4.message.includes('schema cache') || e4.message.includes('Could not find') ? 'DOES NOT EXIST' : `EXISTS (error: ${e4.message})`) : 'EXISTS (no error)');

  // 5. Inspect deliveries columns by doing a dummy insert
  console.log('\n--- Column Discovery ---');
  const { data: d5, error: e5 } = await sb.from('deliveries').insert({ order_id: '00000000-0000-0000-0000-000000000001', status: 'pending' }).select().single();
  if (e5) {
    console.log('5a. deliveries insert test:', e5.message);
  } else {
    console.log('5a. deliveries columns:', Object.keys(d5));
    // cleanup
    await sb.from('deliveries').delete().eq('id', d5.id);
  }

  // 6. Inspect delivery_items columns
  const { error: e6 } = await sb.from('delivery_items').insert({ delivery_id: '00000000-0000-0000-0000-000000000001', barcode: 'x' }).select().single();
  console.log('6. delivery_items insert test:', e6 ? e6.message : 'OK');

  // 7. Check boxes statuses
  const { data: statuses } = await sb.from('boxes').select('status');
  const unique = [...new Set((statuses || []).map(b => b.status))];
  console.log('\n7. All box statuses in DB:', unique);

  // 8. Check barcode_history actions
  const { data: bhActions } = await sb.from('barcode_history').select('action');
  const uniqueActions = [...new Set((bhActions || []).map(b => b.action))];
  console.log('8. All barcode_history actions:', uniqueActions);

  // 9. Check stock_movement types
  const { data: smTypes } = await sb.from('stock_movements').select('movement_type');
  const uniqueTypes = [...new Set((smTypes || []).map(s => s.movement_type))];
  console.log('9. All stock_movement types:', uniqueTypes);

  // 10. Check RLS on deliveries and delivery_items
  console.log('\n--- RLS Check ---');
  const { data: rlsD, error: rlsDE } = await sb.from('deliveries').select('*').limit(5);
  console.log('10a. deliveries SELECT (as admin):', rlsDE ? `BLOCKED: ${rlsDE.message}` : `OK (${rlsD.length} rows)`);
  
  const { data: rlsDI, error: rlsDIE } = await sb.from('delivery_items').select('*').limit(5);
  console.log('10b. delivery_items SELECT (as admin):', rlsDIE ? `BLOCKED: ${rlsDIE.message}` : `OK (${rlsDI.length} rows)`);

  // 11. Check order statuses
  const { data: orderStatuses } = await sb.from('orders').select('status');
  const uniqueOS = [...new Set((orderStatuses || []).map(o => o.status))];
  console.log('\n11. All order statuses in DB:', uniqueOS);

  // 12. Check dispatches columns
  const { data: dispSample } = await sb.from('dispatches').select('*').limit(1);
  console.log('12. dispatches columns:', dispSample && dispSample.length > 0 ? Object.keys(dispSample[0]) : 'no data - empty table or RLS blocked');

  await sb.auth.signOut();
}
run().catch(console.error);
