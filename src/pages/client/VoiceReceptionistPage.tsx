import { useEffect, useState, useCallback, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import ComingSoonOverlay from "@/components/ComingSoonOverlay";
import { formatDuration } from "@/utils/duration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PhoneIncoming, Clock, CheckCircle, PhoneForwarded, Settings, Phone,
  Play, Pause, Copy, Plus, Trash2, GripVertical, MoreVertical,
  Volume2, List, QrCode, ChevronRight, ArrowRight, PhoneCall,
  Voicemail, Shield, X, Brain,
} from "lucide-react";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ─── Types ─── */
interface CallLog {
  id: string;
  phone_number: string;
  duration_seconds: number | null;
  status: string | null;
  ai_summary: string | null;
  executed_at: string;
  recording_url: string | null;
  call_type: string | null;
  caller_id: string | null;
  metadata: any;
}

interface MenuOption {
  id: string;
  pressKey: string;
  label: string;
  action: string;
  actionDetail: string;
}

interface BusinessHours {
  day: string;
  enabled: boolean;
  from: string;
  to: string;
}

interface TeamMember {
  id: string;
  name: string;
  phone: string;
  department: string;
  hours: string;
}

interface ReceptionistConfig {
  systemPrompt: string;
  voiceCommandsEnabled: boolean;
  voiceCommands: string[];
  timeoutSeconds: number;
  timeoutAction: string;
  invalidInputRetries: number;
  afterHoursGreeting: string;
  afterHoursAction: string;
  emergencyNumber: string;
  businessHours: BusinessHours[];
  teamMembers: TeamMember[];
  privacyMaskPhone: boolean;
  voicemailEnabled: boolean;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours[] = [
  { day: "Monday", enabled: true, from: "09:00", to: "18:00" },
  { day: "Tuesday", enabled: true, from: "09:00", to: "18:00" },
  { day: "Wednesday", enabled: true, from: "09:00", to: "18:00" },
  { day: "Thursday", enabled: true, from: "09:00", to: "18:00" },
  { day: "Friday", enabled: true, from: "09:00", to: "18:00" },
  { day: "Saturday", enabled: false, from: "09:00", to: "13:00" },
  { day: "Sunday", enabled: false, from: "09:00", to: "13:00" },
];

const DEFAULT_CONFIG: ReceptionistConfig = {
  systemPrompt: "You are a professional receptionist for a premium business. Greet the caller warmly, ask how you can help, and provide information about our services. If they need to speak with someone specific, ask for their details and mention we will have someone call them back.",
  menuOptions: [],
  voiceCommandsEnabled: false,
  voiceCommands: [],
  timeoutSeconds: 10,
  timeoutAction: "replay",
  invalidInputRetries: 3,
  afterHoursGreeting: "Thank you for calling. We're currently closed. Please leave a message after the tone.",
  afterHoursAction: "voicemail",
  emergencyNumber: "",
  businessHours: DEFAULT_BUSINESS_HOURS,
  teamMembers: [],
  privacyMaskPhone: false,
  voicemailEnabled: true,
};

const getReceptionistCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_receptionist_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let receptionistPageCache = getReceptionistCacheFromStorage();

const saveReceptionistCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && receptionistPageCache) {
      localStorage.setItem(`pixora_receptionist_cache_${uid}`, JSON.stringify(receptionistPageCache));
    }
  } catch {}
};

