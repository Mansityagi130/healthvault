"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, FileText, CheckCircle } from "lucide-react";

export default function NewLabReportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const handleFinalize = () => {
    // Call API here...
    setShowModal(false);
    router.push("/lab/dashboard");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Sign & Finalize Report</h2>
              <p className="text-slate-600 text-sm">
                Finalizing this report will lock the report and its results. You will not be able to edit them afterward.
              </p>
            </div>
            <div className="flex gap-3 p-4 bg-slate-50 border-t border-slate-100">
              <Button className="flex-1" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" variant="primary" onClick={handleFinalize}>
                <CheckCircle size={16} className="mr-2 inline" /> Sign & Finalize
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Create Lab Report</h1>
        <p className="text-slate-500 mt-1">Structured medical data workflow.</p>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-2 flex-1 rounded-full transition-colors ${step >= s ? 'bg-teal-600' : 'bg-slate-200'}`} />
        ))}
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="text-slate-800">
            {step === 1 && "Identify Patient"}
            {step === 2 && "Report Metadata"}
            {step === 3 && "Structured Results"}
            {step === 4 && "Review Report"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID / Public ID</label>
                <input type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="Scan or enter Patient ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Encounter ID (Optional)</label>
                <input type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="Encounter ID" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test Title</label>
                <input type="text" className="w-full border border-slate-300 rounded-md p-2 focus:ring-teal-500 focus:border-teal-500 outline-none" placeholder="e.g. Complete Blood Count" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Collection Date</label>
                <input type="datetime-local" className="w-full border border-slate-300 rounded-md p-2 focus:ring-teal-500 focus:border-teal-500 outline-none" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Test Name</label>
                    <input type="text" className="w-full border border-slate-300 rounded-md p-2 outline-none" placeholder="e.g. Hemoglobin" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                    <input type="text" className="w-full border border-slate-300 rounded-md p-2 outline-none" placeholder="14.2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit</label>
                    <input type="text" className="w-full border border-slate-300 rounded-md p-2 outline-none" placeholder="g/dL" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Reference Range</label>
                    <input type="text" className="w-full border border-slate-300 rounded-md p-2 outline-none" placeholder="13.8 - 17.2" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select className="w-full border border-slate-300 rounded-md p-2 outline-none bg-white">
                      <option>NORMAL</option>
                      <option>HIGH</option>
                      <option>LOW</option>
                      <option>CRITICAL</option>
                      <option>ABNORMAL</option>
                      <option>UNSPECIFIED</option>
                    </select>
                  </div>
                </div>
              </div>
              <Button variant="outline" className="w-full border-dashed border-slate-300 text-teal-600 hover:text-teal-700">Add Another Result</Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-full">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900">Current Status: Draft</h3>
                    <p className="text-sm text-amber-700">Please review the details below before signing.</p>
                  </div>
                </div>
                <Badge variant="warning">DRAFT</Badge>
              </div>

              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-500 mb-4">Summary will appear here (mocked for UI step)...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-6">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : router.back()}>
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step < 4 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)}>
            Next Step
          </Button>
        ) : (
          <Button variant="primary" className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={() => setShowModal(true)}>
            <CheckCircle size={16} />
            Sign & Finalize
          </Button>
        )}
      </div>
    </div>
  );
}
