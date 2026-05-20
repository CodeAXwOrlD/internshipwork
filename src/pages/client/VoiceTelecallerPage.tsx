import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { initiateInstantCall } from "@/lib/instant-call";
import {
  Phone, CheckCircle, Users, Plus, MoreVertical, Play,
  FileText, ArrowRight, Lightbulb, ChevronDown, X,
  Pause, Copy, Trash2, Eye, Zap, Loader2, MessageSquare, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatDuration, parseDurationToSeconds } from "@/utils/duration";
import CreateCampaignWizard from "@/components/client/telecaller/CreateCampaignWizard";
import { cn } from "@/lib/utils";

interface CampaignStats {
  totalCalls: number;
  completedCalls: number;
  successRate: number;
  leadsCount: number;
}

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  list_id: string | null;
}

interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number;
  status: string;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
  contact_name: string | null;
}

const getTelecallerCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_telecaller_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let telecallerPageCache = getTelecallerCacheFromStorage();

const saveTelecallerCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && telecallerPageCache) {
      localStorage.setItem(`pixora_telecaller_cache_${uid}`, JSON.stringify(telecallerPageCache));
    }
  } catch {}
};

const ensureTelecallerCache = () => {
  if (!telecallerPageCache) {
    telecallerPageCache = {
      stats: null,
      campaigns: [],
      recentCalls: [],
      outboundLeads: [],
    };
  }
  return telecallerPageCache;
};

