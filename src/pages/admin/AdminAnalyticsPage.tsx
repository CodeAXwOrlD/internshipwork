import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity, BarChart3,
  RefreshCw, Download, Lightbulb, AlertTriangle, Rocket, CheckCircle,
  ArrowUpRight, Eye,
} from "lucide-react";
import { format, subDays, subMonths, startOfYear, differenceInDays } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Tooltip, Legend,
} from "recharts";

type DateRange = "7" | "30" | "90" | "year";

const CATEGORY_COLORS: Record<string, string> = {
  voice: "hsl(217, 91%, 60%)",
  messaging: "hsl(142, 71%, 45%)",
  social_media: "hsl(280, 67%, 55%)",
};

const PIE_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(280, 67%, 55%)",
  "hsl(25, 95%, 53%)",
  "hsl(340, 82%, 52%)",
  "hsl(45, 93%, 47%)",
];

export default function AdminAnalyticsPage() {
  const { admin, primaryColor } = useAdmin();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRange>("30");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Data states
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [totalClientsCount, setTotalClientsCount] = useState(0);
  const [totalUsage, setTotalUsage] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState<{ date: string; revenue: number; commission: number }[]>([]);
  const [revenueByService, setRevenueByService] = useState<{ name: string; value: number }[]>([]);
  const [clientGrowth, setClientGrowth] = useState<{ month: string; newClients: number; cumulative: number }[]>([]);
  const [topClients, setTopClients] = useState<{ company_name: string; services_count: number; total_usage: number; revenue: number }[]>([]);
  const [usageByCategory, setUsageByCategory] = useState<{ category: string; count: number }[]>([]);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const end = new Date();
    let start: Date;
    if (range === "year") start = startOfYear(end);
    else start = subDays(end, parseInt(range));

    const days = differenceInDays(end, start);
    const pEnd = new Date(start);
    pEnd.setDate(pEnd.getDate() - 1);
    const pStart = subDays(pEnd, days);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      prevStartDate: pStart.toISOString(),
      prevEndDate: pEnd.toISOString(),
    };
  }, [range]);

  const fetchClientIds = useCallback(async () => {
    if (!admin) return [];
    const { data } = await supabase.from("clients").select("id").eq("admin_id", admin.id);
    const ids = data?.map(c => c.id) || [];
    setClientIds(ids);
    return ids;
  }, [admin]);

  const fetchAll = useCallback(async () => {
    if (!admin) return;
    setIsLoading(true);
    const ids = await fetchClientIds();

    await Promise.all([
      fetchRevenue(ids),
      fetchActiveClients(ids),
      fetchTotalUsage(ids),
      fetchRevenueTrend(),
      fetchRevenueByService(ids),
      fetchClientGrowth(),
      fetchTopClients(ids),
      fetchUsageByCategory(ids),
    ]);

    setLastUpdated(new Date());
    setIsLoading(false);
  }, [admin, startDate, endDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function fetchRevenue(ids: string[]) {
    if (!admin) return;
    const [currentRes, prevRes, totalRes] = await Promise.all([
      supabase.from("invoices").select("total_amount")
        .eq("admin_id", admin.id).eq("status", "paid")
        .gte("invoice_date", startDate.split("T")[0]).lte("invoice_date", endDate.split("T")[0]),
      supabase.from("invoices").select("total_amount")
        .eq("admin_id", admin.id).eq("status", "paid")
        .gte("invoice_date", prevStartDate.split("T")[0]).lte("invoice_date", prevEndDate.split("T")[0]),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("admin_id", admin.id),
    ]);
    setTotalRevenue(currentRes.data?.reduce((s, i) => s + Number(i.total_amount), 0) || 0);
    setPrevRevenue(prevRes.data?.reduce((s, i) => s + Number(i.total_amount), 0) || 0);
    setTotalClientsCount(totalRes.count || 0);
  }

  async function fetchActiveClients(ids: string[]) {
    if (!ids.length) { setActiveClientsCount(0); return; }
    const { data: callClients } = await supabase.from("call_logs").select("client_id")
      .in("client_id", ids).gte("executed_at", startDate);
    const { data: msgClients } = await supabase.from("whatsapp_messages").select("client_id")
      .in("client_id", ids).gte("sent_at", startDate);
    const uniqueIds = new Set([
      ...(callClients?.map(c => c.client_id) || []),
      ...(msgClients?.map(c => c.client_id) || []),
    ]);
    setActiveClientsCount(uniqueIds.size);
  }

  async function fetchTotalUsage(ids: string[]) {
    if (!ids.length) { setTotalUsage(0); return; }
    const { data } = await supabase.from("client_services").select("usage_consumed")
      .in("client_id", ids);
    setTotalUsage(data?.reduce((s, r) => s + (r.usage_consumed || 0), 0) || 0);
  }

  async function fetchRevenueTrend() {
    if (!admin) return;
    const { data } = await supabase.from("invoices").select("invoice_date, total_amount")
      .eq("admin_id", admin.id).eq("status", "paid")
      .gte("invoice_date", startDate.split("T")[0]).lte("invoice_date", endDate.split("T")[0])
      .order("invoice_date", { ascending: true });

    const byDate = new Map<string, number>();
    data?.forEach(inv => {
      const d = inv.invoice_date;
      byDate.set(d, (byDate.get(d) || 0) + Number(inv.total_amount));
    });

    const days = differenceInDays(new Date(endDate), new Date(startDate));
    const commissionRate = (admin.commission_rate ?? 0) / 100;
    const trend: { date: string; revenue: number; commission: number }[] = [];
    for (let i = days; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      const rev = byDate.get(key) || 0;
      trend.push({ date: key, revenue: rev, commission: rev * commissionRate });
    }
    setRevenueTrend(trend);
  }

  async function fetchRevenueByService(ids: string[]) {
    if (!admin || !ids.length) { setRevenueByService([]); return; }
    const [csRes, apRes, svcRes] = await Promise.all([
      supabase.from("client_services").select("service_id, usage_consumed").in("client_id", ids),
      supabase.from("admin_pricing").select("service_id, custom_price_per_unit").eq("admin_id", admin.id),
      supabase.from("services").select("id, name"),
    ]);

    const priceMap = new Map(apRes.data?.map(p => [p.service_id, Number(p.custom_price_per_unit) || 0]) || []);
    const nameMap = new Map(svcRes.data?.map(s => [s.id, s.name]) || []);
    const revenueMap = new Map<string, number>();

    csRes.data?.forEach(cs => {
      const price = priceMap.get(cs.service_id) || 0;
      const rev = (cs.usage_consumed || 0) * price;
      const name = nameMap.get(cs.service_id) || "Unknown";
      revenueMap.set(name, (revenueMap.get(name) || 0) + rev);
    });

    setRevenueByService(
      Array.from(revenueMap.entries())
        .map(([name, value]) => ({ name, value }))
        .filter(r => r.value > 0)
        .sort((a, b) => b.value - a.value)
    );
  }

  async function fetchClientGrowth() {
    if (!admin) return;
    const { data } = await supabase.from("clients").select("onboarded_at")
      .eq("admin_id", admin.id).order("onboarded_at", { ascending: true });

    if (!data?.length) { setClientGrowth([]); return; }

    const byMonth = new Map<string, number>();
    data.forEach(c => {
      if (!c.onboarded_at) return;
      const month = format(new Date(c.onboarded_at), "yyyy-MM");
      byMonth.set(month, (byMonth.get(month) || 0) + 1);
    });

    let cumulative = 0;
    const growth = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => {
        cumulative += count;
        return { month, newClients: count, cumulative };
      });
    setClientGrowth(growth);
  }

  async function fetchTopClients(ids: string[]) {
    if (!admin || !ids.length) { setTopClients([]); return; }
    const [clientsRes, csRes, apRes] = await Promise.all([
      supabase.from("clients").select("id, company_name").eq("admin_id", admin.id),
      supabase.from("client_services").select("client_id, service_id, usage_consumed").in("client_id", ids),
      supabase.from("admin_pricing").select("service_id, custom_price_per_unit").eq("admin_id", admin.id),
    ]);

    const nameMap = new Map(clientsRes.data?.map(c => [c.id, c.company_name]) || []);
    const priceMap = new Map(apRes.data?.map(p => [p.service_id, Number(p.custom_price_per_unit) || 0]) || []);

    const clientMap = new Map<string, { services: Set<string>; usage: number; revenue: number }>();
    csRes.data?.forEach(cs => {
      const entry = clientMap.get(cs.client_id) || { services: new Set(), usage: 0, revenue: 0 };
      entry.services.add(cs.service_id);
      entry.usage += cs.usage_consumed || 0;
      entry.revenue += (cs.usage_consumed || 0) * (priceMap.get(cs.service_id) || 0);
      clientMap.set(cs.client_id, entry);
    });

    setTopClients(
      Array.from(clientMap.entries())
        .map(([id, data]) => ({
          company_name: nameMap.get(id) || "Unknown",
          services_count: data.services.size,
          total_usage: data.usage,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
    );
  }

  async function fetchUsageByCategory(ids: string[]) {
    if (!ids.length) { setUsageByCategory([]); return; }
    const [callsRes, msgsRes, postsRes] = await Promise.all([
      supabase.from("call_logs").select("id", { count: "exact", head: true })
        .in("client_id", ids).gte("executed_at", startDate),
      supabase.from("whatsapp_messages").select("id", { count: "exact", head: true })
        .in("client_id", ids).gte("sent_at", startDate),
      supabase.from("social_media_posts").select("id", { count: "exact", head: true })
        .in("client_id", ids).gte("created_at", startDate),
    ]);
    setUsageByCategory([
      { category: "Voice", count: callsRes.count || 0 },
      { category: "Messaging", count: msgsRes.count || 0 },
      { category: "Social Media", count: postsRes.count || 0 },
    ]);
  }

  const commissionRate = admin?.commission_rate ?? 0;
  const commissionEarned = totalRevenue * (commissionRate / 100);
  const revenueTrendPct = prevRevenue === 0 ? (totalRevenue > 0 ? 100 : 0) : Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100);

  const chartConfig = {
    revenue: { label: "Revenue", color: "hsl(217, 91%, 60%)" },
    commission: { label: "Commission", color: "hsl(142, 71%, 45%)" },
    newClients: { label: "New Clients", color: "hsl(217, 91%, 60%)" },
    cumulative: { label: "Total Clients", color: "hsl(142, 71%, 45%)" },
    count: { label: "Usage", color: "hsl(217, 91%, 60%)" },
  };

  const insights = useMemo(() => {
    const items: { icon: React.ReactNode; text: string; type: "success" | "warning" | "info" }[] = [];
    if (revenueByService.length > 0) {
      const top = revenueByService[0];
      const totalRev = revenueByService.reduce((s, r) => s + r.value, 0);
      const pct = totalRev > 0 ? Math.round((top.value / totalRev) * 100) : 0;
      items.push({ icon: <Rocket className="h-4 w-4" />, text: `${top.name} is your best performer with ${pct}% of revenue`, type: "success" });
    }
    if (activeClientsCount > 0 && totalClientsCount > 0) {
      const retention = Math.round((activeClientsCount / totalClientsCount) * 100);
      items.push({ icon: <CheckCircle className="h-4 w-4" />, text: `Client activity rate: ${retention}% (${activeClientsCount} of ${totalClientsCount})`, type: retention >= 80 ? "success" : "warning" });
    }
    if (revenueTrendPct > 0) {
      items.push({ icon: <TrendingUp className="h-4 w-4" />, text: `Revenue is up ${revenueTrendPct}% compared to the previous period`, type: "success" });
    } else if (revenueTrendPct < 0) {
      items.push({ icon: <AlertTriangle className="h-4 w-4" />, text: `Revenue declined ${Math.abs(revenueTrendPct)}% — consider upselling`, type: "warning" });
    }
    if (totalUsage > 0) {
      items.push({ icon: <Lightbulb className="h-4 w-4" />, text: `${totalUsage.toLocaleString("en-IN")} total units consumed across all services`, type: "info" });
    }
    return items;
  }, [revenueByService, activeClientsCount, totalClientsCount, revenueTrendPct, totalUsage]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" /><Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground">Performance insights for your business</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden md:block">
            Updated {format(lastUpdated, "h:mm a")}
          </span>
          <Button variant="outline" size="icon" onClick={fetchAll} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Revenue"
          value={`₹${totalRevenue.toLocaleString("en-IN")}`}
          icon={<DollarSign className="h-5 w-5" />}
          trend={revenueTrendPct}
          subtext="From paid invoices"
        />
        <MetricCard
          label="Commission Earned"
          value={`₹${commissionEarned.toLocaleString("en-IN")}`}
          icon={<TrendingUp className="h-5 w-5" />}
          subtext={`at ${commissionRate}% rate`}
        />
        <MetricCard
          label="Active Clients"
          value={activeClientsCount}
          icon={<Users className="h-5 w-5" />}
          subtext={`out of ${totalClientsCount} total`}
        />
        <MetricCard
          label="Total Usage"
          value={totalUsage.toLocaleString("en-IN")}
          icon={<Activity className="h-5 w-5" />}
          subtext="units across all services"
        />
      </div>

      {/* Revenue Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenue Over Time</CardTitle>
            <CardDescription>Total revenue and your commission</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={revenueTrend} margin={{ left: 10, right: 10, top: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(217, 91%, 60%)" fill="url(#revGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="commission" stroke="hsl(142, 71%, 45%)" fill="url(#comGrad)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenue by Service</CardTitle>
            <CardDescription>Distribution across services</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByService.length > 0 ? (
              <div className="flex flex-col items-center">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                  <PieChart>
                    <Pie
                      data={revenueByService}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {revenueByService.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {revenueByService.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No revenue data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Analytics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Client Growth</CardTitle>
            <CardDescription>New clients and cumulative total</CardDescription>
          </CardHeader>
          <CardContent>
            {clientGrowth.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <LineChart data={clientGrowth} margin={{ left: 5, right: 5, top: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => format(new Date(v + "-01"), "MMM yy")} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} labelFormatter={(v) => format(new Date(v + "-01"), "MMMM yyyy")} />
                  <Bar dataKey="newClients" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="cumulative" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No client data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Usage by Category</CardTitle>
            <CardDescription>Activity across service types</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={usageByCategory} margin={{ left: 10, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {usageByCategory.map((entry, i) => (
                    <Cell key={i} fill={Object.values(CATEGORY_COLORS)[i] || PIE_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Top Clients by Revenue</CardTitle>
            <CardDescription>Your highest-performing clients</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {topClients.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-center">Services</TableHead>
                  <TableHead className="text-center">Usage</TableHead>
                  <TableHead className="text-right">Revenue (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClients.map((client, i) => (
                  <TableRow key={client.company_name}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{client.company_name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{client.services_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{client.total_usage.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-semibold">₹{client.revenue.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No client revenue data yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {insights.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${item.type === "success" ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900" :
                      item.type === "warning" ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900" :
                        "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900"
                    }`}
                >
                  <span className={`mt-0.5 ${item.type === "success" ? "text-green-600" :
                      item.type === "warning" ? "text-yellow-600" : "text-blue-600"
                    }`}>
                    {item.icon}
                  </span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, subtext, trend }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext: string;
  trend?: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{subtext}</span>
          {trend !== undefined && trend !== 0 && (
            <Badge variant={trend > 0 ? "default" : "destructive"} className="text-xs px-1.5 py-0">
              {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend)}%
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
