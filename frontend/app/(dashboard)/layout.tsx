"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithAuth, setAccessToken } from "@/lib/api-client";
import { 
  LayoutDashboard, 
  FileText, 
  Pill, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  Stethoscope, 
  FolderOpen, 
  Share2, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
  AlertCircle, 
  Settings
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

interface User {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  roles?: string[];
  profile?: {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    profileImageRef: string | null;
  };
}

export const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserAndProfile() {
      try {
        const authRes = await fetchWithAuth("/auth/me");
        if (!authRes.ok) {
          router.push("/login");
          return;
        }
        const authData = await authRes.json();
        const userData = authData.user;

        const profileRes = await fetchWithAuth("/patient/profile");
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUser({ ...userData, profile });

          const hasName = profile.firstName && profile.lastName;
          if (!hasName && pathname !== "/onboarding") {
            router.push("/onboarding");
          } else if (hasName && pathname === "/onboarding") {
            router.push("/dashboard");
          }
        } else {
          router.push("/login");
        }
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js / React temporary strictness disable
      } catch (err) {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadUserAndProfile();
  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      await fetchWithAuth("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      router.push("/login");
    }
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Records", href: "/records", icon: FileText },
    { name: "Documents", href: "/documents", icon: FolderOpen, active: false },
    { name: "Sharing & Consent", href: "/sharing", icon: Share2 },
    { name: "Lab Connections", href: "/lab-connections", icon: Pill },
    { name: "Settings", href: "/settings", icon: Settings, active: false },
  ];

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700"></div>
          <p className="text-sm font-medium text-slate-500">Loading your vault...</p>
        </div>
      </div>
    );
  }

  const switchRole = (r: string) => {
    if (r === "PROVIDER") router.push("/provider/dashboard");
    if (r === "HOSPITAL_ADMIN" || r === "HOSPITAL_STAFF") router.push("/hospital/dashboard");
    if (r === "LAB_TECHNICIAN" || r === "LAB_ADMIN") router.push("/lab/dashboard");
  };

  return (
    <UserContext.Provider value={user}>
      <AppShell
        user={user}
        navItems={navItems}
        title="HealthVault"
        roleSubtitle="Patient Portal"
        onLogout={handleLogout}
        roles={user?.roles || ["PATIENT"]}
        currentRole="PATIENT"
        onRoleSwitch={switchRole}
      >
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </AppShell>
    </UserContext.Provider>
  );
}
