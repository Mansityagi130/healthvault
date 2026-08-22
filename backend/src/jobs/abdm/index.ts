import { databaseClient } from '../../config/database.js';
import type { AbdmExchangeJob } from '../types.js';
import { MockAbdmAdapter } from '../../interoperability/abdm/abdm.adapter.js';

const prisma = databaseClient.getClient();
const adapter = new MockAbdmAdapter();

export const processAbdmExchange = async (data: AbdmExchangeJob) => {
  const { transactionId } = data;
  
  const transaction = await prisma.externalExchangeTransaction.findUnique({
    where: { id: transactionId }
  });

  if (!transaction) {
    throw new Error('Transaction ' + transactionId + ' not found');
  }

  if (transaction.status !== 'REQUESTED') {
    return;
  }

  await prisma.externalExchangeTransaction.update({
    where: { id: transaction.id },
    data: { status: 'PROCESSING' }
  });

  try {
    let artefactId = '';
    if (transaction.type === 'CONSENT_REQUEST') {
      artefactId = await adapter.requestConsent('mock@abdm', 'Background Job Purpose');
    }
    
    await prisma.externalExchangeTransaction.update({
      where: { id: transaction.id },
      data: { status: 'COMPLETED', correlationId: artefactId }
    });
  } catch (err: unknown) {
    await prisma.externalExchangeTransaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED', errorMessage: (err as Error).message }
    });
    throw err;
  }
};
