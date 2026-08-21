import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { databaseClient } from "../config/database.js";

const prisma = databaseClient.getClient();

export class HospitalController {
  static async getHospitals(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Get hospitals where user has an active membership
      const memberships = await prisma.hospitalMembership.findMany({
        where: { userId: req.user.id, status: "ACTIVE" },
        include: { hospital: true }
      });

      const hospitals = memberships.map(m => m.hospital);
      res.json(hospitals);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getHospitalDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const hospital = await prisma.hospital.findUnique({
        where: { id: hospitalId }
      });
      if (!hospital) {
        res.status(404).json({ error: "Hospital not found" });
        return;
      }
      res.json(hospital);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getDepartments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const departments = await prisma.department.findMany({
        where: { hospitalId }
      });
      res.json(departments);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const members = await prisma.hospitalMembership.findMany({
        where: { hospitalId }, // View all members, not just active, to manage them
        include: {
          user: {
            select: {
              id: true,
              email: true,
              doctorProfile: true
            }
          },
          department: true
        }
      });
      res.json(members);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async addMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const { email, role, departmentId } = req.body;

      if (!email || !role) {
        res.status(400).json({ error: "Missing email or role" });
        return;
      }

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: "User not found. Provider invitation not fully implemented yet." });
        return;
      }

      // Verify department if provided
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.hospitalId !== hospitalId) {
          res.status(400).json({ error: "Invalid department for this hospital" });
          return;
        }
      }

      // Check duplicate
      const existing = await prisma.hospitalMembership.findFirst({
        where: { hospitalId, userId: user.id }
      });

      if (existing) {
        res.status(400).json({ error: "User is already a member of this hospital" });
        return;
      }

      const membership = await prisma.hospitalMembership.create({
        data: {
          hospitalId,
          userId: user.id,
          role,
          departmentId: departmentId || null,
          status: "ACTIVE"
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: "MEMBERSHIP_CREATED",
          targetType: "HospitalMembership",
          targetId: membership.id,
          metadata: { hospitalId, role, departmentId }
        }
      });

      res.status(201).json(membership);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async updateMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const membershipId = req.params.membershipId as string;
      const { role, status, departmentId } = req.body;

      // Verify membership exists and belongs to hospital
      const existing = await prisma.hospitalMembership.findUnique({ where: { id: membershipId } });
      if (!existing || existing.hospitalId !== hospitalId) {
        res.status(404).json({ error: "Membership not found in this hospital" });
        return;
      }

      // Prevent self-elevation/demotion
      if (existing.userId === req.user!.id) {
        res.status(403).json({ error: "Cannot modify your own membership" });
        return;
      }

      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept || dept.hospitalId !== hospitalId) {
          res.status(400).json({ error: "Invalid department for this hospital" });
          return;
        }
      }

      const membership = await prisma.hospitalMembership.update({
        where: { id: membershipId },
        data: {
          role: role !== undefined ? role : existing.role,
          status: status !== undefined ? status : existing.status,
          departmentId: departmentId !== undefined ? departmentId : existing.departmentId,
        }
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: "MEMBERSHIP_CREATED", // Fallback because migration couldn't apply without UI
          targetType: "HospitalMembership",
          targetId: membership.id,
          metadata: { role, status, departmentId }
        }
      });

      res.json(membership);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async removeMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hospitalId = req.params.hospitalId as string;
      const membershipId = req.params.membershipId as string;

      const existing = await prisma.hospitalMembership.findUnique({ where: { id: membershipId } });
      if (!existing || existing.hospitalId !== hospitalId) {
        res.status(404).json({ error: "Membership not found" });
        return;
      }

      if (existing.userId === req.user!.id) {
        res.status(403).json({ error: "Cannot remove your own membership" });
        return;
      }

      await prisma.hospitalMembership.delete({
        where: { id: membershipId }
      });

      await prisma.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          action: "MEMBERSHIP_REVOKED",
          targetType: "HospitalMembership",
          targetId: membershipId,
          metadata: { hospitalId }
        }
      });

      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

