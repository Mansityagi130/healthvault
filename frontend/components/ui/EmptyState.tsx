import React from "react";
import { DivideIcon as LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: typeof LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 border-dashed rounded-xl ${className}`}>
      <div className="flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-slate-50 border border-slate-100">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
