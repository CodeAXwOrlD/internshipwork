import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Phone, MessageCircle, Users, Heart, TrendingUp, TrendingDown,
  Download, BarChart3, PieChart as PieChartIcon, Activity,
  ArrowUpRight, ArrowDownRight, Clock, DollarSign,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays, eachDayOfInterval } from "date-fns";
import { formatDuration } from "@/utils/duration";

type DateRange = "7d" | "30d" | "90d" | "this_month" | "last_month";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)",   // blue
  "hsl(142, 71%, 45%)",   // green
  "hsl(280, 67%, 55%)",   // purple
  "hsl(25, 95%, 53%)",    // orange
  "hsl(346, 77%, 50%)",   // rose
  "hsl(48, 96%, 53%)",    // yellow
];

const STATUS_COLORS: Record<string, string> = {
  answered: "hsl(142, 71%, 45%)",
  completed: "hsl(142, 71%, 45%)",
  busy: "hsl(48, 96%, 53%)",
  no_answer: "hsl(215, 14%, 65%)",
  failed: "hsl(0, 84%, 60%)",
  initiated: "hsl(217, 91%, 60%)",
  ringing: "hsl(280, 67%, 55%)",
};

export default function ClientAnalyticsPage() {
  const { client, primaryColor, isLoading: ctxLoading } = useClient();
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    switch (dateRange) {
      case "7d":
        start = subDays(now, 7);
        end = now;
        break;
      case "30d":
        start = subDays(now, 30);
        end = now;
        break;
      case "90d":
        start = subDays(now, 90);
        end = now;
        break;
      case "this_month":
        start = startOfMonth(now);
        end = now;
        break;
      case "last_month":
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      default:
        start = subDays(now, 30);
        end = now;
    }
    const days = differenceInDays(end, start);
    return {
      startDate: start,
      endDate: end,
      prevStartDate: subDays(start, days),
      prevEndDate: start,
    };
  }, [dateRange]);

  const { data: analyticsData = { callLogs: [], waMessages: [], leads: [], socialPosts: [], campaigns: [] }, isLoading: analyticsLoading } = useQuery({
    queryKey: ["client-analytics", client?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!client) return { callLogs: [], waMessages: [], leads: [], socialPosts: [], campaigns: [] };
      const sd = startDate.toISOString();
      const ed = endDate.toISOString();

      const [callsRes, waRes, leadsRes, socialRes, campRes] = await Promise.all([
        supabase.from("call_logs").select("*").eq("client_id", client.id)
          .gte("executed_at", sd).lte("executed_at", ed).order("executed_at"),
        supabase.from("whatsapp_messages").select("*").eq("client_id", client.id)
          .gte("sent_at", sd).lte("sent_at", ed).order("sent_at"),
        supabase.from("leads").select("*").eq("client_id", client.id)
          .gte("created_at", sd).lte("created_at", ed).order("created_at"),
        supabase.from("social_media_posts").select("*").eq("client_id", client.id)
          .gte("created_at", sd).lte("created_at", ed),
        supabase.from("outbound_contact_lists").select("*").eq("owner_user_id", client.user_id)
          .gte("created_at", sd).lte("created_at", ed).order("created_at"),
      ]);

      return {
        callLogs: callsRes.data || [],
        waMessages: waRes.data || [],
        leads: leadsRes.data || [],
        socialPosts: socialRes.data || [],
        campaigns: campRes.data || [],
      };
    },
    enabled: !!client && !ctxLoading,
  });

  const { callLogs, waMessages, leads, socialPosts, campaigns } = analyticsData;
  const loading = analyticsLoading;

  // Derived metrics
  const totalCalls = callLogs.length;
  const totalMessages = waMessages.length;
  const totalLeads = leads.length;
  const totalEngagement = socialPosts.reduce((sum, p) => {
    const s = p.engagement_stats || {};
    return sum + (Number(s.likes) || 0) + (Number(s.comments) || 0) + (Number(s.shares) || 0);
  }, 0);
  const totalCost = callLogs.reduce((s, c) => s + (Number(c.cost) || 0), 0)
    + waMessages.reduce((s, m) => s + (Number(m.cost) || 0), 0);
  const costPerLead = totalLeads > 0 ? totalCost / totalLeads : 0;

  // Call outcomes
  const callOutcomes = useMemo(() => {
    const counts: Record<string, number> = {};
    callLogs.forEach(c => {
      const s = c.status || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
      color: STATUS_COLORS[name] || "hsl(215, 14%, 65%)",
    }));
  }, [callLogs]);

  // Call volume over time
  const callVolumeData = useMemo(() => {
    if (!callLogs.length) return [];
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = callLogs.filter(c => format(new Date(c.executed_at), "yyyy-MM-dd") === dayStr).length;
      return { date: format(day, "MMM d"), calls: count };
    });
  }, [callLogs, startDate, endDate]);

  // WA funnel
  const waFunnel = useMemo(() => {
    const sent = waMessages.length;
    const delivered = waMessages.filter(m => m.status === "delivered" || m.status === "read").length;
    const read = waMessages.filter(m => m.status === "read").length;
    return [
      { name: "Sent", value: sent, fill: CHART_COLORS[0] },
      { name: "Delivered", value: delivered, fill: CHART_COLORS[1] },
      { name: "Read", value: read, fill: CHART_COLORS[2] },
    ];
  }, [waMessages]);

  // Lead sources
  const leadSources = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.lead_source || "manual";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value], i) => ({
      name: name.replace(/_/g, " "),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [leads]);

  // Lead funnel
  const leadFunnel = useMemo(() => {
    const statusOrder = ["new", "contacted", "qualified", "converted"];
    const counts: Record<string, number> = {};
    leads.forEach(l => { counts[l.status || "new"] = (counts[l.status || "new"] || 0) + 1; });
    let cumulative = totalLeads;
    return statusOrder.map((s, i) => {
      const val = cumulative;
      cumulative -= (counts[s] || 0);
      return { name: s.charAt(0).toUpperCase() + s.slice(1), value: val, fill: CHART_COLORS[i] };
    });
  }, [leads, totalLeads]);

  // Leads over time
  const leadsOverTime = useMemo(() => {
    if (!leads.length) return [];
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const count = leads.filter(l => format(new Date(l.created_at), "yyyy-MM-dd") === dayStr).length;
      return { date: format(day, "MMM d"), leads: count };
    });
  }, [leads, startDate, endDate]);

  // Cost breakdown
  const costBreakdown = useMemo(() => {
    const callCost = callLogs.reduce((s, c) => s + (Number(c.cost) || 0), 0);
    const waCost = waMessages.reduce((s, m) => s + (Number(m.cost) || 0), 0);
    return [
      { name: "Voice", value: callCost, color: CHART_COLORS[0] },
      { name: "WhatsApp", value: waCost, color: CHART_COLORS[1] },
    ].filter(c => c.value > 0);
  }, [callLogs, waMessages]);

  // Call performance metrics
  const callMetrics = useMemo(() => {
    const answered = callLogs.filter(c => c.status === "answered" || c.status === "completed").length;
    const totalDuration = callLogs.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
    const answerRate = totalCalls > 0 ? (answered / totalCalls) * 100 : 0;
    return { answered, totalDuration, avgDuration, answerRate };
  }, [callLogs, totalCalls]);

  // Lead score distribution
  const leadScoreDist = useMemo(() => {
    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];
    leads.forEach(l => {
      const score = l.lead_score || 0;
      const bucket = buckets.find(b => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map(b => ({ name: b.range, count: b.count }));
  }, [leads]);

  // Social platform comparison
  const platformComparison = useMemo(() => {
    const platforms: Record<string, { likes: number; comments: number; shares: number; posts: number }> = {};
    socialPosts.forEach(p => {
      if (!platforms[p.platform]) platforms[p.platform] = { likes: 0, comments: 0, shares: 0, posts: 0 };
      const s = p.engagement_stats || {};
      platforms[p.platform].likes += Number(s.likes) || 0;
      platforms[p.platform].comments += Number(s.comments) || 0;
      platforms[p.platform].shares += Number(s.shares) || 0;
      platforms[p.platform].posts++;
    });
    return Object.entries(platforms).map(([name, data]) => ({ name, ...data }));
  }, [socialPosts]);

  function exportCSV() {
    const rows = [
      ["Metric", "Value"],
      ["Total Calls", totalCalls],
      ["Total Messages", totalMessages],
      ["Total Leads", totalLeads],
      ["Total Engagement", totalEngagement],
      ["Total Cost", `₹${totalCost.toFixed(2)}`],
      ["Cost Per Lead", `₹${costPerLead.toFixed(2)}`],
      ["Answer Rate", `${callMetrics.answerRate.toFixed(1)}%`],
      ["Avg Call Duration", `${Math.round(callMetrics.avgDuration)}s`],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

// formatDuration moved to src/utils/duration.ts

  if (ctxLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Analytics & Reports</h1>
          <p className="text-sm text-muted-foreground">Insights into your service performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <OverviewCard icon={<Phone className="h-5 w-5" />} label="Total Calls" value={totalCalls} color={primaryColor} />
        <OverviewCard icon={<MessageCircle className="h-5 w-5" />} label="Total Messages" value={totalMessages} color={primaryColor} />
        <OverviewCard icon={<Users className="h-5 w-5" />} label="Leads Generated" value={totalLeads} color={primaryColor} />
        <OverviewCard icon={<Heart className="h-5 w-5" />} label="Engagement" value={totalEngagement} color={primaryColor} />
        <OverviewCard icon={<DollarSign className="h-5 w-5" />} label="Cost/Lead" value={`₹${costPerLead.toFixed(0)}`} color={primaryColor} />
      </div>

      {/* Tabs for sections */}
      <Tabs defaultValue="voice" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="cost">Cost & ROI</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* Voice Tab */}
        <TabsContent value="voice" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Call Volume */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Call Volume Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {callVolumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={callVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                      <Area type="monotone" dataKey="calls" stroke={primaryColor} fill={primaryColor} fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* Call Outcomes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Call Outcomes</CardTitle>
              </CardHeader>
              <CardContent>
                {callOutcomes.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={callOutcomes} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {callOutcomes.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>

          {/* Call Metrics Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Call Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricItem label="Total Calls" value={totalCalls.toString()} />
                <MetricItem label="Answer Rate" value={`${callMetrics.answerRate.toFixed(1)}%`} />
                <MetricItem label="Avg Duration" value={formatDuration(callMetrics.avgDuration)} />
                <MetricItem label="Total Talk Time" value={formatDuration(callMetrics.totalDuration)} />
                <MetricItem label="Total Cost" value={`₹${totalCost.toFixed(2)}`} />
                <MetricItem label="Leads from Calls" value={leads.filter(l => l.lead_source === "telecaller" || l.lead_source === "receptionist" || l.lead_source === "voice_agent").length.toString()} />
                <MetricItem label="Conversion Rate" value={totalCalls > 0 ? `${((leads.filter(l => l.lead_source !== "manual").length / totalCalls) * 100).toFixed(1)}%` : "0%"} />
                <MetricItem label="Cost Per Lead" value={`₹${costPerLead.toFixed(2)}`} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Message Delivery Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                {waFunnel[0].value > 0 ? (
                  <div className="space-y-3 py-4">
                    {waFunnel.map((item, i) => {
                      const pct = waFunnel[0].value > 0 ? (item.value / waFunnel[0].value) * 100 : 0;
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground">{item.value} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-8 rounded-md overflow-hidden bg-muted">
                            <div
                              className="h-full rounded-md transition-all"
                              style={{ width: `${pct}%`, backgroundColor: item.fill }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">WhatsApp Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <MetricItem label="Messages Sent" value={waMessages.length.toString()} />
                  <MetricItem label="Delivery Rate" value={waMessages.length > 0 ? `${((waMessages.filter(m => m.status === "delivered" || m.status === "read").length / waMessages.length) * 100).toFixed(1)}%` : "0%"} />
                  <MetricItem label="Read Rate" value={waMessages.length > 0 ? `${((waMessages.filter(m => m.status === "read").length / waMessages.length) * 100).toFixed(1)}%` : "0%"} />
                  <MetricItem label="Total Cost" value={`₹${waMessages.reduce((s, m) => s + (Number(m.cost) || 0), 0).toFixed(2)}`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Platform Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {platformComparison.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={platformComparison}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                      <Legend />
                      <Bar dataKey="likes" fill={CHART_COLORS[0]} name="Likes" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="comments" fill={CHART_COLORS[1]} name="Comments" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shares" fill={CHART_COLORS[2]} name="Shares" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Platform Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                {platformComparison.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Posts</TableHead>
                        <TableHead className="text-right">Likes</TableHead>
                        <TableHead className="text-right">Comments</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {platformComparison.map(p => (
                        <TableRow key={p.name}>
                          <TableCell className="capitalize font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.posts}</TableCell>
                          <TableCell className="text-right">{p.likes}</TableCell>
                          <TableCell className="text-right">{p.comments}</TableCell>
                          <TableCell className="text-right">{p.shares}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leads Tab */}
        <TabsContent value="leads" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Lead Sources Pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Leads by Source</CardTitle>
              </CardHeader>
              <CardContent>
                {leadSources.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={leadSources} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {leadSources.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>

            {/* Lead Score Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lead Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {leads.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={leadScoreDist}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                      <Bar dataKey="count" fill={primaryColor} radius={[4, 4, 0, 0]} name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart />}
              </CardContent>
            </Card>
          </div>

          {/* Lead Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lead Conversion Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              {totalLeads > 0 ? (
                <div className="space-y-3 py-4 max-w-lg">
                  {leadFunnel.map((item) => {
                    const pct = totalLeads > 0 ? (item.value / totalLeads) * 100 : 0;
                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">{item.value} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-8 rounded-md overflow-hidden bg-muted">
                          <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, backgroundColor: item.fill }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Leads Over Time */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Leads Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={leadsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }} />
                    <Line type="monotone" dataKey="leads" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Lead Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lead Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricItem label="Total Leads" value={totalLeads.toString()} />
                <MetricItem label="Avg Score" value={totalLeads > 0 ? (leads.reduce((s, l) => s + (l.lead_score || 0), 0) / totalLeads).toFixed(0) : "0"} />
                <MetricItem label="Hot Leads (>70)" value={leads.filter(l => (l.lead_score || 0) > 70).length.toString()} />
                <MetricItem label="Conversion Rate" value={totalLeads > 0 ? `${((leads.filter(l => l.status === "converted").length / totalLeads) * 100).toFixed(1)}%` : "0%"} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost & ROI Tab */}
        <TabsContent value="cost" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {costBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ₹${value.toFixed(0)}`}>
                        {costBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyChart message="No cost data available" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ROI Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <MetricItem label="Total Spent" value={`₹${totalCost.toFixed(2)}`} />
                  <MetricItem label="Total Leads" value={totalLeads.toString()} />
                  <MetricItem label="Cost Per Lead" value={`₹${costPerLead.toFixed(2)}`} />
                  <MetricItem label="Campaigns Run" value={campaigns.length.toString()} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Campaign Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                        <TableHead className="text-right">Called</TableHead>
                        <TableHead className="text-right">Answered</TableHead>
                        <TableHead className="text-right">Answer Rate</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map(c => {
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize text-xs">telecaller</Badge>
                            </TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize text-xs">
                                Active
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : <EmptyChart message="No campaigns found in this period" />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-components

function OverviewCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyChart({ message = "No data available for this period" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
