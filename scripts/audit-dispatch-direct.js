const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const userId = authData.session.user.id;

  const BARCODE = 'DIRECT-DISP-TEST-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';

  // produce
  const { data: product } = await sb.from('products').select('id').limit(1).single();
  await sb.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: userId });
  
  // receive
  await sb.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: userId });

  // order
  const { data: cust } = await sb.from('customers').select('id').limit(1).single();
  const { data: order, error: orderErr } = await sb.from('orders').insert({
    order_number: 'ORD-' + Date.now(),
    customer_id: cust.id,
    status: 'approved',
    sales_person_id: userId,
    total_amount: 0
  }).select().single();
  
  if (orderErr) {
    console.log("Order Insert Error:", orderErr);
    return;
  }
  await sb.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });
  
  // allocate
  await sb.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });

  // dispatch
  const { data: dispResult, error: dispErr } = await sb.rpc('fn_dispatch_box', {
    p_barcode: BARCODE,
    p_order_id: order.id,
    p_warehouse_id: WH_ID,
    p_user_id: userId
  });
  
  console.log("Dispatch RPC Data:", dispResult);
  console.log("Dispatch RPC Error:", dispErr);

  const { data: boxAfter } = await sb.from('boxes').select('*').eq('barcode', BARCODE).single();
  console.log("Box status after dispatch:", boxAfter?.status);

  await sb.auth.signOut();
}
run().catch(console.error);
