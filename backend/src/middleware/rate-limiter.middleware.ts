import rateLimit from "express-rate-limit";
import type { Request } from "express";

const shouldSkip = (req: Request) => {
  return process.env.NODE_ENV === "test" && req.headers["x-forwarded-for"] !== "192.168.4.1";
};

// Limit registration to 5 accounts per hour per IP
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Too many accounts created from this IP, please try again after an hour" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit login attempts to mitigate brute-force
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit refresh requests to prevent abuse
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many refresh requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit MFA verification attempts
export const mfaVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit password reset request / reset-token verification
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many password reset attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit password change attempts
export const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many password change attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit phone OTP verification attempts
export const phoneOtpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});

// Limit OTP resend requests
export const phoneOtpResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP resend requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
});
