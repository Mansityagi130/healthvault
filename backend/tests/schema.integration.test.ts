import { afterAll, describe, expect, it } from "vitest";

import { databaseClient } from "../src/config/database.js";

const expectedTables = [
  "User",
  "PatientProfile",
  "MedicalRecord",
  "Consent",
  "SharingSession",
  "QRSession",
  "AccessLog",
  "AuditLog"
];

describe("HealthVault schema", () => {
  it("creates the core relational tables", async () => {
    const prisma = databaseClient.getClient();
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual(expect.arrayContaining(expectedTables));
  });

  afterAll(async () => {
    await databaseClient.disconnect();
  });
});
