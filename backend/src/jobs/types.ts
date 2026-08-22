export interface DocumentScanJob {
  documentId: string;
  quarantineKey: string;
}

export interface NotificationJob {
  notificationId: string;
}

export interface AbdmExchangeJob {
  transactionId: string;
}

export type JobPayload = DocumentScanJob | NotificationJob | AbdmExchangeJob;