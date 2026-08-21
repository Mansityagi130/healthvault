import { Router } from "express";
import { SharingController } from "../controllers/sharing.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Provider must be authenticated to scan a QR and establish context
router.use(authenticate);

router.post("/qr/resolve", SharingController.resolveQr);

export default router;
