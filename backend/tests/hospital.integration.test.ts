import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { MembershipRole, MembershipStatus } from "../src/generated/prisma/enums.js";

const prisma = databaseClient.getClient();

describe("Organization & Tenant Security", () => {
  let docA: { id: string; accessToken: string };
  let docB: { id: string; accessToken: string };
  let hospA: unknown;
  let hospB: unknown;
  let deptA: unknown;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    
    
    
    
    
    const resA = await request(app).post("/api/auth/register").send({
      email: "docA@orgtest.com", password: "securepassword123", firstName: "Doc", lastName: "A"
    });
    const loginA = await request(app).post("/api/auth/login").send({
      email: "docA@orgtest.com", password: "securepassword123"
    });
    docA = { id: resA.body.user.id, accessToken: loginA.body.accessToken };

    const resB = await request(app).post("/api/auth/register").send({
      email: "docB@orgtest.com", password: "securepassword123", firstName: "Doc", lastName: "B"
    });
    const loginB = await request(app).post("/api/auth/login").send({
      email: "docB@orgtest.com", password: "securepassword123"
    });
    docB = { id: resB.body.user.id, accessToken: loginB.body.accessToken };

    hospA = await prisma.hospital.create({ data: { name: "Hospital A", code: "HOSP-A" } });
    hospB = await prisma.hospital.create({ data: { name: "Hospital B", code: "HOSP-B" } });

    deptA = await prisma.department.create({ data: { hospitalId: hospA.id, name: "Cardiology", code: "CARD-A" } });

    await prisma.hospitalMembership.create({
      data: { hospitalId: hospA.id, departmentId: deptA.id, userId: docA.id, role: MembershipRole.DOCTOR, status: MembershipStatus.ACTIVE }
    });
    await prisma.hospitalMembership.create({
      data: { hospitalId: hospB.id, userId: docB.id, role: MembershipRole.HOSPITAL_ADMIN, status: MembershipStatus.ACTIVE }
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab" CASCADE;`);

    
    
    
    
    
    });

  it("1. Hospital Admin A cannot view Hospital B members", async () => {
    const res = await request(app).get(`/api/hospitals/${hospA.id}/members`).set("Authorization", `Bearer ${docB.accessToken}`);
    expect(res.status).toBe(403);
  });

  it("3. Hospital Admin cannot create membership in another hospital", async () => {
    const res = await request(app).post(`/api/hospitals/${hospA.id}/members`).set("Authorization", `Bearer ${docB.accessToken}`).send({
      email: "docA@orgtest.com",
      role: MembershipRole.DOCTOR
    });
    expect(res.status).toBe(403);
  });

  it("12. Nonexistent provider returns 404 on add", async () => {
    await prisma.hospitalMembership.updateMany({
      where: { userId: docA.id, hospitalId: hospA.id },
      data: { role: MembershipRole.HOSPITAL_ADMIN }
    });

    const res = await request(app).post(`/api/hospitals/${hospA.id}/members`).set("Authorization", `Bearer ${docA.accessToken}`).send({
      email: "nobody@orgtest.com",
      role: MembershipRole.DOCTOR
    });
    expect(res.status).toBe(404);
  });

  it("10. Cross-hospital department assignment fails", async () => {
    const res = await request(app).post(`/api/hospitals/${hospB.id}/members`).set("Authorization", `Bearer ${docB.accessToken}`).send({
      email: "docA@orgtest.com",
      role: MembershipRole.DOCTOR,
      departmentId: deptA.id
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid department");
  });

  it("Add valid provider", async () => {
    const res = await request(app).post(`/api/hospitals/${hospB.id}/members`).set("Authorization", `Bearer ${docB.accessToken}`).send({
      email: "docA@orgtest.com",
      role: MembershipRole.DOCTOR
    });
    expect(res.status).toBe(201);
  });

  it("11. Duplicate membership is rejected", async () => {
    const res = await request(app).post(`/api/hospitals/${hospB.id}/members`).set("Authorization", `Bearer ${docB.accessToken}`).send({
      email: "docA@orgtest.com",
      role: MembershipRole.DOCTOR
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already a member");
  });

  it("6/7. Cannot promote themselves or modify own membership", async () => {
    const membership = await prisma.hospitalMembership.findFirst({ where: { userId: docB.id, hospitalId: hospB.id }});
    const res = await request(app).patch(`/api/hospitals/${hospB.id}/members/${membership?.id}`).set("Authorization", `Bearer ${docB.accessToken}`).send({
      role: MembershipRole.STAFF
    });
    expect(res.status).toBe(403);
  });
});
