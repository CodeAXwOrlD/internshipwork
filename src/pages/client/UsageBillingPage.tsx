import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { format, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays, addMonths } from "date-fns";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, Activity, FileText, Download,
  AlertTriangle, XCircle, ChevronDown, Send, Calendar, ArrowUpRight, Printer,
  Mail, CreditCard, Filter, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Legend
} from "recharts";

type DateRange = "this_month" | "last_month" | "custom";

interface UsageRecord {
  id: string;
  service_id: string | null;
  usage_type: string;
  quantity: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  metadata: any;
  recorded_at: string | null;
  service_name?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number | null;
  total_amount: number;
  status: string | null;
  paid_at: string | null;
  payment_method: string | null;
  notes: string | null;
  admin_id: string | null;
  client_id: string | null;
}

export default function UsageBillingPage() {
  const { client, admin, assignedServices, isLoading: clientLoading } = useClient();
  const [dateRange, setDateRange] = useState<DateRange>("this_month");

  const [activeChart, setActiveChart] = useState("daily");
  const [invoiceModal, setInvoiceModal] = useState<Invoice | null>(null);
  const [limitDialog, setLimitDialog] = useState(false);
  const [limitService, setLimitService] = useState("");
  const [limitRequested, setLimitRequested] = useState("");
  const [limitReason, setLimitReason] = useState("");
  const [usageFilter, setUsageFilter] = useState("all");
  const [usageSearch, setUsageSearch] = useState("");
  const [usagePage, setUsagePage] = useState(0);
  const PAGE_SIZE = 50;

  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    if (dateRange === "last_month") {
      const lm = subMonths(now, 1);
      return { rangeStart: startOfMonth(lm), rangeEnd: endOfMonth(lm) };
    }
    return { rangeStart: startOfMonth(now), rangeEnd: endOfMonth(now) };
  }, [dateRange]);

  const { data: usageRecords = [], isLoading: usageLoading } = useQuery({
    queryKey: ["client-usage-records", client?.id, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      if (!client) return [];
      const { data, error } = await supabase
        .from("usage_tracking")
        .select("*")
        .eq("client_id", client.id)
        .gte("recorded_at", rangeStart.toISOString())
        .lte("recorded_at", rangeEnd.toISOString())
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      if (!data) return [];

      const serviceIds = [...new Set(data.map(u => u.service_id).filter(Boolean))];
      let serviceMap = new Map<string, string>();
      if (serviceIds.length > 0) {
        const { data: svcs } = await supabase
          .from("services")
          .select("id, name")
          .in("id", serviceIds as string[]);
        svcs?.forEach(s => serviceMap.set(s.id, s.name));
      }

      return data.map(u => ({
        ...u,
        service_name: u.service_id ? serviceMap.get(u.service_id) || "Unknown" : "General",
      })) as UsageRecord[];
    },
    enabled: !!client,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["client-invoices", client?.id],
    queryFn: async () => {
      if (!client) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", client.id)
        .order("invoice_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!client,
  });

  const loading = usageLoading || invoicesLoading;

  const totalUsage = usageRecords.reduce((s, r) => s + (r.quantity || 0), 0);
  const totalCost = usageRecords.reduce((s, r) => s + (r.total_cost || 0), 0);

  // Alerts
  const alerts = assignedServices
    .map(s => {
      const pct = s.usage_limit > 0 ? (s.usage_consumed / s.usage_limit) * 100 : 0;
      if (pct >= 100) return { service: s, level: "critical" as const, pct };
      if (pct >= 80) return { service: s, level: "warning" as const, pct };
      return null;
    })
    .filter(Boolean) as { service: typeof assignedServices[0]; level: "warning" | "critical"; pct: number }[];

  const overdueInvoices = invoices.filter(i => i.status === "overdue");

  // Chart data
  const chartData = useMemo(() => {
    const days = differenceInDays(rangeEnd, rangeStart) + 1;
    const map = new Map<string, Record<string, number>>();
    for (let i = 0; i < days; i++) {
      const d = format(subDays(rangeEnd, days - 1 - i), "yyyy-MM-dd");
      map.set(d, {});
    }
    usageRecords.forEach(r => {
      if (!r.recorded_at) return;
      const d = format(new Date(r.recorded_at), "yyyy-MM-dd");
      const entry = map.get(d);
      if (entry) {
        const svc = r.service_name || "Other";
        entry[svc] = (entry[svc] || 0) + (r.quantity || 0);
      }
    });
    return Array.from(map.entries()).map(([date, svcs]) => ({ date: format(new Date(date), "MMM d"), ...svcs }));
  }, [usageRecords, rangeStart, rangeEnd]);

  const serviceNames = [...new Set(usageRecords.map(r => r.service_name || "Other"))];
  const chartColors = ["hsl(var(--primary))", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  // Filtered usage
  const filteredUsage = usageRecords.filter(r => {
    if (usageFilter !== "all" && r.service_name !== usageFilter) return false;
    if (usageSearch && !r.usage_type.toLowerCase().includes(usageSearch.toLowerCase())) return false;
    return true;
  });
  const pagedUsage = filteredUsage.slice(usagePage * PAGE_SIZE, (usagePage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredUsage.length / PAGE_SIZE);

  const handleRequestIncrease = async () => {
    if (!client || !limitService || !limitRequested) return;
    const svc = assignedServices.find(s => s.service_id === limitService);
    if (!svc) return;

    const { error } = await supabase.from("notifications").insert({
      user_id: client.admin_id,
      title: "Limit Increase Request",
      message: `Client ${client.company_name} requested to increase ${svc.service_name} limit from ${svc.usage_limit} to ${limitRequested}. Reason: ${limitReason}`,
      type: "info" as const,
      action_url: `/admin/clients/${client.id}`,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to send request", variant: "destructive" });
    } else {
      toast({ title: "Request Sent", description: "Your admin has been notified" });
      setLimitDialog(false);
      setLimitService("");
      setLimitRequested("");
      setLimitReason("");
    }
  };

  const exportCSV = () => {
    const rows = [["Date", "Service", "Type", "Quantity", "Unit Cost", "Total Cost"]];
    filteredUsage.forEach(r => {
      rows.push([
        r.recorded_at ? format(new Date(r.recorded_at), "yyyy-MM-dd HH:mm") : "",
        r.service_name || "",
        r.usage_type,
        String(r.quantity || 0),
        String(r.unit_cost || 0),
        String(r.total_cost || 0),
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-report-${format(rangeStart, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      sent: "bg-blue-100 text-blue-700",
      paid: "bg-green-100 text-green-700",
      overdue: "bg-red-100 text-red-700",
      cancelled: "bg-muted text-muted-foreground line-through",
    };
    return <Badge className={map[status || "draft"] || ""}>{status || "draft"}</Badge>;
  };

  const usageColor = (pct: number) => {
    if (pct >= 90) return "text-destructive";
    if (pct >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  const progressColor = (pct: number) => {
    if (pct >= 90) return "[&>div]:bg-destructive";
    if (pct >= 70) return "[&>div]:bg-yellow-500";
    return "[&>div]:bg-green-500";
  };

  if (clientLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!client) {
    return <div className="text-center py-20 text-muted-foreground">Unable to load client data.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-center justify-between p-3 rounded-lg text-sm ${
            a.level === "critical" ? "bg-destructive/10 text-destructive" : "bg-yellow-50 text-yellow-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {a.level === "critical" ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>
              {a.level === "critical"
                ? `You've reached your ${a.service.service_name} limit`
                : `You've used ${Math.round(a.pct)}% of your ${a.service.service_name} limit`}
            </span>
          </div>
          <Button
            size="sm"
            variant={a.level === "critical" ? "destructive" : "outline"}
            onClick={() => {
              setLimitService(a.service.service_id);
              setLimitDialog(true);
            }}
          >
            {a.level === "critical" ? "Contact Admin" : "Request Increase"}
          </Button>
        </div>
      ))}

      {overdueInvoices.map(inv => (
        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Overdue invoice {inv.invoice_number} — ₹{inv.total_amount.toLocaleString()}</span>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setInvoiceModal(inv)}>View Invoice</Button>
        </div>
      ))}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usage & Billing</h1>
          <p className="text-muted-foreground">Track your service usage and billing</p>
        </div>
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
              <span className="text-sm font-bold text-slate-500">Total Usage</span>
            </div>
            <p className="text-3xl font-black text-slate-900">{totalUsage.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Units across all services</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-500/10"><DollarSign className="h-5 w-5 text-green-600" /></div>
              <span className="text-sm font-bold text-slate-500">Estimated Cost</span>
            </div>
            <p className="text-3xl font-black text-slate-900">₹{totalCost.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">This month so far</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200/60 shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10"><FileText className="h-5 w-5 text-blue-600" /></div>
              <span className="text-sm font-bold text-slate-500">Pending Invoices</span>
            </div>
            <p className="text-3xl font-black text-slate-900">
              {invoices.filter(i => i.status === "sent" || i.status === "overdue").length}
            </p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Usage Breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Service Usage Details</h2>
        {assignedServices.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No active services assigned.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedServices.map(svc => {
              const pct = svc.usage_limit > 0 ? Math.round((svc.usage_consumed / svc.usage_limit) * 100) : 0;
              const remaining = Math.max(0, svc.usage_limit - svc.usage_consumed);
              const resetLabel = svc.reset_period || "never";
              return (
                <Card key={svc.id} className="bg-white border-slate-200/60 shadow-sm transition-all hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-slate-800 font-bold">{svc.service_name}</CardTitle>
                      <Badge variant="outline" className="text-xs bg-primary/5 border-primary/10 text-primary">{svc.service_category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Usage</span>
                      <span className={`font-black ${usageColor(pct)}`}>{pct}%</span>
                    </div>
                    <Progress value={Math.min(pct, 100)} className={`h-2 ${progressColor(pct)}`} />
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{svc.usage_consumed}</p>
                        <p className="text-slate-500 text-[10px]">Used</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{svc.usage_limit}</p>
                        <p className="text-slate-500 text-[10px]">Limit</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{remaining}</p>
                        <p className="text-slate-500 text-[10px]">Left</p>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Resets: {resetLabel}</div>
                    {pct >= 80 && (
                      <Button
                        size="sm"
                        variant={pct >= 100 ? "destructive" : "outline"}
                        className="w-full"
                        onClick={() => {
                          setLimitService(svc.service_id);
                          setLimitDialog(true);
                        }}
                      >
                        {pct >= 100 ? "Limit Reached — Contact Admin" : "Request Increase"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 || serviceNames.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">No usage data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <ReTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                {serviceNames.map((name, i) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stackId="1"
                    stroke={chartColors[i % chartColors.length]}
                    fill={chartColors[i % chartColors.length]}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Usage History Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-lg">Usage History</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={usageFilter} onValueChange={setUsageFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {serviceNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search type..."
                  value={usageSearch}
                  onChange={e => { setUsageSearch(e.target.value); setUsagePage(0); }}
                  className="pl-7 h-9 w-40"
                />
              </div>
              <Button size="sm" variant="outline" onClick={exportCSV}>
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsage.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No usage records found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedUsage.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        {r.recorded_at ? format(new Date(r.recorded_at), "MMM d, HH:mm") : "—"}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{r.service_name}</Badge></TableCell>
                      <TableCell className="text-sm">{r.usage_type}</TableCell>
                      <TableCell className="text-right">{r.quantity || 0}</TableCell>
                      <TableCell className="text-right">₹{(r.unit_cost || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">₹{(r.total_cost || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Summary & Pagination */}
              <div className="flex items-center justify-between mt-4 text-sm">
                <div className="text-muted-foreground">
                  Total: {filteredUsage.reduce((s, r) => s + (r.quantity || 0), 0)} units · ₹
                  {filteredUsage.reduce((s, r) => s + (r.total_cost || 0), 0).toLocaleString()}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" disabled={usagePage === 0} onClick={() => setUsagePage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs">{usagePage + 1}/{totalPages}</span>
                    <Button size="icon" variant="ghost" disabled={usagePage >= totalPages - 1} onClick={() => setUsagePage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No invoices yet</div>
          ) : (
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-3">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                    <div>
                      <p className="font-medium text-foreground">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inv.invoice_date), "MMM d, yyyy")}
                        {inv.due_date && ` · Due ${format(new Date(inv.due_date), "MMM d, yyyy")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {statusBadge(inv.status)}
                    <p className="text-lg font-bold text-foreground">₹{inv.total_amount.toLocaleString()}</p>
                    <Button size="sm" variant="outline" onClick={() => setInvoiceModal(inv)}>View</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fair Usage Policy */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground">
            Fair Usage Policy
            <ChevronDown className="h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
              <p><strong>Usage Limits:</strong> Each service has a defined usage limit based on your plan. Usage resets according to your reset period.</p>
              <p><strong>When Limit Reached:</strong> Service functionality may be paused until the next reset or until your admin increases your limit.</p>
              <p><strong>Requesting Increases:</strong> Use the "Request Increase" button on any service card to notify your admin.</p>
              <p><strong>Billing:</strong> Usage costs are calculated based on your admin's pricing. Invoices are generated periodically by your admin.</p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Invoice Detail Modal */}
      <Dialog open={!!invoiceModal} onOpenChange={() => setInvoiceModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice {invoiceModal?.invoice_number}</DialogTitle>
            <DialogDescription>Invoice details and payment information</DialogDescription>
          </DialogHeader>
          {invoiceModal && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  {admin && <p className="font-semibold text-foreground">{admin.company_name}</p>}
                  <p className="text-xs text-muted-foreground">Invoice Date: {format(new Date(invoiceModal.invoice_date), "MMM d, yyyy")}</p>
                  {invoiceModal.due_date && (
                    <p className="text-xs text-muted-foreground">Due: {format(new Date(invoiceModal.due_date), "MMM d, yyyy")}</p>
                  )}
                </div>
                {statusBadge(invoiceModal.status)}
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Bill To</p>
                <p className="font-medium text-foreground">{client.company_name}</p>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">₹{invoiceModal.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="text-foreground">₹{(invoiceModal.tax_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Total</span>
                  <span>₹{invoiceModal.total_amount.toLocaleString()}</span>
                </div>
              </div>

              {invoiceModal.paid_at && (
                <p className="text-sm text-green-600">
                  Paid on {format(new Date(invoiceModal.paid_at), "MMM d, yyyy")}
                  {invoiceModal.payment_method && ` via ${invoiceModal.payment_method}`}
                </p>
              )}

              {invoiceModal.notes && (
                <div className="text-xs text-muted-foreground border-t pt-3">
                  <p className="font-medium mb-1">Notes</p>
                  <p>{invoiceModal.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request Limit Increase Dialog */}
      <Dialog open={limitDialog} onOpenChange={setLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Limit Increase</DialogTitle>
            <DialogDescription>Send a request to your admin to increase your usage limit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={limitService} onValueChange={setLimitService}>
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>
                {assignedServices.map(s => (
                  <SelectItem key={s.service_id} value={s.service_id}>
                    {s.service_name} (Current: {s.usage_limit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Requested limit"
              value={limitRequested}
              onChange={e => setLimitRequested(e.target.value)}
            />
            <Textarea
              placeholder="Reason for increase..."
              value={limitReason}
              onChange={e => setLimitReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestIncrease} disabled={!limitService || !limitRequested}>
              <Send className="h-4 w-4 mr-1" /> Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
