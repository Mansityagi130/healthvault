import { Router } from "express";
import { LabController } from "../controllers/lab.controller.js";
import { LabAssociationController } from "../controllers/lab-association.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";


const router = Router();

// Ensure all lab routes are authenticated and require LAB_USER or LAB_ADMIN
router.use(authenticate);

// We will rely on the controller logic for fine-grained lab membership verification,
// but we can ensure they have at least one lab role globally.
// The requireRole middleware might be tied to global user roles, but Membership roles are separate.
// The verifyLabMembership function inside the controller checks the specific labId.

router.post("/:labId/associations/consume", LabAssociationController.consumePairingToken);
router.get("/:labId/associations", LabAssociationController.listLabAssociations);

router.get("/:labId/reports", LabController.listReports);
router.post("/:labId/reports", LabController.createReport);
router.post("/:labId/reports/:reportId/results", LabController.addResult);
router.patch("/:labId/reports/:reportId/finalize", LabController.finalizeReport);
router.get("/:labId/reports/:reportId", LabController.getReport);

export default router;
