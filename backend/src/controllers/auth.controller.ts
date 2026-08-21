import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res: Response) => {
  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
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
      setRefreshTokenCookie(res, result.refreshToken);
      
      res.status(200).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "ZodError") {
        res.status(400).json({ error: "Validation error", details: (error as any).errors });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
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
    } catch (_error: unknown) {
      res.status(500).json({ error: "Logout all failed" });
    }
  },

  async me(req: AuthRequest, res: Response) {
    // In a real app, you might fetch user from DB to get fresh profile data
    res.status(200).json({ user: req.user });
  }
};
