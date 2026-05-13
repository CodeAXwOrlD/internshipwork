import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Outlet, useLocation } from "react-router-dom";
import ClientSidebar from "./ClientSidebar";
import ClientHeader from "./ClientHeader";
import MobileBottomNav from "./MobileBottomNav";
import { ClientProvider } from "@/contexts/ClientContext";

export default function ClientLayout() {
  return (
    <ClientProvider>
      <ClientLayoutInner />
    </ClientProvider>
  );
}

function ClientLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  useEffect(() => {
    setSidebarOpen(false);
    // Reset scroll position to top when navigating to a new page
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-mesh md:flex overflow-hidden">
      <ClientSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      
      <div className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        // shift the main content to the right on md+ for the tablet rail and lg+ for the expanded sidebar
        collapsed ? "md:ml-20 lg:ml-20" : "md:ml-20 lg:ml-64"
      )}>
        <ClientHeader
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />

        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pt-14 md:pt-16 pb-16 md:pb-0"
        >
          <div className="p-4 md:p-5 lg:p-6 max-w-[1100px] lg:max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