/* ─── Main Page ─── */
export default function VoiceReceptionistPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(!receptionistPageCache);
  const [serviceId, setServiceId] = useState<string | null>(receptionistPageCache?.serviceId || null);
  const [workflowInstance, setWorkflowInstance] = useState<any>(receptionistPageCache?.workflowInstance || null);
  const [config, setConfig] = useState<ReceptionistConfig>(receptionistPageCache?.config || DEFAULT_CONFIG);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>(receptionistPageCache?.recentCalls || []);
  const [callStats, setCallStats] = useState(receptionistPageCache?.callStats || { received: 0, handled: 0, transferred: 0 });
  const [chartData, setChartData] = useState<{ date: string; calls: number }[]>(receptionistPageCache?.chartData || []);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);

  // Modals
  const [ivrEditOpen, setIvrEditOpen] = useState(false);
  const [hoursEditOpen, setHoursEditOpen] = useState(false);
  const [teamEditOpen, setTeamEditOpen] = useState(false);
  const [testCallOpen, setTestCallOpen] = useState(false);
  const [activateConfirm, setActivateConfirm] = useState<boolean | null>(null);

  const receptionistService = assignedServices.find(s => s.service_slug === "voice-receptionist" || s.service_slug === "ai-voice-receptionist");

  // Fetch service ID
  useEffect(() => {
    if (!client || contextLoading || !receptionistService) return;
    const fetchId = async () => {
      const { data } = await supabase.from("services").select("id").eq("slug", "ai-voice-receptionist").maybeSingle();
      if (data) setServiceId(data.id);
    };
    fetchId();
  }, [client, contextLoading, receptionistService]);

  // Fetch all data
  useEffect(() => {
    if (!client || !serviceId) return;
    fetchAllData();
  }, [client, serviceId]);

  const fetchAllData = useCallback(async () => {
    if (!client || !serviceId) return;
    if (!receptionistPageCache) setIsLoading(true);
    await Promise.all([fetchWorkflow(), fetchStats(), fetchRecentCalls(), fetchChartData()]);
    setIsLoading(false);
  }, [client, serviceId]);

  async function fetchWorkflow() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .maybeSingle();
    if (data) {
      setWorkflowInstance(data);
      if (data.custom_config && typeof data.custom_config === "object") {
        setConfig({ ...DEFAULT_CONFIG, ...(data.custom_config as any) });
      }
      if (!receptionistPageCache) receptionistPageCache = {} as any;
      receptionistPageCache!.workflowInstance = data;
      receptionistPageCache!.config = { ...DEFAULT_CONFIG, ...(data.custom_config as any) };
      saveReceptionistCacheToStorage();
    }
  }

  async function fetchStats() {
    if (!client || !serviceId) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { data: calls } = await supabase
      .from("call_logs")
      .select("status, metadata")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .eq("call_type", "inbound")
      .gte("executed_at", monthStart);

    const allCalls = calls || [];
    const handled = allCalls.filter(c => c.status === "completed").length;
    const transferred = allCalls.filter(c => {
      const meta = c.metadata as any;
      return meta?.action === "forwarded";
    }).length;

    setCallStats({ received: allCalls.length, handled, transferred });
    if (!receptionistPageCache) receptionistPageCache = {} as any;
    receptionistPageCache!.callStats = { received: allCalls.length, handled, transferred };
    saveReceptionistCacheToStorage();
  }

  async function fetchRecentCalls() {
    if (!client || !serviceId) return;
    const { data } = await supabase
      .from("call_logs")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .eq("call_type", "inbound")
      .order("executed_at", { ascending: false })
      .limit(10);
    const mapped = (data || []).map((d: any) => ({
      ...d,
      executed_at: d.executed_at || d.created_at || null
    }));
    setRecentCalls(mapped as CallLog[]);
    if (!receptionistPageCache) receptionistPageCache = {} as any;
    receptionistPageCache!.recentCalls = mapped;
    saveReceptionistCacheToStorage();
  }

  async function fetchChartData() {
    if (!client || !serviceId) return;
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const { data } = await supabase
      .from("call_logs")
      .select("executed_at")
      .eq("client_id", client.id)
      .eq("service_id", serviceId)
      .eq("call_type", "inbound")
      .gte("executed_at", thirtyDaysAgo);

    const counts: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      counts[d] = 0;
    }
    (data || []).forEach(c => {
      const d = format(new Date(c.executed_at), "MMM d");
      if (counts[d] !== undefined) counts[d]++;
    });
    setChartData(Object.entries(counts).map(([date, calls]) => ({ date, calls })));
    if (!receptionistPageCache) receptionistPageCache = {} as any;
    receptionistPageCache!.chartData = Object.entries(counts).map(([date, calls]) => ({ date, calls }));
    saveReceptionistCacheToStorage();
  }

  const isActive = workflowInstance?.status === "active" && workflowInstance?.is_active;
  const receptionistNumber = workflowInstance?.custom_config?.receptionist_number || workflowInstance?.webhook_url || "";

  const toggleActive = async (activate: boolean) => {
    if (!workflowInstance) return;
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
      toast({ title: activate ? "Receptionist activated! ✓" : "Receptionist deactivated" });
      setWorkflowInstance((prev: any) => prev ? { ...prev, is_active: activate, status: activate ? "active" : "suspended" } : prev);
    }
    setActivateConfirm(null);
  };

  const saveConfig = async (newConfig: ReceptionistConfig) => {
    if (!workflowInstance) return;
    const { error } = await supabase
      .from("client_workflow_instances")
      .update({ custom_config: newConfig as any, updated_at: new Date().toISOString() })
      .eq("id", workflowInstance.id);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      setConfig(newConfig);
      toast({ title: "Configuration saved" });
    }
  };

  if (contextLoading) return <LoadingSkeleton />;
  if (!receptionistService) return <Navigate to="/client" replace />;

  const successRate = callStats.received > 0 ? Math.round((callStats.handled / callStats.received) * 100) : 0;

  return (
    <div className="relative space-y-6">
      <ComingSoonOverlay
        title="AI Voice Receptionist"
        description="Configure dynamic voice instructions, weekly business hours, and phone directories to let our AI receptionist answer, filter, and forward inbound calls."
        features={[
          "Smart AI Inbound Interception & Dialogs",
          "Dynamic Call Routing & Team Forwarding Directory",
          "Weekly Office Availability Schedules",
          "Voicemail Inbox with AI Transcription Summaries",
          "Inbound Call Logs & Volume Charts"
        ]}
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">AI Voice Receptionist</h1>
          <p className="text-sm text-muted-foreground">Manage your inbound calls with AI</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-xs py-1 px-3">
            {receptionistService.usage_consumed} / {receptionistService.usage_limit} min used
          </Badge>
          <div className="flex items-center gap-2">
            {isActive ? (
              <Badge className="bg-primary/15 text-primary text-xs animate-pulse">● Active</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">● Inactive</Badge>
            )}
            <Switch checked={isActive} onCheckedChange={v => setActivateConfirm(v)} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setIvrEditOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> AI Config
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<PhoneIncoming className="h-5 w-5" />} label="Calls Received"
          value={callStats.received} subtext="This month" color={primaryColor} />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Avg Wait Time"
          value="< 2s" subtext="Fast response" color={primaryColor} />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Handled Successfully"
          value={`${callStats.handled}`} subtext={`${successRate}% of total`} color={primaryColor} />
        <StatCard icon={<PhoneForwarded className="h-5 w-5" />} label="Transferred to Team"
          value={callStats.transferred} subtext="Forwarded calls" color={primaryColor} />
      </div>

      {/* Status & Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status Card */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            {isActive ? (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="rounded-full bg-primary/15 p-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Your AI Receptionist is ACTIVE</p>
                    <p className="text-sm text-muted-foreground">All incoming calls will be handled by AI</p>
                  </div>
                </div>
                {receptionistNumber && (
                  <div className="flex items-center gap-2 mt-3 bg-background rounded-lg p-3 border">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{receptionistNumber}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto"
                      onClick={() => { navigator.clipboard.writeText(receptionistNumber); toast({ title: "Number copied" }); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-5 text-center">
                <Pause className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-semibold text-foreground">Your AI Receptionist is INACTIVE</p>
                <p className="text-sm text-muted-foreground mb-4">Incoming calls will not be answered</p>
                <Button style={{ backgroundColor: primaryColor, color: "white" }}
                  onClick={() => setActivateConfirm(true)}>
                  Activate Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setTestCallOpen(true)}>
              <PhoneCall className="h-4 w-4 mr-2" /> Test Call
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setIvrEditOpen(true)}>
              <Brain className="h-4 w-4 mr-2" /> AI Instructions
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setHoursEditOpen(true)}>
              <Clock className="h-4 w-4 mr-2" /> Business Hours
            </Button>
            <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setTeamEditOpen(true)}>
              <Phone className="h-4 w-4 mr-2" /> Team Numbers
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="ivr" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calls">Recent Calls</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="voicemail">Voicemail</TabsTrigger>
        </TabsList>

        <TabsContent value="calls">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent Calls</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs"
                onClick={() => navigate("/client/voice-telecaller/calls")}>
                View All <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentCalls.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caller</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCalls.map(call => (
                      <TableRow key={call.id}>
                        <TableCell className="font-mono text-sm">
                          {config.privacyMaskPhone
                            ? call.phone_number.replace(/(\d{4})$/, "****")
                            : call.phone_number}
                        </TableCell>
                        <TableCell>
                          <CallActionBadge metadata={call.metadata} status={call.status} />
                        </TableCell>
                        <TableCell className="text-sm">{formatDuration(call.duration_seconds)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}
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
                                <DropdownMenuItem><Play className="h-3 w-3 mr-2" /> Listen</DropdownMenuItem>
                              )}
                              <DropdownMenuItem><List className="h-3 w-3 mr-2" /> Details</DropdownMenuItem>
                              <DropdownMenuItem><Shield className="h-3 w-3 mr-2" /> Block Number</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10">
                  <PhoneIncoming className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No calls received yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Call Volume (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="calls" stroke={primaryColor} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Voicemail Tab */}
        <TabsContent value="voicemail">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Voicemail className="h-5 w-5" /> Voicemail Inbox
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCalls.filter(c => c.status === "completed" && c.ai_summary).length > 0 ? (
                <div className="space-y-3">
                  {recentCalls.filter(c => c.ai_summary).slice(0, 5).map(call => (
                    <div key={call.id} className="flex items-start gap-3 rounded-lg border p-3">
                      <Voicemail className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{call.phone_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(call.executed_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{call.ai_summary}</p>
                      </div>
                      <div className="flex gap-1">
                        {call.recording_url && (
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <Voicemail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No voicemails yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Modals ─── */}

      {/* IVR Edit Modal */}
      <IVREditDialog open={ivrEditOpen} onOpenChange={setIvrEditOpen}
        config={config} onSave={c => { saveConfig(c); setIvrEditOpen(false); }} />

      {/* Business Hours Modal */}
      <BusinessHoursDialog open={hoursEditOpen} onOpenChange={setHoursEditOpen}
        config={config} onSave={c => { saveConfig(c); setHoursEditOpen(false); }} />

      {/* Team Members Modal */}
      <TeamMembersDialog open={teamEditOpen} onOpenChange={setTeamEditOpen}
        config={config} onSave={c => { saveConfig(c); setTeamEditOpen(false); }} />

      {/* Test Call Dialog */}
      <Dialog open={testCallOpen} onOpenChange={setTestCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Your Receptionist</DialogTitle>
            <DialogDescription>
              Call your receptionist number to test the IVR menu and routing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {receptionistNumber && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Receptionist Number</p>
                <p className="text-2xl font-mono font-bold">{receptionistNumber}</p>
                <Button variant="outline" size="sm" className="mt-2"
                  onClick={() => { navigator.clipboard.writeText(receptionistNumber); toast({ title: "Copied" }); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
            )}
            <div className="space-y-2 text-sm">
              <p className="font-medium">Test Checklist:</p>
              <div className="space-y-1">
                {["Greeting plays correctly", "IVR menu options work", "Call routing works", "Voicemail works (if after hours)"].map(item => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestCallOpen(false)}>Close</Button>
            {receptionistNumber && (
              <Button asChild>
                <a href={`tel:${receptionistNumber}`}><PhoneCall className="h-4 w-4 mr-1" /> Call Now</a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate/Deactivate Confirm */}
      <Dialog open={activateConfirm !== null} onOpenChange={o => { if (!o) setActivateConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activateConfirm ? "Activate" : "Deactivate"} AI Receptionist?</DialogTitle>
            <DialogDescription>
              {activateConfirm
                ? "Your receptionist will start answering all incoming calls."
                : "Incoming calls will no longer be handled. Are you sure?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateConfirm(null)}>Cancel</Button>
            <Button variant={activateConfirm ? "default" : "destructive"}
              onClick={() => activateConfirm !== null && toggleActive(activateConfirm)}>
              {activateConfirm ? "Activate" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── IVR Edit Dialog ─── */
function IVREditDialog({ open, onOpenChange, config, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ReceptionistConfig;
  onSave: (c: ReceptionistConfig) => void;
}) {
  const [local, setLocal] = useState<ReceptionistConfig>(config);
  useEffect(() => { if (open) setLocal({ ...config }); }, [open, config]);

  const updateOption = (id: string, field: keyof MenuOption, value: string) => {
    setLocal(prev => ({
      ...prev,
      menuOptions: prev.menuOptions.map(o => o.id === id ? { ...o, [field]: value } : o),
    }));
  };

  const addOption = () => {
    const nextKey = String(local.menuOptions.length + 1);
    setLocal(prev => ({
      ...prev,
      menuOptions: [...prev.menuOptions, { id: crypto.randomUUID(), pressKey: nextKey, label: "", action: "forward", actionDetail: "" }],
    }));
  };

  const removeOption = (id: string) => {
    setLocal(prev => ({ ...prev, menuOptions: prev.menuOptions.filter(o => o.id !== id) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Receptionist Configuration</DialogTitle>
          <DialogDescription>Configure how your AI receptionist handles incoming calls.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* System Prompt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">System Instructions</Label>
              <Badge variant="outline" className="text-[10px]">AI Driven</Badge>
            </div>
            <Textarea
              value={local.systemPrompt}
              onChange={e => setLocal(prev => ({ ...prev, systemPrompt: e.target.value }))}
              rows={8}
              placeholder="Enter instructions for the AI..."
              className="mt-1 font-mono text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">This prompt defines the personality and behavior of your AI receptionist.</p>
              <p className="text-[11px] text-muted-foreground">{local.systemPrompt.length} characters</p>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 p-4 border border-primary/10">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> How it works
            </h4>
            <p className="text-xs text-muted-foreground leading-normal">
              The IVR system has been replaced with a smart AI agent. The agent will follow these instructions word-for-word to assist your callers, answer their questions, and route calls based on natural conversation.
            </p>
          </div>

          {/* Advanced / Fallback */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Emergency Number</Label>
              <Input value={local.emergencyNumber} onChange={e => setLocal(prev => ({ ...prev, emergencyNumber: e.target.value }))} placeholder="+1..." className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">After Hours Action</Label>
              <Select value={local.afterHoursAction} onValueChange={v => setLocal(prev => ({ ...prev, afterHoursAction: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="voicemail">Take Voicemail</SelectItem>
                  <SelectItem value="forward">Forward to Emergency</SelectItem>
                  <SelectItem value="hangup">Hang Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(local)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ─── Business Hours Dialog ─── */
function BusinessHoursDialog({ open, onOpenChange, config, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ReceptionistConfig;
  onSave: (c: ReceptionistConfig) => void;
}) {
  const [hours, setHours] = useState<BusinessHours[]>(config.businessHours);
  useEffect(() => { if (open) setHours([...config.businessHours]); }, [open, config]);

  const updateDay = (index: number, field: keyof BusinessHours, value: any) => {
    setHours(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h));
  };

  const copyToAll = (index: number) => {
    const source = hours[index];
    setHours(prev => prev.map(h => ({ ...h, enabled: source.enabled, from: source.from, to: source.to })));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Business Hours</DialogTitle>
          <DialogDescription>Set when your receptionist is available.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {hours.map((bh, i) => (
            <div key={bh.day} className="flex items-center gap-3">
              <div className="w-16 text-sm font-medium">{bh.day.slice(0, 3)}</div>
              <Switch checked={bh.enabled} onCheckedChange={v => updateDay(i, "enabled", v)} />
              {bh.enabled ? (
                <>
                  <Input type="time" value={bh.from} className="w-28 h-9"
                    onChange={e => updateDay(i, "from", e.target.value)} />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input type="time" value={bh.to} className="w-28 h-9"
                    onChange={e => updateDay(i, "to", e.target.value)} />
                  <Button variant="ghost" size="sm" className="text-[10px] shrink-0"
                    onClick={() => copyToAll(i)}>Copy all</Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ ...config, businessHours: hours })}>Save Hours</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Team Members Dialog ─── */
function TeamMembersDialog({ open, onOpenChange, config, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: ReceptionistConfig;
  onSave: (c: ReceptionistConfig) => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>(config.teamMembers);
  useEffect(() => { if (open) setMembers([...config.teamMembers]); }, [open, config]);

  const addMember = () => {
    setMembers(prev => [...prev, { id: crypto.randomUUID(), name: "", phone: "", department: "", hours: "Mon-Fri 9-6" }]);
  };

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team Members & Numbers</DialogTitle>
          <DialogDescription>Add phone numbers for call forwarding.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {members.map(tm => (
            <div key={tm.id} className="border rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input className="h-9" value={tm.name}
                    onChange={e => updateMember(tm.id, "name", e.target.value)} placeholder="John - Sales" />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-9" value={tm.phone}
                    onChange={e => updateMember(tm.id, "phone", e.target.value)} placeholder="+91..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Department</Label>
                  <Input className="h-9" value={tm.department}
                    onChange={e => updateMember(tm.id, "department", e.target.value)} placeholder="Sales" />
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMember(tm.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addMember}>
            <Plus className="h-3 w-3 mr-1" /> Add Member
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave({ ...config, teamMembers: members })}>Save Team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub Components ─── */
function StatCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode; label: string; value: string | number; subtext: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground">{subtext}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CallActionBadge({ metadata, status }: { metadata: any; status: string | null }) {
  const meta = metadata as any;
  const action = meta?.action;
  if (action === "forwarded") return <Badge variant="outline" className="text-[10px]">Forwarded to {meta?.forwarded_to || "team"}</Badge>;
  if (action === "voicemail") return <Badge variant="secondary" className="text-[10px]">Voicemail left</Badge>;
  if (status === "completed") return <Badge className="text-[10px]">Completed</Badge>;
  if (status === "no_answer") return <Badge variant="outline" className="text-[10px]">Missed</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{status || "Unknown"}</Badge>;
}

// formatDuration moved to src/utils/duration.ts

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  );
}
