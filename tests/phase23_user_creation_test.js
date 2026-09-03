/**
 * Phase 23.1 — Admin User Creation E2E Tests
 * 
 * Tests the secure server-side user creation endpoint.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';
const API_URL = 'http://localhost:3000/api/admin/users';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.log(`[FAIL] ${message}`);
    failed++;
  }
}

async function getAuthSession(email, password) {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error) return null;
  return data.session;
}

async function runTests() {
  console.log('--- STARTING PHASE 23.1 USER CREATION TESTS ---\n');

  // ============================================================
  // Login to get sessions
  // ============================================================
  const adminSession = await getAuthSession('admin@2bf.com.et', 'Password123!');
  if (!adminSession) {
    console.error('CRITICAL: Cannot login as admin');
    process.exit(1);
  }
  const salesSession = await getAuthSession('sales@2bf.com.et', 'Password123!');
  if (!salesSession) {
    console.error('CRITICAL: Cannot login as sales');
    process.exit(1);
  }
  const accountsSession = await getAuthSession('accounts@2bf.com.et', 'Password123!');
  
  const testEmail = `newuser_${Date.now()}@2bf.com.et`;
  const testPassword = 'TempPassword123!';

  // ============================================================
  // TEST 1: Sales cannot create users (Unauthorized)
  // ============================================================
  const salesRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${salesSession.access_token}` },
    body: JSON.stringify({ email: testEmail, password: testPassword, full_name: 'Test', role: 'reports' })
  });
  assert(salesRes.status === 403, `1. Sales cannot create user (status: ${salesRes.status})`);

  // ============================================================
  // TEST 2: Accounts cannot create users (Unauthorized)
  // ============================================================
  const accRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accountsSession.access_token}` },
    body: JSON.stringify({ email: testEmail, password: testPassword, full_name: 'Test', role: 'reports' })
  });
  assert(accRes.status === 403, `2. Accounts cannot create user (status: ${accRes.status})`);

  // ============================================================
  // TEST 3: Admin can create users
  // ============================================================
  const adminRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminSession.access_token}` },
    body: JSON.stringify({ email: testEmail, password: testPassword, full_name: 'Created User', role: 'sales' })
  });
  
  if (adminRes.status === 500) {
    const errorBody = await adminRes.json();
    console.error(`\nCRITICAL: Admin user creation returned 500. Message: ${errorBody.message}`);
    console.error('If the message says "SUPABASE_SERVICE_ROLE_KEY is missing", the server does not have the key configured.');
    process.exit(1);
  }

  const createdData = await adminRes.json();
  assert(adminRes.ok, `3. Admin can create user (${adminRes.status} - ${createdData.message})`);

  // ============================================================
  // TEST 4: Duplicate email is rejected
  // ============================================================
  const dupRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminSession.access_token}` },
    body: JSON.stringify({ email: testEmail, password: testPassword, full_name: 'Duplicate', role: 'sales' })
  });
  assert(dupRes.status === 400, `4. Duplicate email is rejected (status: ${dupRes.status})`);

  // ============================================================
  // TEST 5: Created user can log in
  // ============================================================
  const newSession = await getAuthSession(testEmail, testPassword);
  assert(newSession != null, `5. Created user can log in with temporary password`);

  if (newSession) {
    const newClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${newSession.access_token}` } }
    });

    // TEST 6: Created user's profile exists and has correct role
    const { data: profile } = await newClient.from('profiles').select('*').eq('id', newSession.user.id).single();
    assert(profile != null && profile.role === 'sales', `6. Created profile has correct role (role: ${profile?.role})`);

    // TEST 7: New user cannot change their own role (tests trigger protection)
    const { error: roleErr } = await newClient.from('profiles').update({ role: 'admin' }).eq('id', newSession.user.id);
    assert(roleErr != null && roleErr.message.includes('Only admin'), `7. New user cannot escalate role (error: ${roleErr?.message || 'allowed'})`);
    
    // TEST 8: Audit log is created (Admin checks this)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${adminSession.access_token}` } }
    });
    const { data: logs } = await adminClient.from('audit_logs').select('*').eq('entity_id', newSession.user.id);
    assert(logs && logs.length > 0 && logs[0].action === 'user_created', `8. Audit log created for user creation`);
  } else {
    assert(false, `6. Profile creation check (skipped)`);
    assert(false, `7. New user access check (skipped)`);
    assert(false, `8. Audit log check (skipped)`);
  }

  // ============================================================
  // Final Results
  // ============================================================
  console.log(`\n--- RESULTS ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nFINAL STATUS: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
