"use client";
import React, { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Building, UserPlus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function AddProviderForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hospitalId = searchParams.get("hospitalId");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("DOCTOR");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<any /* eslint-disable-line @typescript-eslint/no-explicit-any */[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hospitalId) return;
    const fetchDepts = async () => {
      try {
        const res = await fetchWithAuth(`/hospitals/${hospitalId}/departments`);
        if (res.ok) {
          setDepartments(await res.json());
        }
      } catch (err) {}
    };
    fetchDepts();
  }, [hospitalId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/hospitals/${hospitalId}/members`, {
        method: "POST",
        body: JSON.stringify({ email, role, departmentId: departmentId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add provider");
      }
      router.push("/hospital/providers");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hospitalId) return <div className="p-6">Missing hospital context</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/hospital/providers" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Providers
      </Link>
      
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-teal-50 rounded-lg">
            <UserPlus className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Add Provider</h1>
            <p className="text-sm text-slate-500">Invite a provider to this organization.</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Provider Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              placeholder="doctor@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select 
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                <option value="DOCTOR">Doctor</option>
                <option value="NURSE">Nurse</option>
                <option value="STAFF">Staff</option>
                <option value="HOSPITAL_ADMIN">Admin</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department (Optional)</label>
              <select 
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {departments.map((d: Record<string, any /* eslint-disable-line @typescript-eslint/no-explicit-any */>) => (
                  <option key={d.id as string} value={d.id as string}>{d.name as string}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Provider"}
          </button>
        </form>
      </div>
    </div>
  );
}
export default function AddProvider() {
  return (
    <Suspense fallback={<div className="p-6">Loading provider context...</div>}>
      <AddProviderForm />
    </Suspense>
  );
}
