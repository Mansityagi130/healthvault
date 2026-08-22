"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(t);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Reset token is missing in URL.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    // Complexity check: min 10 chars, uppercase, lowercase, number, symbol
    const complexRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/;
    if (!complexRegex.test(newPassword)) {
      setError("Password must be at least 10 characters long and include uppercase, lowercase, number, and symbol.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetchWithAuth("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Password reset failed");
      }

      setMessage("Password successfully reset! You will be redirected to the login page shortly.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Reset Password</h3>
      <p className="text-sm text-slate-500 mb-6">
        Enter your new secure password below.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 border border-red-200">
          {error}
        </div>
      )}

      {message ? (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm mb-6 border border-green-200">
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={!token}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 pr-10 text-slate-900"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Must be at least 10 characters long, and contain uppercase, lowercase, numbers, and symbols.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Reset Password"}
          </button>
        </form>
      )}

      <div className="text-center mt-6 text-sm">
        <Link href="/login" className="font-medium text-teal-700 hover:text-teal-800">
          Back to Login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-teal-700" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
