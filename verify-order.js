const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const delay = ms => new Promise(res => setTimeout(res, ms));
const log = (type, msg) => console.log(`${type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️'} ${msg}`);

async function verifyOrderCreation() {
  console.log('\n=====================================');
  console.log('  ORDER CREATION VERIFICATION');
  console.log('=====================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, successMsg, failMsg) {
    if (condition) {
      log('pass', successMsg);
      passed++;
    } else {
      log('fail', failMsg);
      failed++;
    }
  }

  const sbAdmin = createClient(supabaseUrl, supabaseAnonKey);
  const sbProd = createClient(supabaseUrl, supabaseAnonKey);

  // Authenticate Admin (has sales privileges)
  const { data: authAdmin, error: authAdminErr } = await sbAdmin.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  if (authAdminErr) {
    console.error('Failed to login admin:', authAdminErr.message);
    process.exit(1);
  }
  const adminId = authAdmin.session.user.id;

  // Authenticate Production (should be unauthorized for sales)
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });

  try {
    // 1. Customer Creation
    console.log('\n[1] Creating a test customer...');
    const custName = 'TEST CUST ' + Date.now();

    const { data: customer, error: custErr } = await sbAdmin.from('customers').insert({
      customer_name: custName,
      sales_person_id: adminId
    }).select().single();
    
    assert(!custErr && customer, `Customer created: ${custName}`, `Customer creation failed: ${custErr?.message}`);
    if (custErr) throw custErr;

    // 2. Setup product
    const { data: product } = await sbAdmin.from('products').select('id, name').limit(1).single();
    if (!product) throw new Error('No product found for testing.');

    // 3. Check product has an active price (may be RLS-blocked for some roles, so just log)
    const { data: activePrice } = await sbAdmin.from('product_prices').select('price').eq('product_id', product.id).eq('is_active', true).single();
    if (activePrice) {
      assert(activePrice.price > 0, `Active price found for product: $${activePrice.price}`, `Active price is zero or negative.`);
    } else {
      log('info', 'product_prices not readable via client (RLS), will verify via RPC return data.');
    }
    
    // 4. Create Order
    console.log('\n[2] Creating an order...');
    const orderNum = 'TEST-ORD-' + Date.now();
    const { data: order, error: orderErr } = await sbAdmin.from('orders').insert({
      order_number: orderNum,
      customer_id: customer.id,
      status: 'pending',
      sales_person_id: adminId,
      total_amount: 0
    }).select().single();
    
    assert(!orderErr && order, `Order created: ${orderNum}`, `Order creation failed: ${orderErr?.message}`);
    if (orderErr) throw orderErr;

    // 5. Create Order Item via RPC (happy path)
    console.log('\n[3] Adding order item via fn_create_order_item...');
    const { data: rpcItem, error: rpcErr } = await sbAdmin.rpc('fn_create_order_item', {
      p_order_id: order.id,
      p_product_id: product.id,
      p_quantity: 5
    });

    assert(!rpcErr && rpcItem, `Order item created via RPC successfully`, `RPC failed: ${rpcErr?.message}`);
    
    if (rpcItem) {
      // The RPC itself fetches the price from product_prices, so we validate from the returned data
      assert(rpcItem.standard_price > 0, `standard_price automatically populated ($${rpcItem.standard_price}) ✓`, `standard_price is 0 or missing`);
      assert(rpcItem.unit_price > 0, `unit_price automatically populated ($${rpcItem.unit_price}) ✓`, `unit_price is 0 or missing`);
      assert(rpcItem.standard_price === rpcItem.unit_price, `standard_price === unit_price (no discount applied) ✓`, `standard_price (${rpcItem.standard_price}) !== unit_price (${rpcItem.unit_price})`);
    }

    // 6. Verify total is updated (Trigger)
    console.log('\n[4] Verifying order total calculation trigger...');
    await delay(1000);
    const { data: orderAfter } = await sbAdmin.from('orders').select('total_amount').eq('id', order.id).single();
    if (rpcItem) {
      const expectedTotal = rpcItem.unit_price * 5;
      assert(orderAfter?.total_amount === expectedTotal, `Order total_amount updated to $${expectedTotal} by trigger ✓`, `Order total mismatch! Expected ${expectedTotal}, got ${orderAfter?.total_amount}`);
    }

    // 7. Duplicate handling
    console.log('\n[5] Testing duplicate item rejection...');
    const { error: dupErr } = await sbAdmin.rpc('fn_create_order_item', {
      p_order_id: order.id,
      p_product_id: product.id,
      p_quantity: 2
    });
    assert(dupErr && dupErr.message.includes('Duplicate product'), `Duplicate order item correctly rejected ✓`, `Duplicate was incorrectly allowed! Error: ${dupErr?.message || 'None'}`);

    // 8. Quantity <= 0 handling
    console.log('\n[6] Testing invalid quantity rejection...');
    const { data: product2 } = await sbAdmin.from('products').select('id, name').neq('id', product.id).limit(1).single();
    if (product2) {
      const { error: qtyErr } = await sbAdmin.rpc('fn_create_order_item', {
        p_order_id: order.id,
        p_product_id: product2.id,
        p_quantity: 0
      });
      assert(qtyErr && qtyErr.message.includes('Quantity must be greater than zero'), `Zero quantity correctly rejected ✓`, `Zero quantity was incorrectly allowed!`);
    }

    // 9. Unauthorized users rejected
    console.log('\n[7] Testing security constraints (Production user shouldn\'t create order items)...');
    const { error: unauthErr } = await sbProd.rpc('fn_create_order_item', {
      p_order_id: order.id,
      p_product_id: product.id,
      p_quantity: 1
    });
    assert(unauthErr && unauthErr.message.includes('Unauthorized'), `Production user correctly blocked from order item creation ✓`, `Security violation! Production user was allowed to create an order item.`);

    console.log('\n[8] Verifying Audit Log creation...');
    if (rpcItem) {
      const { data: logs } = await sbAdmin.from('audit_logs').select('*').eq('entity_id', rpcItem.id).eq('action', 'order_item_created').limit(1);
      assert(logs && logs.length > 0, `Audit log correctly written for order item ✓`, `Audit log missing!`);
    }

  } catch (err) {
    console.error('\n❌ UNHANDLED EXCEPTION:', err);
  } finally {
    console.log('\n=====================================');
    console.log('  VERIFICATION SUMMARY');
    console.log('=====================================');
    console.log(`✅ PASSED:   ${passed}`);
    console.log(`❌ FAILED:   ${failed}`);
    console.log(`Total:       ${passed + failed}\n`);

    if (failed > 0) {
      console.log('🔴 ORDER CREATION: HAS FAILURES');
      process.exit(1);
    } else {
      console.log('🟢 ORDER CREATION: FULLY OPERATIONAL');
    }
  }
}

verifyOrderCreation();
