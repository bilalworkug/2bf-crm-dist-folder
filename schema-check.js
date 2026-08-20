const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const { data, error } = await sb.rpc('fn_test_get_dispatch', { p_barcode: 'NONEXISTENT' });
  
  if (error) {
    console.log("Creating RPC to get schema...");
  }

  // We can just create an RPC to fetch schema
}
run().catch(console.error);
