import { z } from "zod";

export const patientProfileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim().optional(),
  lastName: z.string().min(1, "Last name is required").trim().optional(),
  phone: z.string().trim().optional(),
  dateOfBirth: z.string().datetime().or(z.date()).optional(),
  sexAtBirth: z.string().optional(),
  preferredLanguage: z.string().optional(),
}).strict();
