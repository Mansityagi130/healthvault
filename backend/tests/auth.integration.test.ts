import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";

const prisma = databaseClient.getClient();

describe("Auth Endpoints", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    
    });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    
    await databaseClient.disconnect();
  });

  let userTokens: { accessToken: string; refreshTokenCookie: string };

  it("POST /api/auth/register should create a new patient", async () => {
    const res = await request(app).post("/api/auth/register")
      .set("X-Forwarded-For", "192.168.3.1")
      .send({
      email: "test@example.com",
      password: "securepassword123",
      firstName: "John",
      lastName: "Doe"
    });

    if (res.status !== 201) console.error("REGISTER ERROR BODY:", res.body);

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.email).toBe("test@example.com");
  });

  it("2. Prevents duplicate email registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: "test@example.com", // same email
        password: "anotherpassword123",
        firstName: "Duplicate",
        lastName: "User"
      });
    
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Account already exists");
  });

  it("3. Authenticates valid user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
        password: "securepassword123",
      });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.email).toBe("test@example.com");
    userTokens = {
      accessToken: res.body.accessToken,
      refreshTokenCookie: res.headers["set-cookie"][0].split(";")[0],
    };
  });

  it("4. Rejects invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });

  it("POST /api/auth/refresh should issue new access token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [userTokens.refreshTokenCookie]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.headers["set-cookie"]).toBeDefined();
    
    // Update cookies
    userTokens.refreshTokenCookie = res.headers["set-cookie"][0].split(";")[0];
    userTokens.accessToken = res.body.accessToken;
  });

  it("GET /api/auth/me should return user details", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${userTokens.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("id");
  });

  it("POST /api/auth/logout should revoke session", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${userTokens.accessToken}`);

    expect(res.status).toBe(200);
  });

  it("POST /api/auth/refresh should fail with revoked token", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [userTokens.refreshTokenCookie]);

    expect(res.status).toBe(401);
  });
});
