import { databaseClient } from '../../config/database.js';
import { storage } from '../../services/storage/LocalStorageProvider.js';
import { scanner } from '../../services/scanner/MockScanner.js';
import type { DocumentScanJob } from '../types.js';
import { AuditAction, DocumentSecurityStatus } from '../../generated/prisma/enums.js';

const prisma = databaseClient.getClient();

export const processDocumentScan = async (data: DocumentScanJob) => {
  const { documentId } = data;
  
  const document = await prisma.medicalDocument.findUnique({
    where: { id: documentId }
  });

  if (!document) {
    throw new Error('Document ' + documentId + ' not found');
  }

  if (document.securityStatus !== 'PENDING_SCAN') {
    return;
  }

  const fileBuffer = await storage.get(document.storageKey);
  if (!fileBuffer) {
    throw new Error('File buffer not found in quarantine');
  }

  let scanResult: { status: string; signature?: string };
  try {
    scanResult = await scanner.scan(fileBuffer);
  } catch {
    scanResult = { status: 'SCAN_FAILED' };
  }

  let finalStorageKey = document.storageKey;
  if (scanResult.status === 'CLEAN') {
    try {
      if (storage.moveToNamespace) {
        finalStorageKey = await storage.moveToNamespace(document.storageKey, 'approved');
      }
    } catch {
      scanResult.status = 'SCAN_FAILED';
    }
  }

  await prisma.medicalDocument.update({
    where: { id: document.id },
    data: {
      securityStatus: scanResult.status as DocumentSecurityStatus,
      scanCompletedAt: new Date(),
      scanResult: scanResult.signature || null,
      storageKey: finalStorageKey
    }
  });

  let auditAction: AuditAction = AuditAction.SCAN_COMPLETED;
  if (scanResult.status === 'INFECTED') {
    auditAction = AuditAction.DOCUMENT_INFECTED;
  } else if (scanResult.status === 'SCAN_FAILED') {
    auditAction = AuditAction.SCAN_FAILED;
  } else if (scanResult.status === 'CLEAN') {
    auditAction = AuditAction.DOCUMENT_APPROVED;
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: document.uploadedByUserId || 'SYSTEM',
      action: auditAction,
      targetType: 'MedicalDocument',
      targetId: document.id,
    }
  }).catch(() => {});
};