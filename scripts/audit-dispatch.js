const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  console.log('--- SCHEMA CHECK ---');

  // Check if dispatches table exists
  const { data: disp, error: dispErr } = await sb.from('dispatches').select('*').limit(1);
  console.log('\ndispatches table:', dispErr ? `ERROR: ${dispErr.message}` : `OK, columns: ${Object.keys(disp?.[0] || {})}`);

  // Check fn_dispatch_box exists
  const { error: rpcErr } = await sb.rpc('fn_dispatch_box', { p_barcode: 'x' });
  console.log('\nfn_dispatch_box exists?', rpcErr?.message?.includes('schema cache') ? 'NO' : `YES (error: ${rpcErr?.message})`);

  // Check stock_movements types
  const { data: smTypes } = await sb.from('stock_movements').select('movement_type');
  const uniqueTypes = [...new Set((smTypes || []).map(s => s.movement_type))];
  console.log('\nExisting movement_types:', uniqueTypes);

  // Check box statuses
  const { data: statuses } = await sb.from('boxes').select('status');
  const unique = [...new Set((statuses || []).map(b => b.status))];
  console.log('\nAll box statuses in DB:', unique);
  
  await sb.auth.signOut();
}
run().catch(console.error);
