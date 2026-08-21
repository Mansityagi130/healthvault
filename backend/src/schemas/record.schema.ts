import { z } from "zod";
import { RecordCategory, RecordLifecycleStatus, ProvenanceStatus } from "../generated/prisma/enums.js";

// Ensure we only accept valid enums for categories
export const recordCategoryEnum = z.enum([
  RecordCategory.CONSULTATION,
  RecordCategory.PRESCRIPTION,
  RecordCategory.LAB_REPORT,
  RecordCategory.IMAGING,
  RecordCategory.DISCHARGE_SUMMARY,
  RecordCategory.VACCINATION,
  RecordCategory.OTHER,
]);

export const recordLifecycleStatusEnum = z.enum([
  RecordLifecycleStatus.ACTIVE,
  RecordLifecycleStatus.ARCHIVED,
  RecordLifecycleStatus.SUPERSEDED,
  RecordLifecycleStatus.REVOKED,
]);

export const createRecordSchema = z.object({
  category: recordCategoryEnum,
  title: z.string().min(1, "Title is required").max(255).trim(),
  occurredAt: z.string().datetime("Invalid date format (ISO 8601 expected)"),
}).strict();

export const updateRecordSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").max(255).trim().optional(),
  occurredAt: z.string().datetime("Invalid date format (ISO 8601 expected)").optional(),
  lifecycleStatus: recordLifecycleStatusEnum.optional(),
  category: recordCategoryEnum.optional(),
}).strict();

export const provenanceStatusEnum = z.enum([
  ProvenanceStatus.PATIENT_UPLOADED,
  ProvenanceStatus.PROVIDER_CREATED,
  ProvenanceStatus.HOSPITAL_CREATED,
  ProvenanceStatus.LAB_VERIFIED,
]);

export const listRecordsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  category: recordCategoryEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  provenance: provenanceStatusEnum.optional(),
  status: recordLifecycleStatusEnum.optional(),
}).strict();
