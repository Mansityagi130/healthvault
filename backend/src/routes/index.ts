import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import patientRouter from "./patient.routes.js";
import sharingRoutes from "./sharing.routes.js";
import providerRoutes from "./provider.routes.js";
import hospitalRoutes from "./hospital.routes.js";
import encounterRoutes from "./encounter.routes.js";
import labRoutes from "./lab.routes.js";
import notificationRoutes from "./notification.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/patient", patientRouter);
apiRouter.use("/sharing", sharingRoutes);
apiRouter.use("/provider", providerRoutes);
apiRouter.use("/hospitals", hospitalRoutes);
apiRouter.use("/labs", labRoutes);
apiRouter.use("/notifications", notificationRoutes);
apiRouter.use(encounterRoutes);
