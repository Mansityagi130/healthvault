import { databaseClient } from "../config/database.js";
import { storage } from "./storage/LocalStorageProvider.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { AuditAction, AccessAction, AccessOutcome } from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

// Very basic magic bytes checking for prototype
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") {
    // %PDF
    return buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (mimeType === "image/jpeg") {
    // FF D8 FF
    return buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === "image/png") {
    // 89 50 4E 47
    return buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimeType === "image/webp") {
    // RIFF .... WEBP
    return buffer.length > 12 && 
           buffer.toString("ascii", 0, 4) === "RIFF" && 
           buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

export class DocumentService {
  static async uploadDocument(
    userId: string,
    recordId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }
  ) {
    // 1. Get profile and check ownership of MedicalRecord
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("Profile not found");

    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.patientId !== profile.id) {
      throw new Error("Record not found");
    }

    // 2. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error("Invalid file type");
    }

    // 3. Validate magic bytes
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw new Error("File signature validation failed");
    }

    // 4. Validate size (handled mostly by multer, but double check)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      throw new Error("File too large");
    }

    // 5. Checksum
    const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

    // 6. Generate storage key
    const docId = uuidv4();
    const storageKey = `patients/${profile.id}/records/${record.id}/${docId}`;

    // 7. Store file privately
    await storage.upload(storageKey, file.buffer, file.mimetype);

    let document;
    try {
      // 8. Create database record
      document = await prisma.$transaction(async (txn) => {
        const newDoc = await txn.medicalDocument.create({
          data: {
            id: docId,
            medicalRecordId: record.id,
            storageKey,
            originalFilename: pathSanitize(file.originalname),
            mimeType: file.mimetype,
            byteSize: BigInt(file.size),
            checksum,
            uploadedByUserId: userId,
          },
        });

        await txn.auditLog.create({
          data: {
            actorUserId: userId,
            action: AuditAction.RECORD_UPLOADED,
            targetType: "MedicalDocument",
            targetId: newDoc.id,
          },
        });

        return newDoc;
      });
    } catch (err) {
      // 9. Rollback storage on DB failure
      await storage.delete(storageKey);
      throw err;
    }

    return {
      ...document,
      byteSize: document.byteSize.toString(), // Convert BigInt for JSON safely
    };
  }

  static async getDocument(userId: string, documentId: string) {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new Error("Profile not found");

    const document = await prisma.medicalDocument.findUnique({
      where: { id: documentId },
      include: { medicalRecord: true },
    });

    if (!document || document.medicalRecord.patientId !== profile.id) {
      throw new Error("Document not found");
    }

    // Log access
    await prisma.accessLog.create({
      data: {
        actorUserId: userId,
        patientId: profile.id,
        medicalRecordId: document.medicalRecordId,
        resourceType: "MedicalDocument",
        resourceId: document.id,
        action: AccessAction.VIEW,
        outcome: AccessOutcome.ALLOWED,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: AuditAction.RECORD_VIEWED,
        targetType: "MedicalDocument",
        targetId: document.id,
      },
    });

    const buffer = await storage.get(document.storageKey);

    return {
      metadata: document,
      buffer,
    };
  }
}

function pathSanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}
