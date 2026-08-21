import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";

const prisma = databaseClient.getClient();

describe("Patient Profile Security", () => {
  let userA: { id: string; accessToken: string };
  let userB: { id: string; accessToken: string };

  beforeAll(async () => {
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "patienttest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "patienttest" } } } });
    await prisma.user.deleteMany({ where: { email: { contains: "patienttest" } } });

    // Register User A
    const resA = await request(app).post("/api/auth/register")
      .set("X-Forwarded-For", "192.168.2.1")
      .send({
      email: "patienttestA@example.com",
      password: "securepassword123",
      firstName: "User",
      lastName: "A"
    });
    
    const loginA = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "192.168.2.1")
      .send({
      email: "patienttestA@example.com",
      password: "securepassword123",
    });
    userA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    // Register User B
    const resB = await request(app).post("/api/auth/register")
      .set("X-Forwarded-For", "192.168.2.2")
      .send({
      email: "patienttestB@example.com",
      password: "securepassword123",
      firstName: "User",
      lastName: "B"
    });

    const loginB = await request(app).post("/api/auth/login")
      .set("X-Forwarded-For", "192.168.2.2")
      .send({
      email: "patienttestB@example.com",
      password: "securepassword123",
    });
    userB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };
  });

  afterAll(async () => {
    await prisma.encounter.deleteMany();
    await prisma.authSession.deleteMany({ where: { user: { email: { contains: "patienttest" } } } });
    await prisma.patientProfile.deleteMany({ where: { user: { email: { contains: "patienttest" } } } });
    await prisma.user.deleteMany({ where: { email: { contains: "patienttest" } } });
  });

  it("1. Authenticated patient can retrieve own profile", async () => {
    const res = await request(app)
      .get("/api/patient/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe("User");
    expect(res.body.lastName).toBe("A");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("2. Unauthenticated request is rejected", async () => {
    const res = await request(app).get("/api/patient/profile");
    expect(res.status).toBe(401);
  });

  it("3/4. Valid profile update succeeds and patient cannot access/modify another patient's profile", async () => {
    // Attempt to update A's profile using A's token
    const resUpdate = await request(app)
      .patch("/api/patient/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        firstName: "UserAUpdated",
        phone: "1234567890",
        dateOfBirth: "1990-01-01T00:00:00Z"
      });

    expect(resUpdate.status).toBe(200);
    expect(resUpdate.body.firstName).toBe("UserAUpdated");
    expect(resUpdate.body.phone).toBe("1234567890");

    // Try to update B's profile using A's token by spoofing in body?
    // Since the API only uses `req.user.id`, spoofing `userId: userB.id` in the body shouldn't do anything to B.
    const spoofRes = await request(app)
      .patch("/api/patient/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        userId: userB.id,
        firstName: "HackedByA"
      });
    
    // Zod will strip or throw error if extra fields, but either way it updates A's profile (or fails validation), NOT B's.
    // patientProfileUpdateSchema has .strict() so it will fail 400.
    expect(spoofRes.status).toBe(400);

    // Verify B is untouched
    const checkB = await request(app)
      .get("/api/patient/profile")
      .set("Authorization", `Bearer ${userB.accessToken}`);
    
    expect(checkB.body.firstName).toBe("User");
  });

  it("5. Invalid profile data is rejected", async () => {
    const res = await request(app)
      .patch("/api/patient/profile")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        dateOfBirth: "not-a-date"
      });

    expect(res.status).toBe(400);
  });
});
