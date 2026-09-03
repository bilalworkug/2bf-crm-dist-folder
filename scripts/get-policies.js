const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sb = createClient(supabaseUrl, supabaseKey);

async function run() {
  await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const { data, error } = await sb.rpc('fn_get_all_policies');
  if (error) {
    console.log(error);
  } else {
    console.log(data);
  }
}
run().catch(console.error);
