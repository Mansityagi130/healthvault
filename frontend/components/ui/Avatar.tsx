import React from "react";

export function Avatar({ name, className = "" }: { name: string, className?: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className={`flex items-center justify-center rounded-full bg-teal-100 text-teal-800 font-medium ${className}`}>
      {initials || "?"}
    </div>
  );
}
