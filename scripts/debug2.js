const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function fix() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: auth } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const ac = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  });

  const { error } = await ac.from('profiles').update({ role: 'accounts' }).eq('email', 'accounts@2bf.com.et');
  console.log('Restore accounts:', error?.message || 'OK');
  
  const { data: finalCheck } = await ac.from('profiles').select('email, role').eq('email', 'accounts@2bf.com.et').single();
  console.log('Accounts final role:', finalCheck?.role);
}

fix();
