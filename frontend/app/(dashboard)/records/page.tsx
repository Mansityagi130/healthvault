"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, FileText, Filter, ChevronLeft, ChevronRight, Activity, Calendar } from "lucide-react";

interface RecordItem {
  id: string;
  category: string;
  title: string;
  occurredAt: string;
  source: string;
  provenanceStatus: string;
  lifecycleStatus: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "CONSULTATION", label: "Consultations" },
  { value: "PRESCRIPTION", label: "Prescriptions" },
  { value: "LAB_REPORT", label: "Lab Reports" },
  { value: "IMAGING", label: "Imaging" },
  { value: "DISCHARGE_SUMMARY", label: "Discharge Summaries" },
  { value: "VACCINATION", label: "Vaccinations" },
  { value: "OTHER", label: "Other" },
];

const formatCategory = (cat: string) => {
  const match = CATEGORIES.find(c => c.value === cat);
  return match ? match.label : cat;
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

export default function RecordsPage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (category) {
        qs.set("category", category);
      }
      if (search) {
        qs.set("search", search);
      }
      
      const res = await fetchWithAuth(`/patient/records?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      
      setRecords(data.items || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [category, search, page, pageSize]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setPage(1); // Reset to first page
  };

  const handlePrev = () => {
    if (page > 1) setPage(p => p - 1);
  };
  const handleNext = () => {
    if (pagination && page < pagination.totalPages) setPage(p => p + 1);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Health Records</h1>
          <p className="text-slate-500 mt-1">Your medical history, organized in one secure place.</p>
        </div>
        
        <Link href="/records/new">
          <Button variant="primary" className="gap-2 w-full sm:w-auto">
            <Plus size={16} />
            Add Record
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <SearchBar onSearch={handleSearch} initialValue={search} placeholder="Search records by title..." />
      </div>

      {/* Filters (Scrollable on mobile) */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => handleCategoryChange(cat.value)}
            className={`
              whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${category === cat.value 
                ? "bg-teal-700 text-white" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900"}
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (
        <Card className="p-12 flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <Activity size={24} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">We couldn't load your records.</h3>
          <p className="text-slate-500 mb-6">Please check your connection and try again.</p>
          <Button variant="outline" onClick={loadRecords}>Try again</Button>
        </Card>
      ) : loading ? (
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
          icon={FileText}
          title={search || category ? "No records match your filters" : "No health records yet"}
          description={search || category ? "Try adjusting your search or category filters to find what you're looking for." : "Your medical records will appear here when you add your first record or receive one from a healthcare provider."}
          action={
            !search && !category ? (
              <Link href="/records/new">
                <Button variant="outline">Add your first record</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <Link key={record.id} href={`/records/${record.id}`} className="block">
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
                        {record.lifecycleStatus !== "ACTIVE" && (
                          <Badge variant={getStatusVariant(record.lifecycleStatus)}>
                            {record.lifecycleStatus}
                          </Badge>
                        )}
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
                  
                  <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-3 sm:mt-0">
                    <span className="text-teal-600 text-sm font-medium sm:hidden flex items-center gap-1">
                      View details <ChevronRight size={16} />
                    </span>
                    <span className="hidden sm:flex text-slate-400 group-hover:text-teal-600 transition-colors">
                      <ChevronRight size={20} />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-6 mt-6">
              <p className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-900">{((pagination.page - 1) * pagination.pageSize) + 1}</span> to <span className="font-medium text-slate-900">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of <span className="font-medium text-slate-900">{pagination.total}</span> records
              </p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={handlePrev}
                  className="h-8 px-2"
                >
                  <ChevronLeft size={16} />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium px-2">{page}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === pagination.totalPages}
                  onClick={handleNext}
                  className="h-8 px-2"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
