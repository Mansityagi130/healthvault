"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, Terminal, AlertTriangle, Loader2 } from "lucide-react";

export default function ProviderScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [controls, setControls] = useState<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [resolving, setResolving] = useState(false);

  // Debounce lock
  const isResolving = useRef(false);

  useEffect(() => {
    let activeControls: IScannerControls | null = null;
    
    if (mode === "camera" && videoRef.current) {
      const codeReader = new BrowserQRCodeReader();
      
      codeReader.decodeFromVideoDevice(undefined, videoRef.current, async (result, err) => {
        if (result && !isResolving.current) {
          isResolving.current = true;
          setResolving(true);
          try {
            const parsed = JSON.parse(result.getText());
            if (!parsed.selector || !parsed.token) {
              throw new Error("Invalid QR format");
            }
            await handleResolve(parsed.selector, parsed.token);
          } catch (e: any) {
            setError(e.message || "Failed to process QR code");
            setTimeout(() => {
              isResolving.current = false;
              setResolving(false);
            }, 3000); // Allow scan again after 3s
          }
        }
      }).then(ctrls => {
        activeControls = ctrls;
        setControls(ctrls);
      }).catch(err => {
        setError("Camera permission denied or unsupported. Please use the development fallback.");
        setMode("manual");
      });
    }

    return () => {
      if (activeControls) {
        activeControls.stop();
      }
    };
  }, [mode]);

  const handleResolve = async (selector: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/sharing/qr/resolve", {
        method: "POST",
        body: JSON.stringify({ selector, token })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resolve QR code");
      }

      const data = await res.json();
      router.push(`/provider/shared/${data.sharingSessionId}`);
    } catch (err: any) {
      setError(err.message || "QR resolution failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput) return;
    try {
      const parsed = JSON.parse(manualInput);
      await handleResolve(parsed.selector, parsed.token);
    } catch (e) {
      setError("Invalid JSON payload or network error");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Scan Patient QR</h1>
        <p className="text-slate-500 mt-2">
          Position the patient's HealthVault QR code within the frame to gain authorized access.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3 mb-6">
          <AlertTriangle className="mt-0.5 flex-shrink-0" size={18} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="flex justify-center mb-4 space-x-2">
        <Button 
          variant={mode === "camera" ? "primary" : "outline"} 
          size="sm" 
          onClick={() => setMode("camera")}
          className="gap-2"
        >
          <Camera size={16} /> Camera
        </Button>
        <Button 
          variant={mode === "manual" ? "primary" : "outline"} 
          size="sm" 
          onClick={() => setMode("manual")}
          className="gap-2"
        >
          <Terminal size={16} /> Dev Fallback
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {mode === "camera" ? (
            <div className="relative aspect-square md:aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              {resolving && (
                <div className="absolute inset-0 z-10 bg-black/60 flex flex-col items-center justify-center text-white">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  <p className="font-medium">Resolving authorization...</p>
                </div>
              )}
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover" 
              />
              {/* Scan overlay guides */}
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-dashed border-white/50 rounded" />
              </div>
            </div>
          ) : (
            <form onSubmit={submitManual} className="space-y-4">
              <div className="p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
                <span className="font-bold uppercase text-xs mr-2">Development Fallback</span>
                Paste the raw JSON payload from the patient's QR code.
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">QR Payload</label>
                <textarea 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                  rows={4}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder='{"selector":"...","token":"..."}'
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? "Resolving..." : "Resolve Token"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
