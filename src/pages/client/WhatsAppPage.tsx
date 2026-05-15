import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  WHATSAPP_API_URL,
  getWhatsAppTemplates,
  updateMessageStatus,
  sendWhatsAppMessage,
  syncWhatsAppTemplates,
  createWhatsAppTemplate,
} from "@/utils/whatsapp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  CheckCircle,
  CheckCheck,
  Zap,
  MessageSquare,
  Users,
  FileText,
  BarChart3,
  MoreVertical,
  Plus,
  Send,
  Clock,
  X,
  ArrowRight,
  Upload,
  Eye,
  RefreshCw,
  Trash2,
  Copy,
  Pause,
  Play,
  Video,
  Headset,
  AlertCircle,
  Phone,
  Bot as BotIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import WhatsAppInbox from "@/components/client/whatsapp/WhatsAppInbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/* ─── Types ─── */
interface WACampaign {
  id: string;
  campaign_name: string;
  status: string;
  total_contacts: number;
  messages_sent: number;
  messages_delivered: number;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
  message_template: string;
}

interface WAMessage {
  id: string;
  phone_number: string;
  message_content: string;
  message_type: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  campaign_id: string | null;
  media_url: string | null;
  template_name: string | null;
  error_message: string | null;
  campaign_name?: string;
}

interface Stats {
  messagesSent: number;
  deliveryRate: number;
  delivered: number;
  total: number;
  readRate: number;
  readCount: number;
  activeCampaigns: number;
}

