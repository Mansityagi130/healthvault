"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { QRCodeDisplay } from "@/components/ui/QRCodeDisplay";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  organization: string;
}

const CATEGORIES = [
  "CONSULTATION",
  "PRESCRIPTION",
  "LAB_REPORT",
  "IMAGING",
  "DISCHARGE_SUMMARY",
  "VACCINATION",
  "OTHER"
];

const PURPOSES = [
  "Medical consultation",
  "Second opinion",
  "Emergency care",
  "Diagnostic review",
  "Specialist referral"
];

const DURATIONS = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "4 hours", value: 240 },
  { label: "24 hours", value: 1440 },
];

export default function NewSharePage() {
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPurpose, setSelectedPurpose] = useState<string>(PURPOSES[0]);
  const [selectedDuration, setSelectedDuration] = useState<number>(60);

  // Result State
  const [qrPayload, setQrPayload] = useState<{ selector: string; token: string } | null>(null);

  useEffect(() => {
    // Load mock providers
    const loadProviders = async () => {
      try {
        const res = await fetchWithAuth("/patient/providers/fixtures");
        if (res.ok) {
          const data = await res.json();
          setProviders(data);
        }
      } catch (err) {
        console.error("Failed to load providers", err);
      }
    };
    loadProviders();
  }, []);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/patient/sharing", {
        method: "POST",
        body: JSON.stringify({
          granteeUserId: selectedProvider,
          purpose: selectedPurpose,
          categories: selectedCategories,
          durationMinutes: selectedDuration
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create sharing session");
      }

      const data = await res.json();
      setQrPayload(data.qrPayload);
      setStep(5); // The QR step
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/sharing" className="inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-700">
          <ChevronLeft size={16} className="mr-1" />
          Back to Shares
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Share your health records</h1>
        <p className="text-slate-500 mt-1">
          Choose exactly what you want to share and who can access it.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2">Step 1: Choose Provider</h2>
              <div className="grid gap-3">
                {providers.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedProvider(p.id)}
                    className={`p-4 border rounded-lg cursor-pointer flex justify-between items-center transition-colors ${selectedProvider === p.id ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <div>
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-sm text-slate-500">{p.specialty} • {p.organization}</p>
                    </div>
                    {selectedProvider === p.id && <Check className="text-teal-600" size={20} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(2)} disabled={!selectedProvider}>Next Step</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2">Step 2: Choose Records</h2>
              <p className="text-sm text-slate-600 mb-2">Select the categories of records you wish to share.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORIES.map(cat => (
                  <label key={cat} className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                    <span className="ml-3 text-sm font-medium text-slate-900 capitalize">
                      {cat.replace("_", " ")}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)} disabled={selectedCategories.length === 0}>Next Step</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2">Step 3: Purpose & Duration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purpose of sharing</label>
                  <select 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={selectedPurpose}
                    onChange={(e) => setSelectedPurpose(e.target.value)}
                  >
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">How long should access last?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {DURATIONS.map(d => (
                      <div 
                        key={d.value}
                        onClick={() => setSelectedDuration(d.value)}
                        className={`p-3 border rounded-lg cursor-pointer text-center text-sm font-medium transition-colors ${selectedDuration === d.value ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-700 hover:border-slate-300'}`}
                      >
                        {d.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button onClick={() => setStep(4)}>Review & Create</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold border-b pb-2">Step 4: Review</h2>
              
              <div className="bg-slate-50 p-5 rounded-lg space-y-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Provider</p>
                  <p className="text-slate-900 font-medium">
                    {providers.find(p => p.id === selectedProvider)?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Categories</p>
                  <p className="text-slate-900 font-medium">
                    {selectedCategories.map(c => c.replace("_", " ")).join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Purpose</p>
                  <p className="text-slate-900 font-medium">{selectedPurpose}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Duration</p>
                  <p className="text-slate-900 font-medium">
                    {DURATIONS.find(d => d.value === selectedDuration)?.label}
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(3)} disabled={loading}>Back</Button>
                <Button variant="primary" onClick={handleCreate} disabled={loading}>
                  {loading ? "Creating..." : "Create Secure Share"}
                </Button>
              </div>
            </div>
          )}

          {step === 5 && qrPayload && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                  <Check className="text-green-600" size={24} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Sharing Session Created</h2>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                  Show this QR code to the provider. Do not close this screen until they have scanned it.
                </p>
              </div>

              <div className="py-4">
                <QRCodeDisplay 
                  selector={qrPayload.selector} 
                  token={qrPayload.token} 
                  expiresInMinutes={selectedDuration}
                />
              </div>

              <div className="flex justify-center pt-4">
                <Link href="/sharing">
                  <Button variant="outline">Done</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
