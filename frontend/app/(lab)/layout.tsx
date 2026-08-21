"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";
import { LayoutDashboard, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetchWithAuth("/auth/me");
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        setUser(data.user || data);
      } catch (err) {
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetchWithAuth("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      router.push("/login");
    }
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const navItems = [
    { name: "Dashboard", href: "/lab/dashboard", icon: LayoutDashboard },
    { name: "Lab Reports", href: "/lab/reports", icon: FileText }
  ];

  const switchRole = (r: string) => {
    if (r === "PATIENT") router.push("/dashboard");
    if (r === "PROVIDER") router.push("/provider/dashboard");
    if (r === "HOSPITAL_ADMIN" || r === "HOSPITAL_STAFF") router.push("/hospital/dashboard");
  };

  return (
    <AppShell
      user={user}
      navItems={navItems}
      title="HealthVault"
      roleSubtitle="Laboratory Portal"
      onLogout={handleLogout}
      roles={user?.roles || ["LAB_TECHNICIAN"]}
      currentRole="LAB_TECHNICIAN"
      onRoleSwitch={switchRole}
    >
      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
        {children}
      </div>
    </AppShell>
  );
}
