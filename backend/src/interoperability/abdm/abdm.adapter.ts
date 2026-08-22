import crypto from 'crypto';

export interface AbdmAdapter {
  linkIdentity(abhaAddress: string, otp: string): Promise<boolean>;
  requestConsent(abhaAddress: string, purpose: string): Promise<string>;
  getConsentStatus(artefactId: string): Promise<string>;
  revokeConsent(artefactId: string): Promise<boolean>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  discoverPatient(abhaAddress: string): Promise<any>;
  requestHealthData(artefactId: string): Promise<string>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  sendHealthData(artefactId: string, bundle: any): Promise<boolean>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  receiveHealthData(transactionId: string): Promise<any>;
}

export class MockAbdmAdapter implements AbdmAdapter {
  public async linkIdentity(abhaAddress: string, otp: string): Promise<boolean> {
    if (otp === '123456') return true;
    return false;
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async requestConsent(abhaAddress: string, purpose: string): Promise<string> {
    return crypto.randomUUID();
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async getConsentStatus(artefactId: string): Promise<string> {
    return 'GRANTED';
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async revokeConsent(artefactId: string): Promise<boolean> {
    return true;
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  public async discoverPatient(abhaAddress: string): Promise<any> {
    return {
      abhaAddress,
      name: 'Mock Patient',
      gender: 'M',
      dateOfBirth: '1990-01-01'
    };
  }

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async requestHealthData(artefactId: string): Promise<string> {
    return crypto.randomUUID();
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async sendHealthData(artefactId: string, bundle: any): Promise<boolean> {
    return true;
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  public async receiveHealthData(transactionId: string): Promise<any> {
    return {};
  }
}