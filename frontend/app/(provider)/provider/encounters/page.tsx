"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users, ChevronRight } from "lucide-react";

export default function ProviderEncountersPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth("/provider/encounters");
        const data = await res.json();
        setEncounters(data || []);
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
        <h1 className="text-2xl font-bold text-slate-900">My Active Encounters</h1>
        <p className="text-slate-500 mt-1">Patients currently under your care.</p>
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : encounters.length === 0 ? (
        <EmptyState 
          icon={Users} 
          title="No encounters found" 
          description="You have no assigned encounters." 
        />
      ) : (
        <div className="space-y-4">
          {encounters.map(enc => (
            <Link key={enc.id} href={`/provider/encounters/${enc.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow">
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
                      Hospital: {enc.hospital?.name}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-slate-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
