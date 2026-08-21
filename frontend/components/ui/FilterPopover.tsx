import React, { useState } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "./Button";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

interface FilterPopoverProps {
  groups: FilterGroup[];
  activeFilters: Record<string, string>;
  onFilterChange: (filters: Record<string, string>) => void;
  className?: string;
}

export function FilterPopover({ groups, activeFilters, onFilterChange, className = "" }: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = Object.keys(activeFilters).filter(k => activeFilters[k]).length;

  const handleSelect = (groupId: string, value: string) => {
    const newFilters = { ...activeFilters };
    if (newFilters[groupId] === value) {
      delete newFilters[groupId];
    } else {
      newFilters[groupId] = value;
    }
    onFilterChange(newFilters);
  };

  const clearAll = () => {
    onFilterChange({});
  };

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2 bg-white"
        aria-expanded={isOpen}
      >
        <Filter size={16} />
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
            {activeCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-64 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <span className="font-semibold text-sm">Filters</span>
            {activeCount > 0 && (
              <button onClick={clearAll} className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                Clear all
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto p-4 space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="space-y-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group.label}</span>
                <div className="space-y-1">
                  {group.options.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={activeFilters[group.id] === opt.value}
                        onChange={() => handleSelect(group.id, opt.value)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
}