export default function VoiceTelecallerPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const navigate = useNavigate();

  const [stats, setStats] = useState<CampaignStats | null>(telecallerPageCache?.stats || null);
  const [campaigns, setCampaigns] = useState<Campaign[]>(telecallerPageCache?.campaigns || []);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>(telecallerPageCache?.recentCalls || []);
  const [outboundLeads, setOutboundLeads] = useState<any[]>(telecallerPageCache?.outboundLeads || []);
  const [isLoading, setIsLoading] = useState(!telecallerPageCache);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);
  const [activeTab, setActiveTab] = useState("all");
  const [tipsVisible, setTipsVisible] = useState(() => {
    return localStorage.getItem("hide-telecaller-tips") !== "true";
  });
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [instantCallOpen, setInstantCallOpen] = useState(false);
  const [instantCallPhone, setInstantCallPhone] = useState("");
  const [instantCallName, setInstantCallName] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [hasBot, setHasBot] = useState<boolean>(true); // assume true until checked
  const [recordingPlayerOpen, setRecordingPlayerOpen] = useState(false);
  const [activeRecordingUrl, setActiveRecordingUrl] = useState<string>("");
  const [activeRecordingName, setActiveRecordingName] = useState<string>("");

  const [selectedCallData, setSelectedCallData] = useState<{
    id?: string;
    name?: string;
    phone?: string;
    status?: string;
    time?: string;
    transcript?: string;
    duration_seconds?: number;
    recording_url?: string | null;
  } | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [leadModalCall, setLeadModalCall] = useState<CallLog | null>(null);

  // Check access
  const telecallerService = assignedServices.find(s => s.service_slug === "voice-telecaller" || s.service_slug === "ai-voice-telecaller");

  const fetchBotStatus = useCallback(async () => {
    if (!client) return;
    try {
      const { data, error } = await (supabase as any)
        .from('outboundagents')
        .select('id, provider_agent_id, provider_from_number_id')
        .eq('owner_user_id', client.user_id)
        .maybeSingle();

      if (error) throw error;
      setHasBot(!!data && !!data.provider_agent_id && !!data.provider_from_number_id);
    } catch (err) {
      console.error("Failed to check bot status:", err);
      setHasBot(false);
    }
  }, [client]);

  const fetchStats = useCallback(async () => {
    if (!client) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [callsRes, leadsRes] = await Promise.all([
      (supabase as any)
        .from("outbound_call_logs")
        .select("call_status")
        .eq("owner_user_id", client.user_id)
        .gte("created_at", monthStart),
      (supabase as any)
        .from("outbound_leads")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", client.user_id)
        .gte("created_at", monthStart),
    ]);

    const calls = (callsRes.data as any[]) || [];
    const completed = calls.filter(c => c.call_status === "completed" || c.call_status === "answered").length;
    const total = calls.length;

    const calculatedStats = {
      totalCalls: total,
      completedCalls: completed,
      successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      leadsCount: leadsRes.count || 0,
    };
    setStats(calculatedStats);
    ensureTelecallerCache().stats = calculatedStats;
    saveTelecallerCacheToStorage();
  }, [client]);

  const fetchCampaigns = useCallback(async () => {
    if (!client) return;
    
    try {
      const { data: lists, error: listError } = await (supabase as any).from("outbound_contact_lists")
        .select(`*`)
        .eq("owner_user_id", client.user_id)
        .order("created_at", { ascending: false });

      if (listError) throw listError;
      
      if (!lists || lists.length === 0) {
        setCampaigns([]);
        return;
      }

      const listIds = lists.map((l: any) => l.id);
      
      const [schedulesRes, contactCountsRes, callLogsCountsRes] = await Promise.all([
        (supabase as any).from("outbound_scheduled_calls").select("*").in("list_id", listIds),
        (supabase as any).from("outbound_contacts").select("list_id").in("list_id", listIds),
        (supabase as any).from("outbound_call_logs").select("list_id").in("list_id", listIds),
      ]);

      const schedules = schedulesRes.data || [];
      const allContacts = contactCountsRes.data || [];
      const allCallLogs = callLogsCountsRes.data || [];

      const contactCountsMap: Record<string, number> = {};
      allContacts.forEach((c: any) => {
        contactCountsMap[c.list_id] = (contactCountsMap[c.list_id] || 0) + 1;
      });

      const callLogsCountsMap: Record<string, number> = {};
      allCallLogs.forEach((l: any) => {
        callLogsCountsMap[l.list_id] = (callLogsCountsMap[l.list_id] || 0) + 1;
      });

      const mapped = lists.map((d: any) => {
        const listSchedules = schedules?.filter((s: any) => s.list_id === d.id) || [];
        const latestSched = listSchedules.length > 0 
          ? [...listSchedules].sort((a: any, b: any) => {
              const dateA = new Date(a.created_at || a.scheduled_at || 0).getTime();
              const dateB = new Date(b.created_at || b.scheduled_at || 0).getTime();
              return dateB - dateA;
            })[0]
          : null;

        let status = latestSched?.status || 'draft';
        const total = contactCountsMap[d.id] || d.contact_count || d.total_contacts || 0;
        const called = callLogsCountsMap[d.id] || latestSched?.contacts_called || 0;
        
        if (status === 'running' && total > 0 && called >= total) {
          status = 'completed';
        }

        return {
          id: d.id,
          campaign_name: d.name || 'Outbound Campaign',
          status: status,
          created_at: d.created_at,
          scheduled_at: latestSched?.scheduled_at || null,
          list_id: d.id,
          total_contacts: total,
          contacts_called: called
        };
      });
      setCampaigns(mapped);
      ensureTelecallerCache().campaigns = mapped;
      saveTelecallerCacheToStorage();
    } catch (err) {
      console.error("fetchCampaigns error:", err);
    }
  }, [client]);

  const fetchRecentCalls = useCallback(async () => {
    if (!client) return;
    const { data } = await (supabase as any).from("outbound_call_logs")
      .select("id, phone, name, duration, transcript, call_url, call_type, call_status, created_at")
      .eq("owner_user_id", client.user_id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        phone_number: d.phone,
        duration_seconds: parseDurationToSeconds(d.duration),
        status: d.call_status || 'unknown',
        ai_summary: d.transcript,
        executed_at: d.created_at || d.started_at || null,
        recording_url: d.call_url,
        call_type: d.call_type,
        contact_name: d.name || d.phone
      }));
      setRecentCalls(mapped);
      ensureTelecallerCache().recentCalls = mapped;
      saveTelecallerCacheToStorage();
    }
  }, [client]);

  const fetchOutboundLeads = useCallback(async () => {
    if (!client) return;
    try {
      const { data: leads, error: leadError } = await (supabase as any).from("outbound_leads")
        .select(`id, status, notes, created_at, call_log_id`)
        .eq("owner_user_id", client.user_id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (leadError) throw leadError;
      if (!leads || leads.length === 0) {
        setOutboundLeads([]);
        return;
      }

      const { data: logs } = await (supabase as any).from("outbound_call_logs")
        .select("id, transcript, phone, name, call_url, duration")
        .in("id", leads.map((l: any) => l.call_log_id).filter(Boolean));

      const mapped = leads.map((d: any) => {
        const callLog = logs?.find((l: any) => l.id === d.call_log_id);
        return {
          id: d.id,
          status: d.status,
          notes: d.notes,
          created_at: d.created_at,
          phone: callLog?.phone || "Unknown",
          name: callLog?.name || "Customer",
          transcript: callLog?.transcript || d.notes,
          recording_url: callLog?.call_url || null,
          duration_seconds: parseDurationToSeconds(callLog?.duration || "0:00"),
          call_log_id: callLog?.id,
          executed_at: d.created_at || null,
        };
      });
      setOutboundLeads(mapped as any[]);
      ensureTelecallerCache().outboundLeads = mapped;
      saveTelecallerCacheToStorage();
    } catch (err) {
      console.error("fetchOutboundLeads error:", err);
    }
  }, [client]);

  const fetchAllData = useCallback(async () => {
    if (!client) return;
    if (!telecallerPageCache) {
      setIsLoading(true);
    }
    await Promise.all([fetchBotStatus(), fetchStats(), fetchCampaigns(), fetchRecentCalls(), fetchOutboundLeads()]);
    setIsLoading(false);
  }, [client, fetchBotStatus, fetchStats, fetchCampaigns, fetchRecentCalls, fetchOutboundLeads]);

  useEffect(() => {
    if (!client) return;
    fetchAllData();
  }, [client, fetchAllData]);

  // Realtime subscription for campaigns and logs
  useEffect(() => {
    if (!client) return;

    const channel = supabase
      .channel("telecaller-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "outbound_contact_lists",
        filter: `owner_user_id=eq.${client.user_id}`,
      }, () => fetchAllData())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "outbound_scheduled_calls",
        filter: `owner_user_id=eq.${client.user_id}`,
      }, () => fetchCampaigns())
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "outbound_call_logs",
        filter: `owner_user_id=eq.${client.user_id}`,
      }, () => {
        fetchCampaigns();
        fetchRecentCalls();
        fetchStats();
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "outbound_leads",
        filter: `owner_user_id=eq.${client.user_id}`,
      }, () => {
        fetchOutboundLeads();
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [client, fetchAllData, fetchCampaigns, fetchRecentCalls, fetchStats, fetchOutboundLeads]);

  if (contextLoading) {
    return <LoadingSkeleton />;
  }

  if (!telecallerService) {
    return <Navigate to="/client" replace />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const filteredCampaigns = activeTab === "all"
    ? campaigns
    : campaigns.filter(c => c.status === activeTab);

  const dismissTips = () => {
    setTipsVisible(false);
    localStorage.setItem("hide-telecaller-tips", "true");
  };

  const handleInstantCall = async () => {
    if (!instantCallPhone) return toast.error("Phone number is required");
    setIsCalling(true);
    try {
      await initiateInstantCall(instantCallPhone, instantCallName, client.user_id);
      toast.success(`Calling ${instantCallPhone}...`);
      setInstantCallOpen(false);
      setInstantCallPhone("");
      setInstantCallName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate call");
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Call Orbitor</h1>
          <p className="text-sm text-muted-foreground">Automate your outbound calling campaigns</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {telecallerService.usage_consumed} / {telecallerService.usage_limit} calls used
          </Badge>
          {!hasBot ? (
            <Badge variant="destructive" className="text-xs py-1 px-3">
              No Active Bot
            </Badge>
          ) : (
            <>
              <Button variant="outline" onClick={() => setInstantCallOpen(true)}>
                <Phone className="h-4 w-4 mr-2 text-green-500" />
                Instant Call
              </Button>
              <Button style={{ backgroundColor: primaryColor, color: "white" }} onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <StatsCard
          icon={<Phone className="h-5 w-5" />}
          color={primaryColor}
          label="Total Calls"
          value={stats?.totalCalls ?? 0}
          subtext="This month"
        />
        <StatsCard
          icon={<CheckCircle className="h-5 w-5" />}
          color="#22c55e"
          label="Success Rate"
          value={`${stats?.successRate ?? 0}%`}
          subtext={`${stats?.completedCalls ?? 0} of ${stats?.totalCalls ?? 0} calls`}
        />
        <StatsCard
          icon={<Users className="h-5 w-5" />}
          color={primaryColor}
          label="Leads Captured"
          value={stats?.leadsCount ?? 0}
        // linkText="View Leads"
        // onLinkClick={() => navigate("/client/leads")}
        />
      </div>

      {/* Quick Tips */}
      {tipsVisible && (
        <Collapsible defaultOpen>
          <Card className="border-dashed">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm">Quick Tips</CardTitle>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismissTips}>
                <X className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                  <p>📝 Prepare your call script with variables like {"{name}"}, {"{company}"}</p>
                  <p>📊 Upload contacts as CSV with name, phone, and custom fields</p>
                  <p>🎯 Best time to call: 10 AM – 4 PM on weekdays</p>
                  <p>✅ Review AI summaries to identify hot leads</p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Campaigns Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">My Campaigns</h2>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All Campaigns" },
            { key: "running", label: "Running" },
            { key: "scheduled", label: "Scheduled" },
            { key: "completed", label: "Completed" },
            { key: "leads", label: "Leads" },
            { key: "call_logs", label: "Call Logs" },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              className="text-xs shrink-0"
              style={activeTab === tab.key ? { backgroundColor: primaryColor, color: "white" } : undefined}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key !== "all" && (
                <span className="ml-1.5 text-[10px] opacity-70">
                  ({
                    tab.key === "leads" ? outboundLeads.length :
                    tab.key === "call_logs" ? recentCalls.length :
                    campaigns.filter(c => c.status === tab.key).length
                  })
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Campaign Cards */}
        {activeTab === "leads" ? (
          <Card>
            <CardContent className="py-6">
              {outboundLeads.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outboundLeads.map(lead => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium text-sm">{lead.name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{lead.phone || "—"}</TableCell>
                          <TableCell className="capitalize text-sm">{lead.status || "new"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(lead.created_at), "dd MMM yyyy, hh:mm a")}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="View Details" onClick={() => {
                              setSelectedCallData({
                                id: lead.id,
                                name: lead.name,
                                phone: lead.phone,
                                status: lead.status || 'qualified',
                                time: lead.created_at,
                                transcript: lead.transcript || lead.notes,
                                duration_seconds: (lead as any).duration_seconds || 0,
                                recording_url: (lead as any).recording_url || null
                              });
                              setDetailsModalOpen(true);
                            }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-5 mb-4">
                    <Users className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    No leads captured yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Leads identified from your calls will appear here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : activeTab === "call_logs" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent Calls</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCalls.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact Name</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.map(call => (
                        <TableRow key={call.id}>
                          <TableCell className="font-medium text-sm">{call.contact_name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                          <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                          <TableCell><CallStatusBadge status={call.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(call.executed_at), "dd MMM yyyy, hh:mm a")}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="View Details" onClick={() => {
                              setSelectedCallData({
                                id: call.id,
                                name: call.contact_name,
                                phone: call.phone_number,
                                status: call.status,
                                time: call.executed_at,
                                transcript: call.ai_summary,
                                duration_seconds: call.duration_seconds,
                                recording_url: call.recording_url
                              });
                              setDetailsModalOpen(true);
                            }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No calls recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : filteredCampaigns.length > 0 ? (
          <div className="space-y-3">
            {filteredCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                primaryColor={primaryColor}
                navigate={navigate}
                onRefresh={fetchCampaigns}
              />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          /* Empty state – no campaigns at all */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-5 mb-4">
                <Phone className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No calling campaigns yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {hasBot
                  ? "Create your first campaign to start reaching out to customers with AI-powered calls."
                  : "You need an active bot to run campaigns. Please contact your admin."}
              </p>
              {hasBot && (
                <Button style={{ backgroundColor: primaryColor, color: "white" }} size="lg" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Empty state – filter has no results */
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No {activeTab} campaigns found.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Calls */}
      {activeTab !== "call_logs" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Recent Calls</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/client/voice-telecaller/calls")}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentCalls.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>AI Summary</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCalls.map(call => (
                        <TableRow key={call.id}>
                          <TableCell className="font-mono text-sm">{call.phone_number}</TableCell>
                          <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                          <TableCell><CallStatusBadge status={call.status} /></TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={call.ai_summary || ""}>
                              {call.ai_summary || "—"}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(call.executed_at), "dd MMM yyyy, hh:mm a")}
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setSelectedCallData({
                                    id: call.id,
                                    name: call.contact_name,
                                    phone: call.phone_number,
                                    status: call.status,
                                    time: call.executed_at,
                                    transcript: call.ai_summary,
                                    duration_seconds: call.duration_seconds,
                                    recording_url: call.recording_url
                                  });
                                  setDetailsModalOpen(true);
                                }}>
                                  <FileText className="h-3 w-3 mr-2" /> View Transcript
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLeadModalCall(call)}>
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
                  {recentCalls.map(call => (
                    <div key={call.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{call.phone_number}</span>
                        <CallStatusBadge status={call.status} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDuration(call.duration_seconds)}</span>
                        <span>{format(new Date(call.executed_at), "dd MMM yyyy, hh:mm a")}</span>
                      </div>
                      {call.ai_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{call.ai_summary}</p>
                      )}
                      {call.recording_url && (
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="w-full text-xs h-8" 
                          onClick={() => {
                            setActiveRecordingUrl(call.recording_url!);
                            setActiveRecordingName(call.contact_name || call.phone_number);
                            setRecordingPlayerOpen(true);
                          }}
                        >
                          <Play className="h-3 w-3 mr-2 fill-current" /> Play Recording
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <Phone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No calls recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <CreateCampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        primaryColor={primaryColor}
        usageLimit={telecallerService.usage_limit}
        usageConsumed={telecallerService.usage_consumed}
        clientId={client?.id || ""}
        userId={client?.user_id || ""}
      />

      <Dialog open={instantCallOpen} onOpenChange={setInstantCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instant Call</DialogTitle>
            <DialogDescription>Make a single instant call to a customer directly.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input placeholder="+1234567890" value={instantCallPhone} onChange={e => setInstantCallPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Customer Name (Optional)</Label>
              <Input placeholder="John Doe" value={instantCallName} onChange={e => setInstantCallName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstantCallOpen(false)} disabled={isCalling}>Cancel</Button>
            <Button onClick={handleInstantCall} disabled={isCalling} style={{ backgroundColor: primaryColor, color: "white" }}>
              {isCalling ? "Calling..." : "Call Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              Details and transcript for the call with {selectedCallData?.phone || "Customer"}
            </DialogDescription>
          </DialogHeader>
          {selectedCallData && (
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Date & Time</span>
                  <span className="font-medium">
                    {selectedCallData.time ? format(new Date(selectedCallData.time), "dd MMM yyyy, hh:mm a") : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Duration</span>
                  <span className="font-medium">{formatDuration(selectedCallData.duration_seconds || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status</span>
                  <CallStatusBadge status={selectedCallData.status || 'unknown'} />
                </div>
                <div>
                  <span className="text-muted-foreground block">Contact Name</span>
                  <span className="font-medium">{selectedCallData.name || "—"}</span>
                </div>
              </div>

              {selectedCallData.recording_url && (
                <div className="pt-2 border-t">
                  <span className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Play className="h-4 w-4" /> Recording
                  </span>
                  <audio controls className="w-full h-10" src={selectedCallData.recording_url} />
                </div>
              )}

              <div className="pt-2 border-t">
                <span className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Transcript / AI Summary
                </span>
                <div className="bg-muted p-3 rounded-md max-h-[200px] overflow-y-auto text-sm whitespace-pre-wrap">
                  {selectedCallData.transcript ? selectedCallData.transcript : <span className="text-muted-foreground italic">No transcript available for this call.</span>}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t mt-4">
                <Button 
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setLeadModalCall({
                      id: selectedCallData.id || "manual",
                      phone_number: selectedCallData.phone || "",
                      contact_name: selectedCallData.name || null,
                      ai_summary: selectedCallData.transcript || null,
                      status: selectedCallData.status || "completed",
                      duration_seconds: selectedCallData.duration_seconds || 0,
                      executed_at: selectedCallData.time || new Date().toISOString(),
                      recording_url: selectedCallData.recording_url || null,
                      call_type: "outbound"
                    });
                    setDetailsModalOpen(false);
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Mark as Lead
                </Button>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDetailsModalOpen(false)}>Close</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recording Player Modal */}
      <Dialog open={recordingPlayerOpen} onOpenChange={setRecordingPlayerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary fill-primary/10" />
              Call Recording
            </DialogTitle>
            <DialogDescription>
              Listening to call with {activeRecordingName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Phone className="h-10 w-10 text-primary" />
            </div>
            <audio 
              controls 
              autoPlay 
              className="w-full h-12 focus:outline-none" 
              src={activeRecordingUrl}
            >
              Your browser does not support the audio element.
            </audio>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordingPlayerOpen(false)} className="w-full">
              Close Player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Lead Modal */}
      {leadModalCall && (
        <MarkAsLeadModal
          call={leadModalCall}
          clientId={client.id}
          onClose={() => setLeadModalCall(null)}
          onCreated={() => {
            setLeadModalCall(null);
            toast.success("Lead created successfully!");
            fetchOutboundLeads();
          }}
        />
      )}
    </div>
  );
}

/* ─── Sub Components ─── */

function StatsCard({
  icon, color, label, value, subtext, linkText, onLinkClick,
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
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {subtext && <p className="text-[11px] text-muted-foreground">{subtext}</p>}
          </div>
          {linkText && onLinkClick && (
            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={onLinkClick}>
              {linkText} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignCard({
  campaign, primaryColor, navigate, onRefresh,
}: {
  campaign: Campaign & { list_id?: string };
  primaryColor: string;
  navigate: (path: string) => void;
  onRefresh: () => void;
}) {
  const { client } = useClient();
  const [isUpdating, setIsUpdating] = useState(false);

  async function updateStatus(newStatus: string) {
    if (!client) return;
    setIsUpdating(true);
    try {
      // Search for any existing schedule for this list
      const { data: existing } = await (supabase as any)
        .from("outbound_scheduled_calls")
        .select("id")
        .eq("list_id", campaign.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update the most recent schedule
        const { error } = await (supabase as any)
          .from("outbound_scheduled_calls")
          .update({ status: newStatus })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Only insert if it doesn't exist – typically only for starting a fresh campaign
        const { error } = await (supabase as any)
          .from("outbound_scheduled_calls")
          .insert({ 
            list_id: campaign.id, 
            status: newStatus,
            owner_user_id: client.user_id,
            scheduled_at: new Date().toISOString()
          });
        if (error) throw error;
      }

      // Mandatory n8n webhook signal to pause/resume the remote dialer service
      const webhookUrl = (import.meta as any).env.VITE_N8N_OUTBOUND_LIST_IMMEDIATE_CALLS_WEBHOOK;
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaign_id: campaign.id,
              list_id: campaign.id,
              status: newStatus,
              action: newStatus === "running" ? "resume" : "pause",
              client_id: client.id
            }),
          });
        } catch (webhookErr) {
          console.error("Webhook signal failed:", webhookErr);
        }
      }

      toast.success(`Campaign ${newStatus === 'running' ? 'resumed' : 'paused'} successfully`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  }

  async function deleteCampaign() {
    if (!confirm("Are you sure you want to delete this campaign? this will wipe all calls queues.")) return;
    setIsUpdating(true);
    try {
      const { error } = await (supabase as any).from("outbound_contact_lists").delete().eq("id", campaign.id);
      if (error) throw error;
      toast.success("Campaign deleted successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <Card className={isUpdating ? "opacity-50" : ""}>
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{campaign.campaign_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Scheduled for {campaign.scheduled_at ? format(new Date(campaign.scheduled_at), "dd MMM yyyy, hh:mm a") : 'Now'}
                </p>
              </div>
              <CampaignStatusBadge status={campaign.status} />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" disabled={isUpdating}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/client/voice-telecaller/campaigns/${campaign.id}`)}>
                <Eye className="h-3 w-3 mr-2" /> View Details
              </DropdownMenuItem>
              {campaign.status === "running" ? (
                <DropdownMenuItem onClick={() => updateStatus("paused")}>
                  <Pause className="h-4 w-4 mr-2" /> Pause Campaign
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => updateStatus("running")}>
                  <Play className="h-4 w-4 mr-2" /> {campaign.status === 'draft' ? 'Start' : 'Resume'} Campaign
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate(`/client/voice-telecaller/calls?campaign=${campaign.id}`)}>
                <Phone className="h-3 w-3 mr-2" /> View Calls
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/client/leads?campaign=${campaign.id}`)}>
                <Users className="h-3 w-3 mr-2" /> View Leads
              </DropdownMenuItem>
              <DropdownMenuItem onClick={deleteCampaign} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3 w-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; className?: string }> = {
    draft: { variant: "outline", label: "Draft" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    pending: { variant: "secondary", label: "Pending" },
    running: { variant: "default", label: "Running", className: "animate-pulse" },
    paused: { variant: "outline", label: "Paused", className: "border-yellow-500 text-yellow-600" },
    completed: { variant: "default", label: "Completed" },
    cancelled: { variant: "destructive", label: "Cancelled" },
  };
  const c = config[status] || { variant: "outline" as const, label: status };
  return <Badge variant={c.variant} className={`text-[10px] ${c.className || ""}`}>{c.label}</Badge>;
}

function CallStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: "Completed", className: "bg-green-50 text-green-600 border-green-200" },
    answered: { label: "Answered", className: "bg-green-50 text-green-600 border-green-200" },
    busy: { label: "Busy", className: "text-yellow-600 border-yellow-200 bg-yellow-50" },
    no_answer: { label: "No Answer", className: "text-muted-foreground" },
    failed: { label: "Failed", className: "bg-red-50 text-red-600 border-red-200" },
    initiated: { label: "Initiated", className: "text-blue-500 border-blue-200 bg-blue-50" },
    ringing: { label: "Ringing", className: "text-blue-500 border-blue-200 bg-blue-50" },
  };
  const c = config[status] || { label: status, className: "text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("uppercase text-[10px]", c.className)}>
      {c.label}
    </Badge>
  );
}

// formatDuration and parseDurationToSeconds moved to src/utils/duration.ts

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

/* ─── Mark as Lead Modal ─── */
function MarkAsLeadModal({
  call, clientId, onClose, onCreated,
}: {
  call: CallLog;
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(call.contact_name || "");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [score, setScore] = useState([50]);
  const [interest, setInterest] = useState([5]);
  const [notes, setNotes] = useState(call.ai_summary || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!clientId) return;
    setSaving(true);
    const { error } = await supabase.from("leads").insert({
      client_id: clientId,
      // call_log_id: call.id === "manual" ? null : call.id,
      lead_source: "telecaller" as const,
      name: name || null,
      phone: call.phone_number,
      email: email || null,
      company: company || null,
      lead_score: score[0],
      interest_level: interest[0],
      status: "new" as const,
      notes: notes || null,
      metadata: {
        recording_url: call.recording_url,
        duration: call.duration_seconds,
        ai_summary: call.ai_summary
      }
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to create lead");
      console.error(error);
    } else {
      onCreated();
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Lead</DialogTitle>
          <DialogDescription>From call to {call.phone_number}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contact name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={call.phone_number} disabled className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lead Score: {score[0]}/100</Label>
            <Slider value={score} max={100} step={1} onValueChange={setScore} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Interest Level: {interest[0]}/10</Label>
            <Slider value={interest} max={10} step={1} onValueChange={setInterest} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Save Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
