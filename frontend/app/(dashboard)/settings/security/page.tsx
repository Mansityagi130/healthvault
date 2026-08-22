"use client";

import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Loader2, Shield, Lock, CheckCircle2, AlertTriangle, Key } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function SecuritySettingsPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // MFA setup states
  const [mfaStep, setMfaStep] = useState<"idle" | "enrolling" | "confirming" | "enabled" | "stepup">("idle");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaOtpauth, setMfaOtpauth] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mfaError, setMfaError] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  
  // Step-up state
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [stepUpCode, setStepUpCode] = useState("");
  const [stepUpAction, setStepUpAction] = useState<"disable" | "regen" | null>(null);

  const loadMfaStatus = async () => {
    try {
      const res = await fetchWithAuth("/auth/me");
      if (res.ok) {
        const data = await res.json();
        setMfaEnabled(data.user?.mfaEnabled || false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMfaStatus();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    // Complexity check: min 10 chars, uppercase, lowercase, number, symbol
    const complexRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/;
    if (!complexRegex.test(newPassword)) {
      setPasswordError("Password must be at least 10 characters long and include uppercase, lowercase, number, and symbol.");
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetchWithAuth("/auth/settings/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Password change failed");
      }

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleMfaEnroll = async () => {
    setMfaError("");
    setMfaLoading(true);

    try {
      const res = await fetchWithAuth("/auth/mfa/enroll", { method: "POST" });
      if (!res.ok) throw new Error("MFA enrollment failed");

      const data = await res.json();
      setMfaSecret(data.secret);
      setMfaOtpauth(data.otpauth);
      setMfaStep("confirming");
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "Failed to initialize MFA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError("");
    setMfaLoading(true);

    try {
      const res = await fetchWithAuth("/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify({ code: otpCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await res.json();
      setBackupCodes(data.backupCodes || []);
      setMfaStep("enabled");
      setMfaEnabled(true);
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "MFA confirmation failed.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleStepUpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError("");
    setMfaLoading(true);

    try {
      const res = await fetchWithAuth("/auth/step-up/verify", {
        method: "POST",
        body: JSON.stringify({
          password: stepUpPassword,
          code: stepUpCode
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await res.json();
      const token = data.stepUpToken;

      if (stepUpAction === "disable") {
        await executeDisableMfa(token);
      } else if (stepUpAction === "regen") {
        await executeRegenCodes(token);
      }
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "Step-up verification failed.");
      setMfaLoading(false);
    }
  };

  const executeDisableMfa = async (token: string) => {
    try {
      const res = await fetchWithAuth("/auth/mfa/disable", {
        method: "POST",
        headers: { "x-step-up-token": token }
      });

      if (!res.ok) throw new Error("Disable failed");

      setMfaEnabled(false);
      setMfaStep("idle");
      setStepUpAction(null);
      setStepUpPassword("");
      setStepUpCode("");
      loadMfaStatus();
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "Failed to disable MFA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const executeRegenCodes = async (token: string) => {
    try {
      const res = await fetchWithAuth("/auth/mfa/recovery-codes", {
        method: "POST",
        headers: { "x-step-up-token": token }
      });

      if (!res.ok) throw new Error("Regeneration failed");

      const data = await res.json();
      setBackupCodes(data.backupCodes || []);
      setMfaStep("enabled");
      setStepUpAction(null);
      setStepUpPassword("");
      setStepUpCode("");
    } catch (err: unknown) {
      setMfaError(err instanceof Error ? err.message : "Failed to regenerate codes.");
    } finally {
      setMfaLoading(false);
    }
  };

  const promptStepUp = (action: "disable" | "regen") => {
    setStepUpAction(action);
    setMfaStep("stepup");
    setMfaError("");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="text-teal-700 w-7 h-7" />
          Security Settings
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Manage your account password and configure Multi-Factor Authentication (MFA) settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Password Card */}
        <Card className="border border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Lock className="text-teal-700 w-5 h-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {passwordError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 border border-green-200">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <Button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-sm transition-colors py-2.5 rounded-lg"
              >
                {passwordLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* MFA Card */}
        <Card className="border border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Key className="text-teal-700 w-5 h-5" />
              Two-Factor Authentication (2FA)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {mfaError && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200">
                {mfaError}
              </div>
            )}

            {mfaStep === "idle" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">MFA Status</span>
                  <Badge variant={mfaEnabled ? "success" : "warning"}>
                    {mfaEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                <p className="text-sm text-slate-500 leading-relaxed">
                  Protect your account with Time-Based One-Time Passwords. An authenticator app generates verification codes for secure sign-ins.
                </p>

                {mfaEnabled ? (
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => promptStepUp("regen")}
                      className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg py-2.5 font-medium transition-colors"
                    >
                      Regenerate Recovery Codes
                    </Button>
                    <Button
                      onClick={() => promptStepUp("disable")}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg py-2.5 font-medium transition-colors"
                    >
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleMfaEnroll}
                    disabled={mfaLoading}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-sm transition-colors py-2.5 rounded-lg"
                  >
                    {mfaLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : "Set Up 2FA"}
                  </Button>
                )}
              </div>
            )}

            {mfaStep === "confirming" && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-slate-600">
                  Scan this QR code using your mobile authenticator app (Google Authenticator, Authy, Microsoft Authenticator):
                </p>
                <div className="flex justify-center p-3 bg-white border border-slate-100 rounded-xl max-w-[220px] mx-auto shadow-sm">
                  <QRCodeSVG value={mfaOtpauth} size={180} />
                </div>
                <div className="text-left bg-slate-50 border border-slate-100 rounded-lg p-3">
                  <span className="block text-xs font-semibold text-slate-500 uppercase">Manual Setup Secret</span>
                  <code className="text-sm font-mono text-teal-800 tracking-wider break-all block mt-1">{mfaSecret}</code>
                </div>

                <form onSubmit={handleMfaConfirm} className="space-y-4 pt-2">
                  <div className="text-left">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Enter 6-digit Code
                    </label>
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center tracking-widest text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                      placeholder="123456"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => setMfaStep("idle")}
                      className="w-1/2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg py-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={mfaLoading}
                      className="w-1/2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg py-2"
                    >
                      {mfaLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : "Verify & Enable"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {mfaStep === "enabled" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-700 font-semibold mb-2">
                  <CheckCircle2 className="w-6 h-6" />
                  MFA Successfully Enabled!
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Store these recovery codes in a safe place. If you lose access to your device, they are the only way to recover your account:
                </p>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-150 rounded-lg p-4 font-mono text-sm text-slate-800">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 rounded px-2 py-1.5 shadow-sm">
                      <span>{code}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    setMfaStep("idle");
                    setBackupCodes([]);
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-lg py-2.5"
                >
                  I Have Saved These Codes
                </Button>
              </div>
            )}

            {mfaStep === "stepup" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                  <AlertTriangle className="w-6 h-6" />
                  Step-up Verification Required
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  Please verify your credentials before performing this sensitive security action.
                </p>

                <form onSubmit={handleStepUpVerify} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Account Password
                    </label>
                    <input
                      type="password"
                      required
                      value={stepUpPassword}
                      onChange={(e) => setStepUpPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none"
                    />
                  </div>

                  {mfaEnabled && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        6-digit 2FA Code
                      </label>
                      <input
                        type="text"
                        required
                        value={stepUpCode}
                        onChange={(e) => setStepUpCode(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none text-center font-semibold text-lg"
                        placeholder="123456"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setMfaStep("idle");
                        setStepUpAction(null);
                      }}
                      className="w-1/2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg py-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={mfaLoading}
                      className="w-1/2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg py-2"
                    >
                      {mfaLoading ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : "Verify Identity"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
