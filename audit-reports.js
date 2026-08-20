const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkAccess(sbClient, roleName, table, selectFields = '*') {
  const { data, error } = await sbClient.from(table).select(selectFields).limit(1);
  if (error) {
    if (error.code === 'PGRST116') {
       return `${roleName} - ${table}: OK (0 rows / empty)`;
    }
    return `${roleName} - ${table}: BLOCKED (${error.message})`;
  }
  return `${roleName} - ${table}: ALLOWED (can read ${data.length} rows)`;
}

async function run() {
  console.log('=== REPORTS AUDIT ===\n');

  // We need credentials for different roles. We know admin and production.
  // Let's create dummy users for sales, warehouse, and dispatch if they don't exist, or just query pg_policies via RPC.
  
  // Since we have admin access, let's query pg_policies using an RPC
  await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  const { data: policies, error: polErr } = await sb.rpc('fn_get_all_policies');
  if (polErr) {
    console.log('fn_get_all_policies failed, creating it...');
    // We can't execute DDL via REST easily unless we use the same schema trick.
  }

  // Let's test what 'production1@2bf.com.et' can see
  const sbProd = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });

  const tables = [
    'production_scans',
    'boxes',
    'warehouse_receipts',
    'warehouse_transfers',
    'orders',
    'customers',
    'dispatches',
    'deliveries',
    'returns',
    'payments',
    'products',
    'approvals',
    'correction_records',
    'audit_logs'
  ];

  console.log('--- PRODUCTION USER ACCESS ---');
  for (const table of tables) {
    console.log(await checkAccess(sbProd, 'production', table));
  }

  console.log('\n--- ADMIN USER ACCESS ---');
  for (const table of tables) {
    console.log(await checkAccess(sb, 'admin', table));
  }

  await sb.auth.signOut();
  await sbProd.auth.signOut();
}
run().catch(console.error);
