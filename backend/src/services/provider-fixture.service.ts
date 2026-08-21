import { databaseClient } from "../config/database.js";
import { ProfileVerificationStatus } from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export class ProviderFixtureService {
  static async getDevelopmentProviders() {
    let doc1 = await prisma.user.findUnique({ where: { email: "dr.smith@example.com" } });
    
    if (!doc1) {
      doc1 = await prisma.user.create({
        data: {
          email: "dr.smith@example.com",
          passwordHash: "mocked_hash",
          doctorProfile: {
            create: {
              registrationNumber: "LIC-12345",
              specialty: "General Practice",
              verificationStatus: ProfileVerificationStatus.VERIFIED
            }
          }
        }
      });
    }

    let doc2 = await prisma.user.findUnique({ where: { email: "dr.jones@example.com" } });
    if (!doc2) {
      doc2 = await prisma.user.create({
        data: {
          email: "dr.jones@example.com",
          passwordHash: "mocked_hash",
          doctorProfile: {
            create: {
              registrationNumber: "LIC-67890",
              specialty: "Cardiology",
              verificationStatus: ProfileVerificationStatus.VERIFIED
            }
          }
        }
      });
    }

    const doctors = await prisma.user.findMany({
      where: { email: { in: ["dr.smith@example.com", "dr.jones@example.com"] } },
      include: { doctorProfile: true }
    });

    return doctors.map(doc => ({
      id: doc.id,
      name: doc.email === "dr.smith@example.com" ? "Dr. Alice Smith" : "Dr. Bob Jones",
      specialty: doc.doctorProfile?.specialty,
      organization: "Development Hospital (Fixture)",
    }));
  }
}
