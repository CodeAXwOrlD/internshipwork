import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Users, Package, TrendingUp, Coins, UserPlus, DollarSign,
  FileText, ArrowRight, AlertTriangle, Eye, Pencil,
  Phone, MessageSquare as MessageSquareIcon, Share2 as Share2Icon,
  Package as PackageIcon, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Tooltip, Area, AreaChart,
} from "recharts";
import DashboardWidgets from "@/components/admin/DashboardWidgets";
import { useAdminServices } from "@/hooks/useAdminServices";
import { SERVICE_ROUTE_MAP } from "@/lib/service-routes";
import { motion } from "framer-motion";
import ClientFormModal from "@/components/admin/ClientFormModal";

interface DashboardStats {
  totalClients: number;
  activeServices: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  commissionEarned: number;
}

interface RecentClient {
  id: string;
  company_name: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  active_services: number;
}

interface ServiceUsage {
  service_name: string;
  usage_count: number;
}

interface RevenueTrend {
  date: string;
  revenue: number;
}

interface PendingAlerts {
  pendingActivation: number;
  nearUsageLimit: number;
  pendingInvoices: number;
}

interface PendingRequest {
  id: string;
  client_id: string;
  service_id: string;
  plan_id: string | null;
  admin_id: string;
  message: string | null;
  created_at: string;
  clients: { company_name: string } | null;
  services: { name: string; category: string } | null;
}

