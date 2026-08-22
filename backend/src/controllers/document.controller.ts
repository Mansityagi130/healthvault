import type { Response } from "express";
import { DocumentService } from "../services/document.service.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const DocumentController = {
  async upload(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const recordId = req.params.recordId as string;

      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
        res.status(400).json({ error: "Invalid record ID" });
        return;
      }

      const document = await DocumentService.uploadDocument(userId, recordId, req.file);
      res.status(201).json(document);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    } catch (error: any) {
      if (
        error.message === "Record not found" || 
        error.message === "Profile not found"
      ) {
        res.status(404).json({ error: "Record not found" });
      } else if (
        error.message === "Invalid file type" || 
        error.message === "File signature validation failed" ||
        error.message === "File too large"
      ) {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to upload document" });
      }
    }
  },

  async download(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const documentId = req.params.documentId as string;

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
        res.status(400).json({ error: "Invalid document ID" });
        return;
      }

      const { metadata, buffer } = await DocumentService.getDocument(userId, documentId);

      res.setHeader("Content-Type", metadata.mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${metadata.originalFilename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      
      res.status(200).send(buffer);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
    } catch (error: any) {
      if (
        error.message === "Document not found" || 
        error.message === "Profile not found"
      ) {
        res.status(404).json({ error: "Document not found" });
      } else if (error.message === "Document unavailable due to security status") {
        res.status(403).json({ error: "Document is unavailable due to its security status" });
      } else {
        console.error("Download Error:", error);
        res.status(500).json({ error: "Failed to download document" });
      }
    }
  }
};
