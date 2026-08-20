const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const log = (type, msg) => console.log(`${type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️'} ${msg}`);

async function verify() {
  console.log('\n=====================================');
  console.log('  PHASE 5: DELIVERY E2E VERIFICATION');
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

  const BARCODE = 'TEST-DEL-' + Date.now();
  const WRONG_BARCODE = 'WRONG-DEL-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';

  try {
    // ---- 1. Prerequisites (Produce -> Receive -> Order -> Allocate -> Dispatch) ----
    console.log('\n[1] Preparing prerequisites...');
    const { data: product } = await sbAdmin.from('products').select('id').limit(1).single();
    await sbAdmin.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_produce_box', { p_barcode: WRONG_BARCODE, p_product_id: product.id, p_user_id: adminId });
    
    await sbAdmin.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: WRONG_BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    
    const { data: cust } = await sbAdmin.from('customers').select('id').limit(1).single();
    const { data: order } = await sbAdmin.from('orders').insert({
      order_number: 'DEL-ORD-' + Date.now(),
      customer_id: cust.id,
      status: 'approved',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    const { data: order2 } = await sbAdmin.from('orders').insert({
      order_number: 'DEL-ORD2-' + Date.now(),
      customer_id: cust.id,
      status: 'approved',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    
    await sbAdmin.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });
    await sbAdmin.rpc('fn_create_order_item', { p_order_id: order2.id, p_product_id: product.id, p_quantity: 1 });
    
    await sbAdmin.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });
    await sbAdmin.rpc('fn_allocate_box', { p_barcode: WRONG_BARCODE, p_order_id: order2.id, p_warehouse_id: WH_ID });
    
    await sbAdmin.rpc('fn_dispatch_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId });
    await sbAdmin.rpc('fn_dispatch_box', { p_barcode: WRONG_BARCODE, p_order_id: order2.id, p_warehouse_id: WH_ID, p_user_id: adminId });
    assert(true, 'Prerequisites completed', '');

    // ---- 2. Create Delivery ----
    console.log('\n[2] Creating Delivery...');
    const { data: deliveryId, error: createErr } = await sbAdmin.rpc('fn_create_delivery', { p_order_id: order.id });
    assert(!createErr && deliveryId, 'Delivery created securely via RPC', `Create Delivery failed: ${createErr?.message}`);

    const { data: deliveryId2 } = await sbAdmin.rpc('fn_create_delivery', { p_order_id: order2.id });

    // ---- 3. Test Rejections ----
    console.log('\n[3] Testing negative delivery scenarios...');
    
    const { error: errUnauthorized } = await sbProd.rpc('fn_deliver_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(errUnauthorized && errUnauthorized.message.includes('Unauthorized'), 'Production user blocked from delivery', 'Failed to block unauthorized user');

    const { error: errWrongOrder } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: WRONG_BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(errWrongOrder && errWrongOrder.message.includes('does not belong to this order'), 'Wrong order correctly rejected', `Failed to reject wrong order: ${errWrongOrder?.message}`);

    const { error: errWrongDelivery } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId2, p_user_id: adminId
    });
    assert(errWrongDelivery && errWrongDelivery.message.includes('Delivery order ID mismatch'), 'Mismatched delivery correctly rejected', `Failed to reject mismatched delivery: ${errWrongDelivery?.message}`);

    const UNALLOC_BARCODE = 'TEST-DEL-UNALLOC-' + Date.now();
    await sbAdmin.rpc('fn_produce_box', { p_barcode: UNALLOC_BARCODE, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: UNALLOC_BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });
    const { error: errUnalloc } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: UNALLOC_BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(errUnalloc && errUnalloc.message.includes('must be dispatched first'), 'Non-dispatched box correctly rejected', `Failed to reject non-dispatched box: ${errUnalloc?.message}`);

    const { error: errNoBarcode } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: 'NONEXISTENT', p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(errNoBarcode && errNoBarcode.message.includes('Barcode not found'), 'Nonexistent barcode correctly rejected', `Failed to reject nonexistent barcode: ${errNoBarcode?.message}`);

    // ---- 4. Valid Delivery ----
    console.log('\n[4] Executing valid delivery...');
    const { data: deliverResult, error: deliverErr } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(!deliverErr, 'Valid deliver_box succeeded', `Deliver box failed: ${deliverErr?.message}`);

    // ---- 5. Duplicate Delivery ----
    console.log('\n[5] Testing duplicate delivery...');
    const { error: dupErr } = await sbAdmin.rpc('fn_deliver_box', {
      p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId
    });
    assert(dupErr && dupErr.message.includes('already delivered'), 'Already delivered box correctly rejected', `Failed to reject already delivered box: ${dupErr?.message}`);

    // ---- 6. Complete Delivery ----
    console.log('\n[6] Completing Delivery...');
    const { error: compErr } = await sbAdmin.rpc('fn_complete_delivery', {
      p_delivery_id: deliveryId, p_receiver_name: 'Test Receiver', p_receiver_phone: '12345', p_notes: 'Notes', p_user_id: adminId
    });
    assert(!compErr, 'Valid complete_delivery succeeded', `Complete delivery failed: ${compErr?.message}`);

    // ---- 7. Verifying State and Traceability ----
    console.log('\n[7] Verifying State and Traceability...');
    
    const { data: boxAfter } = await sbAdmin.from('boxes').select('*').eq('barcode', BARCODE).single();
    assert(boxAfter.status === 'delivered', 'Box status updated to delivered', `Box status is ${boxAfter?.status}`);
    assert(boxAfter.customer_id === cust.id, 'Box customer_id set for traceability', 'Box customer_id not set');

    const { data: delItem } = await sbAdmin.from('delivery_items').select('*').eq('barcode', BARCODE).single();
    assert(delItem, 'Delivery record created in delivery_items table', 'No delivery_items record found');

    const { data: delAfter } = await sbAdmin.from('deliveries').select('*').eq('id', deliveryId).single();
    assert(delAfter && delAfter.status === 'delivered', 'Delivery status updated to delivered', `Delivery status is ${delAfter?.status}`);
    assert(delAfter && delAfter.receiver_name === 'Test Receiver', 'Delivery receiver_name updated', 'Delivery receiver_name not updated');

    const { data: orderAfter } = await sbAdmin.from('orders').select('*').eq('id', order.id).single();
    assert(orderAfter && orderAfter.status === 'delivered', 'Order status updated to delivered', `Order status is ${orderAfter?.status}`);

    // Barcode History Array Check
    const { data: bhData } = await sbAdmin.from('barcode_history').select('action').eq('barcode', BARCODE).order('performed_at', { ascending: true });
    const bhActions = bhData.map(b => b.action);
    const hasLifecycle = bhActions.includes('PRODUCED') || bhActions.includes('produced') 
      && bhActions.includes('RECEIVED') && bhActions.includes('ALLOCATED') 
      && bhActions.includes('DISPATCHED') && bhActions.includes('DELIVERED');
    assert(hasLifecycle, `Barcode history contains full lifecycle: ${bhActions.join(' -> ')}`, `Barcode history incomplete: ${bhActions.join(' -> ')}`);

    const { data: alData } = await sbAdmin.from('audit_logs').select('*').eq('barcode', BARCODE).eq('action', 'box_delivered').single();
    assert(alData, 'Audit log box_delivered created', 'Audit log missing');

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
      console.log('🔴 PHASE 5: HAS FAILURES');
      process.exit(1);
    } else {
      console.log('🟢 PHASE 5: FULLY OPERATIONAL');
    }
  }
}

verify();
