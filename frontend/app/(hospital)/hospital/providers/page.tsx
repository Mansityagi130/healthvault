"use client";
import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { Users, UserPlus, Search, Building } from "lucide-react";
import Link from "next/link";

export default function HospitalProviders() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetchWithAuth("/hospitals");
        if (!res.ok) throw new Error("Failed to load organizations");
        const data = await res.json();
        setHospitals(data);
        if (data.length > 0) setSelectedHospitalId(data[0].id);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, []);

  useEffect(() => {
    if (!selectedHospitalId) return;
    const fetchMembers = async () => {
      try {
        const res = await fetchWithAuth(`/hospitals/${selectedHospitalId}/members`);
        if (!res.ok) {
          if (res.status === 403) throw new Error("You do not have permission to view members for this hospital.");
          throw new Error("Failed to load members");
        }
        const data = await res.json();
        setMembers(data);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
      }
    };
    fetchMembers();
  }, [selectedHospitalId]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-teal-600" />
          Provider Management
        </h1>
        {selectedHospitalId && (
          <Link href={`/hospital/providers/new?hospitalId=${selectedHospitalId}`} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <UserPlus className="w-4 h-4" />
            Add Provider
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {!loading && hospitals.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
          <Building className="w-5 h-5 text-slate-400" />
          <select 
            value={selectedHospitalId} 
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 font-medium"
          >
            {hospitals.map((h: any) => (
              <option key={h.id as string} value={h.id as string}>{h.name as string}</option>
            ))}
          </select>
        </div>
      )}

      {selectedHospitalId && !error && members.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Provider</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Department</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m: Record<string, any>) => (
                <tr key={m.id as string} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">
                      {m.user?.doctorProfile?.firstName} {m.user?.doctorProfile?.lastName}
                    </div>
                    <div className="text-sm text-slate-500">{m.user?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full font-medium">
                      {m.role as string}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {m.department?.name || "Unassigned"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${m.status === 'ACTIVE' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                      {m.status as string}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
