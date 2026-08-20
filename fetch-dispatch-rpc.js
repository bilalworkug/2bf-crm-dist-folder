const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const { data, error } = await sb.rpc('exec_sql', { sql: `
    SELECT prosrc 
    FROM pg_proc 
    WHERE proname = 'fn_dispatch_box';
  `});

  if (error) {
    console.log("No exec_sql, trying via psql...");
  } else {
    console.log("fn_dispatch_box source:\n", data);
  }
  
  await sb.auth.signOut();
}
run().catch(console.error);
