import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { RecordCategory } from "../src/generated/prisma/enums.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const prisma = databaseClient.getClient();

describe("Step 24: Secure Search & Filtering API Integration Tests", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    // Clean up
    // Register User A
    const resA = await request(app).post("/api/auth/register")
      .send({ email: "searchtestA@example.com", password: "securepassword123", firstName: "Alice", lastName: "A" });
    const loginA = await request(app).post("/api/auth/login")
      .send({ email: "searchtestA@example.com", password: "securepassword123" });
    userA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    // Register User B
    const resB = await request(app).post("/api/auth/register")
      .send({ email: "searchtestB@example.com", password: "securepassword123", firstName: "Bob", lastName: "B" });
    const loginB = await request(app).post("/api/auth/login")
      .send({ email: "searchtestB@example.com", password: "securepassword123" });
    userB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };

    // Create records for User A
    await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ category: RecordCategory.LAB_REPORT, title: "Secret HIV Test", occurredAt: "2023-01-01T00:00:00Z" });

    // Create records for User B
    await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ category: RecordCategory.LAB_REPORT, title: "Public Flu Test", occurredAt: "2023-01-02T00:00:00Z" });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    });

  it("1. Patient searching for their own record finds it", async () => {
    const res = await request(app)
      .get("/api/patient/records?search=HIV")
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe("Secret HIV Test");
  });

  it("2. Patient searching for another patient's record returns empty", async () => {
    const res = await request(app)
      .get("/api/patient/records?search=HIV")
      .set("Authorization", `Bearer ${userB.accessToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0); // Scope correctly constrained
  });

  it("3. Validates maximum page size", async () => {
    const res = await request(app)
      .get("/api/patient/records?pageSize=1000")
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(res.status).toBe(400); // Because max pageSize is 100
  });

  it("4. Validates search term max length", async () => {
    const hugeSearch = "A".repeat(150);
    const res = await request(app)
      .get(`/api/patient/records?search=${hugeSearch}`)
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(res.status).toBe(400); // max 100
  });
});
