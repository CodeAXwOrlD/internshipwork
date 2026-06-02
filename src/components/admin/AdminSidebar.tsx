import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Palette,
  Package,
  DollarSign,
  Users,
  BarChart,
  CreditCard,
  Settings,
  Bot,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/AdminContext";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "White-Label Settings", icon: Palette, path: "/admin/white-label" },
  { title: "Service Catalog", icon: Package, path: "/admin/services" },
  { title: "My Pricing", icon: DollarSign, path: "/admin/pricing" },
  { title: "My Clients", icon: Users, path: "/admin/clients" },
  { title: "AI Voice Agent", icon: Bot, path: "/admin/voice-agent" },
  { title: "WhatsApp Analytics", icon: MessageCircle, path: "/admin/whatsapp" },
  { title: "WhatsApp Management", icon: Bot, path: "/admin/whatsapp/bots" },
  { title: "Analytics", icon: BarChart, path: "/admin/analytics" },
  { title: "Billing", icon: CreditCard, path: "/admin/billing" },
  { title: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const { admin, logo, primaryColor } = useAdmin();


  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 min-h-[80px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 shadow-lg shadow-black/20 shrink-0 border border-white/10">
              <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-1" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xl font-black text-white tracking-tighter leading-none">PIXORA</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 leading-none">ADMIN NEST</span>
            </div>
          </div>
          <button onClick={onClose} className="md:hidden p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
        <p className="px-5 pt-2 text-xs text-muted-foreground">Admin Portal</p>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => {
            const isClients = item.path === "/admin/clients";
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={!isClients}
                onClick={onClose}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "text-white shadow-lg shadow-primary/10"
                    : "text-slate-200 hover:text-white hover:bg-white/5"
                )}
                style={({ isActive }) => isActive ? { backgroundColor: primaryColor || "#304f9f" } : undefined}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn(
                      "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-slate-300 group-hover:text-white"
                    )} />
                    <span className="truncate">{item.title}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
