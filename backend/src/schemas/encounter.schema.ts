import { z } from "zod";

export const listEncountersSchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum([
    "SCHEDULED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "ACTIVE"
  ]).optional(),
  departmentId: z.string().uuid().optional(),
}).strict();
