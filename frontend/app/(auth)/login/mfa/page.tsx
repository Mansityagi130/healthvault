"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";

export default function MfaLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("pendingMfaToken");
    if (!token) {
      router.push("/login");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMfaToken(token);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetchWithAuth("/auth/login/mfa", {
        method: "POST",
        body: JSON.stringify({ mfaToken, code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await res.json();
      sessionStorage.removeItem("pendingMfaToken");
      setAccessToken(data.accessToken);

      const roles = data.user?.roles || [];
      if (roles.includes("DOCTOR")) {
        router.push("/provider/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid MFA code or recovery code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Two-Factor Authentication</h3>
      <p className="text-sm text-slate-500 mb-6">
        Enter the 6-digit verification code from your authenticator app, or a backup recovery code.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Verification Code / Recovery Code
          </label>
          <input
            type="text"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900 text-center tracking-widest text-lg font-semibold"
            placeholder="123456"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !mfaToken}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Verify Code"}
        </button>
      </form>
    </div>
  );
}
