"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, Share2, Clock, CheckCircle2, XCircle } from "lucide-react";

interface SharingSession {
  id: string;
  grantee: {
    doctorProfile: {
      firstName?: string;
      lastName?: string;
      specialty?: string;
    }
  };
  purposeSnapshot: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  scopes: { recordCategory: string }[];
}

export default function SharingPage() {
  const [sessions, setSessions] = useState<SharingSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth("/patient/sharing");
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

  useEffect(() => {
// eslint-disable-next-line react-hooks/set-state-in-effect -- Next.js / React temporary strictness disable
    loadSessions();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this session immediately?")) return;
    try {
      const res = await fetchWithAuth(`/patient/sharing/${id}/revoke`, { method: "POST" });
      if (res.ok) {
        loadSessions(); // Reload
      }
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
    } catch (err) {
      alert("Failed to revoke session");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Shared Access</h1>
          <p className="text-slate-500 mt-1">Manage temporary access given to healthcare providers.</p>
        </div>
        
        <Link href="/sharing/new">
          <Button variant="primary" className="gap-2 w-full sm:w-auto">
            <Plus size={16} />
            Create Share
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState 
          icon={Share2}
          title="No sharing sessions"
          description="You haven't shared your records with any providers yet."
          action={
            <Link href="/sharing/new">
              <Button variant="outline">Share your health records</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {sessions.map(session => (
            <Card key={session.id} className="border-slate-200">
              <CardContent className="p-5 flex flex-col sm:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {session.status === "ACTIVE" && new Date(session.expiresAt) > new Date() ? (
                      <Badge variant="success" className="gap-1"><CheckCircle2 size={12}/> Active</Badge>
                    ) : session.status === "REVOKED" ? (
                      <Badge variant="error" className="gap-1"><XCircle size={12}/> Revoked</Badge>
                    ) : (
                      <Badge variant="neutral" className="gap-1"><Clock size={12}/> Expired</Badge>
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      Dr. {session.grantee.doctorProfile?.firstName} {session.grantee.doctorProfile?.lastName}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-600 mb-3">{session.purposeSnapshot}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {session.scopes.map(s => (
                      <span key={s.recordCategory} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-md uppercase tracking-wider">
                        {s.recordCategory.replace("_", " ")}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock size={14} /> Expires: {new Date(session.expiresAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-end">
                  {session.status === "ACTIVE" && new Date(session.expiresAt) > new Date() && (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(session.id)}>
                      Revoke Access
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
