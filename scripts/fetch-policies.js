const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await sb.rpc('exec_sql', { query: `
    SELECT schemaname, tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('orders', 'customers', 'boxes', 'dispatches', 'deliveries', 'returns')
  ` });
  
  if (error) {
    console.log("Cannot run exec_sql. We will have to query the actual tables using our different user roles.");
  } else {
    console.log(data);
  }
}
run().catch(console.error);
