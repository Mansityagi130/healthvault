import { Router } from "express";
import multer from "multer";
import { PatientController } from "../controllers/patient.controller.js";
import { RecordController } from "../controllers/record.controller.js";
import { DocumentController } from "../controllers/document.controller.js";
import { SharingController } from "../controllers/sharing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { LabAssociationController } from "../controllers/lab-association.controller.js";
import { HospitalRegistrationController } from "../controllers/hospital-registration.controller.js";
import { EncounterController } from "../controllers/encounter.controller.js";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  }
});

const router = Router();

router.use(authenticate);

router.get("/profile", PatientController.getProfile);
router.patch("/profile", PatientController.updateProfile);

router.get("/encounters", EncounterController.getPatientEncounters);

router.get("/records", RecordController.list);
router.get("/records/:recordId", RecordController.get);
router.post("/records", RecordController.create);
router.patch("/records/:recordId", RecordController.update);

router.post("/records/:recordId/documents", upload.single("file"), DocumentController.upload);
router.get("/documents/:documentId", DocumentController.download);

router.get("/providers/fixtures", SharingController.getProviders);
router.post("/sharing", SharingController.createDirectShare);
router.get("/sharing", SharingController.listShares);
router.post("/sharing/:sessionId/revoke", SharingController.revokeShare);

router.post("/lab-associations/pairing-token", LabAssociationController.generatePairingToken);
router.get("/lab-associations", LabAssociationController.listPatientAssociations);
router.post("/lab-associations/approve", LabAssociationController.approveAssociation);
router.post("/lab-associations/revoke", LabAssociationController.revokeAssociation);

router.post("/registration-token", HospitalRegistrationController.generateRegistrationToken);

export default router;
