import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { databaseClient } from '../src/config/database.js';
import { pollOutbox } from '../src/jobs/outbox-poller.js';
import { processAllMockJobs } from '../src/jobs/queue.js';

describe('ABDM Interoperability (Step 28B)', () => {
  const prisma = databaseClient.getClient();
  let token = '';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  let patientId = '';

  beforeAll(async () => {
    await prisma.externalExchangeTransaction.deleteMany();
    await prisma.externalIdentity.deleteMany({ where: { externalSystem: 'ABDM' } });
    await prisma.outboxEvent.deleteMany();
    const email = `abmd_test_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      email,
      password: 'ValidPass1!',
      role: 'PATIENT',
      firstName: 'ABDM',
      lastName: 'Test'
    });
    
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'ValidPass1!'
    });
    token = loginRes.body.accessToken;
    patientId = loginRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.externalExchangeTransaction.deleteMany();
    await prisma.externalIdentity.deleteMany({ where: { externalSystem: 'ABDM' } });
    await prisma.outboxEvent.deleteMany();
  });

  it('1. Should reject invalid OTP during ABHA linking', async () => {
    const res = await request(app)
      .post('/api/interoperability/abdm/identity/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ abhaAddress: 'test@abdm', otp: 'wrong otp' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid OTP for ABHA linking');
  });

  it('2. Should link ABHA address with valid OTP', async () => {
    const res = await request(app)
      .post('/api/interoperability/abdm/identity/link')
      .set('Authorization', `Bearer ${token}`)
      .send({ abhaAddress: 'test@abdm', otp: '123456' });
    if (res.status !== 200) console.log('ERROR:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('3. Should create consent request transaction', async () => {
    const res = await request(app)
      .post('/api/interoperability/abdm/consent/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ abhaAddress: 'test@abdm', purpose: 'Clinical Review' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transaction.status).toBe('REQUESTED');

    // Run outbox poller and mock worker
    await pollOutbox();
    await processAllMockJobs();

    // Query DB for updated status
    const dbTx = await prisma.externalExchangeTransaction.findUnique({
      where: { id: res.body.transaction.id }
    });
    expect(dbTx!.status).toBe('COMPLETED');
    expect(dbTx!.correlationId).not.toBeNull();
  });
});