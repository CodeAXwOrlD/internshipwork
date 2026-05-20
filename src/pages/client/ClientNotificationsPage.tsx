import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell, Info, CheckCircle, AlertTriangle, AlertCircle, Loader2,
  Trash2, Eye, EyeOff, Search, CheckCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string; label: string }> = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10", label: "Info" },
  success: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10", label: "Success" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Warning" },
  error: { icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Error" },
};

export default function ClientNotificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!user) return;
    setLoading(true);
    const currentPage = reset ? 0 : page;
    if (reset) setPage(0);

    let query = supabase
      .from("notifications")
      .select("id, title, message, type, is_read, action_url, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (typeFilter !== "all") query = query.eq("type", typeFilter as "info" | "success" | "warning" | "error");
    if (search.trim()) query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%`);

    const { data, count } = await query;
    if (data) {
      if (currentPage === 0 || reset) {
        setNotifications(data as Notification[]);
      } else {
        setNotifications((prev) => [...prev, ...(data as Notification[])]);
      }
    }
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [user, typeFilter, search, page]);

  useEffect(() => { fetchNotifications(true); }, [user, typeFilter, search]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
  };

  useEffect(() => {
    if (page > 0) fetchNotifications();
  }, [page]);

  // Keep a stable ref for notification callbacks
  const notifCallbacksRef = useRef({
    onInsert: (payload: any) => {
      const n = payload.new as Notification;
      setNotifications((prev) => [n, ...prev]);
      setTotalCount((c) => c + 1);
      toast({ title: n.title, description: n.message });
    }
  });

  useEffect(() => {
    notifCallbacksRef.current = {
      onInsert: (payload: any) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev]);
        setTotalCount((c) => c + 1);
        toast({ title: n.title, description: n.message });
      }
    };
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const randomId = Math.random().toString(36).substring(2, 9);
    const channelName = `client-notifs-page-rt-${user.id}-${randomId}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => notifCallbacksRef.current.onInsert(payload))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const toggleRead = async (id: string, currentRead: boolean) => {
    const newRead = !currentRead;
    await supabase.from("notifications").update({ is_read: newRead, read_at: newRead ? new Date().toISOString() : null }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: newRead } : n)));
  };

  const deleteOne = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotalCount((c) => c - 1);
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast({ title: "All notifications marked as read" });
  };

  const bulkMarkRead = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).in("id", ids);
    setNotifications((prev) => prev.map((n) => (selected.has(n.id) ? { ...n, is_read: true } : n)));
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    await supabase.from("notifications").delete().in("id", ids);
    setNotifications((prev) => prev.filter((n) => !selected.has(n.id)));
    setTotalCount((c) => c - ids.length);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const hasMore = notifications.length < totalCount;
  const filterTypes = ["all", "info", "success", "warning", "error"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Notifications</h1>
          <p className="text-sm text-muted-foreground">Stay updated on your services and account</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
        </Button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {filterTypes.map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(t)}
              className="capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button variant="outline" size="sm" onClick={bulkMarkRead}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Mark Read
          </Button>
          <Button variant="outline" size="sm" onClick={bulkDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* List */}
      {loading && notifications.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-lg font-medium text-foreground">You're all caught up!</p>
          <p className="text-sm text-muted-foreground">No new notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const cfg = typeConfig[notif.type] || typeConfig.info;
            const Icon = cfg.icon;
            return (
              <Card
                key={notif.id}
                className={`p-4 transition-colors cursor-pointer hover:bg-muted/30 ${!notif.is_read ? "border-l-4 border-l-primary bg-primary/5" : ""}`}
                onClick={() => {
                  if (!notif.is_read) toggleRead(notif.id, notif.is_read);
                  if (notif.action_url) navigate(notif.action_url);
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); toggleSelect(notif.id); }}>
                    <Checkbox checked={selected.has(notif.id)} />
                  </div>
                  <div className={`p-2 rounded-full ${cfg.bg}`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{notif.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{cfg.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notif.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })})
                      </span>
                      {notif.action_url && (
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { e.stopPropagation(); navigate(notif.action_url!); }}>
                          View Details →
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); toggleRead(notif.id, notif.is_read); }}
                    >
                      {notif.is_read ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteOne(notif.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Load More ({notifications.length} of {totalCount})
          </Button>
        </div>
      )}
    </div>
  );
}
