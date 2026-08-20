const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function run() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Login as Admin
  const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  if (adminErr) return console.error('Admin login failed', adminErr);
  
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } } });

  // Login as Production
  const { data: prodAuth, error: prodErr } = await client.auth.signInWithPassword({ email: 'production@2bf.com.et', password: 'Password123!' });
  if (prodErr) return console.error('Prod login failed', prodErr);

  const prodClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${prodAuth.session.access_token}` } } });
  
  const prodUserId = prodAuth.user.id;

  let passed = 0;
  let failed = 0;

  function assert(condition, name, failMsg) {
    if (condition) {
      passed++;
      console.log(`[PASS] ${name}`);
    } else {
      failed++;
      console.log(`[FAIL] ${name}: ${failMsg}`);
    }
  }

  console.log('--- STARTING PHASE 18 TESTS ---');
  
  // 1. Admin creates product
  const testProductName = `TEST-PROD-${Date.now()}`;
  const { data: newProd, error: newProdErr } = await adminClient.from('products').insert({ name: testProductName, active: true }).select().single();
  assert(!newProdErr && newProd, 'Admin creates product', newProdErr?.message);
  
  const pId = newProd?.id;

  // 2. Admin edits product
  const { error: editErr } = await adminClient.from('products').update({ name: testProductName + '-EDIT' }).eq('id', pId);
  assert(!editErr, 'Admin edits product', editErr?.message);

  // 3. Admin deactivates product
  const { error: deactErr } = await adminClient.from('products').update({ active: false }).eq('id', pId);
  assert(!deactErr, 'Admin deactivates product', deactErr?.message);

  // 4. Production user cannot produce deactivated product
  const deactivatedBarcode = `TEST-BARCODE-DEACT-${Date.now()}`;
  const { error: deactProdErr } = await prodClient.rpc('fn_produce_box', { p_barcode: deactivatedBarcode, p_product_id: pId });
  assert(deactProdErr && deactProdErr.message.includes('deactivated'), 'Production user cannot produce deactivated product', deactProdErr?.message);

  // 5. Admin reactivates product
  const { error: reactErr } = await adminClient.from('products').update({ active: true }).eq('id', pId);
  assert(!reactErr, 'Admin reactivates product', reactErr?.message);

  // 6. Production user cannot produce unassigned product
  const unassignedBarcode = `TEST-BARCODE-UNASSIGNED-${Date.now()}`;
  const { error: unassignedProdErr } = await prodClient.rpc('fn_produce_box', { p_barcode: unassignedBarcode, p_product_id: pId });
  assert(unassignedProdErr && unassignedProdErr.message.includes('not assigned'), 'Production user cannot produce unassigned product', unassignedProdErr?.message);

  // 7. Admin assigns product to Production User
  const { error: assignErr } = await adminClient.from('product_production_assignments').insert({
    product_id: pId,
    production_user_id: prodUserId,
    assigned_by: adminAuth.user.id,
    active: true
  });
  assert(!assignErr, 'Admin assigns product to Production User', assignErr?.message);

  // 8. Duplicate assignment is blocked
  const { error: dupAssignErr } = await adminClient.from('product_production_assignments').insert({
    product_id: pId,
    production_user_id: prodUserId,
    assigned_by: adminAuth.user.id,
    active: true
  });
  assert(dupAssignErr && dupAssignErr.code === '23505', 'Duplicate assignment is blocked', dupAssignErr?.message);

  // 9. Production user can produce assigned product
  const assignedBarcode = `TEST-BARCODE-ASSIGNED-${Date.now()}`;
  const { error: assignedProdErr } = await prodClient.rpc('fn_produce_box', { p_barcode: assignedBarcode, p_product_id: pId });
  assert(!assignedProdErr, 'Production user can produce assigned product', assignedProdErr?.message);

  // 10. (Skipped) Audit logs are verified manually in the UI

  console.log(`\n--- RESULTS ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
}

run();
