const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function runTests() {
  console.log("--- STARTING PHASE 22 TESTS ---");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Login as admin
  const { data: adminAuth, error: authErr } = await client.auth.signInWithPassword({
    email: 'admin@2bf.com.et',
    password: 'Password123!'
  });
  if (authErr) throw authErr;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } }
  });

  // Login as sales
  const { data: salesAuth, error: salesAuthErr } = await client.auth.signInWithPassword({
    email: 'sales@2bf.com.et',
    password: 'Password123!'
  });
  if (salesAuthErr) throw salesAuthErr;
  
  const salesClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${salesAuth.session.access_token}` } }
  });

  // Login as accounts
  const { data: accountsAuth, error: accountsAuthErr } = await client.auth.signInWithPassword({
    email: 'accounts@2bf.com.et',
    password: 'Password123!'
  });
  if (accountsAuthErr) throw accountsAuthErr;

  const accountsClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accountsAuth.session.access_token}` } }
  });

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

  try {
    // Note: If you cannot connect to DB directly, the migration must be applied manually 
    // in the Supabase SQL editor before these tests will fully pass.

    // Get a customer
    const { data: customer } = await adminClient.from('customers').select('*').limit(1).single();
    if (!customer) throw new Error("No customers found");

    const { data: allProducts } = await adminClient.from('products').select('id, name').eq('active', true).limit(2);
    if (!allProducts || allProducts.length < 1) throw new Error("Need products to test");
    const product = allProducts[0];

    // TEST 1: Admin can authorize credit
    const { error: adminCreditErr } = await adminClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 100000,
      p_payment_terms_days: 30,
      p_notes: 'Test Admin Auth'
    });
    
    // If we get an error saying function doesn't exist, it means migration wasn't run
    if (adminCreditErr && adminCreditErr.message.includes("could not find function")) {
        console.error("CRITICAL ERROR: Migration has not been applied to the database!");
        process.exit(1);
    }
    
    assert(!adminCreditErr, `Admin can authorize customer credit (${adminCreditErr?.message || 'OK'})`);

    // TEST 2: Accounts cannot authorize credit
    const { error: accCreditErr } = await accountsClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 50000,
      p_payment_terms_days: 30,
      p_notes: 'Test Acc Auth'
    });
    assert(accCreditErr != null, `Account cannot authorize credit (err: ${accCreditErr?.message || 'none'})`);

    // TEST 3: Sales cannot authorize credit
    const { error: salesCreditErr } = await salesClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 50000,
      p_payment_terms_days: 30,
      p_notes: 'Test Sales Auth'
    });
    assert(salesCreditErr != null, `Sales cannot authorize credit (err: ${salesCreditErr?.message || 'none'})`);

    // TEST 4: Customer with credit disabled cannot create credit order
    await adminClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: false,
      p_credit_limit: 100000,
      p_payment_terms_days: 30,
      p_notes: 'Disabled'
    });

    const { error: disabledOrderErr } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Test Credit Disabled',
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_payment_type: 'credit'
    });
    assert(disabledOrderErr != null, `Customer with credit disabled cannot create a credit order`);

    // TEST 5: Customer with credit enabled can create order within limit
    await adminClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 1000000, // Very high limit
      p_payment_terms_days: 30,
      p_notes: 'Enabled'
    });

    const { data: order1Id, error: order1Err } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Test Credit Enabled',
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_payment_type: 'credit'
    });
    assert(!order1Err, `Customer with credit enabled can create a credit order within limit`);

    // TEST 6: Order exceeding limit is blocked
    await adminClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 1, // Very low limit
      p_payment_terms_days: 30,
      p_notes: 'Low limit'
    });

    const { error: exceedingErr } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Test Credit Exceed',
      p_items: [{ product_id: product.id, quantity: 100 }],
      p_payment_type: 'credit'
    });
    assert(exceedingErr != null, `Customer exceeding credit limit is blocked`);

    // TEST 7: Pay now orders continue working
    const { error: payNowErr } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Test Pay Now',
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_payment_type: 'pay_now'
    });
    assert(!payNowErr, `Sales can create PAY NOW orders normally`);
    
    // TEST 8: Outstanding debt reduces available credit
    await adminClient.rpc('fn_upsert_customer_credit', {
      p_customer_id: customer.id,
      p_credit_allowed: true,
      p_credit_limit: 50000, 
      p_payment_terms_days: 30,
      p_notes: 'Testing calculation'
    });
    
    const { data: status1 } = await adminClient.rpc('fn_get_customer_credit_status', { p_customer_id: customer.id });
    
    // create a credit order
    await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Credit calc',
      p_items: [{ product_id: product.id, quantity: 1 }],
      p_payment_type: 'credit'
    });
    
    const { data: status2 } = await adminClient.rpc('fn_get_customer_credit_status', { p_customer_id: customer.id });
    
    assert(status2.outstanding > status1.outstanding, `Outstanding debt correctly reduces available credit`);

    // TEST 9: Audit logs are created
    const { data: logs } = await adminClient.from('audit_logs').select('*').eq('entity_id', customer.id).ilike('action', '%credit%').limit(1);
    assert(logs && logs.length > 0, `Audit logs are created for credit authorization changes`);

  } catch (err) {
    console.error("Test execution failed:", err);
  }

  console.log(`\n--- RESULTS ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
