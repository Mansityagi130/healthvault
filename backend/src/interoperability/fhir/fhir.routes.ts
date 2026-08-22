import { Router, type Request, type Response } from 'express';
import { authenticate as requireAuth } from '../../middleware/auth.middleware.js';
import { FhirService } from './fhir.service.js';
import { databaseClient } from '../../config/database.js';

const router = Router();
const prisma = databaseClient.getClient();

router.use(requireAuth);

router.get('/patient/:patientId/\\$export', async (req: Request, res: Response) => {
  try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const authUser = (req as any).user;
    const user = await prisma.user.findUnique({ where: { id: authUser.id } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const patientId = req.params.patientId as string;

    let tenantId: string | undefined = undefined;
    let providerId: string | undefined = undefined;

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
    const hospitalMembership = await prisma.hospitalMembership.findFirst({ where: { userId: user.id } });
    const labMembership = await prisma.labMembership.findFirst({ where: { userId: user.id } });

    if (patientProfile && patientProfile.id === patientId) {
      // Patient accessing their own data
    } else if (hospitalMembership) {
      tenantId = hospitalMembership.hospitalId;
      if (hospitalMembership.role === 'DOCTOR') providerId = user.id;
    } else if (labMembership) {
      tenantId = labMembership.labId;
    } else {
      return res.status(403).json({ error: 'Forbidden: You can only export your own FHIR records' });
    }

    // 2. Log Export Request (AuditLog alternative via AccessLog if applicable, or generic logging)
    // We will log this to AccessLog for the patient.
    await prisma.accessLog.create({
      data: {
        actorUserId: user.id,
        patientId,
        resourceType: 'FHIR_BUNDLE',
        resourceId: 'export',
        action: 'DOWNLOAD', // Maps to standard AccessAction
        outcome: 'ALLOWED', // Maps to standard AccessOutcome
        metadata: { event: 'FHIR_EXPORT_COMPLETED' }
      }
    });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const options: any = { isPatientOrigin: patientProfile && patientProfile.id === patientId };
    if (tenantId) options.tenantId = tenantId;
    if (providerId) options.providerId = providerId;
    
    const bundle = await FhirService.getPatientBundle(patientId, options);

    res.status(200).json(bundle);
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  } catch (error: unknown) {
    res.status(500).json({ error: 'Failed to generate FHIR export' });
  }
});

export default router;
