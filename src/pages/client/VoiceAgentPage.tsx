import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { formatDuration } from "@/utils/duration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bot, Phone, Clock, CheckCircle, Users, ArrowRight,
  Play, Copy, Settings, MoreVertical, FileText, Activity,
  PhoneCall, TrendingUp, Pause,
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface AgentStats {
  totalCalls: number;
  answeredCalls: number;
  answerRate: number;
  avgDuration: number;
  leadsCount: number;
}

interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number | null;
  status: string | null;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
}

/* ─── Main Page ─── */
export default function VoiceAgentPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AgentStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [chartData, setChartData] = useState<{ date: string; calls: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);

  const agentService = assignedServices.find(
    (s) => s.service_slug === "voice-agent" || s.service_slug === "ai-voice-agent"
  );

  useEffect(() => {
    if (!client || contextLoading || !agentService) return;
    const fetchServiceId = async () => {
      // Try both slug variants
      let { data } = await supabase
        .from("services")
        .select("id")
        .eq("slug", "voice-agent")
        .maybeSingle();
      if (!data) {
        const res = await supabase
          .from("services")
          .select("id")
          .eq("slug", "ai-voice-agent")
          .maybeSingle();
        data = res.data;
      }
      if (data) setServiceId(data.id);
    };
    fetchServiceId();
  }, [client, contextLoading, agentService]);

  useEffect(() => {
    if (!client || !serviceId) return;
    fetchAllData();
  }, [client, serviceId]);

  const fetchAllData = useCallback(async () => {
    if (!client || !serviceId) return;
    setIsLoading(true);
    await Promise.all([fetchStats(), fetchWorkflow(), fetchRecentCalls(), fetchChartData()]);
    setIsLoading(false);
  }, [client, serviceId]);

  async function fetchStats() {
    if (!client || !serviceId) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [callsRes, leadsRes] = await Promise.all([
      supabase
        .from("call_logs")
        .select("status, duration_seconds")
        .eq("client_id", client.id)
        .eq("service_id", serviceId)
        .gte("executed_at", monthStart),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("lead_source", "voice_agent")
        .gte("created_at", monthStart),
    ]);

    const calls = callsRes.data || [];
    const answered = calls.filter(
      (c) => c.status === "completed" || c.status === "answered"
    ).length;
    const totalDuration = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);

    setStats({
      totalCalls: calls.length,
      answeredCalls: answered,
      answerRate: calls.length > 0 ? Math.round((answered / calls.length) * 100) : 0,
      avgDuration: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      leadsCount: leadsRes.count || 0,
    });
  }

  async function fetchWorkflow() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .maybeSingle();
    setWorkflowInstance(data);
  }

  async function fetchRecentCalls() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("call_logs")
      .select(
        "id, phone_number, duration_seconds, status, ai_summary, executed_at, recording_url, call_type"
      )
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .order("executed_at", { ascending: false })
      .limit(10);
    setRecentCalls((data as CallLog[]) || []);
  }

  async function fetchChartData() {
    if (!client || !serviceId) return;
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("call_logs")
      .select("executed_at")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .gte("executed_at", thirtyDaysAgo);

    const counts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      counts[d] = 0;
    }
    (data || []).forEach((c) => {
      const d = format(new Date(c.executed_at), "MMM d");
      if (counts[d] !== undefined) counts[d]++;
    });
    setChartData(Object.entries(counts).map(([date, calls]) => ({ date, calls })));
  }

  const isActive =
    workflowInstance?.status === "active" && workflowInstance?.is_active;

  const toggleActive = async (activate: boolean) => {
    if (!workflowInstance) {
      toast({
        title: "No workflow configured",
        description: "Contact your admin to set up the Voice Agent workflow.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("client_workflow_instances")
      .update({
        is_active: activate,
        status: activate ? "active" : "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowInstance.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: activate ? "Voice Agent activated ✓" : "Voice Agent deactivated" });
      setWorkflowInstance((prev: any) =>
        prev ? { ...prev, is_active: activate, status: activate ? "active" : "suspended" } : prev
      );
    }
  };

  if (contextLoading) return <LoadingSkeleton />;
  if (!agentService) return <Navigate to="/client" replace />;
  if (isLoading) return <LoadingSkeleton />;

  return (
    <div   className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
               <Bot className="h-6 w-6 md:h-7 md:w-7" style={{ color: primaryColor }} />
             </div>
             <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
               EcoAssist
             </h1>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-13 md:ml-15">
            Your neural voice agent is currently handling global operations.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap bg-white/80 p-3 rounded-2xl border border-white/50 shadow-sm bg-opacity-90">
          <Badge variant="outline" className="text-[10px] py-1.5 px-3 bg-primary/10 border-primary/20 text-primary font-bold uppercase tracking-widest">
            {agentService.usage_consumed} / {agentService.usage_limit} Signals Used
          </Badge>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isActive ? "text-emerald-600" : "text-slate-400")}>
              {isActive ? "System Online" : "System Offline"}
            </span>
            <Switch checked={isActive} onCheckedChange={toggleActive} className="data-[state=checked]:bg-emerald-500" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<PhoneCall className="h-6 w-6" />}
          color={primaryColor}
          label="Total Communications"
          value={stats?.totalCalls ?? 0}
          subtext="Processed this cycle"
        />
        <StatsCard
          icon={<TrendingUp className="h-6 w-6" />}
          color="#10b981"
          label="Conversion Rate"
          value={`${stats?.answerRate ?? 0}%`}
          subtext={`${stats?.answeredCalls ?? 0} successful links`}
        />
        <StatsCard
          icon={<Clock className="h-6 w-6" />}
          label="Mean Interaction"
          value={formatDuration(stats?.avgDuration ?? 0)}
          subtext="Per session average"
          color="#f59e0b"
        />
        <StatsCard
          icon={<Users className="h-6 w-6" />}
          label="Qualified Leads"
          value={stats?.leadsCount ?? 0}
          linkText="Examine Leads"
          onLinkClick={() => navigate("/client/leads")}
          color="#8b5cf6"
        />
      </div>

      {/* Main Console Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-white border-slate-200/60 shadow-sm overflow-hidden group hover:shadow-md transition-colors">
          <CardHeader className="border-b border-slate-200/60 bg-slate-50/50 py-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Signal Continuity
              </CardTitle>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-1 w-4 rounded-full bg-primary/20" />)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            {chartData.some((d) => d.calls > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={primaryColor} />
                      <stop offset="100%" stopColor="#fa692c" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                    interval={4} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} 
                    allowDecimals={false} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid rgba(0, 0, 0, 0.05)",
                      borderRadius: "12px",
                      fontSize: 12,
                      backdropFilter: "blur(8px)",
                      color: "#1e293b"
                    }}
                    itemStyle={{ color: primaryColor }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    dot={{ fill: primaryColor, strokeWidth: 2, r: 4, stroke: "white" }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-5" />
                <div className="h-16 w-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4 relative z-10">
                  <Activity className="h-8 w-8 text-primary animate-pulse" />
                </div>
                <p className="text-lg font-bold text-slate-800 mb-1 relative z-10">Infrastucture Idle</p>
                <p className="text-sm text-slate-500 relative z-10">Global signal data will appear here once sequences begin.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-white/50 shadow-sm bg-opacity-95 flex flex-col overflow-hidden">
          <CardHeader className="border-b border-sidebar-border/10 bg-sidebar/5 py-4">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Agent Core
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center p-8">
            {isActive ? (
              <div className="space-y-6 text-center">
                <div className="relative mx-auto w-24 h-24">
                  <div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-primary/30"
                  />
                  <div className="absolute inset-2 rounded-full bg-emerald-100 flex items-center justify-center border border-emerald-200">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 underline decoration-primary/30 decoration-4 underline-offset-4 tracking-tight">System Operational</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">Agent is intercepting streams and executing neural responses.</p>
                </div>
                <Button variant="outline" className="w-full border-sidebar-border/20 hover:bg-sidebar/5 hover:text-primary transition-colors rounded-xl font-bold" onClick={() => toggleActive(false)}>
                   Emergency Suspension
                </Button>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="h-20 w-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto">
                  <Pause className="h-10 w-10 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Interface Locked</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {workflowInstance ? "Initial setup complete. Ready for deployment." : "Neural path not yet established. Contact Central Command."}
                  </p>
                </div>
                {workflowInstance && (
                  <Button 
                    className="w-full bg-primary text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform" 
                    onClick={() => toggleActive(true)}
                  >
                    Bootstrap Agent
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card className="bg-white/80 border-white/50 shadow-sm bg-opacity-95 overflow-hidden mt-6">
        <CardHeader className="border-b border-sidebar-border/10 py-4 bg-sidebar/5">
          <CardTitle className="text-lg font-bold text-slate-800">Stream Manifest</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentCalls.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>AI Summary</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="font-mono text-sm">
                          {call.phone_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {call.call_type || "voice"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(call.duration_seconds || 0)}
                        </TableCell>
                        <TableCell>
                          <CallStatusBadge status={call.status || "unknown"} />
                        </TableCell>
                        <TableCell>
                          <p
                            className="text-xs text-muted-foreground truncate max-w-[200px]"
                            title={call.ai_summary || ""}
                          >
                            {call.ai_summary || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(call.executed_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {call.recording_url && (
                                <DropdownMenuItem>
                                  <Play className="h-3 w-3 mr-2" /> Play Recording
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <FileText className="h-3 w-3 mr-2" /> View Transcript
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Users className="h-3 w-3 mr-2" /> Mark as Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {recentCalls.map((call) => (
                  <div key={call.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm">{call.phone_number}</span>
                      <CallStatusBadge status={call.status || "unknown"} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(call.duration_seconds || 0)}</span>
                      <span>
                        {formatDistanceToNow(new Date(call.executed_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {call.ai_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {call.ai_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5 opacity-5" />
              <Phone className="h-10 w-10 text-primary mx-auto mb-4 animate-float relative z-10" />
              <p className="text-lg font-bold text-slate-800 mb-1 relative z-10">Silence on the Wire</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto relative z-10">Signals will be logged here as soon as the neural agent intercepts incoming traffic.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub Components ─── */

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
    <Card className="bg-white/80 border-white/50 shadow-sm bg-opacity-95 hover:shadow-md hover:border-primary/30 transition-colors group overflow-hidden relative">
      <div 
        className="absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" 
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
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <div className="flex items-baseline gap-2">
               <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
            {subtext && <p className="text-[10px] text-slate-500 font-medium italic mt-1 leading-none">{subtext}</p>}
          </div>
          {linkText && onLinkClick && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[10px] font-black text-primary hover:bg-primary/10 rounded-lg group-hover:translate-x-1 transition-transform"
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

function CallStatusBadge({ status }: { status: string }) {
  const variant: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    answered: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ringing: "bg-blue-100 text-blue-700 border-blue-200",
    "in-progress": "bg-blue-100 text-blue-700 border-blue-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    "no-answer": "bg-slate-100 text-slate-700 border-slate-200",
    busy: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase rounded-lg px-2", variant[status] || "bg-slate-500/10 text-slate-400 border-slate-500/20")}>
      {status}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <Skeleton className="h-10 w-48 bg-slate-200" />
          <Skeleton className="h-4 w-72 bg-slate-100" />
        </div>
        <Skeleton className="h-12 w-48 bg-slate-200 rounded-2xl" />
      </div>
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 bg-white/80 rounded-2xl border border-white/50" />
        ))}
      </div>
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Skeleton className="h-[380px] lg:col-span-2 bg-white/80 rounded-2xl border border-white/50" />
        <Skeleton className="h-[380px] bg-white/80 rounded-2xl border border-white/50" />
      </div>
      <Skeleton className="h-64 bg-white/80 rounded-2xl border border-white/50" />
    </div>
  );
}

// formatDuration moved to src/utils/duration.ts
