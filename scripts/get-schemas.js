const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const tables = ['profiles', 'production_scans'];
  for (const table of tables) {
    const { data } = await sb.rpc('fn_get_schema', { p_table: table });
    console.log(`Schema for ${table}:`, data);
  }
}
run().catch(console.error);
