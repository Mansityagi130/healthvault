"use client";

import React, { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2 } from "lucide-react";

export default function HospitalEncountersPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  useEffect(() => {
    // In a real app, the hospital admin selects the hospital context,
    // or we fetch the user's active hospital memberships.
    async function load() {
      try {
        const hRes = await fetchWithAuth("/hospital/memberships");
        const memberships = await hRes.json();
        
        if (memberships && memberships.length > 0) {
          const hId = memberships[0].hospitalId;
          setHospitalId(hId);
          
          const res = await fetchWithAuth(`/hospitals/${hId}/encounters`);
          const data = await res.json();
          setEncounters(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hospital Encounters</h1>
        <p className="text-slate-500 mt-1">Manage active patient encounters.</p>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : encounters.length === 0 ? (
        <EmptyState 
          icon={Building2} 
          title="No encounters found" 
          description="There are no encounters for this hospital." 
        />
      ) : (
        <div className="space-y-4">
          {encounters.map(enc => (
            <Card key={enc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-teal-700">{enc.type}</span>
                    <Badge>{enc.status}</Badge>
                  </div>
                  <h3 className="font-semibold text-slate-900">
                    Patient: {enc.patient?.firstName} {enc.patient?.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    Provider: {enc.provider ? `Dr. ${enc.provider.firstName || ''}` : 'Unassigned'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
