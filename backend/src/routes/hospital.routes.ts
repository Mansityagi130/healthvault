import { Router } from "express";
import { HospitalController } from "../controllers/hospital.controller.js";
import { EncounterController } from "../controllers/encounter.controller.js";
import { HospitalRegistrationController } from "../controllers/hospital-registration.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeTenant } from "../middleware/rbac.middleware.js";
import { MembershipRole } from "../generated/prisma/enums.js";

const router = Router();

// Protect all routes
router.use(authenticate);

// Get all hospitals for the authenticated user
router.get("/", HospitalController.getHospitals);

// Organization-scoped endpoints - require active membership in the requested hospital
router.get(
  "/:hospitalId",
  authorizeTenant(),
  HospitalController.getHospitalDetails
);

router.get(
  "/:hospitalId/departments",
  authorizeTenant(),
  HospitalController.getDepartments
);

// Only admins can view all members
router.get(
  "/:hospitalId/members",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN]),
  HospitalController.getMembers
);

router.post(
  "/:hospitalId/members",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN]),
  HospitalController.addMember
);

router.patch(
  "/:hospitalId/members/:membershipId",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN]),
  HospitalController.updateMember
);

router.delete(
  "/:hospitalId/members/:membershipId",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN]),
  HospitalController.removeMember
);

// Hospital Registration (QR resolution)
router.post(
  "/:hospitalId/registration/consume",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN, MembershipRole.STAFF]),
  HospitalRegistrationController.consumeRegistrationToken
);

// Encounters
router.post(
  "/:hospitalId/encounters",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN, MembershipRole.STAFF]),
  EncounterController.createHospitalEncounter
);

router.get(
  "/:hospitalId/encounters",
  authorizeTenant(),
  EncounterController.getHospitalEncounters
);

router.patch(
  "/:hospitalId/encounters/:encounterId",
  authorizeTenant([MembershipRole.HOSPITAL_ADMIN, MembershipRole.STAFF]),
  EncounterController.updateEncounter
);

export default router;
