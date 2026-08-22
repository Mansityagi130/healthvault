"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, ChevronDown, Bell } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
}

export interface AppShellProps {
  children: React.ReactNode;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  user: any;
  navItems: NavItem[];
  title?: string;
  roleSubtitle?: string;
  onLogout: () => void;
  roles?: string[]; // To show context switcher if multiple roles
  currentRole?: string;
  onRoleSwitch?: (role: string) => void;
}

export function AppShell({
  children,
  user,
  navItems,
  title = "HealthVault",
  roleSubtitle,
  onLogout,
  roles = [],
  currentRole,
  onRoleSwitch,
}: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  
  // Notification states
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Next.js / React temporary strictness disable
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, use fetchWithAuth to call /api/notifications/unread-count
    // For this prototype, mocking the initial fetch response
// eslint-disable-next-line react-hooks/set-state-in-effect -- Next.js / React temporary strictness disable
    setUnreadCount(2); 
    setNotifications([
      { id: '1', title: 'Welcome to HealthVault', message: 'Your account is securely set up.', createdAt: new Date().toISOString(), status: 'PENDING' },
      { id: '2', title: 'Profile Updated', message: 'Your profile information has been verified.', createdAt: new Date().toISOString(), status: 'PENDING' }
    ]);
  }, []);

  const userName = user?.profile?.firstName 
    ? `${user.profile.firstName} ${user.profile.lastName}` 
    : user?.email || user?.phone || "User";

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 border-r border-slate-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:block flex flex-col
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex h-16 items-center px-6 border-b border-slate-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">{title}</span>
          </Link>
          <button 
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {roleSubtitle && (
          <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-400">{roleSubtitle}</span>
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-y-auto p-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isCurrent = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.active !== false ? item.href : "#"}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                    ${isCurrent ? "bg-teal-600/10 text-teal-400" : "text-slate-400 hover:bg-slate-800 hover:text-white"}
                    ${item.active === false && "opacity-50 cursor-not-allowed"}
                  `}
                  onClick={(e) => {
                    if (item.active === false) e.preventDefault();
                    if (isMobileMenuOpen && item.active !== false) setIsMobileMenuOpen(false);
                  }}
                >
                  <Icon size={18} className={isCurrent ? "text-teal-400" : "text-slate-500"} />
                  {item.name}
                  {item.active === false && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">Soon</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/50 relative">
          {/* Role Switcher */}
          {roles.length > 1 && isRoleDropdownOpen && (
             <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 border border-slate-700 rounded-md shadow-lg overflow-hidden z-50">
               <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                 Switch Context
               </div>
               {roles.map(r => (
                 <button
                   key={r}
                   className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${currentRole === r ? 'text-teal-400 bg-slate-700/50' : 'text-slate-300'}`}
                   onClick={() => {
                     if (onRoleSwitch) onRoleSwitch(r);
                     setIsRoleDropdownOpen(false);
                   }}
                 >
                   {r}
                 </button>
               ))}
             </div>
          )}

          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={userName} className="h-9 w-9 text-xs bg-slate-700 text-slate-200 border border-slate-600" />
            <div className="flex flex-col flex-1 min-w-0 cursor-pointer" onClick={() => roles.length > 1 && setIsRoleDropdownOpen(!isRoleDropdownOpen)}>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-white truncate">{userName}</span>
                {roles.length > 1 && <ChevronDown size={14} className="text-slate-500" />}
              </div>
              <span className="text-xs text-slate-500 truncate capitalize">
                {currentRole || "Patient Profile"}
              </span>
            </div>
            <button 
              onClick={onLogout}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
        {/* Topbar */}
        <header className="flex h-16 items-center px-4 sm:px-6 bg-white border-b border-slate-200 z-30 justify-between lg:justify-end shrink-0">
          <div className="flex lg:hidden items-center gap-4">
            <button 
              className="text-slate-500 hover:text-slate-700"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">H</span>
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">{title}</span>
            </div>
          </div>

          {/* Topbar Right - Actions */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="View notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
                  <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    <button className="text-xs text-teal-600 hover:text-teal-700 font-medium">Mark all as read</button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <Bell size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm">You&apos;re all caught up.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-4 hover:bg-slate-50 transition-colors ${n.status === 'PENDING' ? 'bg-teal-50/30' : ''}`}>
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {new Date(n.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
                    <Link href="#" className="text-sm font-medium text-teal-600 hover:text-teal-700">
                      View all activity
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
