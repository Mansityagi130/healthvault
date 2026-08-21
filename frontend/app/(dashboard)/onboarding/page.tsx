"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Loader2 } from "lucide-react";

interface Profile {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  sexAtBirth?: string;
  preferredLanguage?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Profile>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    phone: "",
    sexAtBirth: "",
    preferredLanguage: "",
  });

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await fetchWithAuth("/patient/profile");
        if (res.ok) {
          const profile = await res.json();
          // If profile is already fully complete, redirect to dashboard
          if (profile.firstName && profile.lastName && profile.dateOfBirth) {
            router.push("/dashboard");
          } else {
            setFormData({
              firstName: profile.firstName || "",
              lastName: profile.lastName || "",
              dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split("T")[0] : "",
              phone: profile.phone || "",
              sexAtBirth: profile.sexAtBirth || "",
              preferredLanguage: profile.preferredLanguage || "",
            });
            setLoading(false);
          }
        } else {
          router.push("/login");
        }
      } catch (e) {
        router.push("/login");
      }
    }
    checkProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: any = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
      };
      
      if (formData.dateOfBirth) {
        payload.dateOfBirth = new Date(formData.dateOfBirth).toISOString();
      }
      if (formData.phone) payload.phone = formData.phone.trim();
      if (formData.sexAtBirth) payload.sexAtBirth = formData.sexAtBirth;
      if (formData.preferredLanguage) payload.preferredLanguage = formData.preferredLanguage.trim();

      const res = await fetchWithAuth("/patient/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update profile");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred.");
      }
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complete your HealthVault profile</h1>
          <p className="text-slate-500 mt-2 text-sm">A few details will help us personalize your experience.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-6 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
            <input
              type="date"
              name="dateOfBirth"
              required
              max={new Date().toISOString().split("T")[0]}
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender / Sex at Birth</label>
            <select
              name="sexAtBirth"
              value={formData.sexAtBirth}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other / Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Language</label>
            <select
              name="preferredLanguage"
              value={formData.preferredLanguage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900 bg-white"
            >
              <option value="">Select...</option>
              <option value="EN">English</option>
              <option value="ES">Spanish</option>
              <option value="HI">Hindi</option>
              <option value="FR">French</option>
            </select>
          </div>

          <Button type="submit" className="w-full mt-4" isLoading={submitting}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
