const { createClient } = require('@supabase/supabase-js');
const { assert } = require('console');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function runTests() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Login as Admin
  const { data: adminAuth, error: adminErr } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  if (adminErr) return console.error('Admin login failed', adminErr);
  
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } } });

  // Login as Sales (Unauthorized for payments)
  const { data: salesAuth, error: salesErr } = await client.auth.signInWithPassword({ email: 'sales@2bf.com.et', password: 'Password123!' });
  if (salesErr) return console.error('Sales login failed', salesErr);
  const salesClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${salesAuth.session.access_token}` } } });

  console.log('--- STARTING PHASE 20 TESTS ---');
  let passed = 0;
  let failed = 0;

  function assertTest(condition, passMsg, failMsg) {
    if (condition) {
      console.log(`[PASS] ${passMsg}`);
      passed++;
    } else {
      console.log(`[FAIL] ${failMsg}`);
      failed++;
    }
  }

  try {
    // 1. Get a test order
    const { data: orders } = await adminClient.from('orders').select('*').limit(1);
    if (!orders || orders.length === 0) throw new Error("No orders found to test with");
    const testOrder = orders[0];

    const initialPaidAmount = parseFloat(testOrder.paid_amount) || 0;

    // Ensure order has enough total_amount for the test
    await adminClient.from('orders').update({ total_amount: 1000 }).eq('id', testOrder.id);

    // 2. Account/Admin submits a partial payment
    const { data: payment1Id, error: submitErr } = await adminClient.rpc('fn_submit_payment', {
      p_order_id: testOrder.id,
      p_amount: 50.00,
      p_payment_method: 'Cash',
      p_reference: 'TEST-123'
    });
    
    assertTest(!submitErr && payment1Id, 'Account can submit payments', `Failed to submit payment: ${submitErr?.message}`);

    // Verify Pending payment did NOT reduce balance
    const { data: orderAfterSubmit } = await adminClient.from('orders').select('paid_amount').eq('id', testOrder.id).single();
    assertTest(parseFloat(orderAfterSubmit.paid_amount) === initialPaidAmount, 'Pending payment does not reduce balance', 'Paid amount changed before approval');

    // 3. Unauthorized User Attempts Approval
    const { error: salesApproveErr } = await salesClient.rpc('fn_approve_payment', { p_payment_id: payment1Id });
    assertTest(salesApproveErr && salesApproveErr.message.includes('Unauthorized'), 'Other users cannot approve payments', 'Sales was able to approve payment');

    // 4. Admin Approves Payment
    const { error: adminApproveErr } = await adminClient.rpc('fn_approve_payment', { p_payment_id: payment1Id });
    assertTest(!adminApproveErr, 'Admin can approve payments', `Failed to approve payment: ${adminApproveErr?.message}`);

    // Verify Approved payment DID reduce balance
    const { data: orderAfterApprove } = await adminClient.from('orders').select('paid_amount').eq('id', testOrder.id).single();
    assertTest(parseFloat(orderAfterApprove.paid_amount) === initialPaidAmount + 50.00, 'Approved payment reduces balance correctly', 'Paid amount did not change correctly');

    // 5. Multiple / Partial Payments Work
    const { data: payment2Id } = await adminClient.rpc('fn_submit_payment', {
      p_order_id: testOrder.id,
      p_amount: 25.00,
      p_payment_method: 'Bank Transfer'
    });
    await adminClient.rpc('fn_approve_payment', { p_payment_id: payment2Id });

    const { data: orderAfterSecondApprove } = await adminClient.from('orders').select('paid_amount, total_amount').eq('id', testOrder.id).single();
    assertTest(parseFloat(orderAfterSecondApprove.paid_amount) === initialPaidAmount + 75.00, 'Multiple payments work and calculate correctly', 'Multiple payments failed to aggregate');

    // 6. Test Due Date Setting
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const { error: dueDateErr } = await adminClient.rpc('fn_set_order_due_date', {
      p_order_id: testOrder.id,
      p_due_date: tomorrow
    });
    assertTest(!dueDateErr, 'Due date is stored', `Failed to set due date: ${dueDateErr?.message}`);

    // 7. Test Notification Engine (Cron logic)
    const { error: notifErr } = await adminClient.rpc('fn_check_due_payments');
    assertTest(!notifErr, 'Notification engine executed without errors', `Cron failed: ${notifErr?.message}`);

    const { data: notifications } = await adminClient.from('notifications').select('*').eq('reference_id', testOrder.id);
    assertTest(notifications && notifications.length > 0, '1-day reminder works', 'Notification was not generated');

    // Duplicate prevention
    await adminClient.rpc('fn_check_due_payments');
    const { data: notificationsAfterSecondRun } = await adminClient.from('notifications').select('*').eq('reference_id', testOrder.id);
    assertTest(notificationsAfterSecondRun.length === notifications.length, 'Duplicate notifications are prevented', 'Duplicate notifications were generated');

    // Clean up test data
    if (payment1Id) await adminClient.from('payments').delete().eq('id', payment1Id);
    if (payment2Id) await adminClient.from('payments').delete().eq('id', payment2Id);
    
    // Restore original paid amount
    await adminClient.from('orders').update({ paid_amount: initialPaidAmount, due_date: null }).eq('id', testOrder.id);
    await adminClient.from('notifications').delete().eq('reference_id', testOrder.id);

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  }

  console.log(`\n--- RESULTS ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) process.exit(1);
}

runTests();
