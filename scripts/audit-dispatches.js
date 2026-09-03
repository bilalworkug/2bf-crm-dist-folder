const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const { data, error } = await sb.rpc('exec_sql', { sql: `SELECT column_name FROM information_schema.columns WHERE table_name = 'dispatches';` });
  
  if (error) {
     console.log("No exec_sql. Doing an insert to trigger error and see columns...");
     const { error: insErr } = await sb.from('dispatches').insert({ dummy: 1 });
     console.log(insErr);
  }

  await sb.auth.signOut();
}
run().catch(console.error);
