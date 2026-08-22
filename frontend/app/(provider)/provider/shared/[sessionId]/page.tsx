"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Clock, ShieldAlert, ChevronLeft, FileText, Paperclip, Download } from "lucide-react";

interface SharedSessionContext {
  sessionId: string;
  patientDisplayName: string;
  purpose: string;
  scopes: string[];
  expiresAt: string;
  status: string;
}

interface SharedRecord {
  id: string;
  title: string;
  category: string;
  occurredAt: string;
  providerName?: string;
  facilityName?: string;
  notes?: string;
  documents: {
    id: string;
    originalFilename: string;
    byteSize: string;
    mimeType: string;
    uploadedAt: string;
  }[];
}

export default function SharedPatientPage({ params }: { params: Promise<{ sessionId: string }> }) {
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  const router = useRouter();
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [context, setContext] = useState<SharedSessionContext | null>(null);
  const [records, setRecords] = useState<SharedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ctxRes, recRes] = await Promise.all([
          fetchWithAuth(`/provider/sessions/${sessionId}`),
          fetchWithAuth(`/provider/sessions/${sessionId}/records`)
        ]);

        if (!ctxRes.ok) {
          const err = await ctxRes.json();
          throw new Error(err.error || "Failed to load session context");
        }
        
        if (!recRes.ok) {
          const err = await recRes.json();
          throw new Error(err.error || "Failed to load shared records");
        }

        const ctxData = await ctxRes.json();
        const recData = await recRes.json();

        setContext(ctxData);
        setRecords(recData);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
      } catch (err: any) {
        setError(err.message || "Failed to load shared records");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [sessionId]);

  // Visual countdown timer
  useEffect(() => {
    if (!context?.expiresAt) return;
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expire = new Date(context.expiresAt).getTime();
      const diff = expire - now;
      
      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
      } else {
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [context?.expiresAt]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  const handleDocumentDownload = async (recordId: string, doc: any) => {
    try {
      const res = await fetchWithAuth(`/provider/sessions/${sessionId}/documents/${doc.id}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError("Access revoked or expired");
          return;
        }
        throw new Error("Failed to download document");
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
    } catch (err) {
      alert("Failed to download document");
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16 px-4">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-600 mb-6">{error}</p>
        <Link href="/provider/dashboard">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!context) return null;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-4">
        <Link href="/provider/dashboard" className="inline-flex items-center text-sm font-medium text-teal-600 hover:text-teal-700">
          <ChevronLeft size={16} className="mr-1" />
          Back to Dashboard
        </Link>
      </div>

      {/* Access Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={18} className="text-amber-400" />
            <h2 className="font-semibold text-lg">Temporary Access</h2>
          </div>
          <p className="text-slate-300 text-sm">You are viewing records securely shared by {context.patientDisplayName}</p>
        </div>
        
        <div className="bg-slate-800 rounded-lg p-3 md:min-w-[200px]">
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Expires In</p>
          <div className="text-2xl font-mono text-amber-400 font-bold">{timeLeft}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-1">
          <CardContent className="p-5">
            <h3 className="font-semibold text-slate-900 border-b pb-2 mb-3">Context</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Patient</p>
                <p className="text-sm font-medium text-slate-900">{context.patientDisplayName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Purpose</p>
                <p className="text-sm text-slate-700">{context.purpose}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Scope</p>
                <div className="flex flex-wrap gap-2">
                  {context.scopes.map(s => (
                    <Badge key={s} variant="neutral" className="bg-slate-100">{s.replace("_", " ")}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText size={20} className="text-teal-600" />
            Authorized Records
          </h3>
          
          {records.length === 0 ? (
            <Card className="border-dashed bg-slate-50">
              <CardContent className="p-8 text-center text-slate-500">
                The patient has no records matching the authorized scope.
              </CardContent>
            </Card>
          ) : (
            records.map(record => (
              <Card key={record.id} className="border-slate-200">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{record.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="neutral" className="bg-white">{record.category.replace("_", " ")}</Badge>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(record.occurredAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {record.providerName && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Provider</p>
                        <p className="text-sm font-medium">{record.providerName}</p>
                      </div>
                    )}
                    {record.facilityName && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase">Facility</p>
                        <p className="text-sm font-medium">{record.facilityName}</p>
                      </div>
                    )}
                  </div>

                  {record.notes && (
                    <div className="mb-4 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg">
                      {record.notes}
                    </div>
                  )}

                  {record.documents.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Paperclip size={12} /> Attachments ({record.documents.length})
                      </p>
                      <div className="space-y-2">
                        {record.documents.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={16} className="text-teal-600 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700 truncate">{doc.originalFilename}</span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs flex-shrink-0 gap-1"
                              onClick={() => handleDocumentDownload(record.id, doc)}
                            >
                              <Download size={14} /> Open
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
