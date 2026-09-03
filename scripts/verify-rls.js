const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkAccess(sbClient, roleName, table) {
  const { data, error } = await sbClient.from(table).select('id').limit(1);
  if (error) {
    if (error.code === 'PGRST116') return { role: roleName, table, access: 'ALLOWED (Empty)' }; // If it returns no rows but no error
    return { role: roleName, table, access: 'BLOCKED' };
  }
  return { role: roleName, table, access: `ALLOWED (${data.length} rows)` };
}

async function run() {
  console.log('=== PHASE 7: STRICT RLS VERIFICATION ===\n');

  // These users exist from our previous phases
  const users = [
    { email: 'admin@2bf.com.et', role: 'admin' },
    { email: 'production1@2bf.com.et', role: 'production' }
  ];

  const tables = ['orders', 'customers', 'boxes', 'dispatches', 'returns', 'audit_logs', 'payments'];

  for (const u of users) {
    const client = createClient(supabaseUrl, anonKey);
    const { error: signErr } = await client.auth.signInWithPassword({ email: u.email, password: 'Password123!' });
    if (signErr) {
      console.log(`Failed to sign in as ${u.email}: ${signErr.message}`);
      continue;
    }
    console.log(`\n--- ${u.role.toUpperCase()} ---`);
    for (const t of tables) {
      const res = await checkAccess(client, u.role, t);
      console.log(`${res.table.padEnd(12)} : ${res.access}`);
    }
    await client.auth.signOut();
  }
}
run().catch(console.error);
