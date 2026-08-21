import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { registerLimiter, loginLimiter, refreshLimiter } from "../middleware/rate-limiter.middleware.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, AuthController.register);
authRouter.post("/login", loginLimiter, AuthController.login);
authRouter.post("/refresh", refreshLimiter, AuthController.refresh);

// Protected routes
authRouter.post("/logout", authenticate, AuthController.logout);
authRouter.post("/logout-all", authenticate, AuthController.logoutAll);
authRouter.get("/me", authenticate, AuthController.me);
