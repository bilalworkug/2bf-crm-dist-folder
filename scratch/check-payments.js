const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function check() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: adminAuth } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } } });

  const { data, error } = await adminClient.rpc('fn_submit_payment', {
      p_order_id: '00000000-0000-0000-0000-000000000000',
      p_amount: 1,
      p_payment_method: 'Cash'
  });
  console.log('RPC ERROR:', error?.message);

  const { data: cols, error: colErr } = await adminClient.from('payments').select('*').limit(1);
  console.log('PAYMENTS DATA:', cols, 'ERROR:', colErr?.message);
}

check();
