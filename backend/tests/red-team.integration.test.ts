import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { databaseClient } from "../src/config/database.js";
import { 
  RecordCategory, 
  RecordSource, 
  ProvenanceStatus
} from "../src/generated/prisma/enums.js";
import { generate } from "otplib";

const prisma = databaseClient.getClient();

describe("Red-Team Security Hardening Tests (Step 31)", () => {
  let patient: { id: string; accessToken: string; profileId: string };
  let provider: { id: string; accessToken: string };
  let staff: { id: string; accessToken: string };
  let hospital: { id: string };
  let encounterId: string;
  let cleanRecordId: string;
  let verifiedRecordId: string;
  let cleanDocId: string;
  let uncleanDocId: string;

  async function registerAndLogin(email: string) {
    await request(app).post("/api/auth/register").send({
      email,
      password: "Password123!",
      firstName: "Test",
      lastName: "User"
    });
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password: "Password123!"
    });
    return {
      id: loginRes.body.user.id,
      accessToken: loginRes.body.accessToken,
      profileId: loginRes.body.patientProfile?.id || ""
    };
  }

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);

    patient = await registerAndLogin(`patient_rt_${Date.now()}@example.com`);
    const prof = await prisma.patientProfile.findUnique({ where: { userId: patient.id } });
    if (prof) patient.profileId = prof.id;

    provider = await registerAndLogin(`provider_rt_${Date.now()}@example.com`);
    staff = await registerAndLogin(`staff_rt_${Date.now()}@example.com`);

    await prisma.doctorProfile.create({
      data: {
        userId: provider.id,
        registrationNumber: `REG-RT-${Date.now()}`,
        specialty: "General Medicine"
      }
    });

    hospital = await prisma.hospital.create({ data: { name: "Red-Team Hospital" } });

    await prisma.hospitalMembership.create({
      data: { userId: staff.id, hospitalId: hospital.id, role: "STAFF", status: "ACTIVE" }
    });
    await prisma.hospitalMembership.create({
      data: { userId: provider.id, hospitalId: hospital.id, role: "DOCTOR", status: "ACTIVE" }
    });

    // Create an encounter
    const encRes = await request(app)
      .post(`/api/hospitals/${hospital.id}/encounters`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({
        patientId: patient.profileId,
        type: "OUTPATIENT",
        reason: "Routine Security Scan",
        providerId: provider.id
      });
    encounterId = encRes.body.id;

    // Create a patient record (patient uploaded)
    const recRes = await request(app)
      .post("/api/patient/records")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        category: RecordCategory.LAB_REPORT,
        title: "Clean Uploaded Record",
        occurredAt: new Date().toISOString()
      });
    cleanRecordId = recRes.body.id;

    // Create clean and unclean documents
    const cleanDoc = await prisma.medicalDocument.create({
      data: {
        id: crypto.randomUUID(),
        medicalRecordId: cleanRecordId,
        storageKey: `approved/patients/${patient.profileId}/records/${cleanRecordId}/clean`,
        originalFilename: "clean.pdf",
        mimeType: "application/pdf",
        byteSize: 100,
        checksum: "clean-hash",
        securityStatus: "CLEAN"
      }
    });
    cleanDocId = cleanDoc.id;

    const uncleanDoc = await prisma.medicalDocument.create({
      data: {
        id: crypto.randomUUID(),
        medicalRecordId: cleanRecordId,
        storageKey: `quarantine/patients/${patient.profileId}/records/${cleanRecordId}/dirty`,
        originalFilename: "eicar.com",
        mimeType: "application/pdf",
        byteSize: 68,
        checksum: "eicar-hash",
        securityStatus: "INFECTED"
      }
    });
    uncleanDocId = uncleanDoc.id;

    // Create a verified clinical record (hospital created)
    const vRec = await prisma.medicalRecord.create({
      data: {
        patientId: patient.profileId,
        category: RecordCategory.CONSULTATION,
        source: RecordSource.DOCTOR,
        provenanceStatus: ProvenanceStatus.PROVIDER_CREATED,
        createdByUserId: provider.id,
        title: "Clinical Consultation",
        occurredAt: new Date(),
        encounterId
      }
    });
    verifiedRecordId = vRec.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User", "Hospital", "Lab", "OutboxEvent" CASCADE;`);
    await databaseClient.disconnect();
  });

  it("1. Completed encounters must be immutable", async () => {
    // 1. Move encounter to active
    await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({ status: "CHECKED_IN" });

    await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({ status: "IN_PROGRESS" });

    // 2. Complete encounter
    await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({ status: "COMPLETED" });

    // 3. Try to re-assign or update completed encounter
    const res = await request(app)
      .patch(`/api/hospitals/${hospital.id}/encounters/${encounterId}`)
      .set("Authorization", `Bearer ${staff.accessToken}`)
      .send({ departmentId: "some-dept" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("completed or cancelled");
  });

  it("2. Verified clinical records must be immutable", async () => {
    const res = await request(app)
      .patch(`/api/patient/records/${verifiedRecordId}`)
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({ title: "Forged Title" });

    expect(res.status).toBe(500); // RecordService throws Error("Cannot modify verified clinical records")
  });

  it("3. Unsafe documents cannot be downloaded by patients", async () => {
    const resClean = await request(app)
      .get(`/api/patient/documents/${cleanDocId}`)
      .set("Authorization", `Bearer ${patient.accessToken}`);
    // Should attempt to fetch but since local file doesn't exist it might fail at storage level.
    expect(resClean.status).not.toBe(403); 

    const resDirty = await request(app)
      .get(`/api/patient/documents/${uncleanDocId}`)
      .set("Authorization", `Bearer ${patient.accessToken}`);
    expect(resDirty.status).toBe(403);
    expect(resDirty.body.error).toContain("security status");
  });

  it("4. Unsafe documents cannot be downloaded by providers through sharing", async () => {
    // 1. Create a direct sharing session
    const shareRes = await request(app)
      .post("/api/patient/sharing")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({
        granteeUserId: provider.id,
        purpose: "Red-Team Audit",
        categories: [RecordCategory.LAB_REPORT],
        durationMinutes: 60
      });
    expect(shareRes.status).toBe(201);
    const session = shareRes.body.session;

    // 2. Try to get unclean doc
    const resDirty = await request(app)
      .get(`/api/provider/sessions/${session.id}/documents/${uncleanDocId}`)
      .set("Authorization", `Bearer ${provider.accessToken}`);
    expect(resDirty.status).toBe(403);
    expect(resDirty.body.error).toContain("security status");
  });

  it("5. FHIR exports must filter out non-clean documents", async () => {
    const fhirRes = await request(app)
      .get(`/api/interoperability/fhir/Patient/${patient.profileId}/$export`)
      .set("Authorization", `Bearer ${patient.accessToken}`);
    
    expect(fhirRes.status).toBe(200);
    const bundle = fhirRes.body;
    expect(bundle.resourceType).toBe("Bundle");

    // Count DocumentReference resources
    const docRefs = bundle.entry.filter((e: { resource: { resourceType: string } }) => e.resource.resourceType === "DocumentReference");
    // Clean doc should be exported, unclean should be ignored
    expect(docRefs.length).toBe(1);
    expect(docRefs[0].resource.content[0].attachment.title).toContain("clean.pdf");
  });

  it("6. Current session must be preserved when disabling MFA", async () => {
    // 1. Enroll user in MFA
    const enroll = await request(app)
      .post("/api/auth/mfa/enroll")
      .set("Authorization", `Bearer ${patient.accessToken}`);
    const secret = enroll.body.secret;
    const code = await generate({ secret });

    // 2. Confirm MFA
    const confirm = await request(app)
      .post("/api/auth/mfa/confirm")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({ code });
    expect(confirm.status).toBe(200);

    // 3. Perform step-up
    const stepUp = await request(app)
      .post("/api/auth/step-up/verify")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .send({ password: "Password123!", code });
    const stepUpToken = stepUp.body.stepUpToken;

    // 4. Disable MFA
    const disable = await request(app)
      .post("/api/auth/mfa/disable")
      .set("Authorization", `Bearer ${patient.accessToken}`)
      .set("x-step-up-token", stepUpToken);
    expect(disable.status).toBe(200);

    // 5. Patient session must still be active!
    const checkActive = await request(app)
      .get("/api/patient/profile")
      .set("Authorization", `Bearer ${patient.accessToken}`);
    expect(checkActive.status).toBe(200);
  });
});
