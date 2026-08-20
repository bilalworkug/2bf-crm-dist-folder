const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://uubllghmxprlgqttwosr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1YmxsZ2hteHBybGdxdHR3b3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNTE2NzYsImV4cCI6MjEwMDcyNzY3Nn0.vS20ZSyPTbKlu22C42v53vU4DsdfMcDhFeeBlOCjfxc';

async function run() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Need production user to produce boxes, or admin
  const { data: adminLogin, error: adminErr } = await client.auth.signInWithPassword({ email: 'admin@2bf.com.et', password: 'Password123!' });
  if (adminErr) return console.error('Admin login failed:', adminErr);
  const adminClient = client;

  const { data: products } = await adminClient.from('products').select('*').limit(2);
  const p1 = products[0].id;
  const p2 = products[1].id;

  const testBarcodes = Array.from({length: 6}, (_, i) => `TEST-CORR-${Date.now()}-${i}`);
  for (let i = 0; i < 6; i++) {
    const { error: insErr } = await adminClient.rpc('fn_produce_box', {
      p_barcode: testBarcodes[i],
      p_product_id: p1
    });
    if (insErr) console.log('Produce Box Error:', insErr);
  }

  const counters = { scanned: 0, corrected: 0, duplicates: 0, rejected: 0, errors: 0 };
  const processed = new Set();

  async function processBox(barcode, beforeProd, afterProd) {
    counters.scanned++;
    if (processed.has(barcode)) {
      counters.duplicates++;
      return;
    }
    
    const { data: box } = await adminClient.from('boxes').select('*').eq('barcode', barcode).single();
    if (!box) { counters.rejected++; return; }
    if (box.product_id !== beforeProd) { counters.rejected++; return; }
    
    const { data, error } = await adminClient.rpc('fn_correct_production_box_safe', {
      p_barcode: barcode,
      p_expected_before_product_id: beforeProd,
      p_new_product_id: afterProd,
      p_reason: 'Testing Fix',
      p_notes: 'Automated test notes'
    });

    if (error) {
      if (error.code === 'P0001' && (error.message.includes('status') || error.message.includes('product'))) {
         counters.rejected++;
      } else if (error.code === '23505') {
         counters.duplicates++;
      } else {
         counters.errors++;
         console.log(`[RPC] Error ${barcode}:`, error);
      }
    } else {
      counters.corrected++;
      processed.add(barcode);
    }
  }

  await processBox(testBarcodes[0], p1, p2);
  
  const { data: corrRecs } = await adminClient.from('correction_records').select('*').eq('barcode', testBarcodes[0]);
  console.log("Correction Records:", corrRecs);
  
  const { data: auditRecs } = await adminClient.from('audit_logs').select('*').eq('barcode', testBarcodes[0]).eq('action', 'production_box_corrected');
  console.log("Audit logs:", auditRecs);

  await processBox(testBarcodes[0], p1, p2);
  
  const dupRes = await adminClient.rpc('fn_correct_production_box_safe', {
    p_barcode: testBarcodes[0], p_expected_before_product_id: p1, p_new_product_id: p2, p_reason: 'Testing Fix', p_notes: ''
  });
  if (dupRes.error && dupRes.error.code === '23505') {
    counters.duplicates++;
  } else if (dupRes.error) {
    // If it's another error due to status or product mismatch (since it was just corrected), we might get rejected. Wait, if it was already corrected, its product ID is now p2, but we expect p1, so it fails with "Box belongs to different product"! Wait, the true duplicate error occurs if they happen perfectly concurrently, or if we bypass UI.
    // If the product changed, the RPC will throw "Box belongs to different product" or something, but actually the RPC checks `v_box.product_id != p_new_product_id`? No, it checks `v_box.product_id = p_expected_before_product_id`. If it's already corrected, the current product is `p2`, but expected is `p1`. So it throws "Expected before product...".
    // Wait, the duplicate UI prevention uses `processedBarcodes`. The DB unique constraint is on `barcode` and maybe something else, or maybe there isn't a unique constraint on correction_records for barcode? Actually, there might not be a unique constraint, but a box can be corrected multiple times in its life! The duplicate protection is purely session-based! Wait, the user said "Postgres 23505 error mapped to duplicate". That means there IS a unique constraint somewhere! Probably `barcode` in `correction_records` but wait, a barcode can be corrected multiple times! Let's just log it.
    console.log("Dup res error:", dupRes.error);
  }

  for (let i = 1; i < 6; i++) {
    await processBox(testBarcodes[i], p1, p2);
  }

  await processBox(testBarcodes[5], p2, p1);

  console.log(counters);
}
run();
