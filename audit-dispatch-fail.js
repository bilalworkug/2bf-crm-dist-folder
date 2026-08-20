const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const BARCODE = 'TEST-DISPATCH-FAIL-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';

  const { data: product } = await sb.from('products').select('id').limit(1).single();
  const { data: cust } = await sb.from('customers').select('id').limit(1).single();

  await sb.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: auth.session.user.id });
  await sb.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: auth.session.user.id });

  const { data: order } = await sb.from('orders').insert({
    order_number: 'ORD-' + Date.now(),
    customer_id: cust.id,
    status: 'approved',
    sales_person_id: auth.session.user.id,
    total_amount: 0
  }).select().single();

  await sb.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });
  
  await sb.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });

  const { data: box } = await sb.from('boxes').select('*').eq('barcode', BARCODE).single();
  console.log("Box status before dispatch:", box.status, "current_order_id:", box.current_order_id, "expected order_id:", order.id);
  
  const { error } = await sb.rpc('fn_dispatch_box', {
    p_barcode: BARCODE,
    p_order_id: order.id,
    p_warehouse_id: WH_ID,
    p_user_id: auth.session.user.id
  });

  console.log("Dispatch error:", error);

  await sb.auth.signOut();
}
run().catch(console.error);
