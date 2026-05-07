import { Menu, Sparkles, LogOut, Settings, User, CreditCard, PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useClient } from "@/contexts/ClientContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import ClientNotificationsDropdown from "./ClientNotificationsDropdown";
import { motion } from "framer-motion";

export default function ClientHeader({ onMenuClick, collapsed, onToggleCollapse }: { onMenuClick: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { profile, logout } = useAuth();
  const { client, admin, assignedServices, primaryColor } = useClient();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() ?? "CL";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Calculate overall usage percentage
  const totalLimit = assignedServices.reduce((sum, s) => sum + s.usage_limit, 0);
  const totalConsumed = assignedServices.reduce((sum, s) => sum + s.usage_consumed, 0);
  const usagePercent = totalLimit > 0 ? Math.round((totalConsumed / totalLimit) * 100) : 0;

  // Determine page title from route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === "/client") return "Dashboard";
    if (path.includes("/leads")) return "Leads";
    if (path.includes("/usage")) return "Usage & Billing";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/voice-telecaller")) return "Voice Telecaller";
    if (path.includes("/voice-receptionist")) return "Voice Receptionist";
    if (path.includes("/voice-agent")) return "Voice Agent";
    if (path.includes("/whatsapp")) return "WhatsApp";
    if (path.includes("/social-media")) return "Social Media";
    return "Dashboard";
  };

  return (
    <header className={`fixed top-0 right-0 left-0 z-30 flex h-16 md:h-16 items-center justify-between border-b border-white/5 bg-sidebar px-4 md:px-8 safe-area-top shadow-sm shadow-black/20 transition-[left] duration-300 ${collapsed ? 'md:left-[72px]' : 'md:left-64'}`}>
      {/* Left: hamburger on mobile and page title */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="md:hidden h-10 w-10 text-white" onClick={onMenuClick}>
          <Menu className="h-6 w-6" />
        </Button>
        <div className="md:hidden flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/5 border border-white/10 shrink-0">
          <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-0.5" />
        </div>
        <motion.span
          key={getPageTitle()}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-lg font-bold text-white tracking-tight"
        >
          {getPageTitle()}
        </motion.span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">

        {/* Usage indicator (Table/Desktop only) */}
        {totalLimit > 0 && (
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-semibold text-slate-200 uppercase tracking-widest">Usage</span>
              <div className="w-24 md:w-32 bg-white/10 rounded-full overflow-hidden h-1.5 border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary to-orange-400"
                />
              </div>
            </div>
            <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/10">{usagePercent}%</span>
          </div>
        )}

        <div className="h-6 w-[1px] bg-white/10 mx-1 hidden md:block" />

        {/* Notifications */}
        <ClientNotificationsDropdown />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 md:h-11 md:w-11 rounded-xl text-white text-sm font-bold shadow-lg shadow-primary/20 overflow-hidden group transition-all"
            >
              <div 
                className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity" 
                style={{ backgroundColor: primaryColor || "#304f9f" }} 
              />
              <span className="relative z-10">{initials}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-sidebar border-white/10 text-slate-100 mt-2 shadow-2xl">
            <DropdownMenuLabel className="font-normal py-3 bg-white/5">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold text-white">{profile?.full_name ?? "Client"}</p>
                <p className="text-xs text-slate-400">{client?.company_name}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={() => navigate("/client/settings")} className="gap-2 py-2.5 hover:bg-white/5">
              <User className="h-4 w-4 text-primary" />
              <span>My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/client/usage")} className="gap-2 py-2.5 hover:bg-white/5">
              <CreditCard className="h-4 w-4 text-primary" />
              <span>Usage & Billing</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/client/settings")} className="gap-2 py-2.5 hover:bg-white/5">
              <Settings className="h-4 w-4 text-primary" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 gap-2 py-2.5 hover:bg-red-500/10">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

