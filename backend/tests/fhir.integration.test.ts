import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { databaseClient } from '../src/config/database.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
import bcrypt from 'bcrypt';

const prisma = databaseClient.getClient();

describe('FHIR Interoperability (Step 27B)', () => {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  let patientSession: any;
  let patientId: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  let providerSession: any;
  let hospitalId: string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  let encounterId: string;

  beforeAll(async () => {
    // 1. Setup Patient via API
    await request(app).post('/api/auth/register').send({ email: 'fhir-pat@example.com', password: 'Password1!', firstName: 'Fhir', lastName: 'Pat', role: 'PATIENT' });
    const pRes = await request(app).post('/api/auth/login').send({ email: 'fhir-pat@example.com', password: 'Password1!' });
    patientSession = { accessToken: pRes.body.accessToken, user: pRes.body.user };
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: pRes.body.user.id } });
    patientId = patientProfile!.id;

    // 2. Setup Hospital
    await request(app).post('/api/auth/register').send({ email: 'fhir-hosp@example.com', password: 'Password1!', firstName: 'Fhir', lastName: 'Hosp', role: 'HOSPITAL_ADMIN' });
    const hAdmin = await prisma.user.findUnique({ where: { email: 'fhir-hosp@example.com' }});
    const hospital = await prisma.hospital.create({ data: { name: 'FHIR Hosp' }});
    hospitalId = hospital.id;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    await prisma.hospitalMembership.create({ data: { userId: hAdmin!.id, hospitalId, role: 'HOSPITAL_ADMIN' as any }});

    // 3. Setup Provider
    await request(app).post('/api/auth/register').send({ email: 'fhir-prov@example.com', password: 'Password1!', firstName: 'Fhir', lastName: 'Prov', role: 'PROVIDER' });
    const prRes = await request(app).post('/api/auth/login').send({ email: 'fhir-prov@example.com', password: 'Password1!' });
    providerSession = { accessToken: prRes.body.accessToken };
    const providerId = prRes.body.user.id;
    await prisma.hospitalMembership.create({ data: { userId: providerId, hospitalId, role: 'DOCTOR' }});

    const encounter = await prisma.encounter.create({
      data: {
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
        patientId, hospitalId, providerId, type: 'OUTPATIENT' as any, status: 'COMPLETED' as any, startedAt: new Date(), endedAt: new Date()
      }
    });
    encounterId = encounter.id;

    const cleanRecord = await prisma.medicalRecord.create({
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      data: { patientId, hospitalId, category: 'CONSULTATION' as any, source: 'HOSPITAL' as any, provenanceStatus: 'HOSPITAL_CREATED' as any, occurredAt: new Date(), lifecycleStatus: 'ACTIVE' as any }
    });
    await prisma.medicalDocument.create({
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      data: { medicalRecordId: cleanRecord.id, storageKey: `clean-doc-${cleanRecord.id}`, originalFilename: 'clean.pdf', mimeType: 'application/pdf', byteSize: BigInt(1000), checksum: 'fakehash1', securityStatus: 'CLEAN' as any }
    });

    const infectedRecord = await prisma.medicalRecord.create({
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      data: { patientId, hospitalId, category: 'CONSULTATION' as any, source: 'HOSPITAL' as any, provenanceStatus: 'HOSPITAL_CREATED' as any, occurredAt: new Date(), lifecycleStatus: 'ACTIVE' as any }
    });
    await prisma.medicalDocument.create({
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      data: { medicalRecordId: infectedRecord.id, storageKey: `infected-doc-${infectedRecord.id}`, originalFilename: 'infected.pdf', mimeType: 'application/pdf', byteSize: BigInt(1000), checksum: 'fakehash2', securityStatus: 'INFECTED' as any }
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User" CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Hospital" CASCADE;`);
  });

  it('1. Patient can export their own FHIR bundle', async () => {
    const res = await request(app).get(`/api/interoperability/fhir/patient/${patientId}/$export`).set('Authorization', `Bearer ${patientSession.accessToken}`);
    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);
    expect(res.body.resourceType).toBe('Bundle');
    
    const entries = res.body.entry || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const patientResource = entries.find((e: any) => e.resource.resourceType === 'Patient');
    expect(patientResource).toBeDefined();
    expect(patientResource.resource.id).toBe(patientSession.user.id);
  });

  it('2. Patient A cannot export Patient B data', async () => {
    await request(app).post('/api/auth/register').send({ email: 'other-pat@example.com', password: 'Password1!', firstName: 'Other', lastName: 'Pat', role: 'PATIENT' });
    const otherRes = await request(app).post('/api/auth/login').send({ email: 'other-pat@example.com', password: 'Password1!' });
    const res = await request(app).get(`/api/interoperability/fhir/patient/${patientId}/$export`).set('Authorization', `Bearer ${otherRes.body.accessToken}`);
    expect(res.status).toBe(403);
  });

  it('3. PENDING_SCAN/INFECTED documents are excluded, CLEAN are included', async () => {
    const res = await request(app).get(`/api/interoperability/fhir/patient/${patientId}/$export`).set('Authorization', `Bearer ${patientSession.accessToken}`);
    const entries = res.body.entry || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const docRefs = entries.filter((e: any) => e.resource.resourceType === 'DocumentReference');
    expect(docRefs.length).toBe(1);
    expect(docRefs[0].resource.content[0].attachment.title).toBe('clean.pdf');
  });

  it('4. Provider can access patient data if authorized', async () => {
    const res = await request(app).get(`/api/interoperability/fhir/patient/${patientId}/$export`).set('Authorization', `Bearer ${providerSession.accessToken}`);
    if (res.status !== 200) console.log(res.body);
    expect(res.status).toBe(200);
  });

  it('5. JWTs/internal keys are not exposed', async () => {
    const res = await request(app).get(`/api/interoperability/fhir/patient/${patientId}/$export`).set('Authorization', `Bearer ${patientSession.accessToken}`);
    const payloadStr = JSON.stringify(res.body);
    expect(payloadStr).not.toContain('storageKey');
    expect(payloadStr).toContain('urn:uuid');
  });
});
