const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function fix() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const ac = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  });
  
  // Restore sales role
  const { error: e1 } = await ac.from('profiles').update({ role: 'sales' }).eq('email', 'sales@2bf.com.et');
  console.log('Restore sales:', e1?.message || 'OK');

  // Restore accounts role  
  const { error: e2 } = await ac.from('profiles').update({ role: 'accounts' }).eq('email', 'accounts@2bf.com.et');
  console.log('Restore accounts:', e2?.message || 'OK');
  
  // Restore reports role
  const { error: e3 } = await ac.from('profiles').update({ role: 'reports' }).eq('email', 'reports@2bf.com.et');
  console.log('Restore reports:', e3?.message || 'OK');

  // Verify all
  const { data: profiles } = await ac.from('profiles').select('email, role').in('email', ['sales@2bf.com.et', 'accounts@2bf.com.et', 'reports@2bf.com.et', 'admin@2bf.com.et']);
  console.log('\nCurrent roles:');
  profiles?.forEach(p => console.log(`  ${p.email} => ${p.role}`));
}

fix();
