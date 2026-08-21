"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";
import { LayoutDashboard, Users, FileText } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
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
    { name: "Dashboard", href: "/hospital/dashboard", icon: LayoutDashboard },
    { name: "Encounters", href: "/hospital/encounters", icon: FileText },
    { name: "Providers", href: "/hospital/providers", icon: Users }
  ];

  const switchRole = (r: string) => {
    if (r === "PATIENT") router.push("/dashboard");
    if (r === "PROVIDER") router.push("/provider/dashboard");
    if (r === "LAB_TECHNICIAN" || r === "LAB_ADMIN") router.push("/lab/dashboard");
  };

  return (
    <AppShell
      user={user}
      navItems={navItems}
      title="HealthVault"
      roleSubtitle="Hospital Portal"
      onLogout={handleLogout}
      roles={user?.roles || ["HOSPITAL_STAFF"]}
      currentRole="HOSPITAL_STAFF"
      onRoleSwitch={switchRole}
    >
      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
        {children}
      </div>
    </AppShell>
  );
}
