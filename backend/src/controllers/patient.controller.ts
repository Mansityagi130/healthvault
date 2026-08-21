import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";
import { patientProfileUpdateSchema } from "../schemas/patient.schema.js";

const prisma = databaseClient.getClient();

export const PatientController = {
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const profile = await prisma.patientProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          publicId: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          sexAtBirth: true,
          preferredLanguage: true,
          profileImageRef: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!profile) {
        console.error("404 in GET: userId =", userId);
        const all = await prisma.patientProfile.findMany();
        console.error("All profiles in GET:", all.map(p => p.userId));
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      res.status(200).json(profile);
    } catch (error: unknown) {
      res.status(500).json({ error: "Failed to retrieve profile" });
    }
  },

  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const data = patientProfileUpdateSchema.parse(req.body);
      
      const cleanData: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }

      // Check if profile exists
      const existingProfile = await prisma.patientProfile.findUnique({
        where: { userId },
      });

      if (!existingProfile) {
        console.error("404 in PUT: userId =", userId);
        const all = await prisma.patientProfile.findMany();
        console.error("All profiles:", all.map(p => p.userId));
        res.status(404).json({ error: "Profile not found" });
        return;
      }

      const updatedProfile = await prisma.patientProfile.update({
        where: { userId },
        data: cleanData,
        select: {
          id: true,
          publicId: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
          sexAtBirth: true,
          preferredLanguage: true,
          profileImageRef: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.status(200).json(updatedProfile);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else {
        res.status(500).json({ error: "Failed to update profile" });
      }
    }
  }
};
