import React, { useEffect, useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, Link } from "react-router-dom";
import {
  Package,
  Activity,
  Users,
  Zap,
  MessageCircle,
  Phone,
  Share2,
  MessageSquare,
  AlertTriangle,
  XCircle,
  ArrowRight,
  PhoneIncoming,
  Headphones,
  Sparkles,
  TrendingUp,
  Lock,
  Send,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ServiceCard } from "@/components/services/ServiceCard";
import { useClientServices } from "@/hooks/useClientServices";
import { getServicePath, SERVICE_LABEL_MAP, isComingSoon } from "@/lib/service-routes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DashboardStats {
  activeServices: number;
  totalUsage: number;
  leadsThisMonth: number;
  activeCampaigns: number;
}

interface ActivityItem {
  id: string;
  type: "call" | "campaign" | "whatsapp";
  description: string;
  status: string;
  timestamp: string;
}

const getDashboardCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_dashboard_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let dashboardCache = getDashboardCacheFromStorage();

const saveDashboardCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && dashboardCache) {
      localStorage.setItem(`pixora_dashboard_cache_${uid}`, JSON.stringify(dashboardCache));
    }
  } catch {}
};

export default function ClientDashboardHome() {
  const { profile } = useAuth();
  const {
    client,
    admin,
    assignedServices,
    isLoading: contextLoading,
    primaryColor,
  } = useClient();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(dashboardCache?.stats || null);
  const [activities, setActivities] = useState<ActivityItem[]>(dashboardCache?.activities || []);
  const [isLoading, setIsLoading] = useState(!dashboardCache);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);

  useEffect(() => {
    if (!client || contextLoading) return;
    fetchDashboardData();
  }, [client, contextLoading]);

  async function fetchDashboardData() {
    if (!client) return;
    if (!dashboardCache) {
      setIsLoading(true);
    }

    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();

    const [leadsRes, listsRes, callsRes, outboundCallsRes, waMessagesRes] =
      await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id)
          .gte("created_at", monthStart),
        supabase
          .from("outbound_contact_lists")
          .select("id, created_at, name", { count: "exact" })
          .eq("owner_user_id", client.user_id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("call_logs")
          .select(
            "id, executed_at, status, phone_number, call_type, service_id",
          )
          .eq("client_id", client.id)
          .order("executed_at", { ascending: false })
          .limit(5),
        (supabase as any)
          .from("outbound_call_logs")
          .select("id, created_at, call_status, phone, call_type")
          .eq("owner_user_id", client.user_id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("whatsapp_messages")
          .select("id, sent_at, status, phone_number")
          .eq("client_id", client.id)
          .order("sent_at", { ascending: false })
          .limit(5),
      ]);

    const totalUsage = assignedServices.reduce(
      (sum, s) => sum + s.usage_consumed,
      0,
    );

    const newStats = {
      activeServices: assignedServices.length,
      totalUsage,
      leadsThisMonth: leadsRes.count || 0,
      activeCampaigns: listsRes.count || 0,
    };

    const items: ActivityItem[] = [];

    callsRes.data?.forEach((c) => {
      items.push({
        id: c.id,
        type: "call",
        description: `${c.call_type === "inbound" ? "Inbound" : "Outbound"} call ${c.call_type === "inbound" ? "from" : "to"} ${c.phone_number}`,
        status: c.status || "completed",
        timestamp: c.executed_at || new Date().toISOString(),
      });
    });

    outboundCallsRes.data?.forEach((c: any) => {
      items.push({
        id: c.id,
        type: "call",
        description: `Outbound call to ${c.phone}`,
        status: c.call_status || "completed",
        timestamp: c.created_at || new Date().toISOString(),
      });
    });

    listsRes.data?.forEach((c) => {
      items.push({
        id: c.id,
        type: "campaign",
        description: `Campaign "${c.name}" created`,
        status: "active",
        timestamp: c.created_at || new Date().toISOString(),
      });
    });

    waMessagesRes.data?.forEach((m) => {
      items.push({
        id: m.id,
        type: "whatsapp",
        description: `WhatsApp message sent to ${m.phone_number}`,
        status: m.status || "sent",
        timestamp: m.sent_at || new Date().toISOString(),
      });
    });

    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const slicedActivities = items.slice(0, 10);

    dashboardCache = {
      stats: newStats,
      activities: slicedActivities,
    };
    saveDashboardCacheToStorage();

    setStats(newStats);
    setActivities(slicedActivities);
    setIsLoading(false);
  }

  if (contextLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-64 bg-white/5" />
          <Skeleton className="h-4 w-40 bg-white/5" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 bg-white/5 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (assignedServices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-3xl bg-white p-10 border border-primary/10 shadow-xl shadow-primary/5 max-w-lg">
          <div className="rounded-2xl bg-primary/10 p-6 mb-6 inline-block">
            <Package className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            Hello, {profile?.full_name || profile?.email}!
          </h1>
          <h2 className="text-xl font-semibold text-slate-600 mb-2">
            No services have been assigned yet
          </h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Your dashboard is ready, but you haven't been assigned any AI
            services yet. Contact {admin?.company_name || "your admin"} to get
            started.
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 shadow-xl shadow-primary/20"
            style={{ backgroundColor: primaryColor, color: "white" }}
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Contact Administrator
          </Button>
        </div>
      </div>
    );
  }

  const nearLimitServices = assignedServices.filter((s) => {
    const pct =
      s.usage_limit > 0 ? (s.usage_consumed / s.usage_limit) * 100 : 0;
    return pct >= 80;
  });

  const hasService = (slug: string) =>
    assignedServices.some(
      (s) => s.service_slug === slug || s.service_slug === `ai-${slug}`,
    );



  return (
    <div className="space-y-8">
      {/* Usage Alerts */}
      {nearLimitServices.length > 0 && (
        <Alert className="bg-red-50 border-red-200 text-red-800 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-4">
            <span className="font-bold text-sm">
              Critical usage alerts for {nearLimitServices.length}{" "}
              {nearLimitServices.length === 1 ? "service" : "services"}. Some
              limits are almost reached.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="bg-red-100 border-red-200 text-red-800 hover:bg-red-200 rounded-xl"
              onClick={() => navigate("/client/usage")}
            >
              Review Usage
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-white to-accent/10 border border-primary/20 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
          <TrendingUp className="w-48 h-48 text-primary" />
        </div>
        <div className="flex-1 min-w-0 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest mb-4">
            <Sparkles className="h-3 w-3" />
            <span>AI Efficiency Status: Optimal</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Member"}!
          </h1>
          <p className="text-slate-500 flex items-center gap-2 font-medium">
            Managing{" "}
            <span className="text-primary font-bold">
              {client?.company_name}
            </span>{" "}
            ecosystem
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center md:items-end z-10 hidden sm:flex">
          <div className="h-14 w-14 mb-2 flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xl shadow-primary/10 border border-primary/5">
            <img
              src="/logo.png"
              alt="PIXORA"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <p className="text-4xl font-black text-primary tabular-nums">
            {format(new Date(), "HH:mm")}
          </p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<Package className="h-5 w-5" />}
          color={primaryColor}
          label="Active Services"
          value={assignedServices.length}
          linkText="Manage"
          onLinkClick={() => navigate("/client/usage")}
        />
        <StatsCard
          icon={<Activity className="h-5 w-5" />}
          color={primaryColor}
          label="Usage This Month"
          value={(stats?.totalUsage ?? 0).toLocaleString()}
          subtext="Total units consumed"
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          color={primaryColor}
          label="New Leads"
          value={stats?.leadsThisMonth ?? 0}
          linkText="View"
          onLinkClick={() => navigate("/client/leads")}
        />
        <StatsCard
          icon={<Zap className="h-5 w-5" />}
          color={primaryColor}
          label="Campaigns"
          value={stats?.activeCampaigns ?? 0}
          subtext="Active sequences"
        />
      </div>

      {/* My Services */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
            Active Infrastructure
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary font-bold hover:bg-primary/10 rounded-xl px-4"
            onClick={() => navigate("/client/services")}
          >
            Service Catalog <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {assignedServices.map((svc) => {
            const pct =
              svc.usage_limit > 0
                ? Math.round((svc.usage_consumed / svc.usage_limit) * 100)
                : 0;
            const isOverLimit = pct >= 100;
            const isNearLimit = pct >= 75 && !isOverLimit;

            const isUnknown = svc.service_name === "Unknown" || !svc.service_slug;
            const displayName = isUnknown ? "Leads" : (SERVICE_LABEL_MAP[svc.service_slug as keyof typeof SERVICE_LABEL_MAP] || svc.service_name);
            const displayCategory = isUnknown ? "LEADS" : svc.service_category;
            const displaySlug = isUnknown ? "leads" : svc.service_slug;
            const displayPath = isUnknown ? "/client/leads" : getServicePath(svc.service_slug);
            const svcIsComingSoon = !isUnknown && isComingSoon(svc.service_slug, svc.is_coming_soon_unlocked);

            return (
              <DashboardServiceCard
                key={svc.id}
                svc={svc}
                pct={pct}
                isOverLimit={isOverLimit}
                isNearLimit={isNearLimit}
                displayName={displayName}
                displayCategory={displayCategory}
                displaySlug={displaySlug}
                displayPath={displayPath}
                svcIsComingSoon={svcIsComingSoon}
                primaryColor={primaryColor}
                client={client}
                navigate={navigate}
              />
            );
          })}
        </div>
      </div>

      <ClientAllServices primaryColor={primaryColor} />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-white border-slate-200/60 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200/60 py-4">
            <CardTitle className="text-xl font-bold text-slate-800">
              Stream Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => navigate("/client/usage")}
            >
              Full Logs <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-colors"
                  >
                    <div className="rounded-xl p-3 bg-white/5 border border-white/10 group-hover:border-primary/30 transition-colors">
                      {getActivityIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {format(
                          new Date(item.timestamp),
                          "dd MMM yyyy, hh:mm a",
                        )}
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "rounded-lg px-3 py-1 text-[10px] font-bold uppercase",
                        item.status.includes("fail")
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      )}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <Activity className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-lg font-bold text-slate-800 mb-1">
                  Infrastructure Idle
                </p>
                <p className="text-sm text-slate-500">
                  Global activity will appear here once sequences begin.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/20 backdrop-blur-lg border-white/20 shadow-xl overflow-hidden">
          <CardHeader className="border-b border-white/10 py-4 bg-white/5">
            <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Neural Gateways
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 space-y-3">
            {hasService("voice-telecaller") && (
              <QuickActionButton
                icon={<Phone className="h-5 w-5" />}
                label="Telecaller Hub"
                description="Launch sequences"
                color={primaryColor}
                onClick={() => navigate(getServicePath("voice-telecaller"))}
              />
            )}
            {hasService("whatsapp") && (
              <QuickActionButton
                icon={<MessageCircle className="h-5 w-5" />}
                label="LeadNest Core"
                description="WhatsApp flows"
                color={primaryColor}
                onClick={() => navigate(getServicePath("whatsapp"))}
              />
            )}
            <QuickActionButton
              icon={<Users className="h-5 w-5" />}
              label="Intelligence Base"
              description="Manage leads"
              color={primaryColor}
              onClick={() => navigate("/client/leads")}
            />
            <div className="pt-4 mt-4 border-t border-white/5">
              <Link to="/client/help" className="block w-full">
                <Button
                  variant="outline"
                  className="w-full bg-white/40 border-white/60 text-slate-800 font-bold hover:bg-white/60 hover:text-primary hover:border-primary/30 rounded-2xl py-6 gap-3 shadow-sm transition-all group"
                >
                  <Headphones className="h-5 w-5 text-slate-600 group-hover:text-primary transition-colors" />
                  Reach Technical Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ClientAllServices({ primaryColor }: { primaryColor: string }) {
  const { services, loading } = useClientServices();
  const lockedServices = services.filter((s) => s.is_locked);

  if (loading) return null;
  if (lockedServices.length === 0) return null;

  return (
    <div className="pt-8">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
          Available Expansion
        </h2>
        <Badge
          variant="outline"
          className="bg-primary/5 border-primary/10 text-primary uppercase text-[9px] tracking-widest"
        >
          {lockedServices.length} Locked
        </Badge>
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {lockedServices.map((s) => (
          <ServiceCard key={s.id} service={s} primaryColor={primaryColor} />
        ))}
      </div>
    </div>
  );
}

function StatsCard({
  icon,
  color,
  label,
  value,
  subtext,
  linkText,
  onLinkClick,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string | number;
  subtext?: string;
  linkText?: string;
  onLinkClick?: () => void;
}) {
  return (
    <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] hover:shadow-[0_12px_30px_-10px_rgba(48,79,159,0.2)] hover:border-primary/50 transition-shadow group overflow-hidden relative">
      <div
        className="absolute -top-10 -right-10 h-24 w-24 rounded-full opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none"
        style={{ backgroundColor: color }}
      />
      <CardContent className="pt-6 relative z-10">
        <div className="flex items-center gap-4">
          <div
            className="rounded-2xl p-4 border border-sidebar-border/10 bg-sidebar/5 group-hover:bg-primary/10 transition-colors text-primary"
            style={{ color }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">
              {label}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {value}
              </p>
            </div>
            {subtext && (
              <p className="text-[10px] text-slate-600 font-medium italic mt-1 leading-none">
                {subtext}
              </p>
            )}
          </div>
          {linkText && onLinkClick && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[10px] font-black text-primary hover:bg-primary/10 hover:text-slate-900 rounded-lg group-hover:translate-x-1 transition-transform"
              onClick={onLinkClick}
            >
              {linkText}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionButton({
  icon,
  label,
  description,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 w-full rounded-2xl border border-white/60 bg-white/40 p-4 text-left transition-colors hover:bg-white/60 hover:border-primary/30 shadow-sm overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
        <Sparkles className="h-12 w-12 text-primary" />
      </div>
      <div
        className="rounded-xl p-3 bg-white/5 border border-white/10 group-hover:text-primary transition-colors shadow-inner"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="min-w-0 relative z-10">
        <p className="text-sm font-bold text-slate-800 tracking-tight transition-colors group-hover:text-primary">
          {label}
        </p>
        <p className="text-[10px] text-slate-600 font-medium">{description}</p>
      </div>
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="h-4 w-4 text-primary" />
      </div>
    </button>
  );
}

const getUsageColor = (pct: number) => {
  if (pct >= 90) return "text-red-400";
  if (pct >= 75) return "text-orange-400";
  return "text-emerald-400";
};

function DashboardServiceCard({
  svc,
  pct,
  isOverLimit,
  isNearLimit,
  displayName,
  displayCategory,
  displaySlug,
  displayPath,
  svcIsComingSoon,
  primaryColor,
  client,
  navigate,
}: {
  svc: any;
  pct: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  displayName: string;
  displayCategory: string;
  displaySlug: string;
  displayPath: string;
  svcIsComingSoon: boolean;
  primaryColor: string;
  client: any;
  navigate: (path: string) => void;
}) {
  const [requesting, setRequesting] = useState(false);

  const handleRequestAccess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    setRequesting(true);
    try {
      // 1. Insert into service_purchase_requests
      const { error: requestError } = await supabase
        .from("service_purchase_requests")
        .insert({
          client_id: client.id,
          service_id: svc.service_id,
          plan_id: svc.plan_id || null,
          admin_id: client.admin_id,
          status: "pending",
          message: `Request access to ${displayName} from client dashboard`,
        });

      if (requestError) {
        if (requestError.code === "23505") {
          toast.error("You already have a pending request for this service.");
          return;
        }
        throw requestError;
      }

      // 2. Try to notify admin (silently ignore if RLS restricts admin table queries)
      try {
        const { data: admin } = await supabase
          .from("admins")
          .select("user_id")
          .eq("id", client.admin_id)
          .maybeSingle();

        if (admin?.user_id) {
          await supabase.from("notifications").insert({
            user_id: admin.user_id,
            title: "Service Access Request",
            message: `${client.company_name} requested access to "${displayName}".`,
            type: "info" as const,
            action_url: `/admin/clients/${client.id}`,
          });
        }
      } catch (notifyErr) {
        console.warn("Failed to notify admin via DB notifications:", notifyErr);
      }

      toast.success("Access request sent to your administrator");
    } catch (err) {
      console.error("Request access error:", err);
      toast.error("Failed to send request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div
      className={cn(
        "group hover:-translate-y-1 transition-transform duration-200",
        svcIsComingSoon && "opacity-80"
      )}
    >
      <Card
        className={cn(
          "flex flex-col h-full bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] transition-shadow duration-200 overflow-hidden",
          svcIsComingSoon
            ? "hover:shadow-[0_12px_30px_-10px_rgba(100,100,100,0.15)]"
            : "group-hover:shadow-[0_12px_30px_-10px_rgba(48,79,159,0.2)] group-hover:border-primary/50"
        )}
      >
        {/* Top progress bar */}
        <div className="h-1 bg-slate-100 w-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-[width] duration-700 ease-out",
              svcIsComingSoon
                ? "bg-slate-300"
                : isOverLimit
                  ? "bg-red-500"
                  : isNearLimit
                    ? "bg-orange-400"
                    : "bg-primary",
            )}
            style={{ width: svcIsComingSoon ? "100%" : `${pct}%` }}
          />
        </div>

        <CardContent className="pt-8 flex-1 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="rounded-2xl p-3 bg-white/5 border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                <ServiceIcon
                  slug={displaySlug}
                  color={primaryColor}
                  size={24}
                />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-800 tracking-tight truncate leading-tight group-hover:text-primary transition-colors">
                  {displayName}
                </p>
                {svcIsComingSoon ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mt-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    Coming Soon
                  </span>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-tighter mt-1 bg-primary/5 border-primary/10 text-primary"
                  >
                    {displayCategory}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {svcIsComingSoon ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center">
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  This service is coming soon. Request access from your administrator to get early access.
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-400 uppercase tracking-widest text-[9px]">
                    Resource Usage
                  </span>
                  <span className={getUsageColor(pct)}>{pct}%</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={cn(
                      "h-full transition-[width] duration-700 ease-out",
                      pct >= 90
                        ? "bg-red-500"
                        : pct >= 75
                          ? "bg-orange-500"
                          : "bg-emerald-500",
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 font-medium">
                    {svc.usage_consumed.toLocaleString()} /{" "}
                    {svc.usage_limit.toLocaleString()} units
                  </span>
                  <span className="text-slate-500 italic">
                    Resets {svc.reset_period || "monthly"}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>

        <div className="px-6 pb-6">
          {svcIsComingSoon ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Lock className="h-3 w-3" />
                Locked Interface
              </div>
              <Button
                size="lg"
                className="w-full text-white font-bold rounded-xl shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all"
                style={{ backgroundColor: primaryColor }}
                disabled={requesting}
                onClick={handleRequestAccess}
              >
                <Send className="mr-2 h-4 w-4 text-white" />
                {requesting ? "Transmitting..." : "Request Access from Admin"}
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full text-white font-bold rounded-xl shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-shadow hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
              onClick={() => navigate(displayPath)}
            >
              Access Console
              <ArrowRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ServiceIcon({
  slug,
  color,
  size = 16,
}: {
  slug: string;
  color: string;
  size?: number;
}) {
  const props = { size, style: { color } };
  switch (slug) {
    case "leads":
      return <Users {...props} />;
    case "voice-telecaller":
      return <Phone {...props} />;
    case "voice-receptionist":
      return <PhoneIncoming {...props} />;
    case "voice-agent":
      return <Headphones {...props} />;
    case "whatsapp":
      return <MessageCircle {...props} />;
    case "social-media":
      return <Share2 {...props} />;
    default:
      return <Package {...props} />;
  }
}

function getActivityIcon(type: string) {
  switch (type) {
    case "call":
      return <Phone className="h-4 w-4" />;
    case "campaign":
      return <Zap className="h-4 w-4" />;
    case "whatsapp":
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}
