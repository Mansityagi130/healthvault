import React from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  selector: string;
  token: string;
  expiresInMinutes?: number;
}

export function QRCodeDisplay({ selector, token, expiresInMinutes }: QRCodeDisplayProps) {
  // We encode a URL structure or JSON. JSON is simple.
  const payload = JSON.stringify({ selector, token });

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl max-w-sm mx-auto shadow-sm">
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
        <QRCodeSVG 
          value={payload} 
          size={200}
          level="M"
          includeMargin={false}
          className="rounded-md"
        />
      </div>
      
      <p className="text-center text-sm font-medium text-slate-900 mb-1">
        Scan this QR to access the selected records.
      </p>
      
      {expiresInMinutes && (
        <p className="text-center text-xs text-slate-500">
          Expires in {expiresInMinutes} minutes
        </p>
      )}
    </div>
  );
}
