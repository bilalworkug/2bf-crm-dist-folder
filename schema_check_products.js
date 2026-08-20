const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function run() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  
  if (loginErr) {
    console.error("Login failed:", loginErr);
    return;
  }

  // 1. Get products to check structure
  const { data: products, error: pErr } = await client.from('products').select('*');
  console.log("Products table structure (first row):");
  if (products && products.length > 0) {
    console.log(Object.keys(products[0]));
  } else {
    console.log("No products found.");
  }
  
  // 2. List all existing product names
  console.log("\nExisting products:");
  if (products) {
    products.forEach(p => console.log(`- ${p.name}`));
  }

  // 3. Check for any existing assignment tables
  const { data: assignments, error: aErr } = await client.from('product_production_assignments').select('*').limit(1);
  if (aErr) {
    console.log("\nproduct_production_assignments table does NOT exist or is inaccessible (expected). Error:", aErr.message);
  } else {
    console.log("\nproduct_production_assignments table EXISTS.");
  }
}

run();
