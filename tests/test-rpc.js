const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpc() {
  console.log('Logging in as Production User 1 (production1@2bf.com.et)...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'production1@2bf.com.et',
    password: 'Password123!',
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    return;
  }
  console.log('Auth Success! auth.uid():', authData.session.user.id);

  console.log('Fetching a product ID...');
  const { data: products } = await supabase.from('products').select('id').limit(1);
  const productId = products[0].id;

  const testBarcode = 'TEST-PROD-' + Math.floor(Math.random() * 1000000);
  console.log(`Executing fn_produce_box for barcode ${testBarcode}...`);

  const { error: rpcError, data: rpcData } = await supabase.rpc('fn_produce_box', {
    p_barcode: testBarcode,
    p_product_id: productId,
    p_user_id: authData.session.user.id,
  });

  if (rpcError) {
    console.error('\n--- RPC ERROR DETECTED ---');
    console.error(JSON.stringify(rpcError, null, 2));
  } else {
    console.log('RPC Success!', rpcData);
  }
}

testRpc();
