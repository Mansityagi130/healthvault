import { databaseClient } from '../../config/database.js';
import type { AbdmAdapter } from './abdm.adapter.js';
import { MockAbdmAdapter } from './abdm.adapter.js';

const prisma = databaseClient.getClient();
const adapter: AbdmAdapter = new MockAbdmAdapter();

export class AbdmService {
  public static async linkIdentity(userId: string, abhaAddress: string, otp: string) {
    const isValid = await adapter.linkIdentity(abhaAddress, otp);
    if (!isValid) throw new Error('Invalid OTP for ABHA linking');
    
    // Check if identity already linked to another user
    const existing = await prisma.externalIdentity.findUnique({
      where: { externalSystem_identifierHash: { externalSystem: 'ABDM', identifierHash: abhaAddress } }
    });
    
    if (existing && existing.userId !== userId) {
      throw new Error('ABHA address already linked to a different patient');
    }
    
    // Upsert identity manually since userId is not purely unique
    const identity = await prisma.externalIdentity.findFirst({
      where: { userId, externalSystem: 'ABDM' }
    });

    if (identity) {
      return prisma.externalIdentity.update({
        where: { id: identity.id },
        data: {
          identifierType: 'ABHA_ADDRESS',
          identifierEncrypted: abhaAddress,
          identifierHash: abhaAddress,
          status: 'VERIFIED',
          verifiedAt: new Date()
        }
      });
    }

    return prisma.externalIdentity.create({
      data: {
        userId,
        externalSystem: 'ABDM',
        identifierType: 'ABHA_ADDRESS',
        identifierEncrypted: abhaAddress,
        identifierHash: abhaAddress,
        status: 'VERIFIED',
        verifiedAt: new Date()
      }
    });
  }

  public static async requestConsent(patientId: string, abhaAddress: string, purpose: string) {
    return prisma.$transaction(async (txn) => {
      const transaction = await txn.externalExchangeTransaction.create({
        data: {
          type: 'CONSENT_REQUEST',
          patientId,
          status: 'REQUESTED'
        }
      });
      
      await txn.outboxEvent.create({
        data: {
          topic: 'ABDM_EXCHANGE',
          payload: { transactionId: transaction.id }
        }
      });

      return transaction;
    });
  }
}
