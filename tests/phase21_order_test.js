const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function runTests() {
  console.log("--- STARTING PHASE 21 TESTS ---");
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
    // Setup: get a customer
    const { data: customer } = await adminClient.from('customers').select('*').limit(1).single();
    if (!customer) throw new Error("No customers found in DB for test");

    // Get two products that have active prices via the RPC
    const { data: allProducts } = await adminClient.from('products').select('id, name').eq('active', true).limit(10);

    // Find products with current prices
    let product1 = null, product2 = null, productNoPrice = null;
    let price1 = 0, price2 = 0;

    for (const p of (allProducts || [])) {
      const { data: price } = await adminClient.rpc('fn_get_current_product_price', { p_product_id: p.id });
      console.log(`Checking P="${p.name}", ID=${p.id}, price=${price}`);
      if (price > 0 && !product1) {
        product1 = p;
        price1 = price;
      } else if (price > 0 && !product2) {
        product2 = p;
        price2 = price;
      } else if (price <= 0 && !productNoPrice) {
        productNoPrice = p;
      }
      if (product1 && product2 && productNoPrice) break;
    }

    if (!product1 || !product2) throw new Error("Need at least 2 priced products");
    console.log(`Setup: P1="${product1.name}" price=${price1}, P2="${product2.name}" price=${price2}`);

    // ===== TEST 1: Product with no active price cannot be ordered =====
    if (productNoPrice) {
      const { error: noPriceErr } = await salesClient.rpc('fn_create_sales_order', {
        p_customer_id: customer.id,
        p_notes: 'Test no price',
        p_items: [{ product_id: productNoPrice.id, quantity: 5 }]
      });
      assert(
        noPriceErr != null,
        `Product with no active price cannot be ordered (err: ${noPriceErr?.message || 'none'})`
      );
    } else {
      // Create a scenario: deactivate all prices for a product then test
      const testProd = allProducts.find(p => p.id !== product1.id && p.id !== product2.id);
      if (testProd) {
        // Deactivate all prices for this product
        await adminClient.from('product_prices').update({ active: false }).eq('product_id', testProd.id);
        // Wait a moment
        await new Promise(r => setTimeout(r, 500));
        
        const { error: noPriceErr } = await salesClient.rpc('fn_create_sales_order', {
          p_customer_id: customer.id,
          p_notes: 'Test no price',
          p_items: [{ product_id: testProd.id, quantity: 5 }],
          p_payment_type: 'pay_now'
        });
        assert(
          noPriceErr != null,
          `Product with no active price cannot be ordered (err: ${noPriceErr?.message || 'none'})`
        );
        // Restore
        await adminClient.from('product_prices').update({ active: true }).eq('product_id', testProd.id);
      } else {
        console.log("[SKIP] Not enough products to test no-price scenario");
      }
    }

    // ===== TEST 2: Sales can create an order =====
    const qty1 = 10;
    const qty2 = 5;
    const expectedTotal = (price1 * qty1) + (price2 * qty2);

    const { data: orderId, error: createErr } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'Phase 21 Test Order',
      p_items: [
        { product_id: product1.id, quantity: qty1 },
        { product_id: product2.id, quantity: qty2 }
      ],
      p_payment_type: 'pay_now'
    });
    console.log("DEBUG TEST 2 orderId:", orderId, "createErr:", createErr);
    assert(!createErr, `Sales can create an order (${createErr?.message || 'OK'})`);
    if (!orderId) throw new Error("RPC did not return an order ID!");

    // ===== TEST 3: Server calculates the correct total =====
    const { data: order } = await adminClient.from('orders').select('*').eq('id', orderId).single();
    assert(
      Math.abs(order.total_amount - expectedTotal) < 0.01,
      `Server calculated correct total (expected: ${expectedTotal}, actual: ${order.total_amount})`
    );

    // ===== TEST 4: Multiple products added =====
    const { data: items } = await adminClient.from('order_items').select('*').eq('order_id', orderId);
    assert(items.length === 2, 'Multiple products added to one order');

    // ===== TEST 5: Correct Admin-configured price automatically used =====
    const item1 = items.find(i => i.product_id === product1.id);
    const item2 = items.find(i => i.product_id === product2.id);
    assert(
      Math.abs(item1.unit_price - price1) < 0.01,
      `Product 1 uses Admin-configured price (expected: ${price1}, actual: ${item1.unit_price})`
    );
    assert(
      Math.abs(item2.unit_price - price2) < 0.01,
      `Product 2 uses Admin-configured price (expected: ${price2}, actual: ${item2.unit_price})`
    );

    // ===== TEST 6: Historical price remains unchanged after price change =====
    const originalPrice1 = item1.unit_price;
    const newPrice = originalPrice1 + 50;
    
    // Set effective_from to 1 minute in the past so it's guaranteed to be active
    const pastTime = new Date();
    pastTime.setMinutes(pastTime.getMinutes() - 1);

    // Insert a new price record the way the admin page does it
    await adminClient.from('product_prices').insert({
      product_id: product1.id,
      price: newPrice,
      currency: 'ETB',
      effective_from: pastTime.toISOString(),
      active: true,
      created_by: adminAuth.session.user.id
    });
    await new Promise(r => setTimeout(r, 1000));

    // Verify the old order's items haven't changed
    const { data: itemsAfter } = await adminClient.from('order_items').select('*').eq('order_id', orderId);
    const item1After = itemsAfter.find(i => i.product_id === product1.id);
    assert(
      Math.abs(item1After.unit_price - originalPrice1) < 0.01,
      `Historical unit_price unchanged after price change (still: ${item1After.unit_price})`
    );

    // ===== TEST 7: New order uses new price =====
    const { data: newRpcPrice } = await adminClient.rpc('fn_get_current_product_price', { p_product_id: product1.id });
    console.log(`After price change: fn_get_current_product_price returns ${newRpcPrice} (expected ~${newPrice})`);

    const { data: order2Id } = await salesClient.rpc('fn_create_sales_order', {
      p_customer_id: customer.id,
      p_notes: 'New Price Test',
      p_items: [{ product_id: product1.id, quantity: 10 }],
      p_payment_type: 'pay_now'
    });
    const { data: items2 } = await adminClient.from('order_items').select('*').eq('order_id', order2Id);
    const newItem = items2.find(i => i.product_id === product1.id);
    assert(
      Math.abs(newItem.unit_price - newRpcPrice) < 0.01,
      `New order uses current effective price (expected: ${newRpcPrice}, actual: ${newItem.unit_price})`
    );

    // ===== TEST 8: Audit log is created =====
    const { data: logs } = await adminClient.from('audit_logs').select('*').eq('entity_id', orderId).eq('action', 'order_created');
    assert(logs.length > 0, 'Audit log is created for order creation');

    // ===== TEST 9: Order notes are stored =====
    assert(order.notes === 'Phase 21 Test Order', 'Order notes are stored correctly');

    // ===== TEST 10: Sales person ID is set via auth.uid() =====
    assert(order.sales_person_id === salesAuth.session.user.id, 'Sales person set via auth.uid()');

    // ===== Restore price =====
    await adminClient.from('product_prices').insert({
      product_id: product1.id,
      price: originalPrice1,
      currency: 'ETB',
      effective_from: new Date().toISOString(),
      active: true,
      created_by: adminAuth.session.user.id
    });

  } catch (err) {
    console.error("Test execution failed:", err);
  }

  console.log(`\n--- RESULTS ---`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
