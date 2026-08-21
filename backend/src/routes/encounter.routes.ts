import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeTenant } from "../middleware/rbac.middleware.js";
import { EncounterController } from "../controllers/encounter.controller.js";
import { MembershipRole } from "../generated/prisma/client.js";

const router = Router();

// Hospital Context (Must be HOSPITAL_ADMIN to manage encounters at organization level for now)
router.post("/hospitals/:hospitalId/encounters", authenticate, authorizeTenant([MembershipRole.HOSPITAL_ADMIN]), EncounterController.createHospitalEncounter);
router.get("/hospitals/:hospitalId/encounters", authenticate, authorizeTenant([MembershipRole.HOSPITAL_ADMIN]), EncounterController.getHospitalEncounters);
router.patch("/hospitals/:hospitalId/encounters/:encounterId", authenticate, authorizeTenant([MembershipRole.HOSPITAL_ADMIN]), EncounterController.updateEncounter);

// Provider Context
router.get("/provider/encounters", authenticate, EncounterController.getProviderEncounters);

// Patient Context
router.get("/patient/encounters", authenticate, EncounterController.getPatientEncounters);

export default router;



