"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchWithAuth, getAccessToken } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Calendar, User, Activity, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { use } from "react";

interface RecordDetail {
  id: string;
  category: string;
  title: string;
  occurredAt: string;
  source: string;
  provenanceStatus: string;
  lifecycleStatus: string;
  createdAt: string;
  updatedAt: string;
  // relations
  consultation: any;
  prescription: any;
  labReport: any;
  imagingRecord: any;
  dischargeSummary: any;
  vaccinationRecord: any;
  documents: any[];
}

const formatCategory = (cat: string) => {
  const map: Record<string, string> = {
    CONSULTATION: "Consultation",
    PRESCRIPTION: "Prescription",
    LAB_REPORT: "Lab Report",
    IMAGING: "Imaging",
    DISCHARGE_SUMMARY: "Discharge Summary",
    VACCINATION: "Vaccination",
    OTHER: "Other"
  };
  return map[cat] || cat;
};

const formatProvenance = (prov: string) => {
  switch (prov) {
    case "PATIENT_UPLOADED": return "Patient uploaded";
    case "PROVIDER_CREATED": return "Healthcare provider";
    case "HOSPITAL_CREATED": return "Hospital";
    case "LAB_VERIFIED": return "Laboratory verified";
    default: return prov;
  }
};

const getStatusVariant = (status: string): "success" | "neutral" | "warning" | "error" => {
  switch (status) {
    case "ACTIVE": return "success";
    case "ARCHIVED": return "neutral";
    case "SUPERSEDED": return "warning";
    case "REVOKED": return "error";
    default: return "neutral";
  }
};

export default function RecordDetailPage({ params }: { params: Promise<{ recordId: string }> }) {
  const resolvedParams = use(params);
  const { recordId } = resolvedParams;
  
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecord() {
      try {
        const res = await fetchWithAuth(`/patient/records/${recordId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("not_found");
          } else {
            setError("server_error");
          }
          return;
        }
        const data = await res.json();
        setRecord(data);
      } catch (err) {
        setError("server_error");
      } finally {
        setLoading(false);
      }
    }
    loadRecord();
  }, [recordId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-24" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-8 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="max-w-4xl mx-auto pt-10">
        <Card className="p-12 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <FileText size={24} />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Record not found</h3>
          <p className="text-slate-500 mb-6 max-w-md">
            The record you are looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link href="/records">
            <Button variant="primary">Return to Records</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="max-w-4xl mx-auto pt-10">
        <Card className="p-12 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">We couldn't load this record</h3>
          <p className="text-slate-500 mb-6">There was a problem retrieving the information. Please try again.</p>
          <div className="flex gap-3">
            <Link href="/records">
              <Button variant="outline">Back to Records</Button>
            </Link>
            <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation */}
      <div>
        <Link href="/records" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} className="mr-1" />
          Back to Records
        </Link>
      </div>

      {/* Header Card */}
      <Card className="overflow-hidden border-t-4 border-t-teal-600">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-bold tracking-widest text-teal-700 uppercase">
                  {formatCategory(record.category)}
                </span>
                <Badge variant={getStatusVariant(record.lifecycleStatus)}>
                  {record.lifecycleStatus}
                </Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {record.title || "Untitled Record"}
              </h1>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-6 border-y border-slate-100">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} /> Date
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {new Date(record.occurredAt).toLocaleDateString(undefined, { 
                  weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' 
                })}
              </p>
            </div>
            
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Provenance
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {formatProvenance(record.provenanceStatus)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={14} /> Source
              </span>
              <p className="text-sm font-semibold text-slate-900 capitalize">
                {record.source.toLowerCase()}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} /> Record ID
              </span>
              <p className="text-sm font-mono text-slate-600 truncate" title={record.id}>
                {record.id.split('-')[0]}...
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Documents Area */}
      {record.documents && record.documents.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Attached Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {record.documents.map((doc: any) => (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 bg-white rounded flex items-center justify-center border border-slate-200 text-slate-400">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 truncate max-w-xs sm:max-w-sm">
                        {doc.originalFilename}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{(parseInt(doc.byteSize) / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>•</span>
                        <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={async () => {
                        const token = getAccessToken();
                        const res = await fetch(`/api/patient/documents/${doc.id}`, {
                          headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank");
                        } else {
                          alert("Failed to load document");
                        }
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {record.consultation && (
        <Card>
          <CardHeader><CardTitle>Consultation Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Chief Complaint</p>
              <p className="text-slate-900">{record.consultation.clinicalSummary?.chiefComplaint}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Clinical Notes</p>
              <p className="text-slate-900 whitespace-pre-wrap">{record.consultation.clinicalSummary?.clinicalNotes}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Assessment</p>
              <p className="text-slate-900">{record.consultation.clinicalSummary?.assessment}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Plan</p>
              <p className="text-slate-900">{record.consultation.clinicalSummary?.plan}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {record.prescription && (
        <Card>
          <CardHeader><CardTitle>Prescription Items</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500 mb-4">{record.prescription.instructions}</p>
            {record.prescription.items?.map((item: any) => (
              <div key={item.id} className="p-4 border rounded-lg bg-slate-50">
                <p className="font-semibold">{item.medicationName}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm text-slate-600">
                  <p>Dosage: {item.dosage}</p>
                  <p>Freq: {item.frequency}</p>
                  <p>Duration: {item.duration}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {record.labReport && record.labReport.results && record.labReport.results.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Laboratory Results</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium text-slate-500">Test</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Result</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Range</th>
                    <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {record.labReport.results.map((res: any) => (
                    <tr key={res.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{res.testName}</td>
                      <td className="px-4 py-3">
                        {res.value} <span className="text-slate-500 text-xs ml-1">{res.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{res.referenceRange || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={res.status === "NORMAL" ? "neutral" : res.status === "UNSPECIFIED" ? "neutral" : "warning"}>
                          {res.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!record.consultation && !record.prescription && !record.labReport && (
        <Card>
          <CardHeader>
            <CardTitle>Clinical Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-8 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" />
              <h4 className="text-sm font-medium text-slate-900 mb-1">Details not yet available</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                This record is a generic placeholder or has not yet been processed for detailed clinical view.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="text-center text-xs text-slate-400 mt-6">
        Record created on {new Date(record.createdAt).toLocaleString()}
      </div>
    </div>
  );
}
