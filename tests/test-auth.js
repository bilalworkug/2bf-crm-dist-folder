const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('Missing env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('Attempting to log in as admin@2bf.com.et...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@2bf.com.et',
    password: 'Password123!',
  });

  if (error) {
    console.error('Auth Error:', error.message);
    return;
  }

  console.log('Auth Success! auth.uid():', data.session.user.id);

  console.log('Fetching profile...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.session.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile Error:', profileError.message);
  } else if (!profile) {
    console.error('Profile NOT FOUND for this user ID.');
  } else {
    console.log('Profile Found:', profile.role, profile.id);
  }
}

testAuth();
