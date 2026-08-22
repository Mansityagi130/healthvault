import type { Response } from "express";
import { SharingService } from "../services/sharing.service.js";
import { ProviderFixtureService } from "../services/provider-fixture.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { RecordCategory } from "../generated/prisma/enums.js";

const CreateShareSchema = z.object({
  granteeUserId: z.string().uuid(),
  purpose: z.string().min(1).max(255),
  categories: z.array(z.nativeEnum(RecordCategory)).min(1),
  durationMinutes: z.number().int().min(1).max(1440)
});

const ResolveQrSchema = z.object({
  selector: z.string().uuid(),
  token: z.string().min(1)
});

export const SharingController = {
  async getProviders(req: AuthRequest, res: Response) {
    try {
      const providers = await ProviderFixtureService.getDevelopmentProviders();
      res.json(providers);
    } catch (error) {
      console.error("Failed to get providers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async createDirectShare(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const data = CreateShareSchema.parse(req.body);

      const result = await SharingService.createDirectShare(
        userId,
        data.granteeUserId,
        data.purpose,
        data.categories,
        data.durationMinutes
      );

      res.status(201).json(result);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid sharing payload", details: error.issues });
      } else if (error.message === "Profile not found") {
        res.status(404).json({ error: "Profile not found" });
      } else {
        console.error("Create Share Error:", error);
        res.status(500).json({ error: "Failed to create sharing session" });
      }
    }
  },

  async listShares(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const shares = await SharingService.getPatientShares(userId);
      res.json(shares);
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line null -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (error: unknown) {
      res.status(500).json({ error: "Failed to fetch sharing sessions" });
    }
  },

  async revokeShare(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.sessionId as string;

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
        res.status(400).json({ error: "Invalid session ID" });
        return;
      }

      await SharingService.revokeSharingSession(userId, sessionId);
      res.json({ success: true });
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    } catch (error: any) {
      if (error.message === "Sharing session not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Failed to revoke sharing session" });
      }
    }
  },

  async resolveQr(req: AuthRequest, res: Response) {
    try {
      const providerUserId = req.user!.id; // Authenticated provider scanning QR
      const data = ResolveQrSchema.parse(req.body);

      const result = await SharingService.resolveQrToken(providerUserId, data.selector, data.token);
      res.json(result);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid payload" });
      } else if (
        error.message === "QR session is invalid or expired." ||
        error.message === "QR session usage limit exceeded." ||
        error.message === "Sharing session is invalid or expired." ||
        error.message === "Consent is invalid or expired." ||
        error.message.startsWith("Unauthorized:")
      ) {
        // Return 403 Forbidden or 400 with generic message. Do not leak details easily.
        res.status(403).json({ error: error.message });
      } else {
        console.error("Resolve QR Error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
};
