/**
 * verify-warehouse-fix.js
 * Verifies the complete Warehouse Receiving workflow after migration.
 * Run after applying 20260807000001_fix_warehouse_rpc.sql
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const results = { pass: [], fail: [], warn: [] };
function log(type, msg) {
  const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : '⚠';
  results[type].push(msg);
  console.log(`${prefix} ${msg}`);
}

async function loginAs(email) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: 'Password123!' });
  if (error) return { sb: null, error: error.message, userId: null };
  return { sb, error: null, userId: data.session.user.id };
}

async function main() {
  console.log('\n=====================================');
  console.log('  WAREHOUSE RECEIVING VERIFICATION');
  console.log('=====================================\n');

  const TEST_BARCODE = `TEST001-${Date.now()}`;
  const WH_ID = '00000000-0000-0000-0000-000000000001';
  const PROD_ID = '22222222-0000-0000-0000-000000000001';

  // ---- STEP 1: Produce the box ----
  console.log(`\n[1] Producing barcode: ${TEST_BARCODE}`);
  const prodLogin = await loginAs('production1@2bf.com.et');
  if (prodLogin.error) { log('fail', `Cannot login as production: ${prodLogin.error}`); process.exit(1); }

  const { error: produceErr } = await prodLogin.sb.rpc('fn_produce_box', {
    p_barcode: TEST_BARCODE,
    p_product_id: PROD_ID,
    p_user_id: prodLogin.userId,
  });
  if (produceErr) { log('fail', `fn_produce_box failed: ${produceErr.message}`); process.exit(1); }
  log('pass', `Produced barcode: ${TEST_BARCODE}`);

  // Verify box status = 'produced'
  const { data: boxAfterProd } = await prodLogin.sb.from('boxes').select('status, current_warehouse_id').eq('barcode', TEST_BARCODE).single();
  if (boxAfterProd?.status === 'produced') {
    log('pass', `Box status = 'produced' ✓`);
  } else {
    log('fail', `Box status after production = '${boxAfterProd?.status}' (expected 'produced')`);
  }
  await prodLogin.sb.auth.signOut();

  // ---- STEP 2: Receive the box ----
  console.log(`\n[2] Receiving barcode: ${TEST_BARCODE} into warehouse ${WH_ID}`);
  const whLogin = await loginAs('warehouse1@2bf.com.et');
  if (whLogin.error) { log('fail', `Cannot login as warehouse: ${whLogin.error}`); process.exit(1); }

  const { error: receiveErr } = await whLogin.sb.rpc('fn_receive_box', {
    p_barcode: TEST_BARCODE,
    p_warehouse_id: WH_ID,
    p_user_id: whLogin.userId,
  });
  if (receiveErr) {
    log('fail', `fn_receive_box FAILED: ${receiveErr.message}`);
    console.log('\n  This means the migration was NOT applied yet or has a bug.');
    console.log('  Apply the migration and re-run this script.');
    await whLogin.sb.auth.signOut();
    printSummary();
    process.exit(1);
  }
  log('pass', `fn_receive_box succeeded for ${TEST_BARCODE}`);

  // ---- STEP 3: Verify warehouse_receipts row ----
  const { data: receipt, error: receiptErr } = await whLogin.sb
    .from('warehouse_receipts')
    .select('*')
    .eq('barcode', TEST_BARCODE)
    .single();
  if (receipt) {
    log('pass', `warehouse_receipts row created (id: ${receipt.id})`);
    if (receipt.warehouse_id === WH_ID) log('pass', `warehouse_receipts.warehouse_id matches`);
    else log('fail', `warehouse_receipts.warehouse_id mismatch: ${receipt.warehouse_id}`);
  } else {
    log('fail', `warehouse_receipts row NOT FOUND: ${receiptErr?.message}`);
  }

  // ---- STEP 4: Verify box status = 'in_warehouse' ----
  const { data: boxAfterRecv } = await whLogin.sb.from('boxes').select('status, current_warehouse_id').eq('barcode', TEST_BARCODE).single();
  if (boxAfterRecv?.status === 'in_warehouse') {
    log('pass', `Box status updated to 'in_warehouse' ✓`);
  } else {
    log('fail', `Box status after receiving = '${boxAfterRecv?.status}' (expected 'in_warehouse')`);
  }
  if (boxAfterRecv?.current_warehouse_id === WH_ID) {
    log('pass', `Box current_warehouse_id updated correctly ✓`);
  } else {
    log('fail', `Box current_warehouse_id = '${boxAfterRecv?.current_warehouse_id}' (expected '${WH_ID}')`);
  }

  // ---- STEP 5: Verify stock_movements (inventory +1) ----
  const { data: movements } = await whLogin.sb.from('stock_movements')
    .select('*')
    .eq('barcode', TEST_BARCODE)
    .eq('movement_type', 'RECEIVE');
  if (movements && movements.length > 0) {
    log('pass', `stock_movements RECEIVE entry created (qty: ${movements[0].quantity}) ✓`);
  } else {
    log('fail', `stock_movements RECEIVE entry NOT FOUND`);
  }

  // ---- STEP 6: Verify barcode_history (RECEIVED event) ----
  const { data: history } = await whLogin.sb.from('barcode_history')
    .select('*')
    .eq('barcode', TEST_BARCODE)
    .order('performed_at', { ascending: true });
  if (history && history.length >= 2) {
    const actions = history.map(h => h.action);
    log('pass', `barcode_history has ${history.length} events: ${actions.join(' → ')}`);
    if (actions.includes('produced') && (actions.includes('RECEIVED') || actions.includes('received'))) {
      log('pass', `barcode_history shows: produced → RECEIVED ✓`);
    } else {
      log('fail', `barcode_history actions unexpected: ${actions.join(', ')}`);
    }
  } else if (history && history.length === 1) {
    log('fail', `barcode_history only has 1 event: ${history[0].action} (RECEIVED event missing)`);
  } else {
    log('fail', `barcode_history has no events`);
  }

  // ---- STEP 7: Verify audit_logs entry ----
  const adminLogin = await loginAs('admin@2bf.com.et');
  if (!adminLogin.error) {
    const { data: auditLogs } = await adminLogin.sb.from('audit_logs')
      .select('*')
      .eq('barcode', TEST_BARCODE)
      .eq('action', 'box_received');
    if (auditLogs && auditLogs.length > 0) {
      log('pass', `audit_logs 'box_received' entry created ✓`);
    } else {
      log('fail', `audit_logs 'box_received' entry NOT FOUND`);
    }
    await adminLogin.sb.auth.signOut();
  }

  // ---- STEP 8: Test duplicate receiving rejection ----
  console.log(`\n[8] Testing duplicate receiving rejection...`);
  const { error: dupErr } = await whLogin.sb.rpc('fn_receive_box', {
    p_barcode: TEST_BARCODE,
    p_warehouse_id: WH_ID,
    p_user_id: whLogin.userId,
  });
  if (dupErr && dupErr.message.includes('already been received')) {
    log('pass', `Duplicate receiving correctly rejected: "${dupErr.message}"`);
  } else if (dupErr) {
    log('warn', `Duplicate rejected with unexpected message: "${dupErr.message}"`);
  } else {
    log('fail', `Duplicate receiving was NOT rejected! Same box was received twice.`);
  }

  // ---- STEP 9: Security test — production user should NOT receive ----
  console.log(`\n[9] Security: verifying production user cannot receive...`);
  const prodLogin2 = await loginAs('production1@2bf.com.et');
  if (!prodLogin2.error) {
    const TEST_BARCODE_2 = `TEST001-SEC-${Date.now()}`;
    // First produce another box
    await prodLogin2.sb.rpc('fn_produce_box', {
      p_barcode: TEST_BARCODE_2,
      p_product_id: PROD_ID,
      p_user_id: prodLogin2.userId,
    });
    // Production user tries to receive — should fail
    const { error: secErr } = await prodLogin2.sb.rpc('fn_receive_box', {
      p_barcode: TEST_BARCODE_2,
      p_warehouse_id: WH_ID,
      p_user_id: prodLogin2.userId,
    });
    if (secErr && secErr.message.includes('permission')) {
      log('pass', `Security: production user blocked from receiving ✓`);
    } else if (secErr) {
      log('warn', `Security: production user got error (different msg): ${secErr.message}`);
    } else {
      log('fail', `SECURITY BREACH: production user was able to receive stock!`);
    }
    await prodLogin2.sb.auth.signOut();
  }

  await whLogin.sb.auth.signOut();

  printSummary();
}

function printSummary() {
  console.log('\n\n=====================================');
  console.log('  VERIFICATION SUMMARY');
  console.log('=====================================');
  console.log(`✅ PASSED:   ${results.pass.length}`);
  console.log(`⚠  WARNINGS: ${results.warn.length}`);
  console.log(`❌ FAILED:   ${results.fail.length}`);
  console.log(`Total:       ${results.pass.length + results.warn.length + results.fail.length}`);
  
  if (results.fail.length === 0) {
    console.log('\n🟢 WAREHOUSE RECEIVING: FULLY OPERATIONAL');
  } else {
    console.log('\n🔴 WAREHOUSE RECEIVING: HAS FAILURES');
    results.fail.forEach(f => console.log(`  ❌ ${f}`));
  }
}

main().catch(console.error);
