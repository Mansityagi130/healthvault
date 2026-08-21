import { z } from "zod";

export const generateLabPairingTokenSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(60).default(15)
}).strict();

export const consumeLabPairingTokenSchema = z.object({
  selector: z.string().uuid(),
  token: z.string().min(32).max(128)
}).strict();

export const approveLabAssociationSchema = z.object({
  associationId: z.string().uuid()
}).strict();

export const revokeLabAssociationSchema = z.object({
  associationId: z.string().uuid()
}).strict();
