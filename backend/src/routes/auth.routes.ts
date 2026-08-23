import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate, requireStepUp } from "../middleware/auth.middleware.js";
import { 
  registerLimiter, 
  loginLimiter, 
  refreshLimiter, 
  mfaVerifyLimiter, 
  passwordResetLimiter, 
  passwordChangeLimiter,
  phoneOtpVerifyLimiter,
  phoneOtpResendLimiter
} from "../middleware/rate-limiter.middleware.js";

export const authRouter = Router();

authRouter.post("/register", registerLimiter, AuthController.register);
authRouter.post("/login", loginLimiter, AuthController.login);
authRouter.post("/refresh", refreshLimiter, AuthController.refresh);
authRouter.post("/forgot-password", passwordResetLimiter, AuthController.forgotPassword);
authRouter.post("/reset-password", passwordResetLimiter, AuthController.resetPassword);
authRouter.post("/login/mfa", mfaVerifyLimiter, AuthController.loginMfa);
authRouter.post("/verify-phone", phoneOtpVerifyLimiter, AuthController.verifyPhone);
authRouter.post("/resend-phone-otp", phoneOtpResendLimiter, AuthController.resendPhoneOtp);
authRouter.get("/pending-phone/:userId", AuthController.getPendingPhone);

// Protected routes
authRouter.post("/logout", authenticate, AuthController.logout);
authRouter.post("/logout-all", authenticate, AuthController.logoutAll);
authRouter.get("/me", authenticate, AuthController.me);

// MFA Enrollment & Configuration
authRouter.post("/mfa/enroll", authenticate, AuthController.enrollMfa);
authRouter.post("/mfa/confirm", authenticate, mfaVerifyLimiter, AuthController.confirmMfa);
authRouter.post("/mfa/disable", authenticate, requireStepUp, AuthController.disableMfa);
authRouter.post("/mfa/recovery-codes", authenticate, requireStepUp, AuthController.regenerateRecoveryCodes);

// Settings & Security
authRouter.post("/settings/password", authenticate, passwordChangeLimiter, AuthController.changePassword);
authRouter.post("/step-up/verify", authenticate, mfaVerifyLimiter, AuthController.verifyStepUp);
