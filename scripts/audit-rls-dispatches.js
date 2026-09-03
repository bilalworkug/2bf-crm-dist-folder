const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const { data: order } = await sb.from('orders').select('id').limit(1).single();
  const { data: product } = await sb.from('products').select('id').limit(1).single();
  const { data: wh } = await sb.from('warehouses').select('id').limit(1).single();

  const BARCODE = 'RLS-TEST-' + Date.now();

  const { error: insErr } = await sb.from('dispatches').insert({
    barcode: BARCODE,
    order_id: order.id,
    product_id: product.id,
    warehouse_id: wh.id
  });
  console.log("Insert directly:", insErr?.message || 'OK');

  const { data: selData, error: selErr } = await sb.from('dispatches').select('*').eq('barcode', BARCODE);
  console.log("Select directly:", selData, selErr?.message || 'OK');

  await sb.auth.signOut();
}
run().catch(console.error);
