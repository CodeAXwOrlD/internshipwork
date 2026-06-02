import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
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
  Download,
  Check,
  Search,
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
  // activeCampaigns: number;
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

// Cache to prevent loading skeleton flicker on tab switching
const getWaCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_wa_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let waPageCache = getWaCacheFromStorage();

const saveWaCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && waPageCache) {
      localStorage.setItem(`pixora_wa_cache_${uid}`, JSON.stringify(waPageCache));
    }
  } catch { }
};

const ensureWaCache = () => {
  if (!waPageCache) {
    waPageCache = {
      stats: null,
      campaigns: [],
      recentMessages: [],
      templates: [],
      analyticsData: [],
      statusDistribution: [],
      workflowInstance: null,
      assignedBots: [],
    };
  }
  return waPageCache;
};

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
  const location = useLocation();
  const isActiveRoute = location.pathname.startsWith("/client/whatsapp");

  const [stats, setStats] = useState<Stats | null>(waPageCache?.stats || null);
  // const [campaigns, setCampaigns] = useState<WACampaign[]>(waPageCache?.campaigns || []);
  const [recentMessages, setRecentMessages] = useState<WAMessage[]>(waPageCache?.recentMessages || []);
  const [templates, setTemplates] = useState<any[]>(waPageCache?.templates || []);
  const [isLoading, setIsLoading] = useState(!waPageCache);
  const [isRefreshingTemplates, setIsRefreshingTemplates] = useState(false);
  // const [campaignTab, setCampaignTab] = useState("all");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  // const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>(waPageCache?.analyticsData || []);
  const [statusDistribution, setStatusDistribution] = useState<any[]>(waPageCache?.statusDistribution || []);
  const [workflowInstance, setWorkflowInstance] = useState<any>(waPageCache?.workflowInstance || null);
  const [assignedBots, setAssignedBots] = useState<any[]>(waPageCache?.assignedBots || []);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);
  const [viewTemplateOpen, setViewTemplateOpen] = useState(false);
  const [templateToView, setTemplateToView] = useState<any | null>(null);
  // const [deleteCampaignOpen, setDeleteCampaignOpen] = useState(false);
  // const [campaignToDelete, setCampaignToDelete] = useState<WACampaign | null>(null);
  // const [viewCampaignOpen, setViewCampaignOpen] = useState(false);
  // const [campaignToView, setCampaignToView] = useState<WACampaign | null>(null);

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

    const [msgsRes] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("status")
        .eq("client_id", client.id)
        .gte("sent_at", monthStart),
      // supabase
      //   .from("whatsapp_campaigns")
      //   .select("id", { count: "exact", head: true })
      //   .eq("client_id", client.id)
      //   .eq("status", "sending"),
    ]);

    const campaignsRes = { count: 0 };

    const msgs = msgsRes.data || [];
    const total = msgs.length;
    const delivered = msgs.filter(
      (m) => m.status === "delivered" || m.status === "read",
    ).length;
    const readCount = msgs.filter((m) => m.status === "read").length;

    const computedStats = {
      messagesSent: total,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      delivered,
      total,
      readRate: total > 0 ? Math.round((readCount / total) * 100) : 0,
      readCount,
      activeCampaigns: campaignsRes.count || 0,
    };
    setStats(computedStats);
    ensureWaCache().stats = computedStats;
    saveWaCacheToStorage();
  }, [client]);

  const fetchCampaigns = useCallback(async () => {
    // Disabled campaign feature
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
    ensureWaCache().workflowInstance = data;
    saveWaCacheToStorage();
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
    ensureWaCache().assignedBots = allBots;
    saveWaCacheToStorage();
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

    const mapped = data.map((m) => ({
      ...m,
      campaign_name: m.campaign_id
        ? campaignMap.get(m.campaign_id)
        : undefined,
    })) as WAMessage[];

    setRecentMessages(mapped);
    ensureWaCache().recentMessages = mapped;
    saveWaCacheToStorage();
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
    const analytics = Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v }));
    setAnalyticsData(analytics);
    ensureWaCache().analyticsData = analytics;

    const statusMap = new Map<string, number>();
    data.forEach((m) => {
      statusMap.set(
        m.status || "queued",
        (statusMap.get(m.status || "queued") || 0) + 1,
      );
    });
    const dist = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));
    setStatusDistribution(dist);
    ensureWaCache().statusDistribution = dist;
    saveWaCacheToStorage();
  }, [client]);

  const fetchTemplates = useCallback(
    async (appId: string) => {
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
        ensureWaCache().templates = data;
        saveWaCacheToStorage();
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

  const handleDeleteCampaign = useCallback(async () => {
    // Disabled campaign feature
  }, []);

  const fetchAll = useCallback(async () => {
    if (!client) return;
    if (!waPageCache) {
      setIsLoading(true);
    }
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

  // Keep a stable ref for WhatsApp callbacks to prevent subscription useEffect from re-triggering
  const waCallbacksRef = useRef({
    fetchCampaigns,
    fetchStats
  });

  useEffect(() => {
    waCallbacksRef.current = {
      fetchCampaigns,
      fetchStats
    };
  });

  // Realtime for campaigns
  useEffect(() => {
    // Disabled
  }, [client?.id]);

  const [searchParams, setSearchParams] = useSearchParams();

  const mainTab = useMemo(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && ["overview", "inbox", "template", "ai-settings", "followups"].includes(urlTab)) {
      return urlTab;
    }
    return localStorage.getItem("leadnest_active_tab") || "overview";
  }, [searchParams]);

  useEffect(() => {
    if (!isActiveRoute) return;
    localStorage.setItem("leadnest_active_tab", mainTab);
    const urlTab = searchParams.get("tab");
    if (urlTab !== mainTab) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", mainTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [isActiveRoute, mainTab, searchParams, setSearchParams]);

  const handleTabChange = useCallback((tab: string) => {
    if (!isActiveRoute) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams);
  }, [isActiveRoute, searchParams, setSearchParams]);

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inbox", label: "Inbox", icon: MessageSquare },
    { id: "template", label: "Template", icon: FileText },
    { id: "ai-settings", label: "AI Settings", icon: BotIcon },
    { id: "followups", label: "Follow-ups", icon: Clock },
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

  const filteredCampaigns: WACampaign[] = [];

  return (
    <div ref={inboxContainerRef} className="flex flex-col md:flex-row gap-4 md:gap-6 min-w-0 overflow-hidden flex-1 min-h-0">

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

              {/* Removed Campaign button */}
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
              key="overview"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
                {/* Removed Active Campaigns stat */}
              </div>

              <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <QuickAction
                  icon={<MessageSquare className="h-5 w-5" />}
                  label="Send Single Message"
                  sub="Send to one contact"
                  onClick={() => setSendModalOpen(true)}
                  disabled={assignedBots.length === 0}
                />
                {/* Removed Bulk Campaign Quick Action */}
                <QuickAction
                  icon={<FileText className="h-5 w-5" />}
                  label="Message Templates"
                  sub="Pre-approved templates"
                  onClick={() => handleTabChange("template")}
                />
                <QuickAction
                  icon={<MessageSquare className="h-5 w-5" />}
                  label="Live Chat Inbox"
                  sub="Real-time messaging"
                  onClick={() => handleTabChange("inbox")}
                />
              </div>

              {/* Removed Campaign Operations block */}

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
              key="inbox"
              className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden w-full"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <WhatsAppInbox
                selectedAppId={selectedAppId}
                assignedBots={assignedBots}
                templates={templates}
                onNewChat={() => {
                  setPhone("");
                  setSendModalOpen(true);
                }}
              />
            </motion.div>
          )}

          {mainTab === "template" && (
            <motion.div
              key="template"
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
                    onClick={() => setImportModalOpen(true)}
                    disabled={!selectedAppId || assignedBots.length === 0}>
                    <Download className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-2" />
                    <span>Import Template</span>
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
                            <TableCell className="py-6 font-black text-primary max-w-[200px] break-all">
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
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setTemplateToView(tpl);
                                    setViewTemplateOpen(true);
                                  }}
                                  aria-label={`View template ${tpl.name}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
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
                              </div>
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
              key="ai-settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <AISettingsTab 
                clientId={client?.id || ""} 
              />
            </motion.div>
          )}

          {mainTab === "followups" && (
            <motion.div
              key="followups"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >
              <FollowUpSettingsTab 
                clientId={client?.id || ""} 
                serviceId={waService?.service_id || ""}
                templates={templates}
              />
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

      <ImportTemplateModalWA
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        selectedAppId={selectedAppId}
        templates={templates}
        onImported={() => selectedAppId && fetchTemplates(selectedAppId)}
      />

      <ConfirmDialog
        open={deleteTemplateOpen}
        onOpenChange={(open) => {
          setDeleteTemplateOpen(open);
          if (!open) setTemplateToDelete(null);
        }}
        title="Delete template?"
        description={
          <>
            This will permanently remove{" "}
            <span className="font-bold text-foreground">
              {templateToDelete?.name || "this template"}
            </span>{" "}
            from your template list.
          </>
        }
        confirmLabel="Delete"
        cancelLabel="Keep it"
        variant="destructive"
        onConfirm={handleDeleteTemplate}
      />

      <ViewTemplateModalWA
        open={viewTemplateOpen}
        onOpenChange={(open) => {
          setViewTemplateOpen(open);
          if (!open) setTemplateToView(null);
        }}
        template={templateToView}
      />

      {/* Removed Campaign Modals */}
    </div>
  );
}

/* ─── AI Settings Tab ─── */
function AISettingsTab({ 
  clientId,
}: { 
  clientId: string; 
}) {
  const [settings, setSettings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
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
    fetchSettings();
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

  if (isLoading || !settings)
    return (
      <div className="p-20 flex flex-col items-center justify-center opacity-40">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading settings...</p>
      </div>
    );

  return (
    <div className="space-y-6">
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
    </div>
  );
}

/* ─── Follow-up Settings Tab ─── */
function FollowUpSettingsTab({
  clientId,
  serviceId,
  templates,
}: {
  clientId: string;
  serviceId: string;
  templates: any[];
}) {
  const [workflowConfig, setWorkflowConfig] = useState<any>({
    followup_enabled: true,
    followup_24h_template: "",
    followup_48h_template: "",
    followup_72h_template: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchWorkflow() {
      if (!clientId || !serviceId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("client_workflow_instances")
          .select("custom_config")
          .eq("client_id", clientId)
          .eq("service_id", serviceId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const config = data.custom_config || {};
          setWorkflowConfig({
            followup_enabled: config.followup_enabled !== false,
            followup_24h_template: config.followup_24h_template || "",
            followup_48h_template: config.followup_48h_template || "",
            followup_72h_template: config.followup_72h_template || "",
          });
        }
      } catch (err: any) {
        toast({
          title: "Error loading follow-up settings",
          description: err.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchWorkflow();
  }, [clientId, serviceId]);

  const handleSaveWorkflow = async () => {
    if (!clientId || !serviceId) return;
    setIsSavingWorkflow(true);
    try {
      const { data: existing } = await supabase
        .from("client_workflow_instances")
        .select("custom_config")
        .eq("client_id", clientId)
        .eq("service_id", serviceId)
        .maybeSingle();

      const merged = { ...(existing?.custom_config || {}), ...workflowConfig };

      const { error } = await supabase
        .from("client_workflow_instances")
        .update({ custom_config: merged })
        .eq("client_id", clientId)
        .eq("service_id", serviceId);

      if (error) throw error;
      toast({ title: "Follow-up settings updated successfully" });
    } catch (err: any) {
      toast({
        title: "Failed to save settings",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingWorkflow(false);
    }
  };

  if (isLoading)
    return (
      <div className="p-20 flex flex-col items-center justify-center opacity-40">
        <RefreshCw className="h-8 w-8 animate-spin mb-4" />
        <p>Loading follow-up settings...</p>
      </div>
    );

  return (
    <Card className="border-border/50 bg-card/30 backdrop-blur-sm border shadow-xl overflow-hidden">
      <CardHeader className="border-b border-border/50 bg-muted/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl font-black flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              Automated Follow-up Settings
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Configure WhatsApp message templates to be sent automatically at specific time intervals.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 bg-background/50 p-2 rounded-xl border border-border/50">
            <Label
              htmlFor="followup-active"
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2"
            >
              Follow-up Sequences
            </Label>
            <Select
              value={workflowConfig.followup_enabled ? "on" : "off"}
              onValueChange={(v) =>
                setWorkflowConfig({ ...workflowConfig, followup_enabled: v === "on" })
              }
            >
              <SelectTrigger
                className={cn(
                  "w-28 h-9 text-xs font-bold border-none shadow-none focus:ring-0",
                  workflowConfig.followup_enabled ? "text-green-500" : "text-destructive",
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
      <CardContent className="space-y-6 p-6 md:p-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* 24h follow up */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
              24-Hour Follow-up Template
            </Label>
            <Select
              value={workflowConfig.followup_24h_template || "none_selected"}
              onValueChange={(v) =>
                setWorkflowConfig({ ...workflowConfig, followup_24h_template: v === "none_selected" ? "" : v })
              }
            >
              <SelectTrigger className="h-12 bg-muted/30 border-border/50 focus:border-primary/50 text-sm font-medium">
                <SelectValue placeholder="Select 24h template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none_selected" className="text-muted-foreground">None (Disabled)</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id || t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Sent 24 hours after a lead is created if they haven't responded.
            </p>
          </div>

          {/* 48h follow up */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
              48-Hour Follow-up Template
            </Label>
            <Select
              value={workflowConfig.followup_48h_template || "none_selected"}
              onValueChange={(v) =>
                setWorkflowConfig({ ...workflowConfig, followup_48h_template: v === "none_selected" ? "" : v })
              }
            >
              <SelectTrigger className="h-12 bg-muted/30 border-border/50 focus:border-primary/50 text-sm font-medium">
                <SelectValue placeholder="Select 48h template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none_selected" className="text-muted-foreground">None (Disabled)</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id || t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Sent 48 hours after a lead is created if they haven't responded.
            </p>
          </div>

          {/* 72h follow up */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-primary/70">
              72-Hour Follow-up Template
            </Label>
            <Select
              value={workflowConfig.followup_72h_template || "none_selected"}
              onValueChange={(v) =>
                setWorkflowConfig({ ...workflowConfig, followup_72h_template: v === "none_selected" ? "" : v })
              }
            >
              <SelectTrigger className="h-12 bg-muted/30 border-border/50 focus:border-primary/50 text-sm font-medium">
                <SelectValue placeholder="Select 72h template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none_selected" className="text-muted-foreground">None (Disabled)</SelectItem>
                {templates.map((t: any) => (
                  <SelectItem key={t.id || t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Sent 72 hours after a lead is created if they haven't responded.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-60">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Updates sync with n8n instantly
            </p>
          </div>
          <Button
            onClick={handleSaveWorkflow}
            disabled={isSavingWorkflow}
            className="w-full sm:w-auto px-10 h-12 font-black text-sm shadow-xl shadow-primary/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSavingWorkflow ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-3" />
            ) : (
              <CheckCheck className="h-5 w-5 mr-3" />
            )}
            UPDATE FOLLOW-UP SETTINGS
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
  onView,
  onDelete,
}: {
  campaign: WACampaign;
  onRefresh: () => void;
  onView: (c: WACampaign) => void;
  onDelete: (c: WACampaign) => void;
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
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-emerald-50 hover:text-emerald-600"
              onClick={() => onView(campaign)}
              aria-label={`View campaign ${campaign.campaign_name}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
              onClick={() => onDelete(campaign)}
              aria-label={`Delete campaign ${campaign.campaign_name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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

function ViewCampaignModalWA({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: WACampaign | null;
}) {
  if (!campaign) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-50 p-0 border-none shadow-2xl rounded-[2rem] overflow-hidden">
        <DialogHeader className="bg-white px-6 py-6 border-b border-slate-100">
          <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
            Campaign Details
          </DialogTitle>
          <DialogDescription className="text-slate-500 font-medium mt-1">
            Review the campaign summary and launch settings.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Campaign</p>
              <p className="font-bold text-slate-900 break-all">{campaign.campaign_name}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <CampaignStatusBadge status={campaign.status} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Contacts</p>
              <p className="font-black text-slate-900 text-xl">{campaign.total_contacts}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sent</p>
              <p className="font-black text-slate-900 text-xl">{campaign.messages_sent}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Delivered</p>
              <p className="font-black text-slate-900 text-xl">{campaign.messages_delivered}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Message Template</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{campaign.message_template || "—"}</p>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">Created</span>
            <span className="font-bold text-slate-900">
              {campaign.created_at ? new Date(campaign.created_at).toLocaleString() : "N/A"}
            </span>
          </div>
        </div>

        <DialogFooter className="bg-white p-4 border-t border-slate-100">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto rounded-full px-8">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
            type: messageType,
            name: templateName,
            language: selectedLanguage,
            mediaUrl: mediaUrl.trim() || undefined,
            headerFormat: requiresMedia ? headerFormat?.toLowerCase() as any : undefined,
            bodyParams,
          },
          bot.api_config?.meta_access_token || bot.api_config?.api_key,
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
      <DialogContent className="w-[94vw] max-w-6xl overflow-hidden border-slate-200/70 bg-slate-50 p-0 shadow-2xl sm:w-[92vw] md:w-[90vw]">
        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-100">
                  <Send className="h-3.5 w-3.5" />
                  Live preview
                </div>
                <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                  Send Message
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm text-slate-300">
                  Compose and preview your message before sending it to your contact.
                </DialogDescription>
              </div>

              <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 md:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Real-time preview</p>
                  <p className="text-slate-300">See the message as it will appear.</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-w-0 space-y-5 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:border-b-0 lg:border-r">
              {/* Bot Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bot
                </Label>
                <Select value={selectedAppId || ""} onValueChange={onAppChange}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
                    <SelectValue placeholder="Select bot" />
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

              {/* Phone Number */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone Number
                </Label>
                <Input
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-sm transition-colors focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                />
                <p className="text-xs leading-5 text-slate-500">
                  Include country code (e.g., +91 for India). Minimum 11 digits required.
                </p>
              </div>

              {/* Message Type */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Message Type
                </Label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
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

              {/* Media URL (if needed) */}
              {(requiresMedia ||
                ["image", "video", "audio", "document"].includes(messageType)) && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {(headerFormat || messageType).toUpperCase()} URL
                    </Label>
                    <Input
                      placeholder="https://example.com/media.jpg"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-sm transition-colors focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                    />
                  </div>
                )}

              {/* Template Selection */}
              {messageType === "template" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template
                  </Label>
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
                    <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
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

              {/* Template Variables */}
              {messageType === "template" && detectedVariables.length > 0 && (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Template Variables
                  </Label>
                  <div className="mt-3 space-y-2">
                    {detectedVariables.map((v: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-xs font-mono font-semibold text-emerald-700">
                          {v.replace(/[{}]/g, "")}
                        </span>
                        <Input
                          placeholder={`Value for ${v}`}
                          onChange={(e) =>
                            setVariables((prev) => ({
                              ...prev,
                              [(v as string).replace(/[{}]/g, "")]: e.target.value,
                            }))
                          }
                          className="h-9 rounded-xl border-slate-200 bg-white text-sm shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Message
                  </Label>
                  <span className="text-xs text-slate-500">
                    {content.length}/1024 characters
                  </span>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  readOnly={messageType === "template"}
                  rows={5}
                  placeholder="Type your message here..."
                  className="min-h-[140px] rounded-3xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                />
              </div>
            </div>

            {/* Preview Section */}
            <div className="min-w-0 space-y-5 bg-slate-100 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Message preview</h3>
                  <p className="text-sm text-slate-500">
                    This is how it will appear in WhatsApp.
                  </p>
                </div>
              </div>

              {/* WhatsApp Message Preview */}
              <div className="mx-auto w-full max-w-[22rem] overflow-x-auto rounded-[2rem] border border-slate-200 bg-slate-950 p-2.5 shadow-2xl sm:max-w-[24rem] lg:max-w-sm xl:max-w-md">
                <div className="rounded-[1.65rem] bg-[#ECE5DD] p-3">
                  <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-sm font-semibold text-white shadow-md shadow-green-500/30">
                        {(phone.slice(-2) || "WA").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {phone.trim() || "+1234567890"}
                        </p>
                        <p className="text-xs text-slate-500">Now</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-auto w-full max-w-full rounded-[1.5rem] rounded-tr-md bg-white p-3.5 shadow-sm ring-1 ring-black/5 sm:p-4">
                    <div className="break-words whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {messageType === "template" && previewContent.split(/(\{\{\d+\}\})/g).filter(Boolean).map((segment, index) =>
                        /\{\{\d+\}\}/.test(segment) ? (
                          <span
                            key={`${segment}-${index}`}
                            className="mx-0.5 inline-block max-w-full break-all rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                          >
                            {segment}
                          </span>
                        ) : (
                          <span key={`${segment}-${index}`} className="break-all">
                            {segment}
                          </span>
                        ),
                      )}
                      {messageType !== "template" && (previewContent || "Your message will appear here...")}
                    </div>

                    {mediaUrl && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          Media attachment
                        </div>
                        <p className="mt-2 break-all text-xs text-slate-600">
                          {mediaUrl}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {messageType.charAt(0).toUpperCase() + messageType.slice(1)}
                      </Badge>
                      {templateName && (
                        <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                          {templateName}
                        </Badge>
                      )}
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Personalization
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    Variables are highlighted so you can verify dynamic fields.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Ready to send
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    The preview shows exactly how it will appear in WhatsApp.
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
              disabled={sending || !phone.trim()}
              onClick={handleSend}
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.01] hover:from-emerald-600 hover:to-green-700 sm:w-auto"
            >
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Import Template Modal ─── */
function ImportTemplateModalWA({
  open,
  onOpenChange,
  selectedAppId,
  templates,
  onImported,
}: any) {
  const { toast } = useToast();
  const [remoteTemplates, setRemoteTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState<Record<string, boolean>>({});

  const fetchRemoteTemplates = useCallback(async () => {
    if (!selectedAppId) return;
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await syncWhatsAppTemplates(selectedAppId);
      setRemoteTemplates(data || []);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch templates");
      toast({
        title: "Error fetching templates",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedAppId, toast]);

  useEffect(() => {
    if (open && selectedAppId) {
      fetchRemoteTemplates();
    }
  }, [open, selectedAppId, fetchRemoteTemplates]);

  const handleImport = async (tpl: any) => {
    if (!selectedAppId) return;
    setIsImporting((prev) => ({ ...prev, [tpl.name]: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: client } = await (supabase.from("clients" as any) as any)
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      const { error } = await (
        supabase.from("whatsapp_templates" as any) as any
      )
        .insert({
          application_id: selectedAppId,
          client_id: client?.id || null,
          name: tpl.name,
          category: tpl.category || "MARKETING",
          language: tpl.language || "en_US",
          components: tpl.components || [],
          status: tpl.status || "approved",
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: `Template "${tpl.name}" imported successfully!` });
      onImported();
    } catch (err: any) {
      toast({
        title: "Import failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting((prev) => ({ ...prev, [tpl.name]: false }));
    }
  };

  const handleImportAll = async () => {
    if (!selectedAppId) return;
    const importable = remoteTemplates.filter(
      (rt) => !templates.some((lt) => lt.name === rt.name)
    );
    if (importable.length === 0) return;

    setIsLoading(true);
    let successCount = 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: client } = await (supabase.from("clients" as any) as any)
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      for (const tpl of importable) {
        try {
          const { error } = await (
            supabase.from("whatsapp_templates" as any) as any
          )
            .insert({
              application_id: selectedAppId,
              client_id: client?.id || null,
              name: tpl.name,
              category: tpl.category || "MARKETING",
              language: tpl.language || "en_US",
              components: tpl.components || [],
              status: tpl.status || "approved",
              created_by: user?.id,
            });

          if (!error) successCount++;
        } catch (err) {
          console.error("Bulk import failed for", tpl.name, err);
        }
      }

      toast({ title: `Imported ${successCount} templates successfully!` });
      onImported();
    } catch (err: any) {
      toast({
        title: "Bulk import error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTemplates = remoteTemplates.filter((t) =>
    (t.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-4xl border-slate-200 bg-slate-50 p-0 shadow-2xl rounded-3xl overflow-hidden">
        <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100">
                <Download className="h-3 w-3" />
                WhapiHub Integration
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white">
                Import Templates
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Browse and import pre-approved WhatsApp templates from WhapiHub into your workspace.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search remote templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-white border-slate-200 focus-visible:border-emerald-500 focus-visible:ring-emerald-500 text-sm"
              />
            </div>

            {remoteTemplates.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportAll}
                disabled={isLoading || !remoteTemplates.some((rt) => !templates.some((lt) => lt.name === rt.name))}
                className="h-10 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs shrink-0"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Import All New Templates
              </Button>
            )}
          </div>

          <Card className="border-slate-200/60 shadow-xl overflow-hidden rounded-2xl bg-white">
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b border-slate-100 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider py-4">Name</TableHead>
                    <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider py-4">Category</TableHead>
                    <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider py-4">Language</TableHead>
                    <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider py-4">Status</TableHead>
                    <TableHead className="font-bold text-xs text-slate-500 uppercase tracking-wider py-4 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm font-semibold text-slate-500">Fetching templates from Meta Business Manager...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTemplates.length > 0 ? (
                    filteredTemplates.map((tpl: any) => {
                      const isAlreadyImported = templates.some(
                        (lt) => lt.name.toLowerCase() === tpl.name.toLowerCase()
                      );
                      const importing = isImporting[tpl.name];

                      return (
                        <TableRow key={tpl.name} className="hover:bg-slate-50/50 border-b border-slate-100">
                          <TableCell className="py-4 font-mono text-xs font-semibold text-slate-800 break-all">{tpl.name}</TableCell>
                          <TableCell className="py-4 text-xs font-medium text-slate-600">
                            <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 uppercase text-[9px] tracking-wider font-bold">
                              {tpl.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-xs text-slate-600 font-mono">{tpl.language}</TableCell>
                          <TableCell className="py-4 text-xs font-medium">
                            <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] uppercase font-black tracking-wider">
                              {tpl.status || "approved"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            {isAlreadyImported ? (
                              <Badge className="bg-slate-100 text-slate-500 border border-slate-200/60 rounded-full text-[10px] py-1 px-2.5 font-bold uppercase tracking-wider">
                                <Check className="h-3 w-3 mr-1 inline-block" /> Imported
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                disabled={importing}
                                onClick={() => handleImport(tpl)}
                                className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                              >
                                {importing ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Download className="h-3 w-3 mr-1" />
                                )}
                                Import
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : fetchError ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3 max-w-md mx-auto">
                          <AlertCircle className="h-10 w-10 text-red-400" />
                          {fetchError.includes("META_CONFIG_MISSING") ? (
                            <>
                              <p className="font-bold text-sm text-red-600">Meta Configuration Required</p>
                              <div className="text-left bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 space-y-2 w-full">
                                <p className="font-semibold">To import templates, you need to add your Meta credentials to the bot:</p>
                                <ol className="list-decimal list-inside space-y-1 ml-1">
                                  <li>Go to <strong>Admin Dashboard → WhatsApp Bots</strong></li>
                                  <li>Click <strong>Config</strong> on your bot</li>
                                  <li>Enter your <strong>Meta Access Token</strong> (starts with EAA...)</li>
                                  <li>Enter your <strong>Meta WABA ID</strong> (e.g. 1429354545450670)</li>
                                  <li>Click <strong>Save Changes</strong></li>
                                </ol>
                                <p className="pt-1 text-red-500 italic">Or run this SQL in Supabase SQL Editor:</p>
                                <code className="block bg-red-100 text-[10px] p-2 rounded-lg break-all font-mono">
                                  UPDATE whatsapp_applications SET api_config = api_config || '{`{`}"waba_id":"YOUR_WABA_ID","meta_access_token":"YOUR_EAA_TOKEN"{`}`}'::jsonb WHERE provider_type = 'api';
                                </code>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-sm text-red-600">Failed to fetch templates</p>
                              <p className="text-xs text-red-500">{fetchError}</p>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchRemoteTemplates}
                            className="mt-2 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <AlertCircle className="h-10 w-10 text-slate-300" />
                          <p className="font-bold text-sm">No remote templates found</p>
                          <p className="text-xs text-slate-500">Check that templates exist in your Meta Business Manager.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-end">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 font-bold text-slate-600 hover:bg-slate-100 text-xs"
          >
            Close Dialog
          </Button>
        </DialogFooter>
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
  templates: campaignTemplates,
}: any) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [messageType, setMessageType] = useState<"text" | "template" | "video" | "photo" | "document">("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedTemplate = campaignTemplates?.find(
    (t: any) => (t.name || t.template_name) === templateName,
  );
  const requiresMedia = selectedTemplate?.components?.some(
    (c: any) =>
      c.type === "HEADER" &&
      ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"].includes(c.format),
  );
  const stepLabel = step === 1 ? "Campaign details" : step === 2 ? "Import contacts" : "Message preview";
  const previewTitle =
    step === 1
      ? name.trim() || "Your campaign will appear here"
      : step === 2
        ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"} imported`
        : messageType === "template"
          ? selectedTemplate?.name || selectedTemplate?.template_name || templateName || "Template preview"
          : `${messageType.charAt(0).toUpperCase()}${messageType.slice(1)} message`;
  const previewBody =
    step === 1
      ? "Add a campaign name, import contacts, then craft the message preview."
      : step === 2
        ? "Imported contacts will stay visible here while you move between steps."
        : messageContent.trim() || "Your campaign message preview will appear here.";

  const reset = () => {
    setStep(1);
    setName("");
    setContacts([]);
    setMessageContent("");
    setMessageType("text");
    setMediaUrl("");
    setTemplateName("");
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
      if (messageType === "template" && !templateName) {
        return toast({
          title: "Template required",
          description: "Please select a template before launching the campaign.",
          variant: "destructive",
        });
      }

      if (
        (messageType === "video" || messageType === "photo" || messageType === "document" || (messageType === "template" && requiresMedia)) &&
        !mediaUrl.trim()
      ) {
        return toast({
          title: "Media URL required",
          description: "Please provide a media URL for this message type.",
          variant: "destructive",
        });
      }

      const { data: campaign } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          client_id: clientId,
          campaign_name: name.trim(),
          message_template:
            messageType === "template"
              ? templateName || messageContent.trim()
              : messageContent.trim(),
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
        message_type: messageType === "photo" ? "image" : messageType,
        media_url:
          messageType === "text"
            ? null
            : mediaUrl.trim() || null,
        template_name: messageType === "template" ? templateName : null,
        status: "queued",
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
      <DialogContent className="w-[94vw] max-w-6xl overflow-hidden border-slate-200/70 bg-slate-50 p-0 shadow-2xl sm:w-[92vw] md:w-[90vw]">
        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-100">
                  <Send className="h-3.5 w-3.5" />
                  Campaign builder
                </div>
                <DialogTitle className="text-2xl font-semibold tracking-tight text-white">
                  Create WhatsApp Campaign
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm text-slate-300">
                  {stepLabel} — import your contacts and preview the final message before launching.
                </DialogDescription>
              </div>

              <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200 md:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">{contacts.length || 0} contacts</p>
                  <p className="text-slate-300">Responsive, lightweight campaign flow</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="min-w-0 space-y-5 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 sm:py-6 lg:border-b-0 lg:border-r">
              {step === 1 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campaign Name
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. May promo blast"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-sm transition-colors focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    Give this campaign a clear name so it is easy to track later.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Import CSV Contacts
                    </Label>
                    <span className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-2xl border border-amber-100 flex items-start gap-1.5 leading-5">
                      <span className="font-bold shrink-0">Note:</span>
                      All phone numbers must be formatted without the "+" sign (e.g., 1234567890).
                    </span>
                  </div>

                  <Input
                    type="file"
                    accept=".csv"
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-sm shadow-sm file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-600"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      const fileInput = e.target;
                      const reader = new FileReader();

                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        const lines = text.split("\n").filter((l) => l.trim());

                        if (lines.length === 0) {
                          toast({
                            title: "Empty CSV",
                            description: "The uploaded file is empty.",
                            variant: "destructive",
                          });
                          fileInput.value = "";
                          return;
                        }

                        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
                        const phoneIndex = headers.indexOf("phone");

                        if (phoneIndex === -1) {
                          toast({
                            title: "Invalid CSV",
                            description: "CSV must have a 'phone' column header",
                            variant: "destructive",
                          });
                          fileInput.value = "";
                          return;
                        }

                        let hasPlusSign = false;

                        const parsed = lines
                          .slice(1)
                          .map((line) => {
                            const cols = line.split(",");
                            const phoneVal = cols[phoneIndex]?.trim() || "";
                            if (phoneVal.includes("+")) hasPlusSign = true;
                            return { phone: phoneVal.replace(/[^0-9]/g, "") };
                          })
                          .filter((c) => c.phone.length >= 10);

                        if (hasPlusSign) {
                          toast({
                            title: "Invalid Number Format",
                            description:
                              "Found phone numbers containing a '+' sign. Please remove all '+' signs from the CSV and try again.",
                            variant: "destructive",
                          });
                          fileInput.value = "";
                          return;
                        }

                        setContacts(parsed);
                        toast({ title: `${parsed.length} contacts imported successfully` });
                        fileInput.value = "";
                      };

                      reader.readAsText(file);
                    }}
                  />

                  {contacts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-700">Imported Contacts</p>
                        <p className="text-[11px] text-slate-500">
                          {contacts.length} contact{contacts.length === 1 ? "" : "s"} ready
                        </p>
                      </div>

                      <div className="rounded-3xl border border-slate-800 bg-white overflow-hidden shadow-sm">
                        <div className="max-h-64 overflow-auto">
                          <Table className="min-w-[320px]">
                            <TableHeader className="sticky top-0 z-10 bg-slate-100 border-b border-slate-800">
                              <TableRow className="hover:bg-slate-100 border-b border-slate-800">
                                <TableHead className="w-16">#</TableHead>
                                <TableHead>Phone Number</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contacts.map((contact, index) => (
                                <TableRow key={`${contact.phone}-${index}`} className="border-b border-slate-200 last:border-b-0">
                                  <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                                  <TableCell className="font-mono text-slate-900">{contact.phone}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Message Type
                    </Label>
                    <Select
                      value={messageType}
                      onValueChange={(val: any) => {
                        setMessageType(val);
                        if (val !== "template") {
                          setTemplateName("");
                        }
                        if (val === "text") {
                          setMediaUrl("");
                        }
                      }}
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="photo">Photo</SelectItem>
                        <SelectItem value="document">Document</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {messageType === "template" && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Template
                      </Label>
                      <Select
                        value={templateName}
                        onValueChange={(val) => {
                          setTemplateName(val);
                          const tpl = campaignTemplates.find(
                            (t: any) => (t.name || t.template_name) === val,
                          );
                          const body =
                            tpl?.components?.find((c: any) => c.type === "BODY")
                              ?.text || tpl?.body || "";
                          setMessageContent(body);
                        }}
                      >
                        <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-sm focus:ring-emerald-500">
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {campaignTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.name || t.template_name}>
                              {t.name || t.template_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(messageType === "video" || messageType === "photo" || messageType === "document" || (messageType === "template" && requiresMedia)) && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Media URL
                      </Label>
                      <Input
                        placeholder={`Enter ${messageType} URL`}
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        className="h-12 rounded-2xl border-slate-200 bg-slate-50 text-base shadow-sm transition-colors focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {messageType === "template" ? "Template Body" : messageType === "text" ? "Message" : "Caption (Optional)"}
                    </Label>
                    <Textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      readOnly={messageType === "template"}
                      placeholder={messageType === "text" ? "Enter your message here..." : "Enter caption..."}
                      className="min-h-[140px] rounded-3xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-5 bg-slate-100 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Campaign preview</h3>
                  <p className="text-sm text-slate-500">
                    {step === 3 ? "See how the message will look before launching." : previewBody}
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full capitalize">
                  Step {step}
                </Badge>
              </div>

              <div className="mx-auto w-full max-w-[22rem] overflow-x-auto rounded-[2rem] border border-slate-200 bg-slate-950 p-2.5 shadow-2xl sm:max-w-[24rem] lg:max-w-sm xl:max-w-md">
                <div className="rounded-[1.65rem] bg-[#ECE5DD] p-3">
                  <div className="mb-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-semibold text-white shadow-md shadow-green-500/30">
                        {contacts.length ? `${contacts.length}`.slice(-2) : "WA"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 break-all">
                          {previewTitle}
                        </p>
                        <p className="text-xs text-slate-500">{stepLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-auto w-full max-w-full rounded-[1.5rem] rounded-tr-md bg-white p-3.5 shadow-sm ring-1 ring-black/5 sm:p-4">
                    <div className="break-words whitespace-pre-wrap text-sm leading-6 text-slate-800">
                      {step === 3 ? (
                        messageType === "template" ? (
                          previewBody.split(/(\{\{\d+\}\})/g).filter(Boolean).map((segment, index) =>
                            /\{\{\d+\}\}/.test(segment) ? (
                              <span
                                key={`${segment}-${index}`}
                                className="mx-0.5 inline-block max-w-full break-all rounded-md bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                              >
                                {segment}
                              </span>
                            ) : (
                              <span key={`${segment}-${index}`} className="break-all">
                                {segment}
                              </span>
                            ),
                          )
                        ) : (
                          previewBody || "Your message will appear here..."
                        )
                      ) : (
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-900">{previewTitle}</p>
                          <p className="text-sm text-slate-700">{previewBody}</p>
                        </div>
                      )}
                    </div>

                    {step === 3 && mediaUrl && (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          <FileText className="h-3.5 w-3.5 text-emerald-600" />
                          Media attachment
                        </div>
                        <p className="mt-2 break-all text-xs text-slate-600">
                          {mediaUrl}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100 capitalize">
                        {step === 3 ? messageType : step === 2 ? "contacts" : "details"}
                      </Badge>
                      {templateName && step === 3 && (
                        <Badge variant="outline" className="rounded-full border-slate-300 text-slate-600">
                          {templateName}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 shadow-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      Responsive preview
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Fast setup
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    The form stays lightweight and only renders what you need for each step.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Mobile friendly
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    The layout collapses cleanly on smaller screens without losing the preview.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-full px-5 sm:w-auto">
                Cancel
              </Button>
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="w-full rounded-full px-5 sm:w-auto"
                >
                  Back
                </Button>
              )}
            </div>

            <Button
              className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 text-white shadow-lg shadow-emerald-500/25 transition-transform hover:scale-[1.01] hover:from-emerald-600 hover:to-green-700 sm:w-auto"
              onClick={() => {
                if (step === 1) {
                  setStep(2);
                  return;
                }
                if (step === 2) {
                  setStep(3);
                  return;
                }
                handleCreate();
              }}
              disabled={
                creating ||
                (step === 1 && !name.trim()) ||
                (step === 2 && contacts.length === 0) ||
                (step === 3 && (
                  (messageType === "text" && !messageContent.trim()) ||
                  (messageType === "template" && (!templateName || (requiresMedia && !mediaUrl.trim()))) ||
                  ((messageType === "video" || messageType === "photo" || messageType === "document") && !mediaUrl.trim())
                ))
              }
            >
              {creating ? "Launching..." : step < 3 ? "Next" : "Launch"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── View Template Modal ─── */
function ViewTemplateModalWA({ open, onOpenChange, template }: any) {
  if (!template) return null;

  const components = template.components || [];
  const bodyComponent = components.find((c: any) => c.type === "BODY");
  const headerComponent = components.find((c: any) => c.type === "HEADER");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-50 p-0 border-none shadow-2xl rounded-[2rem] overflow-hidden">
        <DialogHeader className="bg-white px-6 py-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
                Template Details
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium mt-1">
                View the structure and content of your template
              </DialogDescription>
            </div>
            <Badge className={cn(
              "rounded-full px-4 py-1 text-xs font-bold border-none",
              (template.status || "approved").toLowerCase() === "approved" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"
            )}>
              {(template.status || "approved").toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Template Name</p>
              <p className="font-bold text-slate-900 break-all">{template.name}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Category</p>
              <p className="font-bold text-slate-900">{template.category || "MARKETING"}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Message Preview</p>

            <div className="max-w-sm mx-auto bg-[#E4EFE7] p-4 rounded-3xl shadow-inner relative overflow-hidden">
              <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2 relative z-10">
                {headerComponent && (
                  <div className="pb-2 border-b border-slate-50">
                    {headerComponent.format === "TEXT" ? (
                      <p className="font-bold text-slate-900">{headerComponent.text}</p>
                    ) : (
                      <div className="bg-slate-100 h-32 rounded-xl flex items-center justify-center">
                        <FileText className="h-8 w-8 text-slate-300" />
                      </div>
                    )}
                  </div>
                )}
                <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed break-all">
                  {bodyComponent?.text || "No content"}
                </p>
                <div className="flex justify-end pt-1">
                  <span className="text-[10px] text-slate-400">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Metadata</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Language</span>
                <span className="font-bold text-slate-900">{template.language || "en_US"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Last Updated</span>
                <span className="font-bold text-slate-900">
                  {template.updated_at || template.created_at ? new Date(template.updated_at || template.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-white p-4 border-t border-slate-100">
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto rounded-full px-8">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
