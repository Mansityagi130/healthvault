"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../layout";
import { fetchWithAuth } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Plus, FileText, Share2, Shield, Activity, ShieldAlert, Pill, Calendar, Stethoscope, ChevronRight } from "lucide-react";

const formatCategory = (cat: string) => {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

export default function DashboardPage() {
  const user = useUser();
  const [records, setRecords] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [recordsRes, encountersRes] = await Promise.all([
          fetchWithAuth("/patient/records?limit=5"),
          fetchWithAuth("/patient/encounters?limit=5")
        ]);
        
        if (recordsRes.ok) {
          const recData = await recordsRes.json();
          setRecords(recData.items || []);
        }
        if (encountersRes.ok) {
          const encData = await encountersRes.json();
          setEncounters(encData.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = user?.profile?.firstName || user?.email?.split('@')[0] || user?.phone || "Patient";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {getGreeting()}, <span className="capitalize">{displayName}</span>
          </h1>
          <p className="text-slate-500 mt-1">Your health records, securely organized and accessible.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/sharing">
            <Button variant="outline" className="gap-2">
              <Share2 size={16} />
              Share Records
            </Button>
          </Link>
          <Link href="/records/new">
            <Button variant="primary" className="gap-2">
              <Plus size={16} />
              Add Record
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats / Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Records</p>
              {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold text-slate-900 mt-1">{records.length > 0 ? `${records.length}+` : 0}</h4>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Recent Encounters</p>
              {loading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold text-slate-900 mt-1">{encounters.length}</h4>}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-start gap-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Emergency Profile</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                <span className="text-sm font-medium text-slate-600">Not setup</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Timeline Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Recent Health Timeline</h2>
            <Link href="/records" className="text-sm font-medium text-teal-600 hover:text-teal-700">View all</Link>
          </div>
          
          {loading ? (
             <div className="space-y-4">
               {[1, 2, 3].map(i => (
                 <Card key={i} className="p-4">
                   <div className="flex gap-4 items-start">
                     <Skeleton className="h-10 w-10 rounded-lg" />
                     <div className="flex-1 space-y-2">
                       <Skeleton className="h-5 w-1/3" />
                       <Skeleton className="h-4 w-1/4" />
                     </div>
                   </div>
                 </Card>
               ))}
             </div>
          ) : records.length === 0 ? (
            <EmptyState 
              icon={Activity}
              title="No medical records yet"
              description="Your health timeline will appear here once you upload a document or receive one from a healthcare provider."
              action={
                <Link href="/records/new">
                  <Button variant="outline" size="sm">
                    Add your first record
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              {records.map(record => (
                <Link key={record.id} href={`/records/${record.id}`} className="block group">
                  <Card className="transition-shadow hover:shadow-md cursor-pointer border border-slate-200">
                    <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold tracking-wider text-teal-700 uppercase">
                              {formatCategory(record.category)}
                            </span>
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 leading-snug">
                            {record.title || "Untitled Record"}
                          </h3>
                          <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={14} />
                              {new Date(record.occurredAt).toLocaleDateString(undefined, { 
                                year: 'numeric', month: 'short', day: 'numeric' 
                              })}
                            </div>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{formatProvenance(record.provenanceStatus)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center text-slate-400 group-hover:text-teal-600 transition-colors">
                        <ChevronRight size={20} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent Encounters</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
                </div>
              ) : encounters.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-500">No recent appointments.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {encounters.map(enc => (
                    <div key={enc.id} className="flex flex-col gap-1 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                       <div className="flex justify-between items-center">
                         <span className="font-medium text-slate-900 text-sm">
                           {enc.department?.name || "General"}
                         </span>
                         <Badge variant={enc.status === 'COMPLETED' ? 'success' : enc.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}>
                           {enc.status}
                         </Badge>
                       </div>
                       <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                         <Calendar size={12} />
                         {new Date(enc.createdAt).toLocaleDateString()}
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
