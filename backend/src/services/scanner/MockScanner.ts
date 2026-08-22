import type { MalwareScanner, ScanResult } from "./MalwareScanner.js";

/**
 * MockScanner is a deterministic development/testing implementation.
 * It does NOT constitute production malware protection.
 * Production deployment requires a real malware scanning engine (e.g., ClamAV, AWS GuardDuty).
 */
export class MockScanner implements MalwareScanner {
  async scan(buffer: Buffer): Promise<ScanResult> {
    // EICAR Standard Antivirus Test File signature
    const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
    
    // Convert buffer to string to check for EICAR. 
    // In production, real scanners use efficient binary signature matching.
    const content = buffer.toString("utf8");

    if (content.includes(EICAR_SIGNATURE)) {
      return {
        status: "INFECTED",
        signature: "EICAR-TEST-SIGNATURE"
      };
    }

    if (content.includes("FAIL_SCAN_TEST")) {
      return {
        status: "SCAN_FAILED"
      };
    }

    return {
      status: "CLEAN"
    };
  }
}

export const scanner = new MockScanner();
