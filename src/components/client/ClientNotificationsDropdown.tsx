import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bell, Info, CheckCircle, AlertTriangle, AlertCircle, Loader2, Trash2, Sparkles,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
};

export default function ClientNotificationsDropdown() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [bellShake, setBellShake] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
      .from("notifications")
      .select("id, title, message, type, is_read, action_url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (filter === "unread") {
      query = query.eq("is_read", false);
    }

    const { data } = await query;
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  }, [user, filter]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => { fetchUnreadCount(); }, [fetchUnreadCount]);
  useEffect(() => { if (open) fetchNotifications(); }, [open, fetchNotifications, filter]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("client-notifications-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev].slice(0, 20));
        setUnreadCount((prev) => prev + 1);
        setBellShake(true);
        setTimeout(() => setBellShake(false), 1000);
        toast({ 
          title: n.title, 
          description: n.message,
          variant: n.type === "error" ? "destructive" : "default"
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  const markAsRead = async (id: string, actionUrl: string | null) => {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    if (actionUrl) { setOpen(false); navigate(actionUrl); }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 md:h-11 md:w-11 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
          <motion.div
            animate={bellShake ? { rotate: [0, -20, 20, -20, 20, 0] } : {}}
            transition={{ duration: 0.5 }}
          >
            <Bell className="h-5 w-5 md:h-6 md:w-6" />
          </motion.div>
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 text-[10px] bg-primary text-white border-2 border-slate-950 flex items-center justify-center font-black">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] md:w-[420px] p-0 bg-slate-100/40 backdrop-blur-xl border border-slate-200/40 shadow-2xl mt-2 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4 bg-white/30">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">Signal Feed</h4>
            <Badge variant="outline" className="bg-primary/20 border-primary/20 text-primary text-[10px] tracking-tight">{unreadCount} New</Badge>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">Mark All Read</button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-5 py-3 bg-white/20 border-b border-slate-200/20">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-lg transition-all ${filter === f ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"}`}
            >
              {f === "all" ? "Priority" : "New"}
            </button>
          ))}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[460px] custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-slate-500 font-medium">Syncing signals...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center px-8">
                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">Clear Horizon</p>
                <p className="text-xs text-slate-500">{filter === "unread" ? "You've processed all incoming signals." : "No signals detected at this time."}</p>
              </div>
            ) : (
              notifications.map((notif, idx) => {
                const cfg = typeConfig[notif.type] || typeConfig.info;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <button
                      onClick={() => markAsRead(notif.id, notif.action_url)}
                      className={`group relative flex w-full items-start gap-4 px-5 py-4 text-left transition-all hover:bg-white/50 border-b border-slate-200/60 last:border-0 ${!notif.is_read ? "bg-primary/5" : ""}`}
                    >
                      <div className={`mt-1 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border border-slate-100/50 shadow-sm ${cfg.bg} transition-transform group-hover:scale-110`}>
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className={`text-sm font-bold tracking-tight ${notif.is_read ? "text-slate-500 font-medium" : "text-slate-800"}`}>{notif.title}</p>
                          {!notif.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">{notif.message}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteNotification(e, notif.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 transition-all text-slate-600 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Footer */}
        <div className="bg-white/30 p-4 flex items-center justify-center border-t border-slate-200/40">
          <Button
            variant="ghost"
            onClick={() => { setOpen(false); navigate("/client/notifications"); }}
            className="w-full h-10 text-xs font-bold text-slate-500 hover:text-primary hover:bg-slate-100 rounded-xl gap-2"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Launch Notification Center
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

