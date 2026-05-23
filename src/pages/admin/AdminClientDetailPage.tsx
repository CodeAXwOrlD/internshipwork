import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft, Mail, Phone, Pencil, MoreHorizontal, Ban, Trash2,
  Package, Activity, DollarSign, Users, MessageSquare, FileText,
  PhoneCall, Eye, ShieldCheck, ShieldOff, Clock, Globe, Building2,
  Copy, TrendingUp, Calendar, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import ClientFormModal from "@/components/admin/ClientFormModal";
import AssignServicesModal from "@/components/admin/AssignServicesModal";

/* ────────── Types ────────── */

interface ClientDetail {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  is_active: boolean;
  allow_admin_raw_access: boolean | null;
  created_at: string;
  onboarded_at: string | null;
  profile: {
    email: string;
    full_name: string | null;
    phone: string | null;
    is_active: boolean;
    last_login: string | null;
  };
}

interface AssignedService {
  id: string;
  service_id: string;
  service_name: string;
  category: string;
  base_pricing_model: string;
  plan_name: string | null;
  usage_consumed: number;
  usage_limit: number;
  reset_period: string | null;
  last_reset_at: string | null;
  is_active: boolean;
  custom_price_per_unit: number | null;
  assigned_at: string | null;
}

interface ActivityItem {
  type: "call" | "campaign" | "message";
  id: string;
  timestamp: string | null;
  service_name: string;
  status: string | null;
  extra?: string | null;
}

interface ServiceRequest {
  id: string;
  service_id: string;
  plan_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
  services: { name: string; category: string } | null;
  service_plans: { plan_name: string } | null;
}

/* ────────── Page ────────── */

