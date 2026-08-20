const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function check() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const ac = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  });

  // Restore sales first
  await ac.from('profiles').update({ role: 'sales' }).eq('email', 'sales@2bf.com.et');

  // Query pg_policies for profiles
  const { data, error } = await ac.rpc('fn_get_current_product_price', { p_product_id: '22222222-0000-0000-0000-000000000002' });
  // We can't query pg_policies via PostgREST. Let me try a different approach.
  // Let me check if the old "Allow all modifications" policy on profiles still exists by testing behavior.
  
  // Login as sales fresh
  const salesC = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: salesAuth } = await salesC.auth.signInWithPassword({ email: 'sales@2bf.com.et', password: 'Password123!' });
  const sc = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${salesAuth.session.access_token}` } }
  });
  
  // Test: can sales INSERT a new profile? (should be blocked if old policy is gone)
  const { error: insertErr } = await sc.from('profiles').insert({
    id: '00000000-0000-0000-0000-000000000099',
    email: 'fake@test.com',
    role: 'admin',
    active: true,
  });
  console.log('Sales INSERT profile:', insertErr?.message || 'ALLOWED - OLD POLICY STILL EXISTS');
  
  // Test: can sales DELETE a profile? (should be blocked)
  const { error: delErr } = await sc.from('profiles').delete().eq('email', 'fake@test.com');
  console.log('Sales DELETE profile:', delErr?.message || 'ALLOWED or no rows');
  
  // Test: can sales update own name only (no role change)?
  const { data: myProfile } = await sc.from('profiles').select('id').eq('email', 'sales@2bf.com.et').single();
  const { error: nameErr } = await sc.from('profiles').update({ full_name: 'Sales Person Updated' }).eq('id', myProfile.id);
  console.log('Sales update own name:', nameErr?.message || 'OK');
  
  // Test: can sales update own role?
  const { error: roleErr } = await sc.from('profiles').update({ role: 'admin' }).eq('id', myProfile.id);
  console.log('Sales update own role to admin:', roleErr?.message || 'ALLOWED - BUG');
  
  // Check and restore
  const { data: finalCheck } = await ac.from('profiles').select('role').eq('email', 'sales@2bf.com.et').single();
  console.log('Sales final role:', finalCheck?.role);
  if (finalCheck?.role !== 'sales') {
    await ac.from('profiles').update({ role: 'sales' }).eq('email', 'sales@2bf.com.et');
    console.log('Restored');
  }
}

check();
