"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";

function VerifyPhoneForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [maskedPhone, setMaskedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Cooldown / Resend states
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!userId) {
      router.push("/register");
      return;
    }

    async function fetchPendingDetails() {
      try {
        const res = await fetchWithAuth(`/auth/pending-phone/${userId}`);
        if (!res.ok) {
          router.push("/register");
          return;
        }
        const data = await res.json();
        setMaskedPhone(data.phone);
      } catch (err) {
        setError("Could not retrieve pending registration details.");
      }
    }

    fetchPendingDetails();
  }, [userId, router]);

  // Resend cooldown timer effect
  useEffect(() => {
    if (cooldown > 0) {
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    } else if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetchWithAuth("/auth/verify-phone", {
        method: "POST",
        body: JSON.stringify({ userId, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setSuccess(true);
      setAccessToken(data.accessToken);

      // Instantly route to patient dashboard as authenticated user
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Invalid OTP. Please try again.");
      } else {
        setError("Invalid OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setCooldown(60); // 60 seconds cooldown

    try {
      const res = await fetchWithAuth("/auth/resend-phone-otp", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend code");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to resend verification code. Please try again.");
      } else {
        setError("Failed to resend verification code. Please try again.");
      }
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Verify Your Phone</h3>
      <p className="text-sm text-slate-600 mb-6">
        We sent a 6-digit verification code to your phone number {maskedPhone ? <strong className="text-slate-900">{maskedPhone}</strong> : "on record"}.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-6 border border-green-200">
          Verification successful! Redirecting you to your dashboard...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="otp-input" className="block text-sm font-medium text-slate-700 mb-2">
            Enter 6-Digit Code
          </label>
          <input
            id="otp-input"
            type="text"
            pattern="\d{6}"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full text-center tracking-widest text-2xl font-bold px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900 placeholder:text-slate-300"
            disabled={loading || success}
          />
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
              Verifying...
            </>
          ) : (
            "Verify Code"
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={handleResend}
          disabled={cooldown > 0 || loading || success}
          className="text-sm font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend Code in ${cooldown}s` : "Resend Verification Code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-teal-700" />
      </div>
    }>
      <VerifyPhoneForm />
    </Suspense>
  );
}
