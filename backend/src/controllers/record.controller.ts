import type { Response } from "express";
import { RecordService } from "../services/record.service.js";
import { 
  createRecordSchema, 
  updateRecordSchema, 
  listRecordsSchema 
} from "../schemas/record.schema.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const RecordController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const query = listRecordsSchema.parse(req.query);
      
      const result = await RecordService.listRecords(
        userId, 
        query
      );
      
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else {
        res.status(500).json({ error: "Failed to fetch records" });
      }
    }
  },

  async get(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const recordId = req.params.recordId as string;

      // UUID basic check (Zod or just regex could be used here)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
        res.status(400).json({ error: "Invalid record ID" });
        return;
      }

      const record = await RecordService.getRecord(userId, recordId);
      res.status(200).json(record);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Record not found") {
        res.status(404).json({ error: "Record not found" });
      } else {
        res.status(500).json({ error: "Failed to fetch record" });
      }
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const data = createRecordSchema.parse(req.body);
      
      const record = await RecordService.createRecord(userId, data);
      res.status(201).json(record);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else {
        res.status(500).json({ error: "Failed to create record" });
      }
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const recordId = req.params.recordId as string;

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
        res.status(400).json({ error: "Invalid record ID" });
        return;
      }

      const data = updateRecordSchema.parse(req.body);
      
      const record = await RecordService.updateRecord(userId, recordId, data);
      res.status(200).json(record);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else if (error instanceof Error && error.message === "Record not found") {
        res.status(404).json({ error: "Record not found" });
      } else {
        res.status(500).json({ error: "Failed to update record" });
      }
    }
  }
};
