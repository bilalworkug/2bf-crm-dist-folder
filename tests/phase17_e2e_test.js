/**
 * PHASE 17 — Full ERP Go-Live Regression Test (v2)
 * 
 * Traces: Sales → Production → Warehouse → Dispatch → Delivery → Return → Correction
 * Tests: Security, auth.uid(), role checks, spoofing, duplicates, invalid transitions, audit logs, schema
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

const ACCOUNTS = {
  admin:      { email: 'admin@2bf.com.et',       password: 'Password123!' },
  production: { email: 'production1@2bf.com.et',  password: 'Password123!' },
  warehouse:  { email: 'warehouse1@2bf.com.et',   password: 'Password123!' },
  sales:      { email: 'sales@2bf.com.et',        password: 'Password123!' },
  dispatch:   { email: 'dispatch@2bf.com.et',     password: 'Password123!' },
};

const results = [];
let passCount = 0, failCount = 0, skipCount = 0;

function record(section, test, status, detail) {
  results.push({ section, test, status, detail: detail || '' });
  if (status === 'PASS') passCount++;
  else if (status === 'FAIL') failCount++;
  else skipCount++;
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠';
  console.log(`  ${icon} [${section}] ${test}: ${status}${detail ? ' → ' + detail : ''}`);
}

async function getClient(role) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const acc = ACCOUNTS[role];
  const { data, error } = await client.auth.signInWithPassword({ email: acc.email, password: acc.password });
  if (error) throw new Error(`Login failed for ${role}: ${error.message}`);
  return { client, user: data.user };
}

async function run() {
  const ts = Date.now();
  const testBarcode = `E2E-${ts}`;
  const corrBarcode = `E2E-CORR-${ts}`;

  console.log('========================================');
  console.log('PHASE 17 — Go-Live Regression Test v2');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Test Barcode: ${testBarcode}`);
  console.log('========================================\n');

  // --- SETUP ---
  console.log('--- SETUP ---');
  const { client: adminClient } = await getClient('admin');
  const { client: prodClient, user: prodUser } = await getClient('production');
  const { client: whClient, user: whUser } = await getClient('warehouse');
  const { client: salesClient } = await getClient('sales');
  const { client: dispClient, user: dispUser } = await getClient('dispatch');

  const { data: products } = await adminClient.from('products').select('*').limit(2);
  if (!products || products.length < 2) { console.error('Need 2+ products'); return; }
  const productId = products[0].id;
  const product2Id = products[1].id;

  const { data: wh } = await adminClient.from('warehouses').select('id').limit(1).single();
  const warehouseId = wh?.id;

  // Find an order that has an item matching our test product
  const { data: matchingItem } = await adminClient
    .from('order_items')
    .select('order_id, orders!inner(id, status)')
    .eq('product_id', productId)
    .eq('orders.status', 'approved')
    .limit(1)
    .single();
  
  const orderId = matchingItem?.order_id || null;

  console.log(`Products: ${productId}, ${product2Id}`);
  console.log(`Warehouse: ${warehouseId}`);
  console.log(`Order (matching product): ${orderId || 'NONE FOUND'}`);
  console.log('');

  // =============================================
  // SECTION 1: PRODUCTION (fn_produce_box)
  // =============================================
  console.log('--- 1. PRODUCTION ---');

  {
    const { error } = await prodClient.rpc('fn_produce_box', { p_barcode: testBarcode, p_product_id: productId });
    record('Production', 'Authorized produce', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
  }

  {
    const { data: box } = await adminClient.from('boxes').select('status, product_id').eq('barcode', testBarcode).single();
    record('Production', 'Box status = produced', box?.status === 'produced' ? 'PASS' : 'FAIL', `status=${box?.status}`);
    record('Production', 'Box product correct', box?.product_id === productId ? 'PASS' : 'FAIL');
  }

  // Audit: the secure RPC writes barcode in details JSONB, not barcode column. Search by action + details
  {
    const { data: logs } = await adminClient.from('audit_logs').select('*')
      .eq('action', 'scan_produced')
      .order('created_at', { ascending: false }).limit(5);
    const found = logs?.find(l => {
      try { return JSON.parse(l.details)?.barcode === testBarcode; } catch { return false; }
    });
    record('Production', 'Audit log created', found ? 'PASS' : 'FAIL', found ? 'Found in details JSONB' : `0 matching in last 5 logs`);
    if (found) {
      record('Production', 'Audit uses auth.uid()', found.user_id === prodUser.id ? 'PASS' : 'FAIL');
    }
  }

  {
    const { error } = await salesClient.rpc('fn_produce_box', { p_barcode: `UNAUTH-${ts}`, p_product_id: productId });
    record('Production', 'Sales user blocked', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  {
    const { error } = await prodClient.rpc('fn_produce_box', { p_barcode: testBarcode, p_product_id: productId });
    record('Production', 'Duplicate barcode rejected', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  // Produce correction barcode
  {
    const { error } = await prodClient.rpc('fn_produce_box', { p_barcode: corrBarcode, p_product_id: productId });
    record('Production', 'Correction box produced', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
  }

  // =============================================
  // SECTION 2: WAREHOUSE RECEIVING (fn_receive_box)
  // =============================================
  console.log('\n--- 2. WAREHOUSE RECEIVING ---');

  {
    const { error } = await prodClient.rpc('fn_receive_box', { p_barcode: testBarcode, p_warehouse_id: warehouseId });
    record('Warehouse', 'Production user blocked', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  {
    const { error } = await whClient.rpc('fn_receive_box', { p_barcode: testBarcode, p_warehouse_id: warehouseId });
    record('Warehouse', 'Authorized receive', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
  }

  {
    const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
    record('Warehouse', 'Box status = in_warehouse', box?.status === 'in_warehouse' ? 'PASS' : 'FAIL', `status=${box?.status}`);
  }

  // Audit: the live RPC uses action='box_received' and barcode column
  {
    const { data: logs } = await adminClient.from('audit_logs').select('*')
      .eq('barcode', testBarcode)
      .in('action', ['box_received', 'scan_received']);
    record('Warehouse', 'Audit log created', logs && logs.length > 0 ? 'PASS' : 'FAIL', `${logs?.length || 0} log(s)`);
    if (logs && logs.length > 0) {
      record('Warehouse', 'Audit uses auth.uid()', logs[0].user_id === whUser.id ? 'PASS' : 'FAIL');
    }
  }

  {
    const { error } = await whClient.rpc('fn_receive_box', { p_barcode: testBarcode, p_warehouse_id: warehouseId });
    record('Warehouse', 'Duplicate receive rejected', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  {
    const { error } = await whClient.rpc('fn_receive_box', { p_barcode: 'NONEXISTENT-BOX-999', p_warehouse_id: warehouseId });
    record('Warehouse', 'Nonexistent barcode rejected', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  // =============================================
  // SECTION 3: ALLOCATION + DISPATCH (fn_dispatch_box)
  // =============================================
  console.log('\n--- 3. DISPATCH ---');

  if (orderId) {
    {
      const { error } = await adminClient.rpc('fn_allocate_box', { p_barcode: testBarcode, p_order_id: orderId, p_warehouse_id: warehouseId });
      record('Dispatch', 'Box allocated', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
    }

    {
      const { error } = await whClient.rpc('fn_dispatch_box', { p_barcode: testBarcode, p_order_id: orderId, p_warehouse_id: warehouseId });
      record('Dispatch', 'Warehouse user blocked', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
    }

    {
      const { error } = await dispClient.rpc('fn_dispatch_box', { p_barcode: testBarcode, p_order_id: orderId, p_warehouse_id: warehouseId });
      record('Dispatch', 'Authorized dispatch', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
    }

    {
      const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
      record('Dispatch', 'Box status = dispatched', box?.status === 'dispatched' ? 'PASS' : 'FAIL', `status=${box?.status}`);
    }

    {
      const { error } = await dispClient.rpc('fn_dispatch_box', { p_barcode: testBarcode, p_order_id: orderId, p_warehouse_id: warehouseId });
      record('Dispatch', 'Duplicate dispatch rejected', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
    }

    // Audit
    {
      const { data: logs } = await adminClient.from('audit_logs').select('*')
        .eq('barcode', testBarcode)
        .in('action', ['scan_dispatched', 'box_dispatched']);
      record('Dispatch', 'Audit log created', logs && logs.length > 0 ? 'PASS' : 'FAIL', `${logs?.length || 0} log(s)`);
    }
  } else {
    record('Dispatch', 'SKIPPED — no approved order with matching product', 'SKIP', 'Cannot test dispatch without a valid order+product match');
  }

  // =============================================
  // SECTION 4: DELIVERY
  // =============================================
  console.log('\n--- 4. DELIVERY ---');
  let deliveryId = null;

  if (orderId) {
    {
      const { data, error } = await adminClient.rpc('fn_create_delivery', { p_order_id: orderId });
      deliveryId = data;
      record('Delivery', 'Delivery created', !error && deliveryId ? 'PASS' : 'FAIL', error?.message || `id=${deliveryId}`);
    }

    if (deliveryId) {
      {
        const { error } = await whClient.rpc('fn_deliver_box', { p_barcode: testBarcode, p_order_id: orderId, p_delivery_id: deliveryId });
        record('Delivery', 'Warehouse user blocked', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
      }

      {
        const { error } = await dispClient.rpc('fn_deliver_box', { p_barcode: testBarcode, p_order_id: orderId, p_delivery_id: deliveryId });
        record('Delivery', 'Authorized deliver', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
      }

      {
        const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
        record('Delivery', 'Box status = delivered', box?.status === 'delivered' ? 'PASS' : 'FAIL', `status=${box?.status}`);
      }

      {
        const { error } = await dispClient.rpc('fn_complete_delivery', {
          p_delivery_id: deliveryId, p_receiver_name: 'E2E Receiver', p_receiver_phone: '+251911000000', p_notes: 'Phase 17 E2E'
        });
        record('Delivery', 'Delivery completed', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
      }

      {
        const { data: del } = await adminClient.from('deliveries').select('status').eq('id', deliveryId).single();
        record('Delivery', 'Delivery status = delivered', del?.status === 'delivered' ? 'PASS' : 'FAIL', `status=${del?.status}`);
      }

      {
        const { error } = await whClient.rpc('fn_complete_delivery', {
          p_delivery_id: deliveryId, p_receiver_name: 'Hacker', p_receiver_phone: '000', p_notes: 'spoofing'
        });
        record('Delivery', 'Warehouse user blocked (complete)', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
      }
    }
  } else {
    record('Delivery', 'SKIPPED — no approved order with matching product', 'SKIP');
  }

  // =============================================
  // SECTION 5: PRODUCTION CORRECTION
  // =============================================
  console.log('\n--- 5. PRODUCTION CORRECTION ---');

  {
    const { error } = await adminClient.rpc('fn_correct_production_box_safe', {
      p_barcode: corrBarcode, p_expected_before_product_id: productId, p_new_product_id: product2Id,
      p_reason: 'E2E Test Correction', p_notes: 'Phase 17 automated test'
    });
    record('Correction', 'Authorized correction', !error ? 'PASS' : 'FAIL', error?.message || 'Success');
  }

  {
    const { data: box } = await adminClient.from('boxes').select('product_id').eq('barcode', corrBarcode).single();
    record('Correction', 'Product changed to new', box?.product_id === product2Id ? 'PASS' : 'FAIL');
  }

  {
    const { data: logs } = await adminClient.from('audit_logs').select('*').eq('barcode', corrBarcode).eq('action', 'production_box_corrected');
    record('Correction', 'Audit log created', logs && logs.length > 0 ? 'PASS' : 'FAIL');
  }

  {
    const { error } = await adminClient.rpc('fn_correct_production_box_safe', {
      p_barcode: corrBarcode, p_expected_before_product_id: productId, p_new_product_id: product2Id,
      p_reason: 'Duplicate', p_notes: ''
    });
    record('Correction', 'Stale correction rejected', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  // =============================================
  // SECTION 6: DISCOUNT APPROVAL
  // =============================================
  console.log('\n--- 6. DISCOUNT APPROVAL ---');

  {
    const { data: pending } = await adminClient.from('order_items').select('id').eq('discount_status', 'pending').limit(1).single();
    if (pending) {
      const { error: unauthErr } = await prodClient.rpc('fn_approve_discount', { p_order_item_id: pending.id, p_is_approved: true });
      record('Discount', 'Production user blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'NOT BLOCKED');
      const { error: authErr } = await adminClient.rpc('fn_approve_discount', { p_order_item_id: pending.id, p_is_approved: true });
      record('Discount', 'Admin approved', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    } else {
      record('Discount', 'No pending discounts', 'SKIP');
    }
  }

  // =============================================
  // SECTION 7: IDENTITY SPOOFING
  // =============================================
  console.log('\n--- 7. IDENTITY SPOOFING ---');

  {
    const { error } = await salesClient.rpc('fn_produce_box', { p_barcode: `SPOOF-${ts}`, p_product_id: productId });
    record('Spoofing', 'Sales cannot produce', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }
  {
    const { error } = await prodClient.rpc('fn_dispatch_box', { p_barcode: testBarcode, p_order_id: orderId || '00000000-0000-0000-0000-000000000000', p_warehouse_id: warehouseId });
    record('Spoofing', 'Production cannot dispatch', error ? 'PASS' : 'FAIL', error?.message || 'NOT BLOCKED');
  }

  // =============================================
  // SECTION 8: DATABASE SCHEMA
  // =============================================
  console.log('\n--- 8. DATABASE SCHEMA ---');

  for (const table of ['correction_records', 'audit_logs', 'boxes', 'stock_movements', 'warehouse_receipts', 'dispatches', 'deliveries', 'orders', 'order_items', 'products', 'profiles']) {
    const { error } = await adminClient.from(table).select('id').limit(1);
    record('Schema', `${table} accessible`, !error ? 'PASS' : 'FAIL', error?.message || 'OK');
  }

  // =============================================
  // SECTION 9: RLS
  // =============================================
  console.log('\n--- 9. RLS ---');

  {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anonClient.from('boxes').select('id').limit(1);
    record('RLS', 'Unauthenticated boxes query blocked', (data?.length === 0) ? 'PASS' : 'FAIL', `${data?.length || 0} rows`);
  }
  {
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await anonClient.from('profiles').select('id').limit(1);
    record('RLS', 'Unauthenticated profiles query blocked', (data?.length === 0) ? 'PASS' : 'FAIL', `${data?.length || 0} rows`);
  }

  // =============================================
  // FINAL SUMMARY
  // =============================================
  console.log('\n========================================');
  console.log('FINAL SUMMARY');
  console.log('========================================');
  console.log(`Total: ${results.length} | PASS: ${passCount} | FAIL: ${failCount} | SKIP: ${skipCount}`);

  if (failCount > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ [${r.section}] ${r.test}: ${r.detail}`);
    });
  }

  if (skipCount > 0) {
    console.log('\nSKIPPED TESTS:');
    results.filter(r => r.status === 'SKIP').forEach(r => {
      console.log(`  ⚠ [${r.section}] ${r.test}: ${r.detail}`);
    });
  }
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
