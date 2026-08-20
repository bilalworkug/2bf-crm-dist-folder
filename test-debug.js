const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugRpc() {
  // 1. Sign in as production user
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'production1@2bf.com.et',
    password: 'Password123!',
  });
  if (authError) { console.error('Auth Error:', authError.message); return; }
  const uid = authData.session.user.id;
  console.log('Auth OK. uid:', uid);

  // 2. Get a product
  const { data: products } = await supabase.from('products').select('id, name').limit(1);
  const product = products[0];
  console.log('Product:', product.name, product.id);

  // 3. Check profile exists and has correct role
  const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  console.log('Profile:', profile ? `role=${profile.role}, id=${profile.id}` : 'NOT FOUND', profErr?.message || '');

  // 4. Try inserting directly into production_scans (test RLS)
  const testBarcode = 'DEBUG-' + Date.now();
  console.log('\n--- Test 1: Direct INSERT into production_scans ---');
  const { error: e1 } = await supabase.from('production_scans').insert({
    barcode: testBarcode + '-A',
    product_id: product.id,
    scanned_by: uid,
  });
  console.log(e1 ? `FAIL: ${e1.code} ${e1.message}` : 'OK');

  // 5. Try inserting directly into boxes
  console.log('\n--- Test 2: Direct INSERT into boxes ---');
  const { error: e2 } = await supabase.from('boxes').insert({
    barcode: testBarcode + '-B',
    product_id: product.id,
  });
  console.log(e2 ? `FAIL: ${e2.code} ${e2.message}` : 'OK');

  // 6. Try inserting directly into barcode_history
  console.log('\n--- Test 3: Direct INSERT into barcode_history ---');
  const { error: e3 } = await supabase.from('barcode_history').insert({
    barcode: testBarcode + '-C',
    action: 'produced',
    product_id: product.id,
    user_id: uid,
  });
  console.log(e3 ? `FAIL: ${e3.code} ${e3.message}` : 'OK');

  // 7. Try inserting directly into audit_logs
  console.log('\n--- Test 4: Direct INSERT into audit_logs ---');
  const { error: e4 } = await supabase.from('audit_logs').insert({
    user_id: uid,
    action: 'test_debug',
    entity_type: 'test',
    details: { test: true },
  });
  console.log(e4 ? `FAIL: ${e4.code} ${e4.message}` : 'OK');

  // 8. Check boxes table schema
  console.log('\n--- Test 5: SELECT from boxes (check if table exists) ---');
  const { data: boxData, error: e5 } = await supabase.from('boxes').select('*').limit(1);
  console.log(e5 ? `FAIL: ${e5.code} ${e5.message}` : `OK - ${boxData?.length} rows`);
}

debugRpc();