/* ─── Loading Skeleton ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
}

const PIE_COLORS = ["#25D366", "#22c55e", "#3b82f6", "#ef4444", "#a3a3a3"];

/* ─── Main Component ─── */
export default function WhatsAppPage() {
  const {
    client,
    assignedServices,
    isLoading: contextLoading,
    primaryColor,
    refetchClient,
  } = useClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<WACampaign[]>([]);
  const [recentMessages, setRecentMessages] = useState<WAMessage[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  const [campaignTab, setCampaignTab] = useState("all");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);
  const [workflowInstance, setWorkflowInstance] = useState<any>(null);
  const [assignedBots, setAssignedBots] = useState<any[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);

  // Message Sending State
  const [phone, setPhone] = useState("");
  const [messageType, setMessageType] = useState("text");
  const [content, setContent] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en_US");

  const waService = assignedServices.find(
    (s) => s.service_slug === "whatsapp-automation",
  );

  const fetchStats = useCallback(async () => {
    if (!client) return;
    const monthStart = startOfMonth(new Date()).toISOString();

    const [msgsRes, campaignsRes] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("status")
        .eq("client_id", client.id)
        .gte("sent_at", monthStart),
      supabase
        .from("whatsapp_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("status", "sending"),
    ]);

    const msgs = msgsRes.data || [];
    const total = msgs.length;
    const delivered = msgs.filter(
      (m) => m.status === "delivered" || m.status === "read",
    ).length;
    const readCount = msgs.filter((m) => m.status === "read").length;

    setStats({
      messagesSent: total,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      delivered,
      total,
      readRate: total > 0 ? Math.round((readCount / total) * 100) : 0,
      readCount,
      activeCampaigns: campaignsRes.count || 0,
    });
  }, [client]);

  const fetchCampaigns = useCallback(async () => {
    if (!client) return;
    const { data } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });
    setCampaigns((data as WACampaign[]) || []);
  }, [client]);

  const fetchWorkflow = useCallback(async () => {
    if (!client || !waService) return;
    const { data } = await supabase
      .from("client_workflow_instances")
      .select("*")
      .eq("client_id", client.id)
      .eq("service_id", waService.service_id)
      .maybeSingle();
    setWorkflowInstance(data);
  }, [client, waService]);

  const fetchAssignedBots = useCallback(async () => {
    if (!client) return;
    console.log("🔍 Client ID:", client.id);
    console.log("🔍 Client user_id:", client.user_id);

    // 1. Try to find bots directly assigned to this client
    const { data: directBots, error } = await (
      supabase.from("whatsapp_applications" as any) as any
    )
      .select("*")
      .eq("client_id", client.id);

    // 2. Also check if the user has access via whatsapp_user_access
    const { data: userAccess } = await (
      supabase.from("whatsapp_user_access" as any) as any
    )
      .select("application_id")
      .eq("user_id", client.user_id);

    let allBots = directBots || [];

    if (userAccess && userAccess.length > 0) {
      const appIds = userAccess.map((a: any) => a.application_id);
      const { data: accessedBots } = await (
        supabase.from("whatsapp_applications" as any) as any
      )
        .select("*")
        .in("id", appIds);

      if (accessedBots) {
        // Merge and avoid duplicates
        const existingIds = new Set(allBots.map((b) => b.id));
        accessedBots.forEach((b: any) => {
          if (!existingIds.has(b.id)) allBots.push(b);
        });
      }
    }

    // 3. Fallback to Env-defined bot if still empty (allows immediate testing)
    if (allBots.length === 0) {
      const envApiKey = import.meta.env.VITE_WHATSAPP_API_KEY;
      const envPhoneId = import.meta.env.VITE_WHATSAPP_PHONE_ID;

      if (envApiKey && envPhoneId) {
        allBots.push({
          id: "00000000-0000-0000-0000-000000000000",
          name: "WhapiHub (Env)",
          provider_type: "api",
          api_config: {
            api_key: envApiKey,
            phone_id: envPhoneId,
            base_url:
              import.meta.env.VITE_WHATSAPP_API_BASE_URL ||
              "https://app.whapihub.com/api",
          },
          phone_number_id: envPhoneId,
          status: "active",
          client_id: client.id,
        });
      }
    }

    setAssignedBots(allBots);
    if (allBots.length > 0 && !selectedAppId) {
      setSelectedAppId(allBots[0].id);
    }
  }, [client, selectedAppId]);

  const fetchRecentMessages = useCallback(async () => {
    if (
      !client ||
      !selectedAppId ||
      selectedAppId === "00000000-0000-0000-0000-000000000000"
    )
      return;

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("client_id", client.id)
      .order("sent_at", { ascending: false })
      .limit(10);

    if (!data) {
      setRecentMessages([]);
      return;
    }

    const campaignIds = [
      ...new Set(data.filter((m) => m.campaign_id).map((m) => m.campaign_id!)),
    ];
    let campaignMap = new Map<string, string>();
    if (campaignIds.length > 0) {
      const { data: camps } = await supabase
        .from("whatsapp_campaigns")
        .select("id, campaign_name")
        .in("id", campaignIds);
      camps?.forEach((c) => campaignMap.set(c.id, c.campaign_name));
    }

    setRecentMessages(
      data.map((m) => ({
        ...m,
        campaign_name: m.campaign_id
          ? campaignMap.get(m.campaign_id)
          : undefined,
      })) as WAMessage[],
    );
  }, [client]);

  const fetchAnalytics = useCallback(async () => {
    if (!client) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data } = await supabase
      .from("whatsapp_messages")
      .select("status, sent_at")
      .eq("client_id", client.id)
      .gte("sent_at", thirtyDaysAgo.toISOString());

    if (!data || data.length === 0) {
      setAnalyticsData([]);
      setStatusDistribution([]);
      return;
    }

    const dayMap = new Map<
      string,
      { sent: number; delivered: number; read: number }
    >();
    data.forEach((m) => {
      if (!m.sent_at) return;
      const day = format(new Date(m.sent_at), "MMM dd");
      const entry = dayMap.get(day) || { sent: 0, delivered: 0, read: 0 };
      entry.sent++;
      if (m.status === "delivered" || m.status === "read") entry.delivered++;
      if (m.status === "read") entry.read++;
      dayMap.set(day, entry);
    });
    setAnalyticsData(
      Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v })),
    );

    const statusMap = new Map<string, number>();
    data.forEach((m) => {
      statusMap.set(
        m.status || "queued",
        (statusMap.get(m.status || "queued") || 0) + 1,
      );
    });
    setStatusDistribution(
      Array.from(statusMap.entries()).map(([name, value]) => ({ name, value })),
    );
  }, [client]);

  const fetchTemplates = useCallback(
    async (appId: string) => {
      if (appId === "00000000-0000-0000-0000-000000000000") {
        setTemplates([]);
        return;
      }
      try {
        setIsRefreshingTemplates(true);
        const bot = assignedBots.find((b) => b.id === appId);
        if (bot && bot.provider_type === "api") {
          try {
            await syncWhatsAppTemplates(appId);
          } catch (syncErr) {
            console.warn(
              "API Sync failed, showing local templates only:",
              syncErr,
            );
          }
        }
        const data = await getWhatsAppTemplates(appId);
        setTemplates(data);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      } finally {
        setIsRefreshingTemplates(false);
      }
    },
    [assignedBots],
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!templateToDelete?.id || !selectedAppId) return;

    try {
      const { error } = await supabase
        .from("whatsapp_templates" as any)
        .delete()
        .eq("id", templateToDelete.id);

      if (error) throw error;

      toast({ title: "Template deleted" });
      setDeleteTemplateOpen(false);
      setTemplateToDelete(null);
      await fetchTemplates(selectedAppId);
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete template.",
        variant: "destructive",
      });
    }
  }, [fetchTemplates, selectedAppId, templateToDelete, toast]);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    await Promise.all([
      fetchStats(),
      fetchCampaigns(),
      fetchRecentMessages(),
      fetchAnalytics(),
      fetchWorkflow(),
      fetchAssignedBots(),
    ]);
    setIsLoading(false);
  }, [
    client,
    fetchStats,
    fetchCampaigns,
    fetchRecentMessages,
    fetchAnalytics,
    fetchWorkflow,
    fetchAssignedBots,
  ]);

  useEffect(() => {
    if (selectedAppId) {
      fetchTemplates(selectedAppId);
    }
  }, [selectedAppId, fetchTemplates]);

  useEffect(() => {
    if (!client || contextLoading) return;
    if (!waService) return;
    fetchAll();
  }, [client, contextLoading, waService, fetchAll]);

  // Realtime for campaigns
  useEffect(() => {
    if (!client) return;
    const channel = supabase
      .channel("wa-campaigns")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_campaigns",
          filter: `client_id=eq.${client.id}`,
        },
        () => {
          fetchCampaigns();
          fetchStats();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [client, fetchCampaigns, fetchStats]);

  const [mainTab, setMainTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inbox", label: "Inbox", icon: MessageSquare },
    { id: "template", label: "Template", icon: FileText },
    { id: "ai-settings", label: "AI Settings", icon: BotIcon },
  ] as const;

  // Lock page-level scroll when inbox is active so panels get bounded heights
  const inboxContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mainTab !== "inbox") return;
    const main = inboxContainerRef.current?.closest("main");
    if (!main) return;
    const innerDiv = main.querySelector(":scope > div") as HTMLElement | null;
    main.style.overflow = "hidden";
    if (innerDiv) innerDiv.style.minHeight = "0";
    return () => {
      main.style.overflow = "";
      if (innerDiv) innerDiv.style.minHeight = "";
    };
  }, [mainTab]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!waService) return <Navigate to="/client" replace />;

  const filteredCampaigns =
    campaignTab === "all"
      ? campaigns
      : campaigns.filter((c) => c.status === campaignTab);

  return (
    <div ref={inboxContainerRef} className="flex flex-col md:flex-row gap-4 md:gap-6 min-w-0 overflow-hidden flex-1 min-h-0">
      <div className="w-full md:w-44 md:shrink-0">
        <div className="flex flex-row md:flex-col gap-1 sticky top-0 md:top-6 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-150 text-left whitespace-nowrap md:whitespace-normal",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col transition-all min-h-0",
          mainTab === "inbox"
            ? "flex-1 min-h-0 overflow-hidden"
            : "h-auto space-y-4 md:space-y-6",
        )}
      >
        <div
          className={cn(
            "bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-3xl px-4 py-3 md:p-6 shadow-sm mb-4 md:mb-6 transition-all",
            mainTab === "inbox" && "flex-shrink-0",
          )}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="ml-2 md:ml-0 h-12 w-12 flex items-center justify-center rounded-2xl bg-green-500/10 shadow-inner shrink-0">
                <MessageCircle className="h-7 w-7 text-[#25D366]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  LeadNest
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">
                    Automation Active
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {assignedBots.length > 1 && (
                <Select
                  value={selectedAppId || ""}
                  onValueChange={setSelectedAppId}
                >
                  <SelectTrigger className="w-[140px] md:w-[180px] h-10 bg-white border-slate-200 text-xs font-semibold rounded-xl">
                    <SelectValue placeholder="Select Bot" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200">
                    {assignedBots.map((bot) => (
                      <SelectItem
                        key={bot.id}
                        value={bot.id}
                        className="text-xs font-medium"
                      >
                        {bot.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="min-w-[110px] h-9 px-2.5 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
                <p className="text-[10px] font-bold text-slate-600 truncate">
                  <span className="text-blue-600">
                    {Math.max(
                      stats?.total || 0,
                      waService?.usage_consumed || 0,
                    )}
                  </span>
                  <span className="mx-1 text-slate-300">/</span>
                  <span className="text-slate-400">
                    {waService?.usage_limit || 0}
                  </span>
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-[10px] font-bold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition-all active:scale-95 whitespace-nowrap"
                onClick={() => setCampaignWizardOpen(true)}
                disabled={assignedBots.length === 0}
              >
                <Plus className="h-3 w-3 mr-1 text-blue-600" /> Campaign
              </Button>
              <Button
                size="sm"
                className="h-9 px-3 text-[10px] font-bold rounded-xl shadow-lg shadow-blue-500/25 bg-blue-600 hover:bg-blue-700 transition-all active:scale-95 text-white whitespace-nowrap"
                onClick={() => setSendModalOpen(true)}
                disabled={assignedBots.length === 0}
              >
                <Send className="h-3 w-3 mr-1" /> Message
              </Button>
            </div>
          </div>
        </div>

        {assignedBots.length === 0 && !isLoading && (
          <Alert
            variant="destructive"
            className="bg-destructive/5 border-destructive/20 text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No WhatsApp Bot Connected</AlertTitle>
            <AlertDescription>
              Direct communication services are currently unavailable. Contact
              admin for bot assignment.
            </AlertDescription>
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {mainTab === "overview" && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  icon={<MessageCircle className="h-5 w-5" />}
                  color="#25D366"
                  label="Messages Sent"
                  value={stats?.messagesSent ?? 0}
                  subtext="This month"
                />
                <StatsCard
                  icon={<CheckCircle className="h-5 w-5" />}
                  color="#22c55e"
                  label="Delivery Rate"
                  value={`${stats?.deliveryRate ?? 0}%`}
                  subtext={`${stats?.delivered ?? 0} of ${stats?.total ?? 0}`}
                />
                <StatsCard
                  icon={<CheckCheck className="h-5 w-5" />}
                  color="#3b82f6"
                  label="Read Rate"
                  value={`${stats?.readRate ?? 0}%`}
                  subtext="Recipients opened"
                />
                <StatsCard
                  icon={<Zap className="h-5 w-5" />}
                  color="#f59e0b"
                  label="Active Campaigns"
                  value={stats?.activeCampaigns ?? 0}
                  subtext="Running now"
                />
              </div>

              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <QuickAction
                  icon={<MessageSquare className="h-5 w-5" />}
                  label="Send Single Message"
                  sub="Send to one contact"
                  onClick={() => setSendModalOpen(true)}
                  disabled={assignedBots.length === 0}
                />
                <QuickAction
                  icon={<Users className="h-5 w-5" />}
                  label="Bulk Campaign"
                  sub="Send to multiple contacts"
                  onClick={() => setCampaignWizardOpen(true)}
                  disabled={assignedBots.length === 0}
                />
                <QuickAction
                  icon={<FileText className="h-5 w-5" />}
                  label="Message Templates"
                  sub="Pre-approved templates"
                  onClick={() => setMainTab("template")}
                />
                <QuickAction
                  icon={<MessageSquare className="h-5 w-5" />}
                  label="Live Chat Inbox"
                  sub="Real-time messaging"
                  onClick={() => setMainTab("inbox")}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground tracking-tight">
                    Campaign Operations
                  </h2>
                </div>
                <Tabs
                  value={campaignTab}
                  onValueChange={setCampaignTab}
                  className="w-full"
                >
                  <TabsList className="mb-4 bg-muted/20 w-full justify-start overflow-x-auto no-scrollbar">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="sending">Sending</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                    <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                  </TabsList>
                  <TabsContent value={campaignTab}>
                    {filteredCampaigns.length > 0 ? (
                      <div className="space-y-4">
                        {filteredCampaigns.map((c) => (
                          <CampaignCard
                            key={c.id}
                            campaign={c}
                            onRefresh={fetchCampaigns}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="border-dashed">
                        <CardContent className="py-12 text-center text-muted-foreground">
                          <p className="text-sm">
                            No {campaignTab} campaigns found in your archives.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              <Card className="shadow-sm border-muted/20">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg font-bold">
                    Transmission History
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-muted"
                    onClick={fetchRecentMessages}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {recentMessages.length > 0 ? (
                    <div className="overflow-x-auto -mx-4 md:mx-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[140px]">Phone</TableHead>
                            <TableHead>Message Content</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[140px]">
                              Timestamp
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentMessages.map((m) => (
                            <TableRow
                              key={m.id}
                              className="group transition-colors hover:bg-muted/30"
                            >
                              <TableCell className="font-mono text-sm font-medium">
                                {m.phone_number}
                              </TableCell>
                              <TableCell className="max-w-[300px] truncate text-xs">
                                {m.message_content}
                              </TableCell>
                              <TableCell>
                                <MessageStatusBadge status={m.status} />
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {m.sent_at
                                  ? format(new Date(m.sent_at), "dd MMM, HH:mm")
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl">
                      <p className="text-sm text-muted-foreground">
                        The transmission stream is currently empty
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div id="wa-analytics" className="grid gap-6 lg:grid-cols-2">
                <Card className="shadow-sm border-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">
                      Metric Trends
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analyticsData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E2E8F0"
                          />
                          <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748B" }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: "#64748B" }}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="sent"
                            stroke="#25D366"
                            strokeWidth={3}
                            dot={{ r: 4, fill: "#25D366" }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center py-16 text-muted-foreground text-sm italic">
                        Analytics engine awaiting data streams...
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="shadow-sm border-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base font-bold">
                      Status Allocation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={statusDistribution}
                            dataKey="value"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={5}
                          >
                            {statusDistribution.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center py-16 text-muted-foreground text-sm italic">
                        Status distribution mapping pending...
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {mainTab === "inbox" && (
            <motion.div
              className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <WhatsAppInbox
                selectedAppId={selectedAppId}
                assignedBots={assignedBots}
              />
            </motion.div>
          )}

          {mainTab === "template" && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold tracking-tight">
                  Whatsapp Templates
                </h2>
                <p className="text-sm text-muted-foreground">
                  Manage your Whatsapp templates
                </p>
              </div>

              <div className="bg-card/50 border border-border rounded-xl p-3 md:p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  </div>
                  <span className="font-bold text-sm md:text-lg">
                    {templates.length} Templates
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-background text-foreground border-border hover:bg-primary/10 hover:text-foreground font-bold text-xs h-8 md:h-9 px-2 md:px-3 transition-colors"
                    onClick={() =>
                      selectedAppId && fetchTemplates(selectedAppId)
                    }
                    disabled={isRefreshingTemplates}
                  >
                    <RefreshCw
                      className={cn(
                        "h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-2",
                        isRefreshingTemplates && "animate-spin",
                      )}
                    />
                    <span className="hidden sm:inline">Sync Templates</span>
                    <span className="sm:hidden">Sync</span>
                  </Button>
                  <Button
                    size="sm"
                    className="font-bold text-xs h-8 md:h-9 px-2 md:px-3"
                    onClick={() => setTemplateModalOpen(true)}
                    disabled={!selectedAppId || selectedAppId === "00000000-0000-0000-0000-000000000000"}
                  >
                    <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-2" />
                    <span>Create Template</span>
                  </Button>
                </div>
              </div>

              <Card className="border-border/50 shadow-xl overflow-hidden rounded-2xl bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="py-5 font-bold text-xs text-muted-foreground uppercase tracking-widest">
                          Name
                        </TableHead>
                        <TableHead className="py-5 font-bold text-xs text-muted-foreground uppercase tracking-widest">
                          Category
                        </TableHead>
                        <TableHead className="py-5 font-bold text-xs text-muted-foreground uppercase tracking-widest">
                          Language
                        </TableHead>
                        <TableHead className="py-5 font-bold text-xs text-muted-foreground uppercase tracking-widest">
                          Status
                        </TableHead>
                        <TableHead className="py-5 font-bold text-xs text-muted-foreground uppercase tracking-widest text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.length > 0 ? (
                        templates.map((tpl: any) => (
                          <TableRow
                            key={tpl.id || tpl.name}
                            className="border-border/30 hover:bg-muted/10 transition-colors"
                          >
                            <TableCell className="py-6 font-black text-primary">
                              {tpl.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {tpl.category || "MARKETING"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {tpl.language || "en_US"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  "rounded-md py-1 px-3",
                                  (tpl.status || "approved").toLowerCase() ===
                                    "approved" ||
                                    (tpl.status || "approved").toLowerCase() ===
                                    "ready"
                                    ? "bg-green-500/10 text-green-500 border-none"
                                    : (
                                      tpl.status || "approved"
                                    ).toLowerCase() === "rejected"
                                      ? "bg-red-500/10 text-red-500 border-none"
                                      : "bg-yellow-500/10 text-yellow-500 border-none",
                                )}
                              >
                                {(tpl.status || "approved").toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setTemplateToDelete(tpl);
                                  setDeleteTemplateOpen(true);
                                }}
                                aria-label={`Delete template ${tpl.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-20">
                              <FileText className="h-12 w-12" />
                              <p className="font-bold">
                                No templates available
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </motion.div>
          )}

          {mainTab === "ai-settings" && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <AISettingsTab clientId={client?.id || ""} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SendMessageModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        clientId={client?.id || ""}
        onSent={() => {
          fetchRecentMessages();
          fetchStats();
          refetchClient();
        }}
        webhookUrl={workflowInstance?.webhook_url}
        assignedBots={assignedBots}
        selectedAppId={selectedAppId}
        onAppChange={setSelectedAppId}
        phone={phone}
        setPhone={setPhone}
        messageType={messageType}
        setMessageType={setMessageType}
        content={content}
        setContent={setContent}
        templateName={templateName}
        setTemplateName={setTemplateName}
        templates={templates}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <CreateTemplateModalWA
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        selectedAppId={selectedAppId}
        onCreated={() => selectedAppId && fetchTemplates(selectedAppId)}
      />

      <ConfirmDialog
        open={deleteTemplateOpen}
        onOpenChange={(open) => {
          setDeleteTemplateOpen(open);
          if (!open) setTemplateToDelete(null);
        }}
        title="Delete template?"
        description={`This will permanently remove ${templateToDelete?.name || "this template"} from your template list.`}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="destructive"
        onConfirm={handleDeleteTemplate}
      />

      <CreateCampaignWizardWA
        open={campaignWizardOpen}
        onOpenChange={setCampaignWizardOpen}
        clientId={client?.id || ""}
        onCreated={() => {
          fetchCampaigns();
          fetchStats();
          refetchClient();
        }}
        selectedAppId={selectedAppId}
        templates={templates}
      />
    </div>
  );
}

/* ─── AI Settings Tab ─── */
function AISettingsTab({ clientId }: { clientId: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchAISettings() {
      if (!clientId) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from("ai_chatbots" as any)
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (!error && data) {
        setSettings(data);
      } else {
        setSettings({
          name: "LeadNest Bot",
          system_prompt:
            "You are a helpful and professional assistant for LeadNest. Answer queries concisely and kindly in the same language as the user.",
          temperature: 0.7,
          is_active: true,
        });
      }
      setIsLoading(false);
    }
    fetchAISettings();
  }, [clientId]);

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await (supabase.from("ai_chatbots" as any) as any).upsert(
      {
        client_id: clientId,
        ...settings,
        updated_at: new Date().toISOString(),
      },
    );

    if (error) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Settings saved successfully" });
    }
    setIsSaving(false);
  };

  if (isLoading)
    return (
      <div className="p-20 flex flex-col items-center justify-center opacity-40">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading AI settings...</p>
      </div>
    );

  return (
    <Card className="border-border/50 bg-card/30 backdrop-blur-sm border shadow-xl overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <BotIcon className="h-6 w-6 text-primary" />
              </div>
              AI Chatbot Configuration
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configure how your AI agent interacts with customers on WhatsApp.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 bg-background/50 p-2 rounded-xl border border-border/50">
            <Label
              htmlFor="bot-active"
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2"
            >
              Agent Status
            </Label>
            <Select
              value={settings.is_active ? "on" : "off"}
              onValueChange={(v) =>
                setSettings({ ...settings, is_active: v === "on" })
              }
            >
              <SelectTrigger
                className={cn(
                  "w-28 h-9 text-xs font-bold border-none shadow-none focus:ring-0",
                  settings.is_active ? "text-green-500" : "text-destructive",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on" className="text-green-500 font-bold">
                  ● ACTIVE
                </SelectItem>
                <SelectItem value="off" className="text-destructive font-bold">
                  ○ DISABLED
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8 p-6 md:p-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
                Agent Identity
              </Label>
              <Input
                className="h-12 bg-muted/30 border-border/50 focus:border-primary/50 text-sm font-medium"
                value={settings.name}
                onChange={(e) =>
                  setSettings({ ...settings, name: e.target.value })
                }
                placeholder="e.g. LeadNest Assistant"
              />
              <p className="text-[10px] text-muted-foreground">
                The name your AI will use when introducing itself.
              </p>
            </div>

            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
                  Creativity (Temperature)
                </Label>
                <Badge
                  variant="outline"
                  className="font-mono text-primary border-primary/20 bg-primary/5"
                >
                  {settings.temperature}
                </Badge>
              </div>
              <div className="px-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  value={settings.temperature}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                />
                <div className="flex justify-between mt-2 px-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Factual/Strict
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                    Creative/Human
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-2 mt-8">
              <h4 className="text-xs font-bold flex items-center gap-2 text-primary">
                <Zap className="h-3 w-3" /> Auto-Pilot Mode
              </h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When enabled, the AI will automatically respond to all incoming
                WhatsApp messages using the instructions provided. You can still
                intervene and send manual messages from the Inbox at any time.
              </p>
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
                System Instructions (Personality)
              </Label>
              <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border">
                <Clock className="h-2.5 w-2.5" />
                Context Aware
              </div>
            </div>
            <Textarea
              className="flex-1 min-h-[300px] text-sm leading-relaxed bg-muted/20 border-border/50 focus:border-primary/50 font-medium resize-none p-4"
              value={settings.system_prompt}
              onChange={(e) =>
                setSettings({ ...settings, system_prompt: e.target.value })
              }
              placeholder="Tell the AI how to behave, what to know about your business, and how to handle inquiries..."
            />
            <div className="flex items-center gap-2 mt-2">
              <Badge className="text-[9px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                Pro Tip
              </Badge>
              <p className="text-[10px] text-muted-foreground">
                Describe your products, pricing, and FAQs for better accuracy.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-60">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Real-time syncing enabled
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-10 h-12 font-black text-sm shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-3" />
            ) : (
              <CheckCheck className="h-5 w-5 mr-3" />
            )}
            UPDATE AI AGENT
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Sub-Components ─── */

function StatsCard({
  icon,
  color,
  label,
  value,
  subtext,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string | number;
  subtext: string;
}) {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm group hover:border-primary/50 transition-all duration-300">
      <CardContent className="p-0">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div
              className="rounded-xl p-2.5 transition-colors group-hover:bg-primary/20"
              style={{ backgroundColor: `${color}15` }}
            >
              <div style={{ color }}>{icon}</div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {label}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-2xl font-black text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              ></span>
              {subtext}
            </p>
          </div>
        </div>
        <div
          className="h-1 w-full opacity-10 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: color }}
        ></div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon,
  label,
  sub,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 border-border/50 bg-card/20 hover:bg-primary/5 hover:border-primary/30 group relative overflow-hidden",
        disabled && "opacity-50 cursor-not-allowed grayscale-[0.5]",
      )}
      onClick={() => !disabled && onClick()}
    >
      <CardContent className="pt-6 pb-5 flex flex-col gap-4">
        <div className="rounded-xl bg-muted p-2.5 w-fit group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-black tracking-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {sub}
          </p>
        </div>
      </CardContent>
      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight className="h-4 w-4 text-primary" />
      </div>
    </Card>
  );
}

function CampaignCard({
  campaign,
  onRefresh,
}: {
  campaign: WACampaign;
  onRefresh: () => void;
}) {
  const progress =
    campaign.total_contacts > 0
      ? Math.round((campaign.messages_sent / campaign.total_contacts) * 100)
      : 0;
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold">{campaign.campaign_name}</h3>
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(campaign.created_at), {
                addSuffix: true,
              })}
            </p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        <Progress value={progress} className="h-2 mb-2" />
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>Sent: {campaign.messages_sent}</span>
          <span>Delivered: {campaign.messages_delivered}</span>
          <span>Total: {campaign.total_contacts}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const variants: any = {
    sending: "default",
    completed: "secondary",
    scheduled: "outline",
    draft: "secondary",
  };
  return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
}

function MessageStatusBadge({ status }: { status: string }) {
  const icons: any = {
    read: <CheckCheck className="h-3 w-3 text-blue-500" />,
    delivered: <CheckCheck className="h-3 w-3 text-muted-foreground" />,
    sent: <CheckCircle className="h-3 w-3 text-muted-foreground" />,
    failed: <X className="h-3 w-3 text-destructive" />,
    queued: <Clock className="h-3 w-3 text-muted-foreground" />,
  };
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium uppercase">
      {icons[status]} {status}
    </span>
  );
}

/* ─── Send Message Modal ─── */
function SendMessageModal({
  open,
  onOpenChange,
  clientId,
  onSent,
  assignedBots,
  selectedAppId,
  onAppChange,
  phone,
  setPhone,
  messageType,
  setMessageType,
  content,
  setContent,
  templateName,
  setTemplateName,
  templates,
  selectedLanguage,
  setSelectedLanguage,
}: any) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [mediaUrl, setMediaUrl] = useState("");

  const selectedTemplate = templates.find(
    (t: any) => (t.name || t.template_name) === templateName,
  );
  const requiresMedia = selectedTemplate?.components?.some(
    (c: any) =>
      c.type === "HEADER" &&
      ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"].includes(c.format),
  );
  const headerFormat = selectedTemplate?.components?.find(
    (c: any) => c.type === "HEADER",
  )?.format;

  const reset = () => {
    setPhone("");
    setContent("");
    setMessageType("text");
    setTemplateName("");
    setVariables({});
    setMediaUrl("");
  };

  const detectedVariables = useMemo(() => {
    if (messageType !== "template") return [];
    const matches = content.match(/{{(\d+)}}/g) || [];
    return [...new Set(matches)].sort() as string[];
  }, [content, messageType]);

  const previewContent = useMemo(() => {
    let text = content;
    Object.entries(variables).forEach(([key, val]) => {
      text = text.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        val || `{{${key}}}`,
      );
    });
    return text;
  }, [content, variables]);

  const handleSend = async () => {
    console.log("🚀 Sending WhatsApp Message:");

    // Clean phone number for validation
    const cleanedPhone = phone.trim().replace(/[^0-9]/g, "");

    if (!phone.trim()) {
      return toast({ title: "Phone required", variant: "destructive" });
    }

    // Check for country code and length
    if (cleanedPhone.length < 11) {
      return toast({
        title: "Invalid Phone Number",
        description:
          "Please include country code (e.g., 91 for India). Minimum 11 digits required.",
        variant: "destructive",
      });
    }

    if (cleanedPhone.length > 15) {
      return toast({
        title: "Invalid Phone Number",
        description: "Phone number is too long. Maximum 15 digits allowed.",
        variant: "destructive",
      });
    }

    if (requiresMedia && !mediaUrl.trim())
      return toast({
        title: `${headerFormat} URL required`,
        variant: "destructive",
      });

    setSending(true);
    const bot = assignedBots.find((b: any) => b.id === selectedAppId);
    try {
      if (bot?.provider_type === "api") {
        const bodyParams = detectedVariables.map(
          (v: string) => variables[v.replace(/[{}]/g, "")] || "",
        );
        const result = await sendWhatsAppMessage(
          {
            to: phone.trim(),
            body: previewContent,
            application_id: bot.id,
            client_id: clientId,
            phoneNoId: bot.api_config?.phone_id,
            type: (requiresMedia
              ? headerFormat?.toLowerCase()
              : messageType) as any,
            name: templateName,
            language: selectedLanguage,
            mediaUrl: mediaUrl.trim() || undefined,
            bodyParams,
          },
          bot.api_config?.api_key,
        );
        if (result.success) {
          toast({ title: "Message sent!" });
        } else {
          toast({
            title: "Error",
            description: result.message,
            variant: "destructive",
          });
        }
      } else {
        await (supabase.from("whatsapp_messages" as any) as any).insert({
          client_id: clientId,
          application_id: selectedAppId,
          phone_number: phone.trim(),
          message_type: messageType,
          message_content: previewContent,
          template_name: messageType === "template" ? templateName : null,
          status: "queued",
          sent_at: new Date().toISOString(),
          media_url: mediaUrl || null,
        });
        toast({ title: "Message queued" });
      }
      onSent();
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-green-500" /> Send Message
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Bot</Label>
            <Select value={selectedAppId || ""} onValueChange={onAppChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignedBots.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={messageType} onValueChange={setMessageType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(requiresMedia ||
            ["image", "video", "audio", "document"].includes(messageType)) && (
              <div>
                <Label>{(headerFormat || messageType).toUpperCase()} URL</Label>
                <Input
                  placeholder="https://..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                />
              </div>
            )}
          {messageType === "template" && (
            <div>
              <Label>Template</Label>
              <Select
                value={templateName}
                onValueChange={(val) => {
                  setTemplateName(val);
                  setVariables({});
                  const tpl = templates.find(
                    (t: any) => (t.name || t.template_name) === val,
                  );
                  if (tpl) {
                    const body =
                      tpl.components?.find((c: any) => c.type === "BODY")
                        ?.text ||
                      tpl.body ||
                      "";
                    setContent(body);
                    setSelectedLanguage(
                      tpl.language || tpl.language_code || "en_US",
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t: any, i: number) => (
                    <SelectItem key={i} value={t.name || t.template_name}>
                      {t.name || t.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {messageType === "template" &&
            detectedVariables.map((v: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <Label className="w-12 text-right font-mono text-[10px]">
                  {v}
                </Label>
                <Input
                  className="h-8 text-xs"
                  placeholder={`Value for ${v}`}
                  onChange={(e) =>
                    setVariables((prev) => ({
                      ...prev,
                      [(v as string).replace(/[{}]/g, "")]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          <div>
            <Label>Message</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              readOnly={messageType === "template"}
              className="text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={sending || !phone.trim()}
            onClick={handleSend}
            className="bg-green-500 text-white hover:bg-green-600"
          >
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Create Template Modal ─── */
function CreateTemplateModalWA({
  open,
  onOpenChange,
  selectedAppId,
  onCreated,
}: any) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("MARKETING");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState("NONE");
  const [headerText, setHeaderText] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedName = useMemo(
    () => name.trim().toLowerCase().replace(/\s+/g, "_"),
    [name],
  );

  const bodyVariables = useMemo(
    () => Array.from(new Set(body.match(/\{\{\d+\}\}/g) || [])),
    [body],
  );

  const previewSegments = useMemo(() => {
    const previewText =
      body.trim() ||
      "Hello {{1}}, your request is ready. Reply with {{2}} if you need help.";
    return previewText.split(/(\{\{\d+\}\})/g).filter(Boolean);
  }, [body]);

  const headerPreviewLabel = useMemo(() => {
    if (headerType === "TEXT") return headerText.trim() || "Header text";
    if (headerType === "IMAGE") return "Image header";
    if (headerType === "VIDEO") return "Video header";
    if (headerType === "AUDIO") return "Audio header";
    if (headerType === "DOCUMENT") return "Document header";
    return "No header";
  }, [headerType, headerText]);

  const reset = () => {
    setName("");
    setCategory("MARKETING");
    setLanguage("en_US");
    setHeaderType("NONE");
    setHeaderText("");
    setBody("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !body.trim())
      return toast({ title: "Name and Body required", variant: "destructive" });
    setIsSubmitting(true);
    try {
      const components: any[] = [{ type: "BODY", text: body.trim() }];
      if (headerType !== "NONE") {
        const header: any = { type: "HEADER", format: headerType };
        if (headerType === "TEXT") header.text = headerText.trim();
        else header.example = { header_handle: [headerText.trim()] };
        components.unshift(header);
      }
      await createWhatsAppTemplate(selectedAppId!, {
        name: name.trim().toLowerCase().replace(/\s+/g, "_"),
        category,
        language,
        components,
      });
      toast({ title: "Template submitted!" });
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[94vw] max-w-6xl overflow-hidden border-slate-200/70 bg-slate-50 p-0 shadow-2xl sm:w-[92vw] md:w-[90vw]">
        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-100">
                  <Eye className="h-3.5 w-3.5" />
                  Live preview
                </div>
                <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                  Create Template
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm text-slate-300">
                  Build a polished WhatsApp template with a real-time preview so
                  you can check the final look before submitting.
                </DialogDescription>
              </div>

              <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 md:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Approval-ready layout</p>
                  <p className="text-slate-300">See the message structure live.</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-w-0 space-y-5 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:border-b-0 lg:border-r">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div className="min-w-0 space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template name
                  </Label>
                  <Input
                    placeholder="welcome_msg"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-sm transition-colors focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                  />
                  <p className="max-w-md text-xs leading-5 text-slate-500">
                    Use lowercase letters, numbers, and underscores for a clean
                    SaaS-style naming convention.
                  </p>
                </div>

                <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <span>Template health</span>
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                    >
                      Ready
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-start justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
                      <span className="text-slate-600">Slug</span>
                      <span className="max-w-[15rem] break-all text-right font-mono text-xs text-slate-900 sm:max-w-[18rem]">
                        {normalizedName || "welcome_msg"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-slate-600">
                      <span>Variables</span>
                      <span className="font-medium text-slate-900">
                        {bodyVariables.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-slate-600">
                      <span>Status</span>
                      <span className="flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Draft
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKETING">Marketing</SelectItem>
                      <SelectItem value="UTILITY">Utility</SelectItem>
                      <SelectItem value="AUTHENTICATION">Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_US">English (US)</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Header
                    </Label>
                    <p className="mt-1 text-xs text-slate-500">
                      Add an optional message header to make the template more engaging.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    {headerType}
                  </Badge>
                </div>
                <Select value={headerType} onValueChange={setHeaderType}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-white shadow-sm focus:ring-emerald-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                    <SelectItem value="AUDIO">Audio</SelectItem>
                    <SelectItem value="DOCUMENT">Doc</SelectItem>
                  </SelectContent>
                </Select>
                {headerType !== "NONE" && (
                  <Input
                    className="mt-3 h-12 rounded-2xl border-slate-200 bg-white shadow-sm focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                    placeholder="Header text or media URL"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Body
                  </Label>
                  <span className="text-xs text-slate-500">
                    {body.length}/1024 characters
                  </span>
                </div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={7}
                  placeholder="Hello {{1}}, welcome to your new workspace."
                  className="min-h-[180px] rounded-3xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                />
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                  <p className="font-medium">Quick tip</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800/90">
                    Keep the first line clear and friendly. Variables like
                    <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                      {'{{1}}'}
                    </span>
                    are highlighted in the preview so you can see exactly how
                    personalization will land.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Template snapshot
                  </p>
                  <p className="text-xs text-slate-500">
                    {normalizedName || "welcome_msg"} · {bodyVariables.length} dynamic field(s)
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="rounded-full bg-slate-200 text-slate-700 hover:bg-slate-200">
                    {category}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                    {language === "en_US" ? "English (US)" : language}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-5 bg-slate-100 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Live preview</h3>
                  <p className="text-sm text-slate-500">
                    Updated instantly as you type.
                  </p>
                </div>
                <Badge className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-900">
                  Draft mode
                </Badge>
              </div>

              <div className="mx-auto w-full max-w-[22rem] overflow-x-auto rounded-[2rem] border border-slate-200 bg-slate-950 p-2.5 shadow-2xl sm:max-w-[24rem] lg:max-w-sm xl:max-w-md">
                <div className="rounded-[1.65rem] bg-[#ECE5DD] p-3">
                  <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-semibold text-white shadow-md shadow-emerald-500/30">
                        WA
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          WhatsApp Business
                        </p>
                        <p className="text-xs text-slate-500">Template preview</p>
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700">
                      Draft
                    </div>
                  </div>

                  <div className="ml-auto w-full max-w-full overflow-x-auto rounded-[1.5rem] rounded-tr-md bg-white p-3.5 shadow-sm ring-1 ring-black/5 sm:p-4">
                    <div className="flex items-start justify-between gap-3 text-[11px] text-slate-500">
                      <span className="font-medium text-emerald-600">
                        {category}
                      </span>
                      <span className="max-w-[55%] break-all font-mono text-[10px] text-slate-400">
                        {normalizedName || "welcome_msg"}
                      </span>
                    </div>

                    {headerType !== "NONE" && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <Phone className="h-3.5 w-3.5 text-emerald-600" />
                          Header preview
                        </div>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">
                          {headerPreviewLabel}
                        </p>
                        {headerType === "TEXT" && headerText.trim() && (
                          <p className="mt-1 break-all text-xs text-slate-500">
                            {headerText.trim()}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mt-3 overflow-x-auto break-words whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {previewSegments.map((segment, index) =>
                        /\{\{\d+\}\}/.test(segment) ? (
                          <span
                            key={`${segment}-${index}`}
                            className="mx-0.5 inline-block max-w-full break-all rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"
                          >
                            {segment}
                          </span>
                        ) : (
                          <span key={`${segment}-${index}`} className="break-all">
                            {segment}
                          </span>
                        ),
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {language === "en_US" ? "English (US)" : language}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                        {bodyVariables.length} variable{bodyVariables.length === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                        {headerType === "NONE" ? "No header" : headerType}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      Live sync enabled
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Personalization
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Variables render clearly so your team can spot dynamic fields fast.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Premium feel
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Clean spacing, gradients, and hierarchy make the modal feel SaaS-ready.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Approval ready
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    The structure mirrors how reviewers see the template in WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-full px-5 sm:w-auto">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.01] hover:from-emerald-600 hover:to-green-700 sm:w-auto"
            >
              {isSubmitting ? "Submitting..." : "Create Template"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campaign Wizard ─── */
function CreateCampaignWizardWA({
  open,
  onOpenChange,
  clientId,
  onCreated,
  selectedAppId,
}: any) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [creating, setCreating] = useState(false);

  const reset = () => {
    setStep(1);
    setName("");
    setContacts([]);
    setMessageContent("");
  };

  const handleCreate = async () => {
    // Basic validation for contacts
    const invalidContacts = contacts.filter((c) => {
      const cleaned = c.phone.replace(/[^0-9]/g, "");
      return cleaned.length < 11 || cleaned.length > 15;
    });

    if (invalidContacts.length > 0) {
      return toast({
        title: "Invalid Contacts Detected",
        description: `${invalidContacts.length} contacts have invalid phone numbers or are missing country codes.`,
        variant: "destructive",
      });
    }

    setCreating(true);
    try {
      const { data: campaign } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          client_id: clientId,
          campaign_name: name.trim(),
          message_template: messageContent.trim(),
          total_contacts: contacts.length,
          status: "sending",
        })
        .select("id")
        .single();

      const msgs = contacts.map((c) => ({
        client_id: clientId,
        application_id: selectedAppId,
        campaign_id: campaign.id,
        phone_number: c.phone,
        message_content: messageContent,
        message_type: "text" as const,
        template_name: null,
        status: "queued" as const,
      }));
      await (supabase.from("whatsapp_messages" as any) as any).insert(msgs);
      toast({ title: "Campaign Launched!" });
      onCreated();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>WhatsApp Campaign (Step {step})</DialogTitle>
        </DialogHeader>
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
            >
              Next
            </Button>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Label>Import CSV (Mock import for now)</Label>
            <Input
              type="file"
              onChange={() =>
                setContacts([{ phone: "12345" }, { phone: "67890" }])
              }
            />
            <Button
              className="w-full"
              onClick={() => setStep(3)}
              disabled={contacts.length === 0}
            >
              Next
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label>Message</Label>
              <Textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-green-500 text-white"
              onClick={handleCreate}
              disabled={creating || !messageContent.trim()}
            >
              {creating ? "Launching..." : "Launch"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
