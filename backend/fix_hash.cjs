require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
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
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    await client.query(`UPDATE _prisma_migrations SET checksum = $1 WHERE migration_name = $2`, [hash, m]);
    console.log(`Updated hash for ${m} to ${hash}`);
  }
  await client.end();
}
fix();
