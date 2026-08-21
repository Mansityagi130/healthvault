"use client";
import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { Hospital, Building, Users } from "lucide-react";
import Link from "next/link";

export default function HospitalDashboard() {
  const [hospitals, setHospitals] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await fetchWithAuth("/hospitals");
        if (!res.ok) throw new Error("Failed to load organizations");
        const data = await res.json();
        setHospitals(data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchHospitals();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <Hospital className="w-6 h-6 text-teal-600" />
        Organization Portals
      </h1>
      
      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-100 rounded-xl w-full"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
          {error}
        </div>
      ) : hospitals.length === 0 ? (
        <div className="text-center p-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No organization memberships found</p>
          <p className="text-slate-400 text-sm mt-1">You are not affiliated with any hospitals.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitals.map((hosp: Record<string, any>) => (
            <div key={hosp.id as string} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-teal-50 rounded-lg">
                  <Building className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-xs font-semibold bg-teal-100 text-teal-700 px-2 py-1 rounded-full uppercase">
                  {hosp.status as string}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">{hosp.name as string}</h2>
              <p className="text-sm text-slate-500 mb-6">Code: {hosp.code as string}</p>
              
              <div className="space-y-2">
                <Link 
                  href={`/hospital/providers`} 
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors flex justify-center items-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  Manage Providers
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
