import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { verify as verifyTotp } from "otplib";
import { databaseClient } from "../config/database.js";
import { AuthService } from "../services/auth.service.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { decryptMfaSecret } from "../utils/crypto.js";

const prisma = databaseClient.getClient();

const setRefreshTokenCookie = (res: Response, token: string) => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "strict",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "strict",
    path: "/api/auth",
    expires: new Date(0),
  });
};

export const AuthController = {
  async register(req: Request, res: Response) {
    try {
      const data = registerSchema.parse(req.body);
      const result = await AuthService.register(data);
      res.status(201).json(result);
    } catch (error: unknown) {
      console.error("REGISTER CATCH ERROR:", error);
      if (error instanceof Error && error.name === "ZodError") {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else if (error instanceof Error && error.message === "User already exists") {
        res.status(409).json({ error: "Account already exists" });
      } else {
        res.status(400).json({ error: "Registration failed", msg: error instanceof Error ? error.message : String(error) });
      }
    }
  },

  async login(req: Request, res: Response) {
    try {
      const data = loginSchema.parse(req.body);
      
      const metadata = {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      };

      const result = await AuthService.login(data, metadata);
      
      if (result.mfaRequired) {
        res.status(200).json({
          mfaRequired: true,
          mfaToken: result.mfaToken
        });
        return;
      }

      setRefreshTokenCookie(res, result.refreshToken!);
      
      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    }
  },

  async loginMfa(req: Request, res: Response) {
    try {
      const { mfaToken, code } = req.body;
      if (!mfaToken || !code) {
        res.status(400).json({ error: "mfaToken and code are required" });
        return;
      }
      const metadata = {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      };
      const result = await AuthService.loginMfa(mfaToken, code, metadata);
      setRefreshTokenCookie(res, result.refreshToken!);
      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error: unknown) {
      res.status(401).json({ error: error instanceof Error ? error.message : "Invalid MFA verification" });
    }
  },

  async enrollMfa(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AuthService.enrollMfa(userId);
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "MFA enrollment failed" });
    }
  },

  async confirmMfa(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { code } = req.body;
      if (!code) {
        res.status(400).json({ error: "Verification code is required" });
        return;
      }
      const result = await AuthService.confirmMfa(userId, code);
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "MFA confirmation failed" });
    }
  },

  async disableMfa(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.user!.sessionId;
      await AuthService.disableMfa(userId, sessionId);
      res.status(200).json({ success: true, message: "MFA disabled" });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "MFA disable failed" });
    }
  },

  async regenerateRecoveryCodes(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AuthService.regenerateRecoveryCodes(userId);
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Regeneration failed" });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.user!.sessionId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current password and new password are required" });
        return;
      }
      await AuthService.changePassword(userId, currentPassword, newPassword, sessionId);
      res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Password change failed" });
    }
  },

  async verifyStepUp(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const sessionId = req.user!.sessionId;
      const { code, password } = req.body;
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(400).json({ error: "User not found" });
        return;
      }

      let isVerified = false;
      if (user.mfaEnabled) {
        if (!code) {
          res.status(400).json({ error: "MFA code required" });
          return;
        }
        const secret = decryptMfaSecret(user.mfaSecret!);
        const mfaRes = await verifyTotp({ token: code, secret });
        isVerified = mfaRes.valid;
      } else {
        if (!password) {
          res.status(400).json({ error: "Password required" });
          return;
        }
        isVerified = await bcrypt.compare(password, user.passwordHash!);
      }

      if (!isVerified) {
        res.status(401).json({ error: "Verification failed" });
        return;
      }

      const stepUpToken = await AuthService.generateStepUpToken(userId, sessionId);
      res.status(200).json({ success: true, stepUpToken });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Step-up verification failed" });
    }
  },

  async forgotPassword(req: Request, res: Response) {
    try {
      const { identity } = req.body;
      if (!identity) {
        res.status(400).json({ error: "Email or phone is required" });
        return;
      }
      await AuthService.forgotPassword(identity);
      res.status(200).json({ success: true, message: "If the account exists, password reset instructions have been sent." });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to initiate password reset" });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        res.status(400).json({ error: "Token and new password are required" });
        return;
      }
      await AuthService.resetPassword(token, newPassword);
      res.status(200).json({ success: true, message: "Password reset completed successfully. Please login." });
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reset password" });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: "No refresh token provided" });
        return;
      }

      const result = await AuthService.refresh(refreshToken);
      setRefreshTokenCookie(res, result.refreshToken);
      
      res.status(200).json({ accessToken: result.accessToken });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (_error: unknown) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: "Session expired or invalid" });
    }
  },

  async logout(req: AuthRequest, res: Response) {
    try {
      if (req.user) {
        await AuthService.logout(req.user.sessionId, req.user.id);
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({ message: "Logged out successfully" });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (_error: unknown) {
      res.status(500).json({ error: "Logout failed" });
    }
  },

  async logoutAll(req: AuthRequest, res: Response) {
    try {
      if (req.user) {
        await AuthService.logoutAll(req.user.id);
      }
      clearRefreshTokenCookie(res);
      res.status(200).json({ message: "All sessions logged out successfully" });
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Needed for test fixtures/types
    } catch (_error: unknown) {
      res.status(500).json({ error: "Logout all failed" });
    }
  },

  async me(req: AuthRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          mfaEnabled: true,
          createdAt: true
        }
      });
      res.status(200).json({ user });
    } catch (error: unknown) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  }
};
