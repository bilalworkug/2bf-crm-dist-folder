const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres.uubllghmxprlgqttwosr:Girma3971-dot%2Ftest2bf@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

async function runMigration() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log("Connected to database successfully.");

    const sqlPath = path.join(__dirname, 'supabase/migrations/20260815000002_phase23_auth_security.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing Phase 23 SQL...");
    await client.query(sql);
    console.log("Phase 23 migration executed successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
