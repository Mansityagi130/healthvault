"use client";

import React, { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Building2 } from "lucide-react";
import { SearchBar } from "@/components/ui/SearchBar";
import { FilterPopover } from "@/components/ui/FilterPopover";

export default function HospitalEncountersPage() {
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      let hId = hospitalId;
      if (!hId) {
        const hRes = await fetchWithAuth("/hospital/memberships");
        const memberships = await hRes.json();
        if (memberships && memberships.length > 0) {
          hId = memberships[0].hospitalId;
          setHospitalId(hId);
        }
      }
      
      if (hId) {
        const qs = new URLSearchParams();
        if (search) qs.set("search", search);
        if (filters.status) qs.set("status", filters.status);
        
        const res = await fetchWithAuth(`/hospitals/${hId}/encounters?${qs.toString()}`);
        const data = await res.json();
        setEncounters(data.items || data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId, search, filters]);

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- Next.js / React temporary strictness disable
    load();
  }, [load]);

  const filterGroups = [
    {
      id: "status",
      label: "Status",
      options: [
        { label: "Scheduled", value: "SCHEDULED" },
        { label: "Checked In", value: "CHECKED_IN" },
        { label: "In Progress", value: "IN_PROGRESS" },
        { label: "Completed", value: "COMPLETED" },
        { label: "Cancelled", value: "CANCELLED" },
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hospital Encounters</h1>
          <p className="text-slate-500 mt-1">Manage active patient encounters.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchBar onSearch={setSearch} initialValue={search} placeholder="Search by patient name, department..." />
        </div>
        <FilterPopover groups={filterGroups} activeFilters={filters} onFilterChange={setFilters} />
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : encounters.length === 0 ? (
        <EmptyState 
          icon={Building2} 
          title={search || Object.keys(filters).length > 0 ? "No encounters match your search" : "No encounters found"} 
          description={search || Object.keys(filters).length > 0 ? "Try adjusting your filters or search term." : "There are no encounters for this hospital."} 
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
