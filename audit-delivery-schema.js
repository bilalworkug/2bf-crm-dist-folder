const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: auth } = await sb.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });

  console.log('=== DELIVERY ITEMS SCHEMA & RLS ===\n');

  // Try inserting with just the columns the schema probably needs
  const cols_attempts = [
    { delivery_id: '5198dd88-b2d6-4f45-bb76-293fc93af83a', barcode: 'x' },
    { delivery_id: '5198dd88-b2d6-4f45-bb76-293fc93af83a', barcode: 'x', order_id: '96904d80-1810-4a06-9fda-b97a6c6dddca' },
  ];

  for (const cols of cols_attempts) {
    const { data, error } = await sb.from('delivery_items').insert(cols).select();
    console.log('Insert with', Object.keys(cols), ':', error?.message || `OK: ${JSON.stringify(data)}`);
    if (data && data.length > 0) {
      console.log('  Columns:', Object.keys(data[0]));
      await sb.from('delivery_items').delete().eq('id', data[0].id);
    }
  }

  // Try to discover columns via select
  const { data: diEmpty } = await sb.from('delivery_items').select('*').limit(0);
  console.log('\ndelivery_items empty select:', diEmpty);

  // Check RLS policies by looking at what a production user can see
  const sbProd = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await sbProd.auth.signInWithPassword({ email: 'production1@2bf.com.et', password: 'Password123!' });
  
  const { data: dProd, error: eProd } = await sbProd.from('deliveries').select('*');
  console.log('\nProduction user can see deliveries:', eProd ? `BLOCKED: ${eProd.message}` : `YES (${dProd?.length} rows)`);
  
  const { data: diProd, error: eiProd } = await sbProd.from('delivery_items').select('*');
  console.log('Production user can see delivery_items:', eiProd ? `BLOCKED: ${eiProd.message}` : `YES (${diProd?.length} rows)`);

  // Check if delivery INSERT policy is too open
  const { data: d1, error: e1 } = await sbProd.from('deliveries').insert({ order_id: '96904d80-1810-4a06-9fda-b97a6c6dddca', status: 'pending' }).select();
  console.log('\nProduction user can INSERT deliveries:', e1 ? `BLOCKED: ${e1.message}` : `ALLOWED (${d1?.length} row) - SECURITY ISSUE!`);
  if (d1 && d1.length > 0) {
    await sb.from('deliveries').delete().eq('id', d1[0].id);
  }

  await sb.auth.signOut();
  await sbProd.auth.signOut();
}
run().catch(console.error);
