"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { QrCode, Clock, CheckCircle2, ChevronRight, Activity, Building, Briefcase } from "lucide-react";

interface SharedSession {
  sessionId: string;
  patientDisplayName: string;
  purpose: string;
  scopes: string[];
  expiresAt: string;
  status: string;
}

export default function ProviderDashboardPage() {
  const [sessions, setSessions] = useState<SharedSession[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalsLoading, setHospitalsLoading] = useState(true);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const res = await fetchWithAuth("/provider/sessions");
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    const loadHospitals = async () => {
      try {
        const res = await fetchWithAuth("/hospitals");
        if (res.ok) {
          const data = await res.json();
          setHospitals(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setHospitalsLoading(false);
      }
    };

    loadSessions();
    loadHospitals();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Provider Dashboard</h1>
          <p className="text-slate-500 mt-1">Manage active patient sessions and organizational affiliations.</p>
        </div>
        
        <Link href="/provider/scan">
          <Button variant="primary" className="gap-2 w-full sm:w-auto bg-slate-900 hover:bg-slate-800">
            <QrCode size={18} />
            Scan Patient QR
          </Button>
        </Link>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Building size={20} className="text-teal-600" /> 
          Affiliated Organizations
        </h2>

        {hospitalsLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-28 w-full" />
          </div>
        ) : hospitals.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-6 text-center border border-dashed border-slate-200">
            <Briefcase className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm font-medium">No active hospital affiliations</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hospitals.map(h => (
              <div key={h.id as string} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
                <div className="bg-teal-50 p-2 rounded-lg">
                  <Building size={20} className="text-teal-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{h.name as string}</h3>
                  <p className="text-xs text-slate-500 mt-1">Code: {h.code as string}</p>
                  <div className="mt-2 text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full inline-block uppercase">
                    {h.status as string}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Activity size={20} className="text-teal-600" /> 
          Active Shared Sessions
        </h2>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState 
            icon={QrCode}
            title="No active sessions"
            description="You don't have any active shared records. Scan a patient's QR code to begin."
            action={
              <Link href="/provider/scan">
                <Button variant="outline">Scan QR Code</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map(session => (
              <Card key={session.sessionId} className="border-slate-200 hover:border-teal-300 transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold uppercase">
                        {session.patientDisplayName.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{session.patientDisplayName}</p>
                        <Badge variant="success" className="gap-1 mt-0.5"><CheckCircle2 size={10}/> Active</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">{session.purpose}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={14} /> Expires: {new Date(session.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <Link href={`/provider/shared/${session.sessionId}`}>
                      <Button variant="outline" size="sm" className="gap-1 text-teal-700 border-teal-200 hover:bg-teal-50">
                        View Records <ChevronRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
