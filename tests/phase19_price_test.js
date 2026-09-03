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

  console.log('--- STARTING PHASE 19 TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, passMsg, failMsg) {
    if (condition) {
      console.log(`[PASS] ${passMsg}`);
      passed++;
    } else {
      console.log(`[FAIL] ${failMsg}`);
      failed++;
    }
  }

  try {
    // Create dedicated product for isolated testing
    const { data: testProduct, error: prodErr } = await adminClient.from('products').insert({
      name: `Test Product ${Date.now()}`,
      sku: `P19-${Date.now()}`,
      active: true
    }).select().single();
    if (prodErr || !testProduct) throw new Error("Could not create test product: " + prodErr?.message);

    // 1. Admin creates price
    const { data: price1, error: err1 } = await adminClient.from('product_prices').insert({
      product_id: testProduct.id,
      price: 10.50,
      currency: 'ETB',
      effective_from: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      active: true,
      created_by: null // Service role doesn't have a user id
    }).select().single();
    
    assert(!err1 && price1, 'Admin creates price', `Failed to create price: ${err1?.message}`);

    // 5. Current price function returns correct price
    const { data: currentPrice, error: currErr } = await adminClient.rpc('fn_get_current_product_price', { p_product_id: testProduct.id });
    assert(!currErr && currentPrice === 10.50, 'Current price function returns correct price', `Current price calculation failed: ${currErr?.message || currentPrice}`);

    // 4. Future price is correctly scheduled
    const { data: priceFuture, error: errFuture } = await adminClient.from('product_prices').insert({
      product_id: testProduct.id,
      price: 15.00,
      currency: 'ETB',
      effective_from: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      active: true
    }).select().single();
    
    assert(!errFuture, 'Future price is correctly scheduled', `Failed to schedule future price: ${errFuture?.message}`);
    
    // Validate current price is STILL 10.50 because the 15.00 one is in the future
    const { data: currentPriceAfterFuture } = await adminClient.rpc('fn_get_current_product_price', { p_product_id: testProduct.id });
    assert(currentPriceAfterFuture === 10.50, 'Future price does not become active early', `Future price became active early! Returns: ${currentPriceAfterFuture}`);

    // 13. Invalid price is rejected (Negative)
    const { error: errNeg } = await adminClient.from('product_prices').insert({
      product_id: testProduct.id,
      price: -5.00,
      effective_from: new Date().toISOString()
    });
    assert(errNeg && errNeg.message.includes('product_prices_price_check'), 'Invalid price is rejected (negative)', 'Allowed negative price');

    // Clean up created prices for testing
    if (price1) await adminClient.from('product_prices').delete().eq('id', price1.id);
    if (priceFuture) await adminClient.from('product_prices').delete().eq('id', priceFuture.id);
    if (testProduct) await adminClient.from('products').delete().eq('id', testProduct.id);

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
