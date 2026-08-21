import { MembershipRole, EncounterType, EncounterStatus } from "../src/generated/prisma/client.js";
import { databaseClient } from "../src/config/database.js";
const prisma = databaseClient.getClient();
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Encounter & Clinical Context Security", () => {
  let adminTokenHospA: string;
  let adminTokenHospB: string;
  let providerTokenHospA: string;
  let providerTokenHospB: string;
  let patientTokenA: string;
  let patientTokenB: string;
  let inactiveProviderToken: string;

  let hospA: any, hospB: any;
  let deptA: any, deptB: any;
  let adminA: any, adminB: any;
  let docA: any, docB: any, inactiveDoc: any;
  let patA: any, patB: any;

  beforeAll(async () => {
    // Create 2 hospitals
    hospA = await prisma.hospital.create({ data: { name: "Hosp A", code: `HA_${Date.now()}`, status: "ACTIVE" } });
    hospB = await prisma.hospital.create({ data: { name: "Hosp B", code: `HB_${Date.now()}`, status: "ACTIVE" } });

    deptA = await prisma.department.create({ data: { name: "Dept A", hospitalId: hospA.id } });
    deptB = await prisma.department.create({ data: { name: "Dept B", hospitalId: hospB.id } });

    let ipCounter = 1;
    const timePrefix = Date.now();
    // Users
    const createPat = async (email: string) => {
      const ip = `10.10.0.${ipCounter++}`;
      await request(app).post("/api/auth/register").set("X-Forwarded-For", ip).send({ email, password: "password123", role: "PATIENT", firstName: "Pat", lastName: "Test" });
      const user = await prisma.user.findUnique({ where: { email } });
      const pat = await prisma.patientProfile.findUnique({ where: { userId: user!.id } });
      const login = await request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({ email, password: "password123" });
      return { user, pat, token: login.body.accessToken };
    };
    
    const p1 = await createPat(`pat_a_${timePrefix}@test.com`); patA = p1.pat; patientTokenA = p1.token;
    const p2 = await createPat(`pat_b_${timePrefix}@test.com`); patB = p2.pat; patientTokenB = p2.token;

    const createDoc = async (email: string, hospId: string, role: MembershipRole, deptId?: string, status: string = "ACTIVE") => {
      const res = await request(app).post("/api/auth/register").send({
        email, password: "securepassword123", firstName: "Doc", lastName: "User", role: "PROVIDER", medicalLicenseNumber: `12345_${Date.now()}`
      });
      const loginRes = await request(app).post("/api/auth/login").send({ email, password: "securepassword123" });
      const user = await prisma.user.findUnique({ where: { email } });
      const token = loginRes.body.accessToken;
      await prisma.hospitalMembership.create({ data: { userId: user!.id, hospitalId: hospId, role, departmentId: deptId, status: status as any } });
      return { user, token };
    };

    const d1 = await createDoc(`admin_a_${timePrefix}@test.com`, hospA.id, MembershipRole.HOSPITAL_ADMIN); adminA = d1.user; adminTokenHospA = d1.token;
    const d2 = await createDoc(`admin_b_${timePrefix}@test.com`, hospB.id, MembershipRole.HOSPITAL_ADMIN); adminB = d2.user; adminTokenHospB = d2.token;
    const d3 = await createDoc(`doc_a_${timePrefix}@test.com`, hospA.id, MembershipRole.DOCTOR, deptA.id); docA = d3.user; providerTokenHospA = d3.token;
    const d4 = await createDoc(`doc_b_${timePrefix}@test.com`, hospB.id, MembershipRole.DOCTOR, deptB.id); docB = d4.user; providerTokenHospB = d4.token;
    const d5 = await createDoc(`doc_inactive_${timePrefix}@test.com`, hospA.id, MembershipRole.DOCTOR, deptA.id, "INACTIVE"); inactiveDoc = d5.user; inactiveProviderToken = d5.token;
  });

  describe("Encounter Creation", () => {
    it("1. Admin A can create encounter for Patient A in Hosp A with Doc A", async () => {
      const res = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({
          patientId: patA.id,
          type: "OUTPATIENT",
          reason: "Checkup",
          providerId: docA.id,
          departmentId: deptA.id
        });
      expect(res.status).toBe(201);
      expect(res.body.patientId).toBe(patA.id);
      expect(res.body.providerId).toBe(docA.id);
      expect(res.body.status).toBe("SCHEDULED");
    });

    it("2. Cross-hospital provider rejection: Admin A cannot assign Doc B to Hosp A encounter", async () => {
      const res = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({
          patientId: patA.id,
          type: "OUTPATIENT",
          providerId: docB.id,
          departmentId: deptA.id
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("not an active member");
    });

    it("3. Department ownership: Cannot assign Dept B to Hosp A encounter", async () => {
      const res = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({
          patientId: patA.id,
          type: "OUTPATIENT",
          departmentId: deptB.id
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid department");
    });

    it("4. Inactive provider rejection: Cannot assign inactive doc", async () => {
      const res = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({
          patientId: patA.id,
          type: "OUTPATIENT",
          providerId: inactiveDoc.id
        });
      expect(res.status).toBe(400);
    });
  });

  describe("Encounter Lifecycle & Status transitions", () => {
    let encId: string;
    beforeAll(async () => {
      const res = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ patientId: patA.id, type: "OUTPATIENT", providerId: docA.id });
      encId = res.body.id;
      if (!encId) console.log("Failed to create encounter in beforeAll:", res.body);
    });

    it("5. SCHEDULED -> CHECKED_IN is allowed", async () => {
      const res = await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "CHECKED_IN" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CHECKED_IN");
    });

    it("6. CHECKED_IN -> IN_PROGRESS is allowed", async () => {
      const res = await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "IN_PROGRESS" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("IN_PROGRESS");
      expect(res.body.startedAt).toBeDefined();
    });

    it("7. IN_PROGRESS -> CANCELLED is rejected", async () => {
      const res = await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "CANCELLED" });
      expect(res.status).toBe(400);
    });

    it("8. IN_PROGRESS -> COMPLETED is allowed", async () => {
      // First, set it back to IN_PROGRESS (since the previous test cancelled it, let's just create a new one or modify status, wait, CANCELLED -> COMPLETED is not allowed!)
      // Let's just create a new encounter for this test
      const encRes = await request(app)
        .post(`/api/hospitals/${hospA.id}/encounters`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({
          patientId: patA.id,
          providerId: docA.id,
          type: "INPATIENT",
          reason: "Test complete"
        });
      const encId2 = encRes.body.id;

      await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId2}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "CHECKED_IN" });
      await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId2}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "IN_PROGRESS" });

      const res = await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId2}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "COMPLETED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("COMPLETED");
      expect(res.body.endedAt).toBeDefined();
      
      // Also check that COMPLETED -> IN_PROGRESS is not allowed
      const res2 = await request(app)
        .patch(`/api/hospitals/${hospA.id}/encounters/${encId2}`)
        .set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ status: "IN_PROGRESS" });
      expect(res2.status).toBe(400);
    });
  });

  describe("Cross-tenant and Access Isolation", () => {
    it("9. Provider gets only their assigned active encounters", async () => {
      await request(app).post(`/api/hospitals/${hospA.id}/encounters`).set("Authorization", `Bearer ${adminTokenHospA}`)
        .send({ patientId: patA.id, type: "OUTPATIENT", providerId: docA.id });

      const res = await request(app).get("/api/provider/encounters").set("Authorization", `Bearer ${providerTokenHospA}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].providerId).toBe(docA.id);
    });

    it("10. Patient gets only their own encounters", async () => {
      const res = await request(app).get("/api/patient/encounters").set("Authorization", `Bearer ${patientTokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].patientId).toBe(patA.id);

      const resB = await request(app).get("/api/patient/encounters").set("Authorization", `Bearer ${patientTokenB}`);
      expect(resB.status).toBe(200);
      expect(resB.body.length).toBe(0);
    });
  });
});