export default function AdminDashboardHome() {
  const { profile } = useAuth();
  const { admin, primaryColor, secondaryColor } = useAdmin();
  const navigate = useNavigate();
  const [editClientId, setEditClientId] = useState<string | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentClients, setRecentClients] = useState<RecentClient[]>([]);
  const [serviceUsage, setServiceUsage] = useState<ServiceUsage[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [alerts, setAlerts] = useState<PendingAlerts>({ pendingActivation: 0, nearUsageLimit: 0, pendingInvoices: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!admin) return;
    fetchAllData();
  }, [admin]);

  async function fetchAllData() {
    setIsLoading(true);
    await Promise.all([
      fetchStats(),
      fetchRecentClients(),
      fetchServiceUsage(),
      fetchRevenueTrend(),
      fetchAlerts(),
      fetchPendingRequests(),
    ]);
    setIsLoading(false);
  }

  async function fetchStats() {
    if (!admin) return;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [clientsRes, servicesRes, thisMonthRes, lastMonthRes] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true })
        .eq("admin_id", admin.id).eq("is_active", true),
      supabase.from("client_services").select("service_id")
        .in("client_id", (await supabase.from("clients").select("id").eq("admin_id", admin.id)).data?.map(c => c.id) || [])
        .eq("is_active", true),
      supabase.from("invoices").select("total_amount")
        .eq("admin_id", admin.id).eq("status", "paid")
        .gte("invoice_date", thisMonthStart.split("T")[0]),
      supabase.from("invoices").select("total_amount")
        .eq("admin_id", admin.id).eq("status", "paid")
        .gte("invoice_date", lastMonthStart.split("T")[0])
        .lte("invoice_date", lastMonthEnd.split("T")[0]),
    ]);

    const uniqueServices = new Set(servicesRes.data?.map(s => s.service_id) || []);
    const thisMonthRevenue = thisMonthRes.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const lastMonthRevenue = lastMonthRes.data?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const commissionRate = admin.commission_rate ?? 0;

    setStats({
      totalClients: clientsRes.count || 0,
      activeServices: uniqueServices.size,
      thisMonthRevenue,
      lastMonthRevenue,
      commissionEarned: thisMonthRevenue * (commissionRate / 100),
    });
  }

  async function fetchRecentClients() {
    if (!admin) return;
    const { data: clients } = await supabase
      .from("clients")
      .select("id, company_name, is_active, created_at, user_id")
      .eq("admin_id", admin.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!clients?.length) { setRecentClients([]); return; }

    const userIds = clients.map(c => c.user_id);
    const clientIds = clients.map(c => c.id);

    const [profilesRes, servicesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds),
      supabase.from("client_services").select("client_id").in("client_id", clientIds).eq("is_active", true),
    ]);

    const profileMap = new Map(profilesRes.data?.map(p => [p.user_id, p]) || []);
    const serviceCountMap = new Map<string, number>();
    servicesRes.data?.forEach(s => {
      serviceCountMap.set(s.client_id, (serviceCountMap.get(s.client_id) || 0) + 1);
    });

    setRecentClients(clients.map(c => {
      const p = profileMap.get(c.user_id);
      return {
        ...c,
        contact_name: p?.full_name || null,
        contact_email: p?.email || null,
        active_services: serviceCountMap.get(c.id) || 0,
      };
    }));
  }

  async function fetchServiceUsage() {
    if (!admin) return;
    const { data: clientIds } = await supabase.from("clients").select("id").eq("admin_id", admin.id);
    if (!clientIds?.length) { setServiceUsage([]); return; }

    const { data: cs } = await supabase
      .from("client_services")
      .select("service_id")
      .in("client_id", clientIds.map(c => c.id))
      .eq("is_active", true);

    if (!cs?.length) { setServiceUsage([]); return; }

    const serviceIds = [...new Set(cs.map(s => s.service_id))];
    const { data: services } = await supabase.from("services").select("id, name").in("id", serviceIds);

    const countMap = new Map<string, number>();
    cs.forEach(s => countMap.set(s.service_id, (countMap.get(s.service_id) || 0) + 1));

    const nameMap = new Map(services?.map(s => [s.id, s.name]) || []);
    setServiceUsage(
      Array.from(countMap.entries())
        .map(([id, count]) => ({ service_name: nameMap.get(id) || "Unknown", usage_count: count }))
        .sort((a, b) => b.usage_count - a.usage_count)
    );
  }

  async function fetchRevenueTrend() {
    if (!admin) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("invoices")
      .select("invoice_date, total_amount")
      .eq("admin_id", admin.id)
      .eq("status", "paid")
      .gte("invoice_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("invoice_date", { ascending: true });

    const byDate = new Map<string, number>();
    data?.forEach(inv => {
      const d = inv.invoice_date;
      byDate.set(d, (byDate.get(d) || 0) + Number(inv.total_amount));
    });

    // Fill in all 30 days
    const trend: RevenueTrend[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      trend.push({ date: key, revenue: byDate.get(key) || 0 });
    }
    setRevenueTrend(trend);
  }

  async function fetchAlerts() {
    if (!admin) return;
    const { data: clientIds } = await supabase.from("clients").select("id").eq("admin_id", admin.id);
    if (!clientIds?.length) return;

    const ids = clientIds.map(c => c.id);

    const [pendingRes, usageRes, invoiceRes] = await Promise.all([
      supabase.from("service_purchase_requests").select("id", { count: "exact", head: true })
        .in("client_id", ids).eq("status", "pending"),
      supabase.from("client_services").select("usage_consumed, usage_limit")
        .in("client_id", ids).eq("is_active", true),
      supabase.from("invoices").select("id", { count: "exact", head: true })
        .eq("admin_id", admin.id).in("status", ["sent", "overdue"]),
    ]);

    const nearLimit = usageRes.data?.filter(s =>
      s.usage_limit > 0 && (s.usage_consumed || 0) >= s.usage_limit * 0.8
    ).length || 0;

    setAlerts({
      pendingActivation: pendingRes.count || 0,
      nearUsageLimit: nearLimit,
      pendingInvoices: invoiceRes.count || 0,
    });
  }

  async function fetchPendingRequests() {
    if (!admin) return;
    const { data: clientIds } = await supabase.from("clients").select("id").eq("admin_id", admin.id);
    if (!clientIds?.length) return;

    const ids = clientIds.map(c => c.id);
    const { data } = await supabase
      .from("service_purchase_requests")
      .select("*, clients(company_name), services(name, category)")
      .in("client_id", ids)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      setPendingRequests(data as any[]);
    }
  }

  // CHANGE TO
  const handleRequestAction = async (requestId: string, status: "approved" | "rejected") => {
    try {
      const req = pendingRequests.find(r => r.id === requestId);

      // Delete any OTHER rows for same client+service (old approved/rejected ones)
      // but NOT the current pending row we want to update
      if (req) {
        await supabase
          .from("service_purchase_requests")
          .delete()
          .eq("client_id", req.client_id)
          .eq("service_id", req.service_id)
          .neq("id", requestId);
      }

      // Now update the current row
      const { error } = await supabase
        .from("service_purchase_requests")
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;

      // Flip is_coming_soon_unlocked on client_services
      if (req) {
        const { data: existingService } = await supabase
          .from("client_services")
          .select("id")
          .eq("client_id", req.client_id)
          .eq("service_id", req.service_id)
          .maybeSingle();

        if (existingService) {
          await supabase
            .from("client_services")
            .update({ is_coming_soon_unlocked: status === "approved" })
            .eq("id", existingService.id);
        } else if (status === "approved" && admin) {
          await supabase
            .from("client_services")
            .insert({
              client_id: req.client_id,
              service_id: req.service_id,
              is_active: true,
              is_coming_soon_unlocked: true,
              usage_limit: 100,
              reset_period: "monthly",
              assigned_by: admin.id,
              assigned_at: new Date().toISOString()
            });
        }
      }

      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setAlerts(prev => ({
        ...prev,
        pendingActivation: Math.max(0, prev.pendingActivation - 1)
      }));

      if (status === "approved" && req) {
        navigate(`/admin/clients/${req.client_id}?tab=services`);
      }
    } catch (err: any) {
      console.error("Failed to update request status:", err);
    }
  };

  const revenueTrendPercent = useMemo(() => {
    if (!stats) return 0;
    if (stats.lastMonthRevenue === 0) return stats.thisMonthRevenue > 0 ? 100 : 0;
    return Math.round(((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100);
  }, [stats]);

  const hasAlerts = alerts.pendingActivation > 0 || alerts.nearUsageLimit > 0 || alerts.pendingInvoices > 0;

  const chartConfig = {
    revenue: { label: "Revenue", color: primaryColor },
    usage_count: { label: "Usage", color: primaryColor },
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 rounded-3xl bg-gradient-to-br from-primary/10 via-white to-accent/10 border border-primary/20 shadow-sm relative overflow-hidden group mb-8"
      >
        <div className="absolute top-0 right-0 p-8 opacity-[0.05] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
          <TrendingUp className="w-48 h-48 text-primary" />
        </div>
        <div className="flex-1 min-w-0 z-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}!
          </h1>
          <p className="text-slate-500 font-medium">
            Manage your network and monitor service performance.
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-center md:items-end z-10 hidden sm:flex">
          <div className="h-14 w-14 mb-2 flex items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xl shadow-primary/10 border border-primary/5">
            <img src="/logo.png" alt="PIXORA" className="h-full w-full object-contain p-1" />
          </div>
          <p className="text-4xl font-black text-primary tabular-nums">{format(new Date(), "HH:mm")}</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
      </motion.div>

      {/* Pending Alerts */}
      {hasAlerts && (
        <Alert className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex flex-wrap gap-3 text-sm">
            {alerts.pendingActivation > 0 && (
              <span
                className="cursor-pointer hover:underline text-yellow-700 font-medium"
                onClick={() => navigate("/admin/clients")}
              >
                {alerts.pendingActivation} client(s) waiting for service activation (Click to manage)
              </span>
            )}
            {alerts.nearUsageLimit > 0 && (
              <span>{alerts.nearUsageLimit} client(s) reached 80%+ usage limit</span>
            )}
            {alerts.pendingInvoices > 0 && (
              <span
                className="cursor-pointer hover:underline text-yellow-700 font-medium"
                onClick={() => navigate("/admin/billing")}
              >
                {alerts.pendingInvoices} invoice(s) pending payment (Click to manage)
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          iconColor={primaryColor}
          label="My Clients"
          value={stats?.totalClients ?? 0}
          subtext="Active clients"
          linkText="View all"
          onLinkClick={() => navigate("/admin/clients")}
        />
        <StatsCard
          icon={<Package className="h-5 w-5" />}
          iconColor={primaryColor}
          label="Services in Use"
          value={stats?.activeServices ?? 0}
          subtext="By all clients"
        />
        <StatsCard
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor={secondaryColor}
          label="This Month Revenue"
          value={`₹${(stats?.thisMonthRevenue ?? 0).toLocaleString("en-IN")}`}
          subtext="From paid invoices"
          trend={revenueTrendPercent}
        />
        <StatsCard
          icon={<Coins className="h-5 w-5" />}
          iconColor={secondaryColor}
          label="Commission Earned"
          value={`₹${(stats?.commissionEarned ?? 0).toLocaleString("en-IN")}`}
          subtext={`${admin?.commission_rate ?? 0}% commission rate`}
        />
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)]">
        <CardHeader className="pb-3 border-b border-sidebar-border/5">
          <CardTitle className="text-lg font-bold text-slate-800">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 min-w-[120px] shrink-0 md:min-w-0 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => navigate("/admin/clients")}>
              <UserPlus className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-slate-600">Add New Client</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 min-w-[120px] shrink-0 md:min-w-0 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => navigate("/admin/services")}>
              <Package className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-slate-600">View Service Catalog</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 min-w-[120px] shrink-0 md:min-w-0 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => navigate("/admin/pricing")}>
              <DollarSign className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-slate-600">Manage Pricing</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2 min-w-[120px] shrink-0 md:min-w-0 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all" onClick={() => navigate("/admin/billing")}>
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-slate-600">Generate Invoice</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Requests Widget */}
      {pendingRequests.length > 0 && (
        <Card className="bg-white border-yellow-200 shadow-sm overflow-hidden mb-6">
          <CardHeader className="bg-yellow-50/50 pb-3 border-b border-yellow-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg font-bold text-slate-800">Pending Service Requests</CardTitle>
              <Badge className="ml-2 bg-yellow-500 text-white">{pendingRequests.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      {req.clients?.company_name}
                      <span className="text-muted-foreground font-normal text-sm">requested</span>
                      {req.services?.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(req.created_at), "MMM d, yyyy 'at' h:mm a")}
                      {req.message && ` • Note: "${req.message}"`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleRequestAction(req.id, "rejected")}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleRequestAction(req.id, "approved")}
                    >
                      Approve & Assign
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Catalog with Lock State */}
      <AdminServiceCatalog primaryColor={primaryColor} />

      {/* Charts Row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Service Usage Chart */}
        <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] hover:shadow-[0_12px_30px_-10px_rgba(48,79,159,0.2)] hover:border-primary/50 transition-all">
          <CardHeader className="pb-2 border-b border-sidebar-border/5">
            <CardTitle className="text-lg font-bold text-slate-800">Service Usage This Month</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {serviceUsage.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={serviceUsage} layout="vertical" margin={{ left: 20, right: 30 }}>
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="service_name" width={120} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="usage_count" fill={primaryColor} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No service usage data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue Trend Chart */}
        <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] hover:shadow-[0_12px_30px_-10px_rgba(48,79,159,0.2)] hover:border-primary/50 transition-all">
          <CardHeader className="pb-2 border-b border-sidebar-border/5">
            <CardTitle className="text-lg font-bold text-slate-800">Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <AreaChart data={revenueTrend} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke={primaryColor}
                  fill="url(#revenueGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Widgets */}
      <DashboardWidgets />

      {/* Recent Clients - Table on desktop, Cards on mobile */}
      <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-sidebar-border/5 pr-20 md:pr-28">
          <CardTitle className="text-lg font-bold text-slate-800">Recent Clients</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => navigate("/admin/clients")}>
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6 pr-20 md:pr-28">
          {recentClients.length > 0 ? (
            <>
              {/* Mobile: Card layout */}
              <div className="space-y-3 md:hidden">
                {recentClients.map((client) => (
                  <div
                    key={client.id}
                    className="rounded-lg border p-4 space-y-2 active:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/admin/clients/${client.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{client.company_name}</p>
                      <Badge variant={client.is_active ? "default" : "destructive"} className="text-[10px]">
                        {client.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {client.contact_name || "—"} · {client.contact_email || "—"}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{client.active_services} Services</Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); navigate(`/admin/clients/${client.id}`); }}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={(e) => { e.stopPropagation(); setEditClientId(client.id); }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop: Table layout */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead>Services</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/clients/${client.id}`)}
                    >
                      <TableCell className="font-medium">{client.company_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.contact_name || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {client.contact_email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{client.active_services}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? "default" : "destructive"}>
                          {client.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/clients/${client.id}`); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); setEditClientId(client.id); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No clients yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Client Modal */}
      {editClientId && (() => {
        const c = recentClients.find(rc => rc.id === editClientId);
        if (!c) return null;
        const clientData = {
          id: c.id,
          company_name: c.company_name,
          industry: null as string | null,
          company_size: null as string | null,
          is_active: c.is_active,
          user_id: c.user_id,
          allow_admin_raw_access: null as boolean | null,
          profile: {
            email: c.contact_email || "",
            full_name: c.contact_name,
            phone: null as string | null,
          },
        };
        return (
          <ClientFormModal
            open={!!editClientId}
            onOpenChange={(open) => { if (!open) setEditClientId(null); }}
            client={clientData}
            onSuccess={() => { setEditClientId(null); fetchAllData(); }}
          />
        );
      })()}
    </div>
  );
}

