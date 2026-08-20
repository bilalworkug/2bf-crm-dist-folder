const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

const ACCOUNTS = {
  admin: { email: 'admin@2bf.com.et', password: 'Password123!' },
  production: { email: 'production1@2bf.com.et', password: 'Password123!' },
  warehouse: { email: 'warehouse1@2bf.com.et', password: 'Password123!' },
  sales: { email: 'sales@2bf.com.et', password: 'Password123!' },
  dispatch: { email: 'dispatch@2bf.com.et', password: 'Password123!' },
};

async function getClient(role) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const acc = ACCOUNTS[role];
  if (!acc) throw new Error(`No account for role: ${role}`);
  const { data, error } = await client.auth.signInWithPassword({ email: acc.email, password: acc.password });
  if (error) throw new Error(`Login failed for ${role}: ${error.message}`);
  return { client, session: data.session, user: data.user };
}

const results = {};

function recordResult(rpc, category, status, detail) {
  if (!results[rpc]) results[rpc] = {};
  results[rpc][category] = { status, detail };
  console.log(`[${rpc}] ${category}: ${status} -> ${detail}`);
}

async function runTests() {
  let testBarcode = `PH14-${Date.now()}`;
  let productId, warehouseId, orderId, deliveryId;

  console.log('--- SETUP ---');
  const { client: adminClient } = await getClient('admin');
  
  const { data: prod } = await adminClient.from('products').select('id').limit(1).single();
  productId = prod.id;
  
  const { data: wh } = await adminClient.from('warehouses').select('id').limit(1).single();
  warehouseId = wh.id;
  
  const { data: ord } = await adminClient.from('orders').select('id').eq('status', 'approved').limit(1).single();
  orderId = ord.id;
  
  console.log(`Setup complete. Barcode: ${testBarcode}, Product: ${productId}, WH: ${warehouseId}, Order: ${orderId}`);

  // ==========================================
  // 1. fn_produce_box
  // ==========================================
  console.log('\n--- fn_produce_box ---');
  try {
    const { client: prodClient, user: prodUser } = await getClient('production');
    const { client: salesClient } = await getClient('sales');
    
    // Unauthorized Test
    const { error: unauthErr } = await salesClient.rpc('fn_produce_box', {
      p_barcode: testBarcode,
      p_product_id: productId
    });
    recordResult('fn_produce_box', 'Spoofing Blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'Did not block sales user');
    recordResult('fn_produce_box', 'Role Check', unauthErr?.message?.includes('permission') ? 'PASS' : 'FAIL', unauthErr?.message || 'No error');
    
    // Authorized Test
    const { error: authErr } = await prodClient.rpc('fn_produce_box', {
      p_barcode: testBarcode,
      p_product_id: productId
    });
    recordResult('fn_produce_box', 'Authorized', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    
    // Check auth.uid() usage (audit logs)
    const { data: logs } = await adminClient.from('audit_logs').select('user_id').eq('action', 'scan_produced').order('created_at', { ascending: false }).limit(1).single();
    recordResult('fn_produce_box', 'auth.uid()', logs?.user_id === prodUser.id ? 'PASS' : 'FAIL', `Expected ${prodUser.id}, got ${logs?.user_id}`);
    
    // Business Logic
    const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
    recordResult('fn_produce_box', 'Business Logic', box?.status === 'produced' ? 'PASS' : 'FAIL', `Box status is ${box?.status}`);
    
  } catch(e) {
    console.error(e);
  }

  // ==========================================
  // 2. fn_receive_box
  // ==========================================
  console.log('\n--- fn_receive_box ---');
  try {
    const { client: whClient, user: whUser } = await getClient('warehouse');
    const { client: prodClient } = await getClient('production');
    
    // Unauthorized Test
    const { error: unauthErr } = await prodClient.rpc('fn_receive_box', {
      p_barcode: testBarcode,
      p_warehouse_id: warehouseId
    });
    recordResult('fn_receive_box', 'Spoofing Blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'Did not block production user');
    recordResult('fn_receive_box', 'Role Check', unauthErr?.message?.includes('permission') ? 'PASS' : 'FAIL', unauthErr?.message || 'No error');
    
    // Authorized Test
    const { error: authErr } = await whClient.rpc('fn_receive_box', {
      p_barcode: testBarcode,
      p_warehouse_id: warehouseId
    });
    recordResult('fn_receive_box', 'Authorized', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    
    // Check auth.uid() usage
    const { data: receipt } = await adminClient.from('warehouse_receipts').select('received_by').eq('barcode', testBarcode).single();
    recordResult('fn_receive_box', 'auth.uid()', receipt?.received_by === whUser.id ? 'PASS' : 'FAIL', `Expected ${whUser.id}, got ${receipt?.received_by}`);
    
    // Business Logic
    const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
    recordResult('fn_receive_box', 'Business Logic', box?.status === 'in_warehouse' ? 'PASS' : 'FAIL', `Box status is ${box?.status}`);
  } catch(e) {
    console.error(e);
  }
  
  // Need to allocate the box before dispatching it
  console.log('\n--- (Setup: Allocating Box) ---');
  const { error: allocErr } = await adminClient.rpc('fn_allocate_box', {
    p_barcode: testBarcode,
    p_order_id: orderId,
    p_warehouse_id: warehouseId
  });
  console.log('Allocation result:', allocErr ? allocErr.message : 'Success');

  // ==========================================
  // 3. fn_dispatch_box
  // ==========================================
  console.log('\n--- fn_dispatch_box ---');
  try {
    const { client: dispClient, user: dispUser } = await getClient('dispatch');
    const { client: whClient } = await getClient('warehouse');
    
    // Unauthorized Test
    const { error: unauthErr } = await whClient.rpc('fn_dispatch_box', {
      p_barcode: testBarcode,
      p_order_id: orderId,
      p_warehouse_id: warehouseId
    });
    recordResult('fn_dispatch_box', 'Spoofing Blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'Did not block warehouse user');
    recordResult('fn_dispatch_box', 'Role Check', unauthErr?.message?.includes('Unauthorized') ? 'PASS' : 'FAIL', unauthErr?.message || 'No error');
    
    // Authorized Test
    const { error: authErr } = await dispClient.rpc('fn_dispatch_box', {
      p_barcode: testBarcode,
      p_order_id: orderId,
      p_warehouse_id: warehouseId
    });
    recordResult('fn_dispatch_box', 'Authorized', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    
    // Check auth.uid() usage
    const { data: dispatchLog } = await adminClient.from('dispatches').select('dispatched_by').eq('barcode', testBarcode).single();
    recordResult('fn_dispatch_box', 'auth.uid()', dispatchLog?.dispatched_by === dispUser.id ? 'PASS' : 'FAIL', `Expected ${dispUser.id}, got ${dispatchLog?.dispatched_by}`);
    
    // Business Logic
    const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
    recordResult('fn_dispatch_box', 'Business Logic', box?.status === 'dispatched' ? 'PASS' : 'FAIL', `Box status is ${box?.status}`);
  } catch(e) {
    console.error(e);
  }

  // Setup delivery
  console.log('\n--- (Setup: Create Delivery) ---');
  const { data: delId, error: delErr } = await adminClient.rpc('fn_create_delivery', {
    p_order_id: orderId
  });
  deliveryId = delId;
  console.log('Delivery created:', deliveryId, delErr ? delErr.message : '');

  // ==========================================
  // 4. fn_deliver_box
  // ==========================================
  console.log('\n--- fn_deliver_box ---');
  try {
    const { client: dispClient, user: dispUser } = await getClient('dispatch');
    const { client: whClient } = await getClient('warehouse');
    
    // Unauthorized Test
    const { error: unauthErr } = await whClient.rpc('fn_deliver_box', {
      p_barcode: testBarcode,
      p_order_id: orderId,
      p_delivery_id: deliveryId
    });
    recordResult('fn_deliver_box', 'Spoofing Blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'Did not block warehouse user');
    recordResult('fn_deliver_box', 'Role Check', unauthErr?.message?.includes('Unauthorized') ? 'PASS' : 'FAIL', unauthErr?.message || 'No error');
    
    // Authorized Test
    const { error: authErr } = await dispClient.rpc('fn_deliver_box', {
      p_barcode: testBarcode,
      p_order_id: orderId,
      p_delivery_id: deliveryId
    });
    recordResult('fn_deliver_box', 'Authorized', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    
    // Check auth.uid() usage
    const { data: delItem } = await adminClient.from('delivery_items').select('scanned_by').eq('barcode', testBarcode).single();
    recordResult('fn_deliver_box', 'auth.uid()', delItem?.scanned_by === dispUser.id ? 'PASS' : 'FAIL', `Expected ${dispUser.id}, got ${delItem?.scanned_by}`);
    
    // Business Logic
    const { data: box } = await adminClient.from('boxes').select('status').eq('barcode', testBarcode).single();
    recordResult('fn_deliver_box', 'Business Logic', box?.status === 'delivered' ? 'PASS' : 'FAIL', `Box status is ${box?.status}`);
  } catch(e) {
    console.error(e);
  }

  // ==========================================
  // 5. fn_complete_delivery
  // ==========================================
  console.log('\n--- fn_complete_delivery ---');
  try {
    const { client: dispClient, user: dispUser } = await getClient('dispatch');
    const { client: whClient } = await getClient('warehouse');
    
    // Unauthorized Test
    const { error: unauthErr } = await whClient.rpc('fn_complete_delivery', {
      p_delivery_id: deliveryId,
      p_receiver_name: 'Test',
      p_receiver_phone: '123',
      p_notes: 'Test note'
    });
    recordResult('fn_complete_delivery', 'Spoofing Blocked', unauthErr ? 'PASS' : 'FAIL', unauthErr?.message || 'Did not block warehouse user');
    recordResult('fn_complete_delivery', 'Role Check', unauthErr?.message?.includes('Unauthorized') ? 'PASS' : 'FAIL', unauthErr?.message || 'No error');
    
    // Authorized Test
    const { error: authErr } = await dispClient.rpc('fn_complete_delivery', {
      p_delivery_id: deliveryId,
      p_receiver_name: 'Test',
      p_receiver_phone: '123',
      p_notes: 'Test note'
    });
    recordResult('fn_complete_delivery', 'Authorized', !authErr ? 'PASS' : 'FAIL', authErr?.message || 'Success');
    
    // Check auth.uid() usage
    const { data: delRecord } = await adminClient.from('deliveries').select('delivered_by').eq('id', deliveryId).single();
    recordResult('fn_complete_delivery', 'auth.uid()', delRecord?.delivered_by === dispUser.id ? 'PASS' : 'FAIL', `Expected ${dispUser.id}, got ${delRecord?.delivered_by}`);
    
    // Business Logic
    const { data: dStat } = await adminClient.from('deliveries').select('status').eq('id', deliveryId).single();
    recordResult('fn_complete_delivery', 'Business Logic', dStat?.status === 'delivered' ? 'PASS' : 'FAIL', `Delivery status is ${dStat?.status}`);
  } catch(e) {
    console.error(e);
  }

  console.log('\n\n--- RESULTS JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
