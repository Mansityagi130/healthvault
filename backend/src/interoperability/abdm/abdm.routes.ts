import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { AbdmService } from './abdm.service.js';
import { databaseClient } from '../../config/database.js';

const router = Router();

router.use(authenticate);

router.post('/identity/link', async (req: Request, res: Response) => {
  try {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const user = (req as any).user;
    const { abhaAddress, otp } = req.body;
    
    if (!abhaAddress || !otp) {
      return res.status(400).json({ error: 'Missing abhaAddress or otp' });
    }

    const identity = await AbdmService.linkIdentity(user.id, abhaAddress, otp);
    res.status(200).json({ success: true, identity });
  } catch (e: unknown) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.post('/consent/request', async (req: Request, res: Response) => {
  try {
    const { abhaAddress, purpose } = req.body;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    const authUser = (req as any).user;

    if (!abhaAddress || !purpose) {
      return res.status(400).json({ error: 'Missing abhaAddress or purpose' });
    }

    const profile = await databaseClient.getClient().patientProfile.findUnique({ where: { userId: authUser.id } });
    if (!profile) return res.status(404).json({ error: 'Patient profile not found' });

    const transaction = await AbdmService.requestConsent(profile.id, abhaAddress, purpose);
    res.status(200).json({ success: true, transaction });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  } catch (e: unknown) {
    res.status(500).json({ error: 'Failed to request consent' });
  }
});

export default router;
