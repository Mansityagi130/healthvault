import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
const prisma = databaseClient.getClient();

describe("Hospital Clinical Workflow Integration (Step 21B)", () => {
  let patient: any;
  let provider: any;
  let hospitalStaff: any;
  let otherHospitalStaff: any;
  let hospitalA: any;
  let hospitalB: any;
  let encounterId: string;
  let pairingToken: any;

  async function registerAndLogin(email: string) {
    const res = await request(app).post("/api/auth/register").send({
      email,
      password: "password123",
      firstName: "Test",
      lastName: "User",
      dateOfBirth: "1990-01-01",
      sexAtBirth: "MALE"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "password123"
    });
    return {
      id: loginRes.body.user.id,
      accessToken: loginRes.body.accessToken,
      profileId: loginRes.body.patientProfile?.id
    };
  }

  beforeAll(async () => {
    patient = await registerAndLogin(`patient_enc_${Date.now()}@example.com`);
    const prof = await prisma.patientProfile.findUnique({ where: { userId: patient.id } });
    if (prof) patient.profileId = prof.id;
    provider = await registerAndLogin(`provider_enc_${Date.now()}@example.com`);
    hospitalStaff = await registerAndLogin(`staff_enc_${Date.now()}@example.com`);
    otherHospitalStaff = await registerAndLogin(`otherstaff_enc_${Date.now()}@example.com`);

    await prisma.doctorProfile.create({
      data: {
        userId: provider.id,
        registrationNumber: `REG-${Date.now()}`,
        specialty: "General Medicine"
      }
    });

    hospitalA = await prisma.hospital.create({ data: { name: "Hospital A" } });
    hospitalB = await prisma.hospital.create({ data: { name: "Hospital B" } });

    await prisma.hospitalMembership.create({
      data: { userId: hospitalStaff.id, hospitalId: hospitalA.id, role: "STAFF", status: "ACTIVE" }
    });
    await prisma.hospitalMembership.create({
      data: { userId: provider.id, hospitalId: hospitalA.id, role: "DOCTOR", status: "ACTIVE" }
    });
    await prisma.hospitalMembership.create({
      data: { userId: otherHospitalStaff.id, hospitalId: hospitalB.id, role: "STAFF", status: "ACTIVE" }
    });
  });

  afterAll(async () => {
    const hospIds = [hospitalA?.id, hospitalB?.id].filter(Boolean) as string[];
    await prisma.consultation.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.medicalRecord.deleteMany({ where: { hospitalId: { in: hospIds } } });
    await prisma.encounter.deleteMany({ where: { hospitalId: { in: hospIds } } });
    await prisma.registrationPairingToken.deleteMany({ where: { patientId: patient?.profileId } });
    await prisma.hospitalMembership.deleteMany({ where: { hospitalId: { in: hospIds } } });
    await prisma.hospital.deleteMany({ where: { id: { in: hospIds } } });
  });

  it("1. Patient creates registration token", async () => {
    const res = await request(app)
      .post("/api/patient/registration-token")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({ expiresInMinutes: 15 });

    expect(res.status).toBe(201);
    expect(res.body.selector).toBeDefined();
    expect(res.body.token).toBeDefined();
    pairingToken = res.body;
  });

  it("2. Hospital B staff cannot consume token for Hospital A", async () => {
    // Other staff belongs to Hospital B. Try to consume for Hospital A.
    const res = await request(app)
      .post(`/api/hospitals/${hospitalA.id}/registration/consume`)
      .set("Authorization", `Bearer ${otherHospitalStaff.accessToken}`)
      .send({ selector: pairingToken.selector, token: pairingToken.token });

    expect(res.status).toBe(403);
  });

  it("3. Hospital A staff consumes token successfully", async () => {
    const res = await request(app)
      .post(`/api/hospitals/${hospitalA.id}/registration/consume`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({ selector: pairingToken.selector, token: pairingToken.token });

    expect(res.status).toBe(200);
    expect(res.body.patient.id).toBe(patient.profileId);
  });

  it("4. Consumed token cannot be reused (replay protection)", async () => {
    const res = await request(app)
      .post(`/api/hospitals/${hospitalA.id}/registration/consume`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({ selector: pairingToken.selector, token: pairingToken.token });

    expect(res.status).toBe(400); // Invalid or expired
  });

  it("5. Hospital staff creates Encounter", async () => {
    const res = await request(app)
      .post(`/api/hospitals/${hospitalA.id}/encounters`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({
        patientId: patient.profileId,
        providerId: provider.id,
        type: "OUTPATIENT",
        reason: "Routine Checkup"
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("SCHEDULED");
    encounterId = res.body.id;
  });

  it("6. Encounter lifecycle transition: SCHEDULED -> CHECKED_IN", async () => {
    const res = await request(app)
      .patch(`/api/hospitals/${hospitalA.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({ status: "CHECKED_IN" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CHECKED_IN");
  });

  it("7. Encounter lifecycle transition: CHECKED_IN -> IN_PROGRESS", async () => {
    const res = await request(app)
      .patch(`/api/hospitals/${hospitalA.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({ status: "IN_PROGRESS" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("IN_PROGRESS");
  });

  it("8. Provider authors consultation on IN_PROGRESS encounter", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterId}/consultations`)
      .set("Authorization", `Bearer ${provider.accessToken}`)
      .send({
        chiefComplaint: "Headache",
        clinicalNotes: "Patient complains of mild headache.",
        assessment: "Tension headache",
        plan: "Rest and hydration"
      });

    expect(res.status).toBe(201);
    expect(res.body.provenanceStatus).toBe("PROVIDER_CREATED");
  });

  it("9. Complete Encounter", async () => {
    const res = await request(app)
      .patch(`/api/hospitals/${hospitalA.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${hospitalStaff.accessToken}`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMPLETED");
  });

  it("10. Cannot author clinical records on COMPLETED encounter", async () => {
    const res = await request(app)
      .post(`/api/provider/encounters/${encounterId}/prescriptions`)
      .set("Authorization", `Bearer ${provider.accessToken}`)
      .send({
        instructions: "Take with water",
        items: [
          { medicationName: "Ibuprofen", dosage: "200mg", frequency: "q6h", duration: "3 days", quantity: 12 }
        ]
      });

    expect(res.status).toBe(400); // Only IN_PROGRESS or ACTIVE
  });
});
