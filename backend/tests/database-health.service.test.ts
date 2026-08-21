import { describe, expect, it } from "vitest";

import { getDatabaseHealth } from "../src/services/database-health.service.js";

describe("database health service", () => {
  it("reports an available database when the connection check succeeds", async () => {
    const databaseHealth = await getDatabaseHealth({
      ping: async () => undefined
    });

    expect(databaseHealth).toEqual({ status: "ok" });
  });

  it("reports an unavailable database when the connection check fails", async () => {
    const databaseHealth = await getDatabaseHealth({
      ping: async () => Promise.reject(new Error("Connection failed"))
    });

    expect(databaseHealth).toEqual({ status: "unavailable" });
  });
});
