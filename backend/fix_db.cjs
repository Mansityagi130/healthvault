require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

async function fix() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const files = [
    '20260819194500_organization_uniques',
    '20260819195000_audit_actions'
  ];

  for (const m of files) {
    const content = fs.readFileSync(`prisma/migrations/${m}/migration.sql`, 'utf8');
    try {
      await client.query(content);
      console.log(`Executed ${m}`);
    } catch (e) {
      console.error(`Failed ${m}: ${e.message}`);
    }
  }
  await client.end();
}
fix();
