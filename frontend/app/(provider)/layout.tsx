"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";
import { LayoutDashboard, QrCode } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetchWithAuth("/auth/me");
        if (!res.ok) throw new Error("Not authenticated");
        const data = await res.json();
        setUser(data.user || data); // handle standard wrapper if any
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
    { name: "Dashboard", href: "/provider/dashboard", icon: LayoutDashboard },
    { name: "Scan QR", href: "/provider/scan", icon: QrCode }
  ];

  const switchRole = (r: string) => {
    if (r === "PATIENT") router.push("/dashboard");
    if (r === "HOSPITAL_ADMIN" || r === "HOSPITAL_STAFF") router.push("/hospital/dashboard");
    if (r === "LAB_TECHNICIAN" || r === "LAB_ADMIN") router.push("/lab/dashboard");
  };

  return (
    <AppShell
      user={user}
      navItems={navItems}
      title="HealthVault"
      roleSubtitle="Provider Portal"
      onLogout={handleLogout}
      roles={user?.roles || ["PROVIDER"]}
      currentRole="PROVIDER"
      onRoleSwitch={switchRole}
    >
      <div className="p-4 sm:p-6 lg:p-8 w-full max-w-full mx-auto">
        {children}
      </div>
    </AppShell>
  );
}
