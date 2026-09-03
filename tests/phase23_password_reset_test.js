/**
 * Phase 23.2 — Admin Password Reset E2E Tests
 *
 * Tests the secure server-side password reset endpoint and full workflow.
 * Requires the dev server running on localhost:3000.
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';
const API_BASE = 'http://localhost:3000/api/admin/users';

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
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return null;
  return data.session;
}

async function resetPasswordAPI(token, userId, password, confirmPassword) {
  return fetch(`${API_BASE}/${userId}/reset-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password, confirmPassword }),
  });
}

async function runTests() {
  console.log('=== PHASE 23.2 — ADMIN PASSWORD RESET TESTS ===\n');

  // ── Setup: get admin session ──────────────────────────────────────
  const adminSession = await getAuthSession('admin@2bf.com.et', 'Password123!');
  if (!adminSession) {
    console.error('CRITICAL: Cannot login as admin');
    process.exit(1);
  }

  // ── Setup: create a dedicated test user ───────────────────────────
  const testEmail = `resettest_${Date.now()}@2bf.com.et`;
  const originalPassword = 'Original1234!';

  const createRes = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminSession.access_token}`,
    },
    body: JSON.stringify({
      email: testEmail,
      password: originalPassword,
      full_name: 'Reset Test User',
      role: 'sales',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error('CRITICAL: Cannot create test user:', err.message);
    process.exit(1);
  }

  const { user: createdUser } = await createRes.json();
  const targetUserId = createdUser.id;
  console.log(`Test user created: ${testEmail} (${targetUserId})\n`);

  const tempPassword = 'TempReset88!';
  const finalPassword = 'FinalPass99!';

  // ════════════════════════════════════════════════════════════════════
  // TEST 1: Admin can reset another user's password
  // ════════════════════════════════════════════════════════════════════
  const resetRes = await resetPasswordAPI(
    adminSession.access_token, targetUserId, tempPassword, tempPassword
  );
  const resetBody = await resetRes.json();
  assert(resetRes.status === 200, `1. Admin can reset password (status: ${resetRes.status})`);
  assert(resetBody.message === 'Password reset successfully', `   Response message correct`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 2: New password allows target user to log in
  // ════════════════════════════════════════════════════════════════════
  const newSession = await getAuthSession(testEmail, tempPassword);
  assert(newSession != null, `2. Target user can log in with temporary password`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 3: Old password no longer works
  // ════════════════════════════════════════════════════════════════════
  const oldSession = await getAuthSession(testEmail, originalPassword);
  assert(oldSession == null, `3. Old password no longer works`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 4: Target user can change the temporary password
  // ════════════════════════════════════════════════════════════════════
  if (newSession) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await userClient.auth.setSession({
      access_token: newSession.access_token,
      refresh_token: newSession.refresh_token
    });
    const { error: changePwErr } = await userClient.auth.updateUser({ password: finalPassword });
    assert(!changePwErr, `4. Target user can change temporary password (${changePwErr?.message || 'ok'})`);

    // TEST 5: New password works after change
    const finalSession = await getAuthSession(testEmail, finalPassword);
    assert(finalSession != null, `5. Final password works after self-change`);

    // Verify temp password no longer works
    const tempAgain = await getAuthSession(testEmail, tempPassword);
    assert(tempAgain == null, `   Temporary password no longer works after self-change`);
  } else {
    assert(false, `4. (skipped — login failed)`);
    assert(false, `5. (skipped — login failed)`);
  }

  // ════════════════════════════════════════════════════════════════════
  // TEST 6-9: Non-admin roles cannot reset passwords
  // ════════════════════════════════════════════════════════════════════
  const rolesToTest = [
    { name: 'Accounts', email: 'accounts@2bf.com.et', pw: 'Password123!', testNum: 6 },
    { name: 'Accounts Manager', email: 'accountsmanager@2bf.com.et', pw: 'Password123!', testNum: 7 },
    { name: 'Sales', email: 'sales@2bf.com.et', pw: 'Password123!', testNum: 8 },
    { name: 'Production', email: 'production@2bf.com.et', pw: 'Password123!', testNum: 9 },
  ];

  for (const r of rolesToTest) {
    const sess = await getAuthSession(r.email, r.pw);
    if (sess) {
      const res = await resetPasswordAPI(sess.access_token, targetUserId, 'Hacked1234!', 'Hacked1234!');
      assert(res.status === 403, `${r.testNum}. ${r.name} cannot reset password (status: ${res.status})`);
    } else {
      // If the role user doesn't exist in this env, skip gracefully
      console.log(`[SKIP] ${r.testNum}. ${r.name} user not found — skipping`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // TEST 10: Non-admin direct API request returns 403
  // ════════════════════════════════════════════════════════════════════
  // Use the test user (sales role) we just created to attempt reset
  const salesDirectSession = await getAuthSession(testEmail, finalPassword);
  if (salesDirectSession) {
    const directRes = await resetPasswordAPI(
      salesDirectSession.access_token, adminSession.user.id, 'Hacked1234!', 'Hacked1234!'
    );
    assert(directRes.status === 403, `10. Non-admin direct API request returns 403 (status: ${directRes.status})`);
  } else {
    assert(false, `10. Non-admin direct API test (skipped — login failed)`);
  }

  // ════════════════════════════════════════════════════════════════════
  // TEST 11: Invalid password (too short) returns 400
  // ════════════════════════════════════════════════════════════════════
  const shortRes = await resetPasswordAPI(adminSession.access_token, targetUserId, 'abc', 'abc');
  assert(shortRes.status === 400, `11. Short password rejected (status: ${shortRes.status})`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 12: Password confirmation mismatch returns 400
  // ════════════════════════════════════════════════════════════════════
  const mismatchRes = await resetPasswordAPI(
    adminSession.access_token, targetUserId, 'ValidPass88!', 'DifferentPass99!'
  );
  assert(mismatchRes.status === 400, `12. Password mismatch rejected (status: ${mismatchRes.status})`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 13: Admin cannot reset their own password
  // ════════════════════════════════════════════════════════════════════
  const selfRes = await resetPasswordAPI(
    adminSession.access_token, adminSession.user.id, 'SelfReset88!', 'SelfReset88!'
  );
  assert(selfRes.status === 400, `13. Admin cannot reset own password via this endpoint (status: ${selfRes.status})`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 14: Deactivated user active status remains unchanged
  // ════════════════════════════════════════════════════════════════════
  // First deactivate the user
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminSession.access_token}` } },
  });
  await adminClient.rpc('fn_admin_update_user_role', {
    p_user_id: targetUserId,
    p_role: 'sales',
    p_active: false,
    p_warehouse_id: null,
  });

  // Reset password while deactivated
  const deactivatedReset = await resetPasswordAPI(
    adminSession.access_token, targetUserId, 'DeactReset88!', 'DeactReset88!'
  );
  assert(deactivatedReset.status === 200, `14a. Can reset deactivated user's password (status: ${deactivatedReset.status})`);

  // Check active is still false
  const { data: afterProfile } = await adminClient
    .from('profiles')
    .select('active')
    .eq('id', targetUserId)
    .single();
  assert(afterProfile && afterProfile.active === false, `14b. User remains deactivated after password reset (active: ${afterProfile?.active})`);

  // Re-activate for subsequent tests
  await adminClient.rpc('fn_admin_update_user_role', {
    p_user_id: targetUserId,
    p_role: 'sales',
    p_active: true,
    p_warehouse_id: null,
  });

  // ════════════════════════════════════════════════════════════════════
  // TEST 15: Password is NOT stored in profiles
  // ════════════════════════════════════════════════════════════════════
  const { data: profileData } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();

  const profileStr = JSON.stringify(profileData || {});
  assert(
    !profileStr.includes('DeactReset88!') && !profileStr.includes('TempReset88!'),
    `15. Password not stored in profiles`
  );

  // ════════════════════════════════════════════════════════════════════
  // TEST 16: Password is NOT stored in audit_logs
  // ════════════════════════════════════════════════════════════════════
  const { data: auditLogs } = await adminClient
    .from('audit_logs')
    .select('*')
    .eq('entity_id', targetUserId)
    .eq('action', 'user_password_reset');

  let auditClean = true;
  if (auditLogs) {
    for (const log of auditLogs) {
      const logStr = JSON.stringify(log);
      if (logStr.includes('TempReset88!') || logStr.includes('DeactReset88!') || logStr.includes('password')) {
        // Check if 'password' appears as a key vs just in the word "user_password_reset"
        const details = log.details || {};
        if (details.password || details.confirmPassword || details.old_password || details.new_password) {
          auditClean = false;
        }
      }
    }
  }
  assert(auditClean, `16. Password not stored in audit_logs`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 17: Audit log IS created
  // ════════════════════════════════════════════════════════════════════
  assert(auditLogs && auditLogs.length > 0, `17. Audit log created for password reset (count: ${auditLogs?.length || 0})`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 18: Audit log contains no password data
  // ════════════════════════════════════════════════════════════════════
  if (auditLogs && auditLogs.length > 0) {
    const latestAudit = auditLogs[auditLogs.length - 1];
    let details = latestAudit.details || {};
    if (typeof details === 'string') {
      try { details = JSON.parse(details); } catch (e) {}
    }
    assert(
      details.target_user_id && details.admin_id && details.target_email &&
      !details.password && !details.confirmPassword,
      `18. Audit log has correct structure (no passwords, has IDs, actual details: ${JSON.stringify(details)})`
    );
  } else {
    assert(false, `18. (skipped — no audit logs found)`);
  }

  // ════════════════════════════════════════════════════════════════════
  // TEST 19: Admin remains logged in after resetting another user
  // ════════════════════════════════════════════════════════════════════
  const adminStillLoggedIn = await getAuthSession('admin@2bf.com.et', 'Password123!');
  assert(adminStillLoggedIn != null, `19. Admin session still valid after password reset`);

  // ════════════════════════════════════════════════════════════════════
  // TEST 20: Service Role key not exposed (check API response)
  // ════════════════════════════════════════════════════════════════════
  // Reset again and verify the response body doesn't contain any keys
  const safeRes = await resetPasswordAPI(
    adminSession.access_token, targetUserId, 'SafeCheck99!', 'SafeCheck99!'
  );
  const safeBody = await safeRes.text();
  assert(
    !safeBody.includes('service_role') && !safeBody.includes('sb_secret') && !safeBody.includes('SUPABASE_SERVICE_ROLE_KEY'),
    `20. Service Role key not exposed in API response`
  );

  // ════════════════════════════════════════════════════════════════════
  // REGRESSION: Admin can still create users
  // ════════════════════════════════════════════════════════════════════
  const regressionEmail = `regression_${Date.now()}@2bf.com.et`;
  const regressionRes = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminSession.access_token}`,
    },
    body: JSON.stringify({
      email: regressionEmail,
      password: 'Regression123!',
      full_name: 'Regression Test',
      role: 'sales', 
    }),
  });
  const regressionBody = await regressionRes.json().catch(() => ({}));
  assert(regressionRes.status === 201, `REGRESSION: Admin can still create users (status: ${regressionRes.status}, message: ${regressionBody.message})`);

  // ════════════════════════════════════════════════════════════════════
  // REGRESSION: Self-service password change still works
  // ════════════════════════════════════════════════════════════════════
  const selfChangeSession = await getAuthSession(testEmail, 'SafeCheck99!');
  if (selfChangeSession) {
    const selfClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    await selfClient.auth.setSession({
      access_token: selfChangeSession.access_token,
      refresh_token: selfChangeSession.refresh_token
    });
    const { error: selfErr } = await selfClient.auth.updateUser({ password: 'SelfService99!' });
    assert(!selfErr, `REGRESSION: Self-service password change works (${selfErr?.message || 'ok'})`);
  } else {
    assert(false, `REGRESSION: Self-service password change (skipped — login failed)`);
  }

  // ════════════════════════════════════════════════════════════════════
  // FINAL RESULTS
  // ════════════════════════════════════════════════════════════════════
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`FINAL STATUS: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`${'='.repeat(60)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
