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
  console.log('  STOCK ALLOCATION VERIFICATION');
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

  const BARCODE = 'ALLOC-TEST-' + Date.now();

  try {
    // ---- STEP 1: Produce a box ----
    console.log('\n[1] Producing box...');
    const { data: product } = await sbAdmin.from('products').select('id').limit(1).single();
    const { error: prodErr } = await sbAdmin.rpc('fn_produce_box', {
      p_barcode: BARCODE,
      p_product_id: product.id,
      p_user_id: adminId
    });
    assert(!prodErr, `Box produced: ${BARCODE}`, `Production failed: ${prodErr?.message}`);

    // ---- STEP 2: Receive into warehouse ----
    console.log('\n[2] Receiving box into warehouse...');
    const { error: recvErr } = await sbAdmin.rpc('fn_receive_box', {
      p_barcode: BARCODE,
      p_warehouse_id: WH_ID,
      p_user_id: adminId
    });
    assert(!recvErr, `Box received into warehouse`, `Receive failed: ${recvErr?.message}`);

    // ---- STEP 3: Create an order ----
    console.log('\n[3] Creating order...');
    const { data: cust } = await sbAdmin.from('customers').select('id').limit(1).single();
    const orderNum = 'ALLOC-ORD-' + Date.now();
    const { data: order, error: orderErr } = await sbAdmin.from('orders').insert({
      order_number: orderNum,
      customer_id: cust.id,
      status: 'approved',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    assert(!orderErr && order, `Order created: ${orderNum} (status: approved)`, `Order creation failed: ${orderErr?.message}`);

    // Add an order item via RPC
    const { data: orderItem, error: oiErr } = await sbAdmin.rpc('fn_create_order_item', {
      p_order_id: order.id,
      p_product_id: product.id,
      p_quantity: 5
    });
    assert(!oiErr && orderItem, `Order item created for product`, `Order item failed: ${oiErr?.message}`);

    // ---- STEP 4: Allocate the box ----
    console.log('\n[4] Allocating box to order...');
    const { data: allocResult, error: allocErr } = await sbAdmin.rpc('fn_allocate_box', {
      p_barcode: BARCODE,
      p_order_id: order.id,
      p_warehouse_id: WH_ID
    });
    assert(!allocErr && allocResult, `Allocation succeeded`, `Allocation failed: ${allocErr?.message}`);

    if (allocResult) {
      assert(allocResult.status === 'allocated', `Allocation status = 'allocated' ✓`, `Unexpected status: ${allocResult.status}`);
    }

    // ---- STEP 5: Verify box status ----
    console.log('\n[5] Verifying box status...');
    const { data: boxAfter } = await sbAdmin.from('boxes').select('status, current_order_id').eq('barcode', BARCODE).single();
    assert(boxAfter?.status === 'allocated', `Box status updated to 'allocated' ✓`, `Box status = '${boxAfter?.status}' (expected 'allocated')`);
    assert(boxAfter?.current_order_id === order.id, `Box linked to order ✓`, `Box current_order_id mismatch`);

    // ---- STEP 6: Stock movement ----
    console.log('\n[6] Verifying stock movement...');
    const { data: sm } = await sbAdmin.from('stock_movements').select('*')
      .eq('barcode', BARCODE).eq('movement_type', 'ALLOCATE').single();
    assert(sm, `Stock movement ALLOCATE created ✓`, `Stock movement ALLOCATE not found`);

    // ---- STEP 7: Barcode history ----
    console.log('\n[7] Verifying barcode history...');
    const { data: bh } = await sbAdmin.from('barcode_history').select('*')
      .eq('barcode', BARCODE).eq('action', 'ALLOCATED').single();
    assert(bh, `Barcode history ALLOCATED event created ✓`, `Barcode history ALLOCATED not found`);
    assert(bh?.order_id === order.id, `Barcode history linked to order ✓`, `Barcode history order_id mismatch`);

    // ---- STEP 8: Audit log ----
    console.log('\n[8] Verifying audit log...');
    const { data: al } = await sbAdmin.from('audit_logs').select('*')
      .eq('barcode', BARCODE).eq('action', 'box_allocated').limit(1);
    assert(al && al.length > 0, `Audit log 'box_allocated' created ✓`, `Audit log missing`);

    // ---- STEP 9: Duplicate allocation rejected ----
    console.log('\n[9] Testing duplicate allocation rejection...');
    const { error: dupErr } = await sbAdmin.rpc('fn_allocate_box', {
      p_barcode: BARCODE,
      p_order_id: order.id,
      p_warehouse_id: WH_ID
    });
    assert(dupErr && dupErr.message.includes('already allocated'), `Duplicate allocation correctly rejected ✓`, `Duplicate was allowed! Error: ${dupErr?.message || 'None'}`);

    // ---- STEP 10: Wrong warehouse rejected ----
    console.log('\n[10] Testing wrong warehouse rejection...');
    const BARCODE2 = 'ALLOC-TEST2-' + Date.now();
    await sbAdmin.rpc('fn_produce_box', { p_barcode: BARCODE2, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: BARCODE2, p_warehouse_id: WH_ID, p_user_id: adminId });
    const { error: whErr } = await sbAdmin.rpc('fn_allocate_box', {
      p_barcode: BARCODE2,
      p_order_id: order.id,
      p_warehouse_id: '00000000-0000-0000-0000-000000000099'  // wrong warehouse
    });
    assert(whErr && whErr.message.includes('does not belong'), `Wrong warehouse correctly rejected ✓`, `Wrong warehouse was allowed! Error: ${whErr?.message || 'None'}`);

    // ---- STEP 11: Wrong product rejected ----
    console.log('\n[11] Testing wrong product rejection...');
    // Create a second product and produce a box for it
    const { data: product2 } = await sbAdmin.from('products').select('id').neq('id', product.id).limit(1).single();
    if (product2) {
      const BARCODE3 = 'ALLOC-TEST3-' + Date.now();
      await sbAdmin.rpc('fn_produce_box', { p_barcode: BARCODE3, p_product_id: product2.id, p_user_id: adminId });
      await sbAdmin.rpc('fn_receive_box', { p_barcode: BARCODE3, p_warehouse_id: WH_ID, p_user_id: adminId });
      const { error: prodMismatchErr } = await sbAdmin.rpc('fn_allocate_box', {
        p_barcode: BARCODE3,
        p_order_id: order.id,
        p_warehouse_id: WH_ID
      });
      assert(prodMismatchErr && prodMismatchErr.message.includes('Product mismatch'), `Wrong product correctly rejected ✓`, `Wrong product was allowed! Error: ${prodMismatchErr?.message || 'None'}`);
    }

    // ---- STEP 12: Security - production user blocked ----
    console.log('\n[12] Testing security (production user cannot allocate)...');
    const { error: secErr } = await sbProd.rpc('fn_allocate_box', {
      p_barcode: BARCODE2,
      p_order_id: order.id,
      p_warehouse_id: WH_ID
    });
    assert(secErr && secErr.message.includes('Unauthorized'), `Production user correctly blocked ✓`, `Security violation! Production user was allowed to allocate.`);

    // ---- STEP 13: Allocation visible in order_allocations ----
    console.log('\n[13] Verifying allocation record in order_allocations...');
    const { data: allocRecord } = await sbAdmin.from('order_allocations').select('*').eq('barcode', BARCODE).single();
    assert(allocRecord, `Allocation record found in order_allocations ✓`, `Allocation record not found`);
    assert(allocRecord?.order_id === order.id, `Allocation linked to correct order ✓`, `Order ID mismatch in allocation`);

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
      console.log('🔴 STOCK ALLOCATION: HAS FAILURES');
      process.exit(1);
    } else {
      console.log('🟢 STOCK ALLOCATION: FULLY OPERATIONAL');
    }
  }
}

verify();
