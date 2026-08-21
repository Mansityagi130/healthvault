import { z } from "zod";
import { 
  LabResultValueType, 
  LabResultStatus,
  LabReportStatus
} from "../generated/prisma/enums.js";

export const labResultValueTypeEnum = z.enum([
  LabResultValueType.NUMERIC,
  LabResultValueType.TEXT,
  LabResultValueType.QUALITATIVE
]);

export const labResultStatusEnum = z.enum([
  LabResultStatus.NORMAL,
  LabResultStatus.HIGH,
  LabResultStatus.LOW,
  LabResultStatus.CRITICAL,
  LabResultStatus.ABNORMAL,
  LabResultStatus.UNSPECIFIED
]);

export const labReportStatusEnum = z.enum([
  LabReportStatus.DRAFT,
  LabReportStatus.FINALIZED,
  LabReportStatus.AMENDED,
  LabReportStatus.CANCELLED
]);

export const createLabReportSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  title: z.string().min(1).max(255).trim().optional(),
  collectedAt: z.string().datetime().optional(),
  encounterId: z.string().uuid().optional(),
}).strict();

export const updateLabReportSchema = z.object({
  title: z.string().min(1).max(255).trim().optional(),
  collectedAt: z.string().datetime().optional(),
}).strict();

export const addLabResultSchema = z.object({
  testName: z.string().min(1, "Test name is required"),
  testCode: z.string().optional(),
  value: z.string().min(1, "Value is required"),
  valueType: labResultValueTypeEnum,
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  status: labResultStatusEnum.default(LabResultStatus.UNSPECIFIED),
}).strict();

export const updateLabResultSchema = addLabResultSchema.partial().strict();

export const listLabReportsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  status: labReportStatusEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).strict();
