const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.uubllghmxprlgqttwosr:Girma3971-dot%2Ftest2bf@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to database successfully.");

    const sqlPath = path.join(__dirname, 'supabase/migrations/20260813000007_product_assignments.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing SQL...");
    await client.query(sql);
    console.log("Migration executed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
