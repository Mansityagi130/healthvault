import type { Response } from "express";
import { ProviderService } from "../services/provider.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { LocalStorageProvider } from "../services/storage/LocalStorageProvider.js";

const storageProvider = new LocalStorageProvider();

export const ProviderController = {
  async listSessions(req: AuthRequest, res: Response) {
    try {
      const providerId = req.user!.id;
      const sessions = await ProviderService.getSharedSessions(providerId);
      res.json(sessions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async getSessionContext(req: AuthRequest, res: Response) {
    try {
      const providerId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const context = await ProviderService.getSharedSessionContext(providerId, sessionId);
      res.json(context);
    } catch (error: any) {
      if (error.message === "Unauthorized" || error.message.includes("expired") || error.message.includes("not approved")) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  },

  async getSharedRecords(req: AuthRequest, res: Response) {
    try {
      const providerId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const records = await ProviderService.getSharedRecords(providerId, sessionId);
      res.json(records);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  },

  async getSharedRecordDetail(req: AuthRequest, res: Response) {
    try {
      const providerId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const recordId = req.params.recordId as string;
      const record = await ProviderService.getSharedRecordDetail(providerId, sessionId, recordId);
      res.json(record);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  },

  async getSharedDocument(req: AuthRequest, res: Response) {
    try {
      const providerId = req.user!.id;
      const sessionId = req.params.sessionId as string;
      const documentId = req.params.documentId as string;
      const doc = await ProviderService.getSharedDocument(providerId, sessionId, documentId);
      
      const exists = await storageProvider.exists(doc.storageKey);
      if (!exists) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const buffer = await storageProvider.get(doc.storageKey);
      res.setHeader("Content-Type", doc.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${doc.originalFilename}"`);
      res.send(buffer);
    } catch (error: any) {
      res.status(403).json({ error: error.message });
    }
  }
};
