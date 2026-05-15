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
import { useState } from "react";
import { ChevronDown, FileText, BotIcon } from "lucide-react";

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
      
      if (slug === "whatsapp-automation" || slug === "whatsapp") {
        return { 
          title: label, 
          icon: Icon, 
          path: getServicePath(slug),
          subItems: [
            { title: "Overview", icon: BarChart3, path: `${getServicePath(slug)}?tab=overview` },
            { title: "Inbox", icon: MessageSquare, path: `${getServicePath(slug)}?tab=inbox` },
            { title: "Template", icon: FileText, path: `${getServicePath(slug)}?tab=template` },
            { title: "AI Settings", icon: BotIcon, path: `${getServicePath(slug)}?tab=ai-settings` },
          ]
        };
      }
      
      return { title: label, icon: Icon, path: getServicePath(slug) };
    })
    .filter(Boolean) as { title: string; icon: React.ElementType; path: string; subItems?: any[] }[];

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

  // Derived: is the sidebar visually in "expanded" mode (showing labels)?
  // On mobile (<md), the overlay is always expanded when open.
  // On md+, it depends on the collapsed state.
  const isExpanded = !collapsed;

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    "LeadNest": true, // Default open
  });

  const toggleMenu = (title: string) => {
    setOpenMenus(prev => ({ ...prev, [title]: !prev[title] }));
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
          // Mobile (<md): full-width overlay, slides in/out
          "w-64",
          open ? "translate-x-0" : "-translate-x-full",
          // md+: always visible, width depends on collapsed state
          "md:translate-x-0",
          collapsed ? "md:w-20" : "md:w-64"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-white/5 min-h-[80px] py-6 transition-all duration-300",
          collapsed ? "md:justify-center md:px-4" : "justify-between px-6"
        )}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 shadow-lg shadow-black/20 shrink-0 border border-white/10">
              <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-1" />
            </div>
            
            {/* Brand text: always visible on mobile overlay, on md+ depends on collapsed */}
            <div
              className={cn(
                "flex flex-col min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ml-3",
                collapsed ? "md:hidden" : "md:flex"
              )}
            >
              <span className="text-xl font-black text-white tracking-tighter leading-none">PIXORA</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">CLIENT NEST</span>
            </div>
          </div>

          <div className="flex items-center shrink-0">
            {/* Close button: only on mobile overlay */}
            <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            
            {/* Collapse button: on md+ when expanded */}
            {!collapsed && (
              <button
                onClick={onToggleCollapse}
                className="hidden md:flex p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title="Collapse sidebar"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Expand toggle when collapsed: on md+ */}
        {collapsed && (
          <div className="hidden md:flex justify-center border-b border-white/5 pb-4 pt-2">
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
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const isMenuOpen = openMenus[item.title];

            return (
              <div key={item.path} className="flex flex-col">
                <NavLink
                  to={hasSubItems ? (item.subItems[0]?.path || `${item.path}?tab=overview`) : item.path}
                  end={item.path === "/client"}
                  onClick={() => {
                    if (hasSubItems) {
                      toggleMenu(item.title);
                    } else {
                      onClose();
                    }
                  }}
                  className={cn(
                    "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-300 overflow-hidden",
                    // Mobile: always expanded
                    "gap-3 px-4 py-3",
                    // md+: depends on collapsed state
                    collapsed
                      ? "md:justify-center md:px-0 md:gap-0"
                      : "md:gap-3 md:px-4",
                    active && !hasSubItems
                      ? "text-white shadow-lg shadow-primary/10"
                      : "text-slate-200 hover:text-white hover:bg-white/5"
                  )}
                  style={active && !hasSubItems ? { backgroundColor: primaryColor || "#304f9f" } : undefined}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110",
                    active && !hasSubItems ? "text-white" : "text-slate-300 group-hover:text-white"
                  )} />
                  
                  {/* Label: always on mobile, on md+ depends on collapsed */}
                  <span
                    className={cn(
                      "truncate whitespace-nowrap overflow-hidden transition-all duration-300",
                      collapsed ? "md:hidden" : "md:inline-block",
                      "flex-1"
                    )}
                  >
                    {item.title}
                  </span>

                  {/* Active dot / Chevron */}
                  {hasSubItems && !collapsed && (
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400 group-hover:text-white",
                      isMenuOpen && "rotate-180"
                    )} />
                  )}
                  {active && !hasSubItems && (
                    <div 
                      className={cn(
                        "ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_white] shrink-0 transition-opacity duration-300",
                        collapsed ? "md:hidden" : "md:block"
                      )}
                    />
                  )}
                </NavLink>

                {/* Submenu */}
                <AnimatePresence>
                  {hasSubItems && isMenuOpen && !collapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col ml-11 mt-1 space-y-1 overflow-hidden"
                    >
                      {item.subItems!.map((subItem) => {
                        const searchParamTab = new URLSearchParams(location.search).get('tab');
                        const subActive = searchParamTab ? subItem.path.includes(`tab=${searchParamTab}`) : subItem.path.includes('tab=overview');
                        
                        return (
                          <NavLink
                            key={subItem.path}
                            to={subItem.path}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                              subActive 
                                ? "text-white bg-white/10 shadow-sm" 
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            )}
                          >
                            {subItem.icon && <subItem.icon className="h-4 w-4 shrink-0" />}
                            <span className="truncate">{subItem.title}</span>
                          </NavLink>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Support Section */}
        <div className="p-4 mt-auto">
          {/* Collapsed icon-only support button */}
          {collapsed && (
            <button 
              className="hidden md:flex w-full justify-center items-center p-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Contact Support"
              onClick={() => navigate("/client/help")}
            >
              <LifeBuoy className="h-5 w-5" />
            </button>
          )}

          {/* Expanded support card: always on mobile, on md+ when not collapsed */}
          <div className={cn(
            "rounded-2xl bg-white/5 border border-white/10 p-4 transition-opacity duration-300 animate-in fade-in slide-in-from-bottom-2",
            collapsed ? "md:hidden" : "md:block"
          )}>
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
        </div>
      </aside>
    </>
  );
}