/* ---------- Admin Service Catalog ---------- */
function AdminServiceCatalog({ primaryColor }: { primaryColor: string }) {
  const { services, loading } = useAdminServices();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Service Catalog</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  const unlocked = services.filter((s) => !s.is_locked);
  const locked = services.filter((s) => s.is_locked);

  const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    voice: { label: "Voice", icon: Phone, color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    messaging: { label: "Messaging", icon: MessageSquareIcon, color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
    social_media: { label: "Social Media", icon: Share2Icon, color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  };

  const handleOpen = (slug: string) => {
    const routeSlug = SERVICE_ROUTE_MAP[slug];
    if (!routeSlug) {
      return;
    }
    navigate(`/admin/${routeSlug}`);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Service Catalog
        <Badge variant="secondary" className="ml-2">{unlocked.length} enabled</Badge>
      </h2>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {unlocked.map((s) => {
          const catConf = CATEGORY_CONFIG[s.category];
          const CatIcon = catConf?.icon || PackageIcon;
          return (
            <Card key={s.id} className="flex flex-col hover-lift cursor-pointer" onClick={() => handleOpen(s.slug)}>
              <CardContent className="pt-6 space-y-3 flex-1">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                    {s.icon_url ? <img src={s.icon_url} alt="" className="h-6 w-6 object-contain" /> : <CatIcon className="h-5 w-5" style={{ color: primaryColor }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <Badge variant="outline" className={cn("text-[10px] capitalize mt-0.5", catConf?.color || "")}>
                      {catConf?.label || s.category}
                    </Badge>
                  </div>
                </div>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                <Button size="sm" className="w-full text-white" style={{ backgroundColor: primaryColor }}>
                  Open Dashboard <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {locked.map((s) => {
          const catConf = CATEGORY_CONFIG[s.category];
          const CatIcon = catConf?.icon || PackageIcon;
          return (
            <Card key={s.id} className="flex flex-col opacity-70 border-dashed relative overflow-hidden">
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                <div className="rounded-full bg-muted p-3"><Lock className="h-5 w-5 text-muted-foreground" /></div>
              </div>
              <CardContent className="pt-6 space-y-3 flex-1">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                    <CatIcon className="h-5 w-5" style={{ color: primaryColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    <Badge variant="outline" className={cn("text-[10px] capitalize mt-0.5", catConf?.color || "")}>
                      {catConf?.label || s.category}
                    </Badge>
                  </div>
                </div>
                {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                <Badge variant="secondary" className="text-xs"><Lock className="mr-1 h-3 w-3" />Not Available</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Stats Card Component ---------- */
function StatsCard({
  icon, iconColor, label, value, subtext, linkText, onLinkClick, trend,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: string | number;
  subtext: string;
  linkText?: string;
  onLinkClick?: () => void;
  trend?: number;
}) {
  return (
    <Card className="bg-white/95 border-primary/20 shadow-[0_4px_20px_-4px_rgba(48,79,159,0.1)] hover:shadow-[0_12px_30px_-10px_rgba(48,79,159,0.2)] hover:border-primary/50 transition-all group overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</CardTitle>
        <div className="rounded-xl p-2 bg-sidebar/5 transition-colors group-hover:bg-primary/10" style={{ color: iconColor }}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-slate-500 font-medium italic">{subtext}</p>
          {trend !== undefined && (
            <span className={`text-[10px] font-bold ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
          )}
          {linkText && onLinkClick && (
            <button onClick={onLinkClick} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wider">
              {linkText}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Skeleton Loader ---------- */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-20 mt-2" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="pt-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-[250px] w-full" /></CardContent></Card>
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
    </div>
  );
}