export default function AdminClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { admin } = useAdmin();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [services, setServices] = useState<AssignedService[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({
    activeServices: 0, totalUsage: 0, totalRevenue: 0, totalLeads: 0,
    totalCalls: 0, totalMessages: 0,
  });
  const [leads, setLeads] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [usageChart, setUsageChart] = useState<{ date: string; count: number }[]>([]);
  const [serviceDistChart, setServiceDistChart] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  /* ── Fetch client ── */
  const fetchClient = useCallback(async () => {
    if (!clientId) return;
    const { data: c, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (error || !c) { setNotFound(true); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, phone, is_active, last_login")
      .eq("user_id", c.user_id)
      .single();

    setClient({
      id: c.id,
      user_id: c.user_id,
      company_name: c.company_name,
      industry: c.industry,
      company_size: c.company_size,
      is_active: c.is_active,
      allow_admin_raw_access: c.allow_admin_raw_access,
      created_at: c.created_at,
      onboarded_at: c.onboarded_at,
      profile: {
        email: profile?.email ?? "",
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        is_active: profile?.is_active ?? true,
        last_login: profile?.last_login ?? null,
      },
    });
  }, [clientId]);

  /* ── Fetch services ── */
  const fetchServices = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("client_services")
      .select("*, services(name, category, base_pricing_model, slug), service_plans(plan_name)")
      .eq("client_id", clientId)
      .order("assigned_at", { ascending: false });

    // get admin pricing
    const { data: pricing } = await supabase
      .from("admin_pricing")
      .select("service_id, custom_price_per_unit");

    const priceMap = new Map(pricing?.map((p) => [p.service_id, p.custom_price_per_unit]) || []);

    setServices(
      (data ?? [])
        .filter((d: any) => d.services?.slug !== "ai-voice-receptionist" && d.services?.slug !== "voice-receptionist")
        .map((d: any) => ({
        id: d.id,
        service_id: d.service_id,
        service_name: d.services?.name ?? "Unknown",
        category: d.services?.category ?? "",
        base_pricing_model: d.services?.base_pricing_model ?? "",
        plan_name: d.service_plans?.plan_name ?? null,
        usage_consumed: d.usage_consumed ?? 0,
        usage_limit: d.usage_limit ?? 0,
        reset_period: d.reset_period,
        last_reset_at: d.last_reset_at,
        is_active: d.is_active ?? false,
        custom_price_per_unit: priceMap.get(d.service_id) ?? null,
        assigned_at: d.assigned_at,
      }))
    );
  }, [clientId]);

  /* ── Fetch stats ── */
  const fetchStats = useCallback(async () => {
    if (!clientId) return;
    const { count: svcCount } = await supabase
      .from("client_services").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("is_active", true);

    const { data: svcUsage } = await supabase
      .from("client_services").select("usage_consumed")
      .eq("client_id", clientId);
    const totalUsage = (svcUsage ?? []).reduce((s, r) => s + (r.usage_consumed || 0), 0);

    const { data: invData } = await supabase
      .from("invoices").select("total_amount, status")
      .eq("client_id", clientId).eq("status", "paid");
    const totalRevenue = (invData ?? []).reduce((s, r) => s + Number(r.total_amount), 0);

    const { count: leadCount } = await supabase
      .from("leads").select("id", { count: "exact", head: true })
      .eq("client_id", clientId);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count: callCount } = await supabase
      .from("call_logs").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).gte("executed_at", thirtyDaysAgo);
    const { count: msgCount } = await supabase
      .from("whatsapp_messages").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).gte("sent_at", thirtyDaysAgo);

    setStats({
      activeServices: svcCount ?? 0,
      totalUsage,
      totalRevenue,
      totalLeads: leadCount ?? 0,
      totalCalls: callCount ?? 0,
      totalMessages: msgCount ?? 0,
    });
  }, [clientId]);

  /* ── Fetch activities ── */
  const fetchActivities = useCallback(async () => {
    if (!clientId) return;
    const { data: calls } = await supabase
      .from("call_logs")
      .select("id, executed_at, status, services(name)")
      .eq("client_id", clientId)
      .order("executed_at", { ascending: false }).limit(5);
    const { data: campaigns } = await supabase
      .from("voice_campaigns")
      .select("id, started_at, status, campaign_name")
      .eq("client_id", clientId)
      .order("started_at", { ascending: false }).limit(5);
    const { data: messages } = await supabase
      .from("whatsapp_messages")
      .select("id, sent_at, status")
      .eq("client_id", clientId)
      .order("sent_at", { ascending: false }).limit(5);

    const items: ActivityItem[] = [
      ...(calls ?? []).map((c: any) => ({
        type: "call" as const, id: c.id,
        timestamp: c.executed_at,
        service_name: c.services?.name ?? "Voice",
        status: c.status,
      })),
      ...(campaigns ?? []).map((c: any) => ({
        type: "campaign" as const, id: c.id,
        timestamp: c.started_at,
        service_name: c.campaign_name ?? "Campaign",
        status: c.status,
      })),
      ...(messages ?? []).map((m: any) => ({
        type: "message" as const, id: m.id,
        timestamp: m.sent_at,
        service_name: "WhatsApp",
        status: m.status,
      })),
    ];
    items.sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
    setActivities(items.slice(0, 15));
  }, [clientId]);

  /* ── Fetch leads ── */
  const fetchLeads = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100);
    setLeads(data ?? []);
  }, [clientId]);

  /* ── Fetch invoices ── */
  const fetchInvoices = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .order("invoice_date", { ascending: false })
      .limit(100);
    setInvoices(data ?? []);
  }, [clientId]);

  /* ── Fetch requests ── */
  const fetchRequests = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from("service_purchase_requests")
      .select("*, services(name, category), service_plans(plan_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setRequests((data as any[]) || []);
  }, [clientId]);

  /* ── Fetch usage chart ── */
  const fetchUsageChart = useCallback(async () => {
    if (!clientId) return;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: calls } = await supabase
      .from("call_logs")
      .select("executed_at")
      .eq("client_id", clientId)
      .gte("executed_at", thirtyDaysAgo);

    const dateMap = new Map<string, number>();
    (calls ?? []).forEach((c) => {
      if (c.executed_at) {
        const d = format(new Date(c.executed_at), "MMM dd");
        dateMap.set(d, (dateMap.get(d) || 0) + 1);
      }
    });
    const chartData = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    setUsageChart(chartData);

    // service distribution
    const { data: svcData } = await supabase
      .from("client_services")
      .select("usage_consumed, services(name)")
      .eq("client_id", clientId);
    setServiceDistChart(
      (svcData ?? [])
        .filter((s: any) => s.usage_consumed > 0)
        .map((s: any) => ({ name: s.services?.name ?? "Unknown", value: s.usage_consumed }))
    );
  }, [clientId]);

  /* ── Load all ── */
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchClient(), fetchServices(), fetchStats(),
        fetchActivities(), fetchLeads(), fetchInvoices(), fetchUsageChart(),
        fetchRequests(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, [fetchClient, fetchServices, fetchStats, fetchActivities, fetchLeads, fetchInvoices, fetchUsageChart, fetchRequests]);

  /* ── Handle Request Action ── */
  const handleRequestAction = async (requestId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("service_purchase_requests")
        .update({ status })
        .eq("id", requestId);
      if (error) throw error;
      toast.success(`Request ${status} successfully.`);
      fetchRequests();
      
      if (status === "approved") {
        setAssignModalOpen(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update request status.");
    }
  };

  /* ── Toggle status ── */
  const toggleStatus = async () => {
    if (!client) return;
    const { error } = await supabase
      .from("clients").update({ is_active: !client.is_active }).eq("id", client.id);
    if (error) { toast.error("Failed to update status"); return; }
    setClient((p) => p ? { ...p, is_active: !p.is_active } : p);
    toast.success(client.is_active ? "Client suspended" : "Client activated");
  };

  /* ── Helpers ── */
  const usagePct = (consumed: number, limit: number) => limit === 0 ? 0 : Math.min((consumed / limit) * 100, 100);
  const usageColor = (pct: number) => pct > 90 ? "text-destructive" : pct > 70 ? "text-yellow-600" : "text-green-600";
  const getInitials = (name?: string | null) =>
    name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?";
  const activityIcon = (type: string) => {
    switch (type) {
      case "call": return <PhoneCall className="h-4 w-4 text-blue-500" />;
      case "campaign": return <Activity className="h-4 w-4 text-purple-500" />;
      case "message": return <MessageSquare className="h-4 w-4 text-green-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const CHART_COLORS = [
    "hsl(222, 47%, 11%)", "hsl(210, 40%, 40%)", "hsl(215, 16%, 47%)",
    "hsl(0, 84%, 60%)", "hsl(142, 71%, 45%)",
  ];

  const invoiceStats = useMemo(() => {
    const totalBilled = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
    const totalPaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
    return { totalBilled, totalPaid, outstanding: totalBilled - totalPaid };
  }, [invoices]);

  /* ── Loading / 404 ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (notFound || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-2xl font-bold text-foreground mb-2">Client not found</h2>
        <p className="text-muted-foreground mb-4">This client doesn't exist or you don't have access.</p>
        <Button onClick={() => navigate("/admin/clients")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients</Button>
      </div>
    );
  }

  const editingClientRow = {
    id: client.id,
    company_name: client.company_name,
    industry: client.industry,
    company_size: client.company_size,
    is_active: client.is_active,
    created_at: client.created_at,
    onboarded_at: client.onboarded_at,
    user_id: client.user_id,
    allow_admin_raw_access: client.allow_admin_raw_access,
    profile: client.profile,
    active_services_count: stats.activeServices,
    total_usage: stats.totalUsage,
    total_revenue: stats.totalRevenue,
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin">Home</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/admin/clients">My Clients</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{client.company_name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/admin/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{client.company_name}</h1>
              <Badge variant={client.is_active ? "default" : "secondary"}>
                {client.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {client.profile.full_name && `${client.profile.full_name} · `}{client.profile.email}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><MoreHorizontal className="mr-2 h-4 w-4" /> Actions</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit Client Info
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAssignModalOpen(true)}>
              <Package className="mr-2 h-4 w-4" /> Manage Services
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" /> Generate Invoice
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MessageSquare className="mr-2 h-4 w-4" /> Send Message
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleStatus}>
              {client.is_active ? <><Ban className="mr-2 h-4 w-4" /> Suspend Account</> : <><ShieldCheck className="mr-2 h-4 w-4" /> Activate Account</>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Top Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(client.profile.full_name || client.company_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{client.profile.full_name || "—"}</p>
                <p className="text-sm text-muted-foreground">{client.company_name}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {client.industry && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" /> {client.industry}
                </div>
              )}
              {client.company_size && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {client.company_size} employees
                </div>
              )}
              <a href={`mailto:${client.profile.email}`} className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" /> {client.profile.email}
              </a>
              {client.profile.phone && (
                <a href={`tel:${client.profile.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {client.profile.phone}
                </a>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {client.profile.last_login
                  ? `Active ${formatDistanceToNow(new Date(client.profile.last_login), { addSuffix: true })}`
                  : "Never logged in"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Quick Stats</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><Package className="h-3.5 w-3.5" /> Active Services</div>
                <p className="text-2xl font-bold text-foreground">{stats.activeServices}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><Activity className="h-3.5 w-3.5" /> Total Usage</div>
                <p className="text-2xl font-bold text-foreground">{stats.totalUsage.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><DollarSign className="h-3.5 w-3.5" /> Revenue</div>
                <p className="text-2xl font-bold text-foreground">₹{stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs"><Users className="h-3.5 w-3.5" /> Leads</div>
                <p className="text-2xl font-bold text-foreground">{stats.totalLeads}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Account Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={client.is_active ? "default" : "destructive"} className="text-sm">
                {client.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div className="text-sm space-y-2 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Member since {client.onboarded_at ? format(new Date(client.onboarded_at), "MMM dd, yyyy") : format(new Date(client.created_at), "MMM dd, yyyy")}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                {formatDistanceToNow(new Date(client.created_at), { addSuffix: false })} old
              </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-1">
                {client.allow_admin_raw_access ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">Full Access Granted</Badge>
                ) : (
                  <Badge variant="secondary">Limited Access</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {client.allow_admin_raw_access
                  ? "You can view recordings and messages"
                  : "Client hasn't granted full data access"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="requests">
            Requests {requests.filter((r) => r.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-700">
                {requests.filter((r) => r.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          <TabsTrigger value="invoices">Invoices & Billing</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* ─── TAB: Overview ─── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Assigned Services */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Assigned Services</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setAssignModalOpen(true)}>
                <Package className="mr-2 h-4 w-4" /> Manage Services
              </Button>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>No services assigned yet</p>
                  <Button size="sm" className="mt-2" onClick={() => setAssignModalOpen(true)}>Assign Services</Button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {services.map((svc) => {
                    const pct = usagePct(svc.usage_consumed, svc.usage_limit);
                    return (
                      <div key={svc.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{svc.service_name}</p>
                              <Badge variant="secondary" className="text-xs">{svc.category}</Badge>
                            </div>
                            {svc.plan_name && <p className="text-xs text-muted-foreground">{svc.plan_name}</p>}
                          </div>
                          <Badge variant={svc.is_active ? "default" : "secondary"} className="text-xs">
                            {svc.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{svc.usage_consumed} / {svc.usage_limit}</span>
                            <span className={usageColor(pct)}>{pct.toFixed(0)}%</span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Resets: {svc.reset_period || "Monthly"}</span>
                          {svc.custom_price_per_unit != null && (
                            <span>₹{svc.custom_price_per_unit}/{svc.base_pricing_model?.replace("per_", "")}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No activity recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((act, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5">{activityIcon(act.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="capitalize">{act.type}</span> — {act.service_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {act.timestamp ? formatDistanceToNow(new Date(act.timestamp), { addSuffix: true }) : "—"}
                        </p>
                      </div>
                      {act.status && (
                        <Badge variant="secondary" className="text-xs capitalize">{act.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Services ─── */}
        <TabsContent value="services">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">All Assigned Services</CardTitle>
              <Button size="sm" onClick={() => setAssignModalOpen(true)}>
                <Package className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </CardHeader>
            <CardContent>
              {services.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No services assigned</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Reset</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>This Month</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((svc) => {
                      const pct = usagePct(svc.usage_consumed, svc.usage_limit);
                      const remaining = Math.max(0, svc.usage_limit - svc.usage_consumed);
                      const monthCost = svc.custom_price_per_unit != null ? svc.usage_consumed * svc.custom_price_per_unit : 0;
                      return (
                        <TableRow key={svc.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{svc.service_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{svc.category}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{svc.plan_name || "Custom"}</TableCell>
                          <TableCell>
                            <div className="w-24">
                              <div className="text-xs mb-1">{svc.usage_consumed}/{svc.usage_limit}</div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          </TableCell>
                          <TableCell className={`text-sm ${usageColor(pct)}`}>{remaining}</TableCell>
                          <TableCell className="text-sm capitalize">{svc.reset_period || "monthly"}</TableCell>
                          <TableCell className="text-sm">
                            {svc.custom_price_per_unit != null ? `₹${svc.custom_price_per_unit}` : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">₹{monthCost.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={svc.is_active ? "default" : "secondary"} className="text-xs">
                              {svc.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Requests ─── */}
        <TabsContent value="requests" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Service Requests</CardTitle>
              <CardDescription>Review and manage client requests for new services.</CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>No service requests found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req.id} className="border rounded-lg p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-foreground text-lg">{req.services?.name || "Unknown Service"}</h4>
                          <Badge 
                            variant={req.status === 'pending' ? 'default' : req.status === 'approved' ? 'secondary' : 'destructive'}
                            className={req.status === 'pending' ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm' : ''}
                          >
                            {req.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Requested on <span className="font-medium text-foreground">{format(new Date(req.created_at), "MMM dd, yyyy 'at' hh:mm a")}</span></p>
                          {req.service_plans?.plan_name && (
                            <p>Preferred Plan: <span className="font-medium text-primary">{req.service_plans.plan_name}</span></p>
                          )}
                        </div>
                        {req.message && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md border text-sm italic">
                            <span className="text-muted-foreground font-semibold pr-2">Message:</span>
                            "{req.message}"
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-border">
                        {req.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="flex-1 md:flex-none border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleRequestAction(req.id, "rejected")}>
                              Reject
                            </Button>
                            <Button size="sm" className="flex-1 md:flex-none bg-primary text-primary-foreground shadow-sm" onClick={() => handleRequestAction(req.id, "approved")}>
                              Approve & Assign
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Usage & Analytics ─── */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Calls (30d)</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalCalls}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Messages (30d)</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalMessages}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Usage</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalUsage.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Revenue</p>
              <p className="text-2xl font-bold text-foreground">₹{stats.totalRevenue.toLocaleString()}</p>
            </CardContent></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Usage Over Time (30d)</CardTitle></CardHeader>
              <CardContent>
                {usageChart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No usage data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={usageChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Usage by Service</CardTitle></CardHeader>
              <CardContent>
                {serviceDistChart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No usage data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={serviceDistChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {serviceDistChart.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── TAB: Invoices & Billing ─── */}
        <TabsContent value="invoices" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Billed</p>
              <p className="text-2xl font-bold text-foreground">₹{invoiceStats.totalBilled.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">₹{invoiceStats.totalPaid.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-destructive">₹{invoiceStats.outstanding.toLocaleString()}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Invoices</CardTitle>
              <Button size="sm" variant="outline"><FileText className="mr-2 h-4 w-4" /> Generate Invoice</Button>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{format(new Date(inv.invoice_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>₹{Number(inv.total_amount).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"} className="capitalize text-xs">
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{inv.paid_at ? format(new Date(inv.paid_at), "MMM dd, yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Leads ─── */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Captured Leads</CardTitle>
              <CardDescription>Leads captured from voice services. Your client can manage these from their dashboard.</CardDescription>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No leads captured yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name || "—"}</TableCell>
                        <TableCell>{lead.company || "—"}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>{lead.email || "—"}</TableCell>
                        <TableCell>
                          {lead.lead_score != null ? (
                            <Badge variant="secondary">{lead.lead_score}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize text-xs">{lead.status || "new"}</Badge>
                        </TableCell>
                        <TableCell className="capitalize text-xs">{lead.lead_source || "—"}</TableCell>
                        <TableCell className="text-xs">{format(new Date(lead.created_at), "MMM dd, yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: Activity Log ─── */}
        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity recorded</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((act, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      {i < activities.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border h-full" />
                      )}
                      <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                        {activityIcon(act.type)}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground capitalize">{act.type} — {act.service_name}</p>
                          {act.status && <Badge variant="secondary" className="text-xs capitalize">{act.status}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {act.timestamp ? format(new Date(act.timestamp), "MMM dd, yyyy 'at' h:mm a") : "—"}
                          {act.timestamp && ` · ${formatDistanceToNow(new Date(act.timestamp), { addSuffix: true })}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ClientFormModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        client={editingClientRow}
        onSuccess={() => {
          fetchClient();
          fetchServices();
          fetchStats();
        }}
      />
      <AssignServicesModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        clientId={client.id}
        clientCompanyName={client.company_name}
        onSuccess={() => {
          fetchServices();
          fetchStats();
        }}
      />
    </div>
  );
}
