const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const adminId = auth.session.user.id;

  console.log('=== PHASE 6: RETURNS AUDIT ===\n');

  // 1. Schema
  console.log('--- 1. SCHEMA ---');
  const { data: retSchema } = await sb.rpc('fn_get_schema', { p_table: 'returns' });
  console.log('returns:', retSchema);

  // 2. Existing returns data
  const { data: retData, error: retErr } = await sb.from('returns').select('*').limit(5);
  console.log('\n--- 2. EXISTING RETURNS ---');
  console.log('returns SELECT:', retErr ? `ERROR: ${retErr.message}` : `${retData.length} rows`);
  if (retData && retData.length > 0) {
    console.log('Sample:', JSON.stringify(retData[0], null, 2));
  }

  // 3. RPCs
  console.log('\n--- 3. RPCs ---');
  
  const { error: e1 } = await sb.rpc('fn_request_return', {
    p_barcode: 'x', p_order_id: '00000000-0000-0000-0000-000000000001',
    p_warehouse_id: '00000000-0000-0000-0000-000000000001',
    p_reason: 'test', p_condition: 'good',
    p_user_id: adminId, p_user_role: 'admin'
  });
  console.log('fn_request_return:', e1 ? (e1.message.includes('schema cache') || e1.message.includes('Could not find') ? 'DOES NOT EXIST' : `EXISTS (err: ${e1.message})`) : 'EXISTS');

  const { error: e2 } = await sb.rpc('fn_approve_return', {
    p_return_id: '00000000-0000-0000-0000-000000000001',
    p_user_id: adminId, p_user_role: 'admin'
  });
  console.log('fn_approve_return:', e2 ? (e2.message.includes('schema cache') || e2.message.includes('Could not find') ? 'DOES NOT EXIST' : `EXISTS (err: ${e2.message})`) : 'EXISTS');

  // 4. Box statuses
  const { data: statuses } = await sb.from('boxes').select('status');
  const unique = [...new Set((statuses || []).map(b => b.status))];
  console.log('\n--- 4. BOX STATUSES ---');
  console.log('All:', unique);

  // 5. barcode_history actions
  const { data: bhActions } = await sb.from('barcode_history').select('action');
  const uniqueActions = [...new Set((bhActions || []).map(b => b.action))];
  console.log('\n--- 5. BARCODE HISTORY ACTIONS ---');
  console.log('All:', uniqueActions);

  // 6. RLS checks
  console.log('\n--- 6. RLS ---');
  const sbProd = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });

  const { data: retProd, error: retProdErr } = await sbProd.from('returns').select('*');
  console.log('Production user SELECT returns:', retProdErr ? `BLOCKED: ${retProdErr.message}` : `ALLOWED (${retProd.length} rows)`);

  const { error: reqProdErr } = await sbProd.rpc('fn_request_return', {
    p_barcode: 'x', p_order_id: '00000000-0000-0000-0000-000000000001',
    p_warehouse_id: '00000000-0000-0000-0000-000000000001',
    p_reason: 'test', p_condition: 'good',
    p_user_id: adminId, p_user_role: 'production'
  });
  console.log('Production user fn_request_return:', reqProdErr?.message || 'ALLOWED (BAD)');

  const { error: appProdErr } = await sbProd.rpc('fn_approve_return', {
    p_return_id: '00000000-0000-0000-0000-000000000001',
    p_user_id: adminId, p_user_role: 'production'
  });
  console.log('Production user fn_approve_return:', appProdErr?.message || 'ALLOWED (BAD)');

  // 7. E2E test: Produce -> Receive -> Order -> Allocate -> Dispatch -> Deliver -> Return Request -> Approve
  console.log('\n--- 7. E2E TEST ---');
  const BARCODE = 'TEST-RETURN-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';
  const { data: product } = await sb.from('products').select('id').limit(1).single();
  const { data: cust } = await sb.from('customers').select('id').limit(1).single();

  // Produce & Receive
  await sb.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: adminId });
  await sb.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });

  // Order
  const { data: order } = await sb.from('orders').insert({
    order_number: 'RET-ORD-' + Date.now(), customer_id: cust.id, status: 'approved',
    sales_person_id: adminId, total_amount: 0
  }).select().single();
  await sb.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });

  // Allocate & Dispatch
  await sb.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });
  await sb.rpc('fn_dispatch_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId });

  // Deliver
  const { data: deliveryId } = await sb.rpc('fn_create_delivery', { p_order_id: order.id });
  await sb.rpc('fn_deliver_box', { p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId });
  await sb.rpc('fn_complete_delivery', { p_delivery_id: deliveryId, p_receiver_name: 'Test', p_receiver_phone: '123', p_notes: '', p_user_id: adminId });

  // Verify delivered
  const { data: boxPre } = await sb.from('boxes').select('status').eq('barcode', BARCODE).single();
  console.log('Box status before return:', boxPre.status);

  // Request Return
  const { data: reqResult, error: reqErr } = await sb.rpc('fn_request_return', {
    p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID,
    p_reason: 'Audit test return', p_condition: 'good',
    p_user_id: adminId, p_user_role: 'admin'
  });
  console.log('Return request:', reqErr ? `FAILED: ${reqErr.message}` : `OK (result: ${JSON.stringify(reqResult)})`);

  // Check box after request
  const { data: boxAfterReq } = await sb.from('boxes').select('status').eq('barcode', BARCODE).single();
  console.log('Box status after return request:', boxAfterReq.status);

  // Check returns table
  const { data: retRecord } = await sb.from('returns').select('*').eq('barcode', BARCODE);
  console.log('Returns record:', retRecord?.length ? JSON.stringify(retRecord[0], null, 2) : 'NOT FOUND');

  // Check barcode history
  const { data: bh } = await sb.from('barcode_history').select('action').eq('barcode', BARCODE).order('performed_at', { ascending: true });
  console.log('Barcode history:', bh?.map(b => b.action));

  // Approve
  if (retRecord && retRecord.length > 0) {
    const { data: appResult, error: appErr } = await sb.rpc('fn_approve_return', {
      p_return_id: retRecord[0].id,
      p_user_id: adminId, p_user_role: 'admin'
    });
    console.log('Approve return:', appErr ? `FAILED: ${appErr.message}` : `OK (result: ${JSON.stringify(appResult)})`);

    const { data: boxAfterApprove } = await sb.from('boxes').select('status, current_warehouse_id').eq('barcode', BARCODE).single();
    console.log('Box after approval:', boxAfterApprove);

    const { data: bhAfter } = await sb.from('barcode_history').select('action').eq('barcode', BARCODE).order('performed_at', { ascending: true });
    console.log('Barcode history after approval:', bhAfter?.map(b => b.action));

    const { data: alAfter } = await sb.from('audit_logs').select('action').eq('barcode', BARCODE);
    console.log('Audit logs:', alAfter?.map(a => a.action));

    // Check stock_movements
    const { data: smAfter } = await sb.from('stock_movements').select('movement_type').eq('barcode', BARCODE);
    console.log('Stock movements:', smAfter?.map(s => s.movement_type));
  }

  // 8. Duplicate return test
  console.log('\n--- 8. DUPLICATE RETURN ---');
  const { error: dupErr } = await sb.rpc('fn_request_return', {
    p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID,
    p_reason: 'Duplicate test', p_condition: 'good',
    p_user_id: adminId, p_user_role: 'admin'
  });
  console.log('Duplicate return request:', dupErr ? `REJECTED: ${dupErr.message}` : 'ALLOWED (potential issue)');

  await sb.auth.signOut();
  await sbProd.auth.signOut();
}
run().catch(console.error);
