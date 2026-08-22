"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
import React, { useEffect, useState } from "react";
import Link from "next/link";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
import { Skeleton } from "@/components/ui/Skeleton";
import { FlaskConical, FileText, Activity } from "lucide-react";

export default function LabDashboard() {
  // Normally we would fetch real stats from /api/labs/:labId/stats
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Laboratory Operations</h1>
          <p className="text-slate-500 mt-1">Manage tests, results, and verify clinical data.</p>
        </div>
        <Link href="/lab/reports/new">
          <Button variant="primary" className="gap-2 w-full sm:w-auto">
            <FlaskConical size={16} />
            Create Report
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Draft Reports</p>
                <p className="text-2xl font-bold text-slate-900">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Pending Tests</p>
                <p className="text-2xl font-bold text-slate-900">8</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center">
                <FlaskConical size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Finalized Today</p>
                <p className="text-2xl font-bold text-slate-900">45</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Drafts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            No drafts currently require attention.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
