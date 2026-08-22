"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchWithAuth } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await fetchWithAuth("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identity }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Request failed");
      }

      const data = await res.json();
      setMessage(data.message || "If the account exists, password reset instructions have been sent.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Forgot Password</h3>
      <p className="text-sm text-slate-500 mb-6">
        Enter your email address or phone number, and we will send you instructions to reset your password.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 border border-red-200">
          {error}
        </div>
      )}

      {message ? (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm mb-6 border border-green-200">
          {message}
          <div className="mt-4">
            <Link href="/login" className="font-medium text-teal-700 hover:text-teal-800">
              Return to Login
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email or Phone
            </label>
            <input
              type="text"
              required
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900"
              placeholder="john@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Send Reset Instructions"}
          </button>

          <div className="text-center mt-4">
            <Link href="/login" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
