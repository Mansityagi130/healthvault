"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth, getAccessToken } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";

export default function NewRecordPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    category: "OTHER",
    title: "",
    occurredAt: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // Convert YYYY-MM-DD to ISO DateTime for backend
      const isoDate = new Date(formData.occurredAt).toISOString();
      
      const res = await fetchWithAuth("/patient/records", {
        method: "POST",
        body: JSON.stringify({
          category: formData.category,
          title: formData.title,
          occurredAt: isoDate,
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create record");
      }

      const newRecord = await res.json();

      // If there's a file, upload it to the newly created record
      if (file) {
        const uploadData = new FormData();
        uploadData.append("file", file);
        
        // We use fetch directly here to attach the auth header but send FormData natively
        const token = getAccessToken();
        const uploadRes = await fetch(`/api/patient/records/${newRecord.id}/documents`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          },
          body: uploadData,
        });

        if (!uploadRes.ok) {
          const uploadError = await uploadRes.json();
          // We navigate anyway but maybe could show a warning. For this step, throw so it shows error.
          throw new Error(uploadError.error || "Record created but document upload failed");
        }
      }

      router.push(`/records/${newRecord.id}`);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Navigation */}
      <div>
        <Link href="/records" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} className="mr-1" />
          Back to Records
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add Health Record</CardTitle>
          <CardDescription>
            Manually add a health record to your timeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="category" className="block text-sm font-medium text-slate-700">
                Record Category <span className="text-red-500">*</span>
              </label>
              <select
                id="category"
                name="category"
                required
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="CONSULTATION">Consultation</option>
                <option value="PRESCRIPTION">Prescription</option>
                <option value="LAB_REPORT">Lab Report</option>
                <option value="IMAGING">Imaging</option>
                <option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                <option value="VACCINATION">Vaccination</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                Record Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                placeholder="e.g. Annual Blood Test"
                value={formData.title}
                onChange={handleChange}
                maxLength={255}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-slate-500">A clear, descriptive name for this record.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="occurredAt" className="block text-sm font-medium text-slate-700">
                Date of Record <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="occurredAt"
                name="occurredAt"
                required
                value={formData.occurredAt}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-slate-500">When this medical event occurred.</p>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label htmlFor="document" className="block text-sm font-medium text-slate-700">
                Attach Document (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-slate-50">
                <div className="space-y-1 text-center">
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label
                      htmlFor="document"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-teal-600 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500 px-2 py-1"
                    >
                      <span>Upload a file</span>
                      <input 
                        id="document" 
                        name="document" 
                        type="file" 
                        className="sr-only" 
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">PDF, JPG, PNG or WEBP up to 10MB</p>
                  {file && (
                    <div className="mt-2 text-sm font-medium text-teal-700">
                      Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Link href="/records">
                <Button variant="outline" type="button" disabled={loading}>
                  Cancel
                </Button>
              </Link>
              <Button variant="primary" type="submit" className="gap-2" disabled={loading || !formData.title.trim()}>
                <Save size={16} />
                {loading ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
