import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Watch, LayoutList, Upload, Package, Gavel, TrendingUp, DollarSign, Radio } from "lucide-react";
import ImageOptimizationMonitor from "@/components/ImageOptimizationMonitor";
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

const navigationItems = [
  {
    title: "Inventory",
    url: createPageUrl("Inventory"),
    icon: LayoutList,
  },
  {
    title: "Sold",
    url: createPageUrl("SoldInventory"),
    icon: DollarSign,
  },
  {
    title: "Add Watch",
    url: createPageUrl("AddWatch"),
    icon: Upload,
  },
  {
    title: "Sources",
    url: createPageUrl("Sources"),
    icon: Package,
  },
  {
    title: "Auctions",
    url: createPageUrl("Auctions"),
    icon: Gavel,
  },
  {
    title: "Optimize Images",
    url: createPageUrl("ReoptimizeImages"),
    icon: TrendingUp,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('watchvault_mode') || 'working';
  });

  const toggleMode = () => {
    const newMode = mode === 'working' ? 'live' : 'working';
    setMode(newMode);
    localStorage.setItem('watchvault_mode', newMode);
  };

  return (
    <SidebarProvider>
      <style>{`
        :root {
          --primary: #1e293b;
          --primary-dark: #0f172a;
          --accent: #d4af37;
          --accent-light: #fbbf24;
        }
      `}</style>
      <div className="min-h-screen flex w-full bg-slate-50">
        <Sidebar className="border-r border-slate-200">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                <Watch className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">WatchVault</h2>
                <p className="text-xs text-slate-500 font-medium">Professional Inventory</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
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
            
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
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
          </SidebarContent>

          <SidebarFooter className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-md">
                <span className="text-slate-900 font-bold text-sm">W</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">Watch Dealer</p>
                <p className="text-xs text-slate-500 truncate">Inventory Manager</p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-slate-900">WatchVault</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
        <ImageOptimizationMonitor />
      </div>
    </SidebarProvider>
  );
}