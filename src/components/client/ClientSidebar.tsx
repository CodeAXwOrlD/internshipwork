import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Activity,
  Settings,
  BarChart3,
  Package,
  X,
  Sparkles,
  Zap,
  MessageSquare,
  Layout,
  History as HistoryIcon,
  ChevronsLeft,
  ChevronsRight,
  LifeBuoy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";
import { getServicePath, getServiceIcon, getServiceLabel } from "@/lib/service-routes";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ClientSidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ClientSidebar({ open, onClose, collapsed, onToggleCollapse }: ClientSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, assignedServices, primaryColor } = useClient();

  const serviceNavItems = assignedServices
    .map((svc) => {
      const slug = svc.service_slug;
      const Icon = getServiceIcon(slug);
      const label = getServiceLabel(slug) || svc.service_name;
      if (!Icon) return null;
      return { title: label, icon: Icon, path: getServicePath(slug) };
    })
    .filter(Boolean) as { title: string; icon: React.ElementType; path: string }[];

  const leadsNavItem = { title: "Leads", icon: Users, path: "/client/leads" };
  const socialMediaIdx = serviceNavItems.findIndex(item => item.path === "/client/social-media");
  if (socialMediaIdx !== -1) {
    serviceNavItems.splice(socialMediaIdx + 1, 0, leadsNavItem);
  } else {
    serviceNavItems.push(leadsNavItem);
  }

  const commonNavItems = [
    { title: "Live Chat", icon: MessageSquare, path: "/client/live-chat" },
    { title: "Bot History", icon: HistoryIcon, path: "/client/whatsapp/history" },
    { title: "AI Configuration", icon: Sparkles, path: "/client/ai-config" },
    { title: "Service Catalog", icon: Package, path: "/client/services" },
    { title: "Analytics", icon: BarChart3, path: "/client/analytics" },
    { title: "Usage & Billing", icon: Activity, path: "/client/usage" },
    { title: "Settings", icon: Settings, path: "/client/settings" },
  ];

  const allNavItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/client" },
    ...serviceNavItems,
    ...commonNavItems,
  ];

  // Find the most specific (longest) path that matches the current URL
  const activePath = allNavItems.reduce((longest, item) => {
    if (location.pathname.startsWith(item.path)) {
      if (item.path === "/client" && location.pathname !== "/client") return longest;
      if (item.path.length > longest.length) return item.path;
    }
    return longest;
  }, "");

  const isActive = (path: string) => {
    if (path === "/client") return location.pathname === "/client";
    return path === activePath;
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-sidebar/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar flex flex-col border-r border-sidebar-border overflow-hidden transition-[width] duration-300 ease-in-out",
          // Keep a compact rail on tablets (md) and only expand on large screens
          "md:translate-x-0 md:w-20",
          collapsed ? "lg:w-20" : "lg:w-64",
          open ? "translate-x-0" : "-translate-x-full md:-translate-x-0",
          "w-64"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-white/5 min-h-[80px] py-6 transition-all duration-300",
          collapsed ? "justify-center px-4" : "justify-between px-6"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 shadow-lg shadow-black/20 shrink-0 border border-white/10">
              <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-1" />
            </div>
            
            <div
              className={cn(
                "flex flex-col min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300",
                collapsed ? "hidden" : "hidden lg:flex ml-3"
              )}
            >
              <span className="text-xl font-black text-white tracking-tighter leading-none">PIXORA</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">CLIENT NEST</span>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            
            {!collapsed && (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Collapse sidebar"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* If collapsed, show the expand toggle right below header or inline */}
        {collapsed && (
          <div className="hidden lg:flex justify-center border-b border-white/5 pb-4 pt-2">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Expand sidebar"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar px-4">
          {allNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/client"}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden",
                  collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
                  active
                    ? "text-white shadow-lg shadow-primary/10"
                    : "text-slate-200 hover:text-white hover:bg-white/5"
                )}
                style={active ? { backgroundColor: primaryColor || "#304f9f" } : undefined}
                title={collapsed ? item.title : undefined}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                  active ? "text-white" : "text-slate-300 group-hover:text-white"
                )} />
                
                <span
                  className={cn(
                    "truncate whitespace-nowrap overflow-hidden transition-all duration-300",
                    collapsed ? "hidden" : "hidden lg:inline-block"
                  )}
                >
                  {item.title}
                </span>

                {active && !collapsed && (
                  <div 
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white] shrink-0 transition-opacity duration-300" 
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Support Section */}
        <div className="p-4 mt-auto">
          {collapsed ? (
            <button 
              className="w-full flex justify-center items-center p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Contact Support"
              onClick={() => navigate("/client/help")}
            >
              <LifeBuoy className="h-5 w-5" />
            </button>
          ) : (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4 transition-opacity duration-300 animate-in fade-in slide-in-from-bottom-2">
              <p className="text-xs font-semibold text-white mb-1">Need help?</p>
              <p className="text-[10px] text-slate-300 mb-3 leading-relaxed">Contact your manager for any assistance.</p>
              <Button 
                size="sm" 
                variant="ghost" 
                className="w-full h-8 text-[11px] bg-primary/20 hover:bg-primary/30 text-white rounded-lg"
                onClick={() => navigate("/client/help")}
              >
                Contact Support
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
