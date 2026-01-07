import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Watch, LayoutList, Upload, Package, Gavel, TrendingUp, DollarSign, Radio, Settings, LogOut, Wrench, Shield, Copy, Upload as UploadIcon } from "lucide-react";
import AlertsBell from "./components/layout/AlertsBell";
import ToastHistoryBell from "./components/layout/ToastHistoryBell";

import { Toaster } from "@/components/ui/sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('watchvault_mode') || 'working';
  });
  const [user, setUser] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Build navigation based on user role with sections
  const navigationItems = React.useMemo(() => {
    const sections = [
      {
        label: "INVENTORY",
        items: [
          {
            title: "Inventory",
            url: createPageUrl("Inventory"),
            icon: Package,
          },
          {
            title: "Out for Repair",
            url: createPageUrl("OutForRepair"),
            icon: Wrench,
          },
          {
            title: "Sold",
            url: createPageUrl("SoldInventory"),
            icon: DollarSign,
          },
        ]
      },
      {
        label: "MANAGEMENT",
        items: [
          {
            title: "Add Product",
            url: createPageUrl("AddProduct"),
            icon: Upload,
          },
          {
            title: "Sources",
            url: createPageUrl("WatchSources"),
            icon: Package,
          },
          {
            title: "Auctions",
            url: createPageUrl("Auctions"),
            icon: Gavel,
          },
        ]
      },
      {
        label: "SETTINGS",
        items: [
          {
            title: "Company",
            url: createPageUrl("CompanySettings"),
            icon: Watch,
          },
          {
            title: "Settings",
            url: createPageUrl("TenantSettings"),
            icon: Settings,
          },
        ]
      }
    ];

    // Admin-only section
    if (user?.role === 'admin') {
      sections.push({
        label: "ADMIN TOOLS",
        items: [
          {
            title: "Product Types",
            url: createPageUrl("ProductTypeManagement"),
            icon: Package,
          },
          {
            title: "AI Management",
            url: createPageUrl("AiManagement"),
            icon: Package,
          },
          {
            title: "Resolve Duplicates",
            url: createPageUrl("ResolveProductDuplicates"),
            icon: Copy,
          },
          {
            title: "Merge Data",
            url: createPageUrl("MergeData"),
            icon: Package,
          },
          {
            title: "Restore Data",
            url: createPageUrl("RestoreData"),
            icon: UploadIcon,
          }
        ]
      });
    }

    return sections;
  }, [user]);

  useEffect(() => {
    const publicPages = ['index', 'SalesView', 'JoinCompany'];

    if (!publicPages.includes(currentPageName) && !user) {
      const checkAuth = async () => {
        try {
          const currentUser = await base44.auth.me();
          if (!currentUser) {
            base44.auth.redirectToLogin();
          } else {
            setUser(currentUser);
            const companyId = currentUser.data?.company_id || currentUser.company_id;
            setIsImpersonating(currentUser.role === 'admin' && !!companyId);
          }
        } catch (error) {
          base44.auth.redirectToLogin();
        }
      };
      checkAuth();
    }
  }, [currentPageName]);

  const toggleMode = () => {
    const newMode = mode === 'working' ? 'live' : 'working';
    setMode(newMode);
    localStorage.setItem('watchvault_mode', newMode);
  };

  const handleLogout = () => {
    base44.auth.logout("/");
  };

  const handleStopImpersonation = async () => {
    try {
      const result = await base44.functions.invoke('stopImpersonation');
      if (result.data.success) {
        window.location.href = '/SystemAdmin';
      }
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
    }
  };

  // System admin navigation (no company)
  const systemAdminNav = [
    {
      title: "System Admin",
      url: createPageUrl("SystemAdmin"),
      icon: Shield,
    },
    {
      title: "Subscriptions",
      url: createPageUrl("Subscriptions"),
      icon: DollarSign,
    },
    {
      title: "System Settings",
      url: createPageUrl("Settings"),
      icon: Settings,
    },
  ];

  // Render simplified layout for public pages
  if (currentPageName === 'index' || currentPageName === 'SalesView' || currentPageName === 'JoinCompany') {
      return (
        <>
        <style>{`
          :root {
            --primary: #1e293b;
            --primary-dark: #0f172a;
            --accent: #d4af37;
            --accent-light: #fbbf24;
          }
        `}</style>
        <main className="min-h-screen bg-slate-950">
          {children}
        </main>
      </>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <style>{`
        :root {
          --primary: #1e293b;
          --primary-dark: #0f172a;
          --accent: #d4af37;
          --accent-light: #fbbf24;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar collapsible="icon" className="border-r border-slate-200">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="lg:hidden" />
              <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                {user && !(user.data?.company_id || user.company_id) ? (
                  <Shield className="w-6 h-6 text-purple-400" />
                ) : (
                  <Watch className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <h2 className="font-bold text-slate-900 text-lg">WatchVault</h2>
                <p className="text-xs text-slate-500 font-medium">
                  {user && !(user.data?.company_id || user.company_id) ? 'System Admin' : 'Professional Inventory'}
                </p>
              </div>
              <SidebarTrigger className="hidden lg:block ml-auto" />
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {user && (user.data?.company_id || user.company_id) && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                  Mode
                </SidebarGroupLabel>
                <div className="px-3 pb-4">
                  <button
                    onClick={toggleMode}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                      mode === 'live' 
                        ? 'bg-red-600 text-white shadow-lg' 
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        {mode === 'live' ? 'Live Auction' : 'Working'}
                      </span>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors ${
                      mode === 'live' ? 'bg-red-800' : 'bg-slate-400'
                    } relative`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        mode === 'live' ? 'right-1' : 'left-1'
                      }`} />
                    </div>
                  </button>
                </div>
              </SidebarGroup>
            )}

            {user && !(user.data?.company_id || user.company_id) ? (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {systemAdminNav.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`hover:bg-slate-800 hover:text-white transition-all duration-200 rounded-xl mb-1 ${
                            location.pathname === item.url ? 'bg-slate-800 text-white shadow-md' : 'text-slate-700'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-5 h-5" />
                            <span className="font-semibold">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              navigationItems.map((section) => (
                <SidebarGroup key={section.label}>
                  <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                    {section.label}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild 
                            className={`hover:bg-slate-800 hover:text-white transition-all duration-200 rounded-xl mb-1 ${
                              location.pathname === item.url ? 'bg-slate-800 text-white shadow-md' : 'text-slate-700'
                            }`}
                          >
                            <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                              <item.icon className="w-5 h-5" />
                              <span className="font-semibold">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            {isImpersonating && (
              <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-xs font-semibold text-purple-800 mb-2">Impersonating Tenant</p>
                <button
                  onClick={handleStopImpersonation}
                  className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Exit Impersonation
                </button>
              </div>
            )}
            <div className="text-center mb-3">
              <p className="text-xs text-slate-400 font-mono">v1.3.1</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-md shrink-0">
                  <span className="text-slate-900 font-bold text-sm">
                    {user && !(user.data?.company_id || user.company_id) ? 'S' : 'W'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm truncate">
                    {user && !(user.data?.company_id || user.company_id) ? 'System Admin' : 'Watch Dealer'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user && !(user.data?.company_id || user.company_id) ? 'Full Access' : 'Inventory Manager'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                  {user && (user.data?.company_id || user.company_id) && <ToastHistoryBell />}
                  {user && (user.data?.company_id || user.company_id) && <AlertsBell />}
                  <button
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                  >
                  <LogOut className="w-5 h-5" />
                  </button>
              </div>
              </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                    <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
                    <h1 className="text-xl font-bold text-slate-900">WatchVault</h1>
                </div>
                <div className="flex items-center gap-1">
                  <ToastHistoryBell />
                  <AlertsBell />
                </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
          </main>
          <Toaster />
          </div>
          </SidebarProvider>
  );
}