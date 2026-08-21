import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("GET /api/health", () => {
  it("returns the service health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "healthvault-api",
      version: "0.1.0"
    });
  });
});

describe("GET /api/health/db", () => {
  it("returns the safe database health status", async () => {
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "healthvault-api",
      api: { status: "ok" },
      database: { status: "ok" }
    });
  });
});
