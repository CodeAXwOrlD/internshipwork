import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
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
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-mesh md:flex overflow-hidden">
      <ClientSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <ClientHeader
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />

        <main className="flex-1 overflow-y-auto pt-14 md:pt-16 pb-16 md:pb-0 [transform:translateZ(0)] [will-change:scroll-position]">
          <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

