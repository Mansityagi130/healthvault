"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronLeft } from "lucide-react";

export default function PatientEncounterDetailPage() {
  const params = useParams();
  const router = useRouter();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  const [encounter, setEncounter] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth(`/patient/encounters`);
        const data = await res.json();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
        const enc = data.find((e: any) => e.id === params.encounterId);
        setEncounter(enc);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.encounterId]);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!encounter) return <div className="text-center p-8">Encounter not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="gap-2">
        <ChevronLeft size={16} /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Encounter Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Hospital</p>
            <p className="font-medium text-slate-900">{encounter.hospital?.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Type</p>
            <p className="font-medium text-slate-900">{encounter.type}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="font-medium text-slate-900">{encounter.status}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Provider</p>
            <p className="font-medium text-slate-900">
              {encounter.provider ? `Dr. ${encounter.provider.doctorProfile?.user?.firstName || ''}` : 'Not assigned'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Reason</p>
            <p className="font-medium text-slate-900">{encounter.reason || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
