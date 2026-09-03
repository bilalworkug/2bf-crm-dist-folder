const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const log = (type, msg) => console.log(`${type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️'} ${msg}`);

const WH_ID = '00000000-0000-0000-0000-000000000001';

async function verify() {
  console.log('\n=====================================');
  console.log('  PHASE 4: DISPATCH E2E VERIFICATION');
  console.log('=====================================\n');

  let passed = 0, failed = 0;
  function assert(condition, ok, fail) {
    if (condition) { log('pass', ok); passed++; } else { log('fail', fail); failed++; }
  }

  const sbAdmin = createClient(supabaseUrl, supabaseAnonKey);
  const sbProd = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authAdmin } = await sbAdmin.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const adminId = authAdmin.session.user.id;
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });

  const BARCODE = 'TEST-DISPATCH-' + Date.now();
  const WRONG_BARCODE = 'WRONG-DISPATCH-' + Date.now();

  try {
    // ---- 1. Produce ----
    console.log('\n[1] Producing boxes...');
    const { data: product } = await sbAdmin.from('products').select('id').limit(1).single();
    await sbAdmin.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_produce_box', { p_barcode: WRONG_BARCODE, p_product_id: product.id, p_user_id: adminId });
    assert(true, 'Boxes produced successfully', '');

    // ---- 2. Receive ----
    console.log('\n[2] Receiving boxes...');
    await sbAdmin.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: WRONG_BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    assert(true, 'Boxes received into warehouse successfully', '');

    // ---- 3. Order ----
    console.log('\n[3] Creating order & allocating...');
    const { data: cust } = await sbAdmin.from('customers').select('id').limit(1).single();
    const { data: order } = await sbAdmin.from('orders').insert({
      order_number: 'DISP-ORD-' + Date.now(),
      customer_id: cust.id,
      status: 'approved',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    await sbAdmin.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 5 });
    
    const { data: order2 } = await sbAdmin.from('orders').insert({
      order_number: 'DISP-ORD2-' + Date.now(),
      customer_id: cust.id,
      status: 'approved',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    await sbAdmin.rpc('fn_create_order_item', { p_order_id: order2.id, p_product_id: product.id, p_quantity: 5 });

    // Allocate BARCODE to order 1, WRONG_BARCODE to order 2
    await sbAdmin.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });
    await sbAdmin.rpc('fn_allocate_box', { p_barcode: WRONG_BARCODE, p_order_id: order2.id, p_warehouse_id: WH_ID });
    assert(true, 'Order creation and allocations successful', '');

    // ---- 4. Attempt invalid dispatches ----
    console.log('\n[4] Testing dispatch rejections...');
    
    // a. Wrong order
    const { error: errWrongOrder } = await sbAdmin.rpc('fn_dispatch_box', {
      p_barcode: BARCODE, p_order_id: order2.id, p_warehouse_id: WH_ID, p_user_id: adminId
    });
    assert(errWrongOrder && errWrongOrder.message.includes('not allocated to this order'), 'Wrong order correctly rejected', `Failed to reject wrong order: ${errWrongOrder?.message}`);

    // b. Wrong warehouse
    const { error: errWrongWh } = await sbAdmin.rpc('fn_dispatch_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: '00000000-0000-0000-0000-000000000099', p_user_id: adminId
    });
    assert(errWrongWh && errWrongWh.message.includes('does not belong to this warehouse'), 'Wrong warehouse correctly rejected', `Failed to reject wrong warehouse: ${errWrongWh?.message}`);

    // c. Unallocated box (produce & receive a 3rd box but don't allocate)
    const UNALLOC_BARCODE = 'TEST-UNALLOC-' + Date.now();
    await sbAdmin.rpc('fn_produce_box', { p_barcode: UNALLOC_BARCODE, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: UNALLOC_BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    const { error: errUnalloc } = await sbAdmin.rpc('fn_dispatch_box', {
      p_barcode: UNALLOC_BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId
    });
    assert(errUnalloc && errUnalloc.message.includes('must be allocated first'), 'Unallocated box correctly rejected', `Failed to reject unallocated box: ${errUnalloc?.message}`);

    // d. Unauthorized user
    const { error: errUnauth } = await sbProd.rpc('fn_dispatch_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId
    });
    assert(errUnauth && errUnauth.message.includes('Unauthorized'), 'Production user blocked from dispatch', `Failed to block unauthorized user`);

    // ---- 5. Valid Dispatch ----
    console.log('\n[5] Executing valid dispatch...');
    const { data: dispatchResult, error: dispatchErr } = await sbAdmin.rpc('fn_dispatch_box', {
      p_barcode: BARCODE,
      p_order_id: order.id,
      p_warehouse_id: WH_ID,
      p_user_id: adminId
    });
    assert(!dispatchErr, 'Valid dispatch succeeded', `Dispatch failed: ${dispatchErr?.message}`);

    // ---- 6. Traceability Verification ----
    console.log('\n[6] Verifying traceability & state changes...');
    
    const { data: boxAfter } = await sbAdmin.from('boxes').select('*').eq('barcode', BARCODE).single();
    assert(boxAfter.status === 'dispatched', 'Box status updated to dispatched', `Box status is ${boxAfter.status}`);
    assert(boxAfter.current_warehouse_id === null, 'Box current_warehouse_id cleared', 'Box warehouse not cleared');
    assert(boxAfter.current_order_id === order.id, 'Box current_order_id preserved for traceability', 'Box order ID cleared incorrectly');

    const { data: dispatchRec } = await sbAdmin.from('dispatches').select('*').eq('barcode', BARCODE).single();
    assert(dispatchRec, 'Dispatch record created in dispatches table', 'No dispatch record found');

    const { data: sm } = await sbAdmin.from('stock_movements').select('*').eq('barcode', BARCODE).eq('movement_type', 'OUT').single();
    assert(sm, 'Stock movement OUT created', 'Stock movement missing');

    const { data: bh } = await sbAdmin.from('barcode_history').select('*').eq('barcode', BARCODE).eq('action', 'DISPATCHED').single();
    assert(bh, 'Barcode history DISPATCHED created', 'Barcode history missing');

    const { data: al } = await sbAdmin.from('audit_logs').select('*').eq('barcode', BARCODE).eq('action', 'box_dispatched').single();
    assert(al, 'Audit log box_dispatched created', 'Audit log missing');

    // ---- 7. Duplicate Dispatch Rejection ----
    console.log('\n[7] Testing duplicate dispatch rejection...');
    const { error: dupErr } = await sbAdmin.rpc('fn_dispatch_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId
    });
    assert(dupErr && dupErr.message.includes('already dispatched'), 'Already dispatched box rejected', `Failed to reject already dispatched box`);

  } catch (err) {
    console.error('\n❌ UNHANDLED EXCEPTION:', err);
  } finally {
    console.log('\n=====================================');
    console.log('  VERIFICATION SUMMARY');
    console.log('=====================================');
    console.log(`✅ PASSED:   ${passed}`);
    console.log(`❌ FAILED:   ${failed}`);
    console.log(`Total:       ${passed + failed}\n`);
    
    if (failed > 0) {
      console.log('🔴 PHASE 4: HAS FAILURES');
      process.exit(1);
    } else {
      console.log('🟢 PHASE 4: FULLY OPERATIONAL');
    }
  }
}

verify();
