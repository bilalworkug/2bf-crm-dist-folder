const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const adminId = auth.session.user.id;

  console.log('=== DELIVERY DEEP AUDIT ===\n');

  // 1. Inspect existing deliveries
  const { data: deliveries } = await sb.from('deliveries').select('*');
  console.log('1. Existing deliveries:', JSON.stringify(deliveries, null, 2));

  // 2. Inspect delivery_items columns by trying a bogus insert
  const { error: diErr } = await sb.from('delivery_items').insert({
    delivery_id: deliveries?.[0]?.id || '00000000-0000-0000-0000-000000000001',
    barcode: 'AUDIT-TEST',
    order_id: deliveries?.[0]?.order_id || '00000000-0000-0000-0000-000000000001',
    product_id: '00000000-0000-0000-0000-000000000001',
    user_id: adminId
  });
  console.log('\n2. delivery_items insert test:', diErr?.message || 'Inserted (unexpected)');

  // 3. E2E flow test: Produce -> Receive -> Order -> Allocate -> Dispatch -> Deliver
  console.log('\n--- E2E DELIVERY TEST ---');
  const BARCODE = 'TEST-DELIVERY-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';

  // Produce
  const { data: product } = await sb.from('products').select('id').limit(1).single();
  const { error: prodErr } = await sb.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: adminId });
  console.log('3a. Produce:', prodErr?.message || 'OK');

  // Receive
  const { error: recvErr } = await sb.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
  console.log('3b. Receive:', recvErr?.message || 'OK');

  // Order
  const { data: cust } = await sb.from('customers').select('id').limit(1).single();
  const { data: order } = await sb.from('orders').insert({
    order_number: 'DEL-ORD-' + Date.now(),
    customer_id: cust.id,
    status: 'approved',
    sales_person_id: adminId,
    total_amount: 0
  }).select().single();
  await sb.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });
  console.log('3c. Order:', order?.id ? 'OK' : 'FAILED');

  // Allocate
  const { error: allocErr } = await sb.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });
  console.log('3d. Allocate:', allocErr?.message || 'OK');

  // Dispatch
  const { error: dispErr } = await sb.rpc('fn_dispatch_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId });
  console.log('3e. Dispatch:', dispErr?.message || 'OK');

  // Create delivery
  const { data: delivery, error: delErr } = await sb.from('deliveries').insert({ order_id: order.id, status: 'pending' }).select().single();
  console.log('3f. Create delivery:', delErr?.message || 'OK', delivery?.id);

  // Deliver box
  if (delivery) {
    const { data: deliverResult, error: deliverErr } = await sb.rpc('fn_deliver_box', {
      p_barcode: BARCODE,
      p_order_id: order.id,
      p_delivery_id: delivery.id,
      p_user_id: adminId,
      p_user_role: 'admin'
    });
    console.log('3g. Deliver box:', deliverErr?.message || 'OK', deliverResult);

    // Check box status after deliver
    const { data: boxAfter } = await sb.from('boxes').select('status, current_order_id, current_warehouse_id').eq('barcode', BARCODE).single();
    console.log('3h. Box after delivery:', boxAfter);

    // Check delivery_items
    const { data: di } = await sb.from('delivery_items').select('*').eq('barcode', BARCODE);
    console.log('3i. delivery_items:', di);

    // Check barcode_history
    const { data: bh } = await sb.from('barcode_history').select('action, performed_at').eq('barcode', BARCODE).order('performed_at', { ascending: true });
    console.log('3j. barcode_history:', bh?.map(b => b.action));

    // Complete delivery
    const { data: compResult, error: compErr } = await sb.rpc('fn_complete_delivery', {
      p_delivery_id: delivery.id,
      p_receiver_name: 'Test Receiver',
      p_receiver_phone: '0911111111',
      p_notes: 'Audit test',
      p_user_id: adminId,
      p_user_role: 'admin'
    });
    console.log('3k. Complete delivery:', compErr?.message || 'OK', compResult);

    // Check delivery after completion
    const { data: delAfter } = await sb.from('deliveries').select('*').eq('id', delivery.id).single();
    console.log('3l. Delivery after completion:', delAfter);

    // Check order status after completion
    const { data: orderAfter } = await sb.from('orders').select('status').eq('id', order.id).single();
    console.log('3m. Order status after delivery:', orderAfter);

    // Check audit_logs
    const { data: al } = await sb.from('audit_logs').select('action, barcode').eq('barcode', BARCODE);
    console.log('3n. audit_logs for barcode:', al?.map(a => a.action));
  }

  // 4. Test unauthorized user
  console.log('\n--- UNAUTHORIZED TEST ---');
  const sbProd = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });
  
  const { error: unauthErr } = await sbProd.rpc('fn_deliver_box', {
    p_barcode: BARCODE,
    p_order_id: '00000000-0000-0000-0000-000000000001',
    p_delivery_id: '00000000-0000-0000-0000-000000000001',
    p_user_id: adminId,
    p_user_role: 'production'
  });
  console.log('4. Unauthorized deliver:', unauthErr?.message || 'ALLOWED (BAD)');

  await sb.auth.signOut();
  await sbProd.auth.signOut();
}
run().catch(console.error);
