import { afterAll, describe, expect, it } from "vitest";

import { databaseClient } from "../src/config/database.js";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabaseUrl)("PostgreSQL integration", () => {
  it("connects through Prisma", async () => {
    const prisma = databaseClient.getClient();

    await expect(prisma.$connect()).resolves.toBeUndefined();
  });

  afterAll(async () => {
    await databaseClient.disconnect();
  });
});
