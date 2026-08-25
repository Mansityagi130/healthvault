import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Mock store for testing OTP verification (in-memory map)
const mockOtpStore = new Map<string, string>();

export class SmsProvider {
  static async sendOtp(phone: string, otp: string): Promise<void> {
    const isTest = env.NODE_ENV === "test";
    const isDev = env.NODE_ENV === "development";

    if (!isTest && !isDev) {
      // Production SMS sending
      // Never log the OTP in production logs
      logger.info(`[SMS PROVIDER] Sending OTP to phone ${phone.slice(0, 4)}***`);
      // If a real SMS gateway was configured in production, call it here.
      return;
    }

    // Local development/testing environment
    mockOtpStore.set(phone, otp);
    console.log(`[SMS MOCK PROVIDER] Sending OTP ${otp} to phone ${phone}`);
    logger.info(`[SMS MOCK PROVIDER] Sending OTP ${otp} to phone ${phone}`);
  }

  static getMockOtp(phone: string): string | undefined {
    return mockOtpStore.get(phone);
  }

  static clearMockOtp(phone: string): void {
    mockOtpStore.delete(phone);
  }
}
