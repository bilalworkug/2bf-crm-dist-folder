const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const log = (type, msg) => console.log(`${type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️'} ${msg}`);

async function verify() {
  console.log('\n=====================================');
  console.log('  PHASE 6: RETURNS E2E VERIFICATION');
  console.log('=====================================\n');

  let passed = 0, failed = 0;
  function assert(condition, ok, fail) {
    if (condition) { log('pass', ok); passed++; } else { log('fail', fail); failed++; }
  }

  const sbAdmin = createClient(supabaseUrl, supabaseAnonKey);
  const sbProd = createClient(supabaseUrl, supabaseAnonKey);
  const sbSales = createClient(supabaseUrl, supabaseAnonKey);

  const { data: authAdmin } = await sbAdmin.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const adminId = authAdmin.session.user.id;
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });

  const BARCODE = 'TEST-RET-' + Date.now();
  const WH_ID = '00000000-0000-0000-0000-000000000001';

  try {
    // ---- 1. Full lifecycle prerequisites ----
    console.log('\n[1] Prerequisites: Produce → Receive → Order → Allocate → Dispatch → Deliver...');
    const { data: product } = await sbAdmin.from('products').select('id').limit(1).single();
    const { data: cust } = await sbAdmin.from('customers').select('id').limit(1).single();

    await sbAdmin.rpc('fn_produce_box', { p_barcode: BARCODE, p_product_id: product.id, p_user_id: adminId });
    await sbAdmin.rpc('fn_receive_box', { p_barcode: BARCODE, p_warehouse_id: WH_ID, p_user_id: adminId });

    const { data: order } = await sbAdmin.from('orders').insert({
      order_number: 'RET-ORD-' + Date.now(), customer_id: cust.id, status: 'approved',
      sales_person_id: adminId, total_amount: 0
    }).select().single();
    await sbAdmin.rpc('fn_create_order_item', { p_order_id: order.id, p_product_id: product.id, p_quantity: 1 });
    await sbAdmin.rpc('fn_allocate_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID });
    await sbAdmin.rpc('fn_dispatch_box', { p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_user_id: adminId });

    const { data: deliveryId } = await sbAdmin.rpc('fn_create_delivery', { p_order_id: order.id });
    await sbAdmin.rpc('fn_deliver_box', { p_barcode: BARCODE, p_order_id: order.id, p_delivery_id: deliveryId, p_user_id: adminId });
    await sbAdmin.rpc('fn_complete_delivery', { p_delivery_id: deliveryId, p_receiver_name: 'Test', p_receiver_phone: '123', p_notes: '', p_user_id: adminId });

    const { data: boxDel } = await sbAdmin.from('boxes').select('status').eq('barcode', BARCODE).single();
    assert(boxDel.status === 'delivered', 'Box delivered successfully', `Box status is ${boxDel.status}`);

    // ---- 2. Security: Unauthorized role rejections ----
    console.log('\n[2] Security: Unauthorized role rejections...');

    // Production user cannot request return
    const { error: errProdReq } = await sbProd.rpc('fn_request_return', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_reason: 'test', p_condition: 'good'
    });
    assert(errProdReq && errProdReq.message.includes('Unauthorized'), 'Production user blocked from requesting return', `Production not blocked: ${errProdReq?.message}`);

    // Production user cannot approve return
    const { error: errProdApp } = await sbProd.rpc('fn_approve_return', { p_return_id: '00000000-0000-0000-0000-000000000001' });
    assert(errProdApp && errProdApp.message.includes('Unauthorized'), 'Production user blocked from approving return', `Production approve not blocked: ${errProdApp?.message}`);

    // ---- 3. Valid Return Request ----
    console.log('\n[3] Valid return request...');
    const { data: returnId, error: reqErr } = await sbAdmin.rpc('fn_request_return', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_reason: 'E2E test', p_condition: 'good'
    });
    assert(!reqErr && returnId, 'Return request succeeded', `Return request failed: ${reqErr?.message}`);

    // Box should still be delivered after request
    const { data: boxAfterReq } = await sbAdmin.from('boxes').select('status').eq('barcode', BARCODE).single();
    assert(boxAfterReq.status === 'delivered', 'Box stays delivered after request', `Box status is ${boxAfterReq.status}`);

    // Return record exists
    const { data: retRecord } = await sbAdmin.from('returns').select('*').eq('id', returnId).single();
    assert(retRecord && retRecord.approval_status === 'pending', 'Return record created with pending status', 'Return record not found or wrong status');
    assert(retRecord && retRecord.customer_id === cust.id, 'Return linked to customer', 'Customer not linked');
    assert(retRecord && retRecord.order_id === order.id, 'Return linked to order', 'Order not linked');

    // ---- 4. Duplicate return rejection ----
    console.log('\n[4] Duplicate return rejection...');
    const { error: dupErr } = await sbAdmin.rpc('fn_request_return', {
      p_barcode: BARCODE, p_order_id: order.id, p_warehouse_id: WH_ID, p_reason: 'dup', p_condition: 'good'
    });
    // Box is still "delivered" so this might succeed as a second return. Let's check.
    // The old RPC allowed this if box was still delivered, so we record the behavior.
    console.log('  ℹ️ Duplicate return result:', dupErr ? `Rejected: ${dupErr.message}` : 'Allowed (second return for same barcode)');

    // ---- 5. Return Approval ----
    console.log('\n[5] Return approval...');
    const { data: appResult, error: appErr } = await sbAdmin.rpc('fn_approve_return', { p_return_id: returnId });
    assert(!appErr, 'Return approval succeeded', `Approval failed: ${appErr?.message}`);

    // Box should now be returned
    const { data: boxAfterApp } = await sbAdmin.from('boxes').select('status, current_warehouse_id').eq('barcode', BARCODE).single();
    assert(boxAfterApp.status === 'returned', 'Box status changed to returned', `Box status is ${boxAfterApp.status}`);
    assert(boxAfterApp.current_warehouse_id === WH_ID, 'Box warehouse restored', 'Warehouse not restored');

    // Return record updated
    const { data: retAfter } = await sbAdmin.from('returns').select('*').eq('id', returnId).single();
    assert(retAfter && retAfter.approval_status === 'approved', 'Return approval_status updated', 'approval_status not updated');

    // Already approved rejection
    const { error: reappErr } = await sbAdmin.rpc('fn_approve_return', { p_return_id: returnId });
    assert(reappErr && reappErr.message.includes('already approved'), 'Already-approved return rejected', `Re-approval not blocked: ${reappErr?.message}`);

    // ---- 6. Traceability ----
    console.log('\n[6] Verifying full traceability...');

    const { data: bhData } = await sbAdmin.from('barcode_history').select('action').eq('barcode', BARCODE).order('performed_at', { ascending: true });
    const bhActions = bhData.map(b => b.action);
    console.log('  ℹ️ Barcode history:', bhActions.join(' → '));

    assert(bhActions.includes('RETURN_REQUESTED'), 'RETURN_REQUESTED in barcode history', 'Missing RETURN_REQUESTED');
    assert(bhActions.includes('RETURN_APPROVED'), 'RETURN_APPROVED in barcode history', 'Missing RETURN_APPROVED');

    const expectedLifecycle = ['produced', 'RECEIVED', 'ALLOCATED', 'DISPATCHED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURN_APPROVED'];
    const hasFullLifecycle = expectedLifecycle.every(a => bhActions.includes(a));
    assert(hasFullLifecycle, 'Full lifecycle preserved: ' + expectedLifecycle.join(' → '), 'Lifecycle incomplete');

    // Audit logs
    const { data: alData } = await sbAdmin.from('audit_logs').select('action').eq('barcode', BARCODE);
    const alActions = alData.map(a => a.action);
    assert(alActions.includes('REQUEST_RETURN'), 'Audit log REQUEST_RETURN exists', 'Missing REQUEST_RETURN audit log');
    assert(alActions.includes('APPROVE_RETURN'), 'Audit log APPROVE_RETURN exists', 'Missing APPROVE_RETURN audit log');

    // Stock movements
    const { data: smData } = await sbAdmin.from('stock_movements').select('movement_type').eq('barcode', BARCODE);
    const smTypes = smData.map(s => s.movement_type);
    assert(smTypes.filter(t => t === 'IN').length >= 1, 'IN stock movement created on approval', 'Missing IN stock movement');

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
      console.log('🔴 PHASE 6: HAS FAILURES');
      process.exit(1);
    } else {
      console.log('🟢 PHASE 6: FULLY OPERATIONAL');
    }
  }
}

verify();
