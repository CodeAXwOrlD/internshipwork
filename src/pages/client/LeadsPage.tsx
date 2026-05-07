import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Users, Plus, MoreVertical, LayoutGrid, TableIcon, Search,
  Download, Phone, Mail, Star, GripVertical, X, CalendarIcon,
  TrendingUp, Target, Bell, Edit, Trash2, Eye, Headphones,
  ArrowRight, Flame, Snowflake, Sun, AlertTriangle, Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { initiateInstantCall } from "@/lib/instant-call";
import {
  DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* ─── Types ─── */
interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  phone: string;
  email: string | null;
  lead_score: number | null;
  interest_level: number | null;
  status: string | null;
  lead_source: string | null;
  tags: string[] | null;
  notes: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  client_id: string;
  call_log_id: string | null;
  campaign_id: string | null;
  designation: string | null;
  assigned_to: string | null;
  metadata: any;
  // joined
  recording_url?: string | null;
  duration_seconds?: number | null;
  campaign_name?: string | null;
}

interface LeadFormData {
  name: string;
  company: string;
  phone: string;
  email: string;
  lead_source: string;
  lead_score: number;
  interest_level: number;
  status: string;
  tags: string;
  notes: string;
  follow_up_date: Date | undefined;
}

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"] as const;
const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary/10 text-primary border-primary/20",
  contacted: "bg-accent text-accent-foreground border-border",
  qualified: "bg-secondary text-secondary-foreground border-border",
  converted: "bg-primary/15 text-primary border-primary/30",
  lost: "bg-destructive/10 text-destructive border-destructive/20",
};
const STATUS_HEADER_COLORS: Record<string, string> = {
  new: "border-t-primary",
  contacted: "border-t-muted-foreground",
  qualified: "border-t-secondary-foreground",
  converted: "border-t-primary",
  lost: "border-t-destructive",
};
const SOURCE_LABELS: Record<string, string> = {
  telecaller: "📞 Telecaller",
  voice_agent: "🎧 Voice Agent",
  receptionist: "📱 Receptionist",
  manual: "✍️ Manual",
};

/* ─── Temperature Classification ─── */
const TEMPERATURE_CONFIG = {
  hot:  { label: "Hot",  color: "bg-red-500/15 text-red-600 border-red-500/30", dotColor: "bg-red-500", icon: Flame,     min: 71, max: 100 },
  warm: { label: "Warm", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", dotColor: "bg-amber-500", icon: Sun,       min: 40, max: 70  },
  cold: { label: "Cold", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", dotColor: "bg-blue-500", icon: Snowflake, min: 0,  max: 39  },
} as const;

type TemperatureKey = keyof typeof TEMPERATURE_CONFIG;

function getLeadTemperature(score: number | null): TemperatureKey {
  const s = score ?? 0;
  if (s > 70) return "hot";
  if (s >= 40) return "warm";
  return "cold";
}

function TemperatureBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "md" }) {
  const temp = getLeadTemperature(score);
  const config = TEMPERATURE_CONFIG[temp];
  const Icon = config.icon;
  const isMd = size === "md";
  return (
    <Badge variant="outline" className={cn(
      "gap-1 font-semibold border",
      config.color,
      isMd ? "text-xs px-2.5 py-1" : "text-[10px] px-1.5 py-0.5"
    )}>
      <Icon className={isMd ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {config.label}
    </Badge>
  );
}

function isLeadStale(lead: Lead): boolean {
  if (lead.status !== "new") return false;
  const created = new Date(lead.created_at);
  const daysSince = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > 7;
}

const emptyForm: LeadFormData = {
  name: "", company: "", phone: "", email: "",
  lead_source: "manual", lead_score: 50, interest_level: 5,
  status: "new", tags: "", notes: "", follow_up_date: undefined,
};

/* ─── Main Page ─── */
export default function LeadsPage() {
  const { client, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [scoreRange, setScoreRange] = useState([0, 100]);
  const [dateFilter, setDateFilter] = useState("all");
  const [temperatureFilter, setTemperatureFilter] = useState<"all" | TemperatureKey>("all");

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Lead | null>(null);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search debounce
  const searchTimeout = useRef<NodeJS.Timeout>();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    searchTimeout.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);

    let query = supabase
      .from("leads")
      .select("*")
      .eq("client_id", client.id)
      .order("lead_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (debouncedSearch) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,company.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`
      );
    }
    if (sourceFilter !== "all") {
      query = query.eq("lead_source", sourceFilter as any);
    }
    if (statusFilters.length > 0) {
      query = query.in("status", statusFilters as any);
    }
    if (scoreRange[0] > 0) query = query.gte("lead_score", scoreRange[0]);
    if (scoreRange[1] < 100) query = query.lte("lead_score", scoreRange[1]);

    if (dateFilter !== "all") {
      const now = new Date();
      let from: Date;
      if (dateFilter === "today") {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateFilter === "7days") {
        from = new Date(now.getTime() - 7 * 86400000);
      } else {
        from = new Date(now.getTime() - 30 * 86400000);
      }
      query = query.gte("created_at", from.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error fetching leads", description: error.message, variant: "destructive" });
    }
    setLeads((data as Lead[]) || []);
    setIsLoading(false);
  }, [client, debouncedSearch, sourceFilter, statusFilters, scoreRange, dateFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const todayStr = format(now, "yyyy-MM-dd");
    return {
      total: leads.length,
      newThisWeek: leads.filter(l => new Date(l.created_at) >= weekAgo).length,
      hot: leads.filter(l => getLeadTemperature(l.lead_score) === "hot").length,
      warm: leads.filter(l => getLeadTemperature(l.lead_score) === "warm").length,
      cold: leads.filter(l => getLeadTemperature(l.lead_score) === "cold").length,
      followUpsToday: leads.filter(l => l.follow_up_date === todayStr).length,
      stale: leads.filter(isLeadStale).length,
      untouched: leads.filter(l => l.status === "new" && !l.notes && !l.follow_up_date).length,
    };
  }, [leads]);

  // Apply temperature filter client-side
  const filteredLeads = useMemo(() => {
    if (temperatureFilter === "all") return leads;
    return leads.filter(l => getLeadTemperature(l.lead_score) === temperatureFilter);
  }, [leads, temperatureFilter]);

  const clearFilters = () => {
    setSearch(""); setSourceFilter("all"); setStatusFilters([]);
    setScoreRange([0, 100]); setDateFilter("all"); setTemperatureFilter("all");
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus as any, updated_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Lead moved to ${newStatus}` });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    }
  };

  const deleteLead = async (lead: Lead) => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead deleted" });
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setDeleteConfirm(null);
      setDetailLead(null);
    }
  };

  const exportCSV = () => {
    const rows = leads.map(l => ({
      Name: l.name || "", Company: l.company || "", Phone: l.phone,
      Email: l.email || "", Score: l.lead_score ?? "", Interest: l.interest_level ?? "",
      Status: l.status || "", Source: l.lead_source || "",
      Tags: (l.tags || []).join("; "), Notes: l.notes || "",
      Created: l.created_at,
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map(r =>
      headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(",")
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const bulkChangeStatus = async (status: string) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("leads")
      .update({ status: status as any, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (!error) {
      toast({ title: `${ids.length} leads moved to ${status}` });
      setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, status } : l));
      setSelectedIds(new Set());
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (!error) {
      toast({ title: `${ids.length} leads deleted` });
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      setSelectedIds(new Set());
    }
  };

  const handleInstantCall = async (lead: Lead) => {
    if (!lead.phone) return;
    try {
      await initiateInstantCall(lead.phone, lead.name || "Customer", client.user_id);
      toast({ title: "Instant Call Initiated", description: `Calling ${lead.phone}...` });
    } catch (err: any) {
      toast({ title: "Failed to initiate call", description: err.message, variant: "destructive" });
    }
  };

  if (contextLoading) return <PageSkeleton />;
  if (!client) return <Navigate to="/client" replace />;

  const hasActiveFilters = debouncedSearch || sourceFilter !== "all" || statusFilters.length > 0 || scoreRange[0] > 0 || scoreRange[1] < 100 || dateFilter !== "all" || temperatureFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Auto-Insights Banner */}
      {(stats.hot > 0 || stats.stale > 0 || stats.untouched > 0) && (
        <div className="rounded-xl border bg-gradient-to-r from-red-500/5 via-amber-500/5 to-blue-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Auto Insights</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {stats.hot > 0 && (
              <button onClick={() => setTemperatureFilter("hot")} className="flex items-center gap-1.5 text-xs bg-red-500/10 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-500/20 transition-colors">
                <Flame className="h-3 w-3" />
                <strong>{stats.hot}</strong> hot lead{stats.hot > 1 ? "s" : ""} need attention
              </button>
            )}
            {stats.stale > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-600 rounded-lg px-3 py-1.5">
                <Clock className="h-3 w-3" />
                <strong>{stats.stale}</strong> lead{stats.stale > 1 ? "s" : ""} stale for 7+ days
              </div>
            )}
            {stats.untouched > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-blue-500/10 text-blue-600 rounded-lg px-3 py-1.5">
                <Snowflake className="h-3 w-3" />
                <strong>{stats.untouched}</strong> lead{stats.untouched > 1 ? "s" : ""} untouched
              </div>
            )}
          </div>
        </div>
      )}

      {/* Follow-up banner */}
      {stats.followUpsToday > 0 && (
        <div className="rounded-lg border bg-accent p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-accent-foreground">
            <Bell className="h-4 w-4" />
            You have <strong>{stats.followUpsToday}</strong> lead{stats.followUpsToday > 1 ? "s" : ""} to follow up today
          </div>
          <Button variant="ghost" size="sm" className="text-xs"
            onClick={() => { setDateFilter("all"); }}>
            View
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage and track your qualified leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Lead
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <MiniStat label="Total Leads" value={stats.total} icon={<Users className="h-4 w-4" />} />
        <MiniStat label="New This Week" value={stats.newThisWeek} icon={<TrendingUp className="h-4 w-4" />} />
        <MiniStat label="Follow-ups Today" value={stats.followUpsToday} icon={<Bell className="h-4 w-4" />} />
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => setTemperatureFilter("hot")} className={cn("rounded-lg border p-2 text-center transition-all hover:shadow-sm", temperatureFilter === "hot" ? "ring-2 ring-red-500/50 bg-red-500/10" : "")}>
            <Flame className="h-3.5 w-3.5 text-red-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-red-600">{stats.hot}</p>
            <p className="text-[9px] text-muted-foreground">Hot</p>
          </button>
          <button onClick={() => setTemperatureFilter("warm")} className={cn("rounded-lg border p-2 text-center transition-all hover:shadow-sm", temperatureFilter === "warm" ? "ring-2 ring-amber-500/50 bg-amber-500/10" : "")}>
            <Sun className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-amber-600">{stats.warm}</p>
            <p className="text-[9px] text-muted-foreground">Warm</p>
          </button>
          <button onClick={() => setTemperatureFilter("cold")} className={cn("rounded-lg border p-2 text-center transition-all hover:shadow-sm", temperatureFilter === "cold" ? "ring-2 ring-blue-500/50 bg-blue-500/10" : "")}>
            <Snowflake className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-lg font-bold text-blue-600">{stats.cold}</p>
            <p className="text-[9px] text-muted-foreground">Cold</p>
          </button>
        </div>
      </div>

      {/* Filters + View Toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, company, phone, email..." className="pl-9"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="telecaller">Telecaller</SelectItem>
              <SelectItem value="voice_agent">Voice Agent</SelectItem>
              <SelectItem value="receptionist">Receptionist</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={temperatureFilter} onValueChange={v => setTemperatureFilter(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Temperature" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Temps</SelectItem>
              <SelectItem value="hot">🔥 Hot</SelectItem>
              <SelectItem value="warm">🌤️ Warm</SelectItem>
              <SelectItem value="cold">❄️ Cold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
            <Button variant={view === "kanban" ? "default" : "ghost"} size="icon" className="h-8 w-8"
              onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "table" ? "default" : "ghost"} size="icon" className="h-8 w-8"
              onClick={() => setView("table")}>
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? <PageSkeleton /> : filteredLeads.length === 0 && !hasActiveFilters ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-5 mb-4"><Users className="h-10 w-10 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No leads yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">Leads from your campaigns will appear here</p>
            <Button style={{ backgroundColor: primaryColor, color: "white" }}
              onClick={() => navigate("/client/voice-telecaller")}>
              <Plus className="h-4 w-4 mr-2" /> Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : view === "kanban" ? (
        <KanbanView leads={filteredLeads} onStatusChange={updateLeadStatus}
          onViewDetail={setDetailLead} onEdit={setEditLead} onDelete={setDeleteConfirm}
          onAddLead={() => setAddModalOpen(true)} />
      ) : (
        <TableView leads={filteredLeads} selectedIds={selectedIds} setSelectedIds={setSelectedIds}
          onViewDetail={setDetailLead} onEdit={setEditLead} onDelete={setDeleteConfirm}
          onStatusChange={updateLeadStatus} />
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && view === "table" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border rounded-lg shadow-lg p-3 flex items-center gap-3 z-50">
          <span className="text-sm font-medium">{selectedIds.size} leads selected</span>
          <Select onValueChange={bulkChangeStatus}>
            <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="Change Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Add Lead Modal */}
      <LeadFormModal open={addModalOpen} onOpenChange={setAddModalOpen} clientId={client.id}
        onSaved={() => { fetchLeads(); setAddModalOpen(false); }} />

      {/* Edit Lead Modal */}
      {editLead && (
        <LeadFormModal open={!!editLead} onOpenChange={o => { if (!o) setEditLead(null); }}
          clientId={client.id} lead={editLead}
          onSaved={() => { fetchLeads(); setEditLead(null); }} />
      )}

      {/* Detail Panel */}
      {detailLead && (
        <LeadDetailPanel lead={detailLead} onClose={() => setDetailLead(null)}
          onEdit={l => { setDetailLead(null); setEditLead(l); }}
          onDelete={l => { setDetailLead(null); setDeleteConfirm(l); }}
          onStatusChange={(id, s) => { updateLeadStatus(id, s); setDetailLead(prev => prev ? { ...prev, status: s } : null); }}
          onNotesUpdate={(id, notes) => {
            supabase.from("leads").update({ notes, updated_at: new Date().toISOString() }).eq("id", id).then(() => {
              setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
              toast({ title: "Notes saved" });
            });
          }}
          onInstantCall={handleInstantCall}
        />
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={o => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name || deleteConfirm?.phone}"? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteLead(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Kanban View ─── */
function KanbanView({ leads, onStatusChange, onViewDetail, onEdit, onDelete, onAddLead }: {
  leads: Lead[];
  onStatusChange: (id: string, status: string) => void;
  onViewDetail: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onAddLead: () => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    // over.id could be a status column
    if (STATUSES.includes(overId as any)) {
      onStatusChange(String(active.id), overId);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map(status => {
          const columnLeads = leads.filter(l => l.status === status);
          return (
            <div key={status} className={`min-w-[280px] flex-1 rounded-lg border-t-4 ${STATUS_HEADER_COLORS[status]} bg-muted/30`}
              id={status}>
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold capitalize text-sm">{status}</h3>
                  <Badge variant="secondary" className="text-xs">{columnLeads.length}</Badge>
                </div>
              </div>
              <SortableContext items={columnLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div className="p-2 space-y-2 min-h-[100px]"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { }}>
                  {columnLeads.map(lead => (
                    <KanbanCard key={lead.id} lead={lead} onView={onViewDetail}
                      onEdit={onEdit} onDelete={onDelete} onStatusChange={onStatusChange} />
                  ))}
                  {columnLeads.length === 0 && (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <p className="text-xs text-muted-foreground">No {status} leads</p>
                      <p className="text-xs text-muted-foreground mt-1">Drag leads here</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}

function KanbanCard({ lead, onView, onEdit, onDelete, onStatusChange }: {
  lead: Lead;
  onView: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const score = lead.lead_score ?? 0;
  const scoreColor = score > 70 ? "bg-primary/15 text-primary" : score > 40 ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive";
  const stars = Math.ceil((lead.interest_level || 0) / 2);

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="bg-card rounded-lg border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onView(lead)}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0" {...listeners}>
          <GripVertical className="h-3 w-3 text-muted-foreground inline mr-1" />
        </div>
        <div className="flex items-center gap-1">
          <TemperatureBadge score={lead.lead_score} />
          <Badge className={cn("text-[10px] px-1.5", scoreColor)}>{score}/100</Badge>
        </div>
      </div>
      {isLeadStale(lead) && (
        <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 rounded px-1.5 py-0.5 mb-1">
          <Clock className="h-2.5 w-2.5" /> Stale — no activity for 7+ days
        </div>
      )}
      <h4 className="font-semibold text-sm truncate">{lead.name || "Unknown"}</h4>
      {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />
          <span className="truncate">{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>
      {/* Stars */}
      <div className="flex items-center gap-0.5 mt-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} className={cn("h-3 w-3", i <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
        ))}
      </div>
      {/* Source + Tags */}
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {lead.lead_source && (
          <span className="text-[10px] bg-muted rounded px-1.5 py-0.5">{SOURCE_LABELS[lead.lead_source] || lead.lead_source}</span>
        )}
        {(lead.tags || []).slice(0, 2).map(t => (
          <span key={t} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{t}</span>
        ))}
        {(lead.tags || []).length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{(lead.tags || []).length - 2}</span>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(lead.created_at), "dd MMM yyyy, hh:mm a")}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onView(lead)}>
              <Eye className="h-3 w-3 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(lead)}>
              <Edit className="h-3 w-3 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><ArrowRight className="h-3 w-3 mr-2" /> Move to...</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STATUSES.filter(s => s !== lead.status).map(s => (
                  <DropdownMenuItem key={s} className="capitalize" onClick={() => onStatusChange(lead.id, s)}>{s}</DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(lead)}>
              <Trash2 className="h-3 w-3 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ─── Table View ─── */
function TableView({ leads, selectedIds, setSelectedIds, onViewDetail, onEdit, onDelete, onStatusChange }: {
  leads: Lead[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  onViewDetail: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const allSelected = leads.length > 0 && selectedIds.size === leads.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(leads.map(l => l.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Temp</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Follow-up</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map(lead => {
              const score = lead.lead_score ?? 0;
              const scoreColor = score > 70 ? "bg-primary/15 text-primary" : score > 40 ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive";
              const stars = Math.ceil((lead.interest_level || 0) / 2);
              const isOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date();
              return (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetail(lead)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleOne(lead.id)} />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{lead.name || "Unknown"}</p>
                      {lead.company && <p className="text-xs text-muted-foreground">{lead.company}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />{lead.phone}
                        </span>
                        {lead.email && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />{lead.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge className={cn("text-xs", scoreColor)}>{score}/100</Badge></TableCell>
                  <TableCell><TemperatureBadge score={lead.lead_score} /></TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star key={i} className={cn("h-3 w-3", i <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[lead.status || "new"])}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{SOURCE_LABELS[lead.lead_source || ""] || lead.lead_source || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(lead.tags || []).slice(0, 2).map(t => (
                        <span key={t} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{t}</span>
                      ))}
                      {(lead.tags || []).length > 2 && <span className="text-[10px] text-muted-foreground">+{(lead.tags || []).length - 2}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.follow_up_date ? (
                      <span className={cn("text-xs", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {format(new Date(lead.follow_up_date), "MMM d, yyyy")}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(lead.created_at), "dd MMM yyyy, hh:mm a")}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetail(lead)}><Eye className="h-3 w-3 mr-2" /> View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(lead)}><Edit className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger><ArrowRight className="h-3 w-3 mr-2" /> Move to...</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {STATUSES.filter(s => s !== lead.status).map(s => (
                              <DropdownMenuItem key={s} className="capitalize" onClick={() => onStatusChange(lead.id, s)}>{s}</DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(lead)}><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ─── Lead Form Modal ─── */
function LeadFormModal({ open, onOpenChange, clientId, lead, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  lead?: Lead;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!lead;
  const [form, setForm] = useState<LeadFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name || "",
        company: lead.company || "",
        phone: lead.phone,
        email: lead.email || "",
        lead_source: lead.lead_source || "manual",
        lead_score: lead.lead_score ?? 50,
        interest_level: lead.interest_level ?? 5,
        status: lead.status || "new",
        tags: (lead.tags || []).join(", "),
        notes: lead.notes || "",
        follow_up_date: lead.follow_up_date ? new Date(lead.follow_up_date) : undefined,
      });
    } else {
      setForm(emptyForm);
    }
  }, [lead, open]);

  const update = (k: keyof LeadFormData, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.phone.trim()) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      client_id: clientId,
      name: form.name || null,
      company: form.company || null,
      phone: form.phone.trim(),
      email: form.email || null,
      lead_source: form.lead_source as any,
      lead_score: form.lead_score,
      interest_level: form.interest_level,
      status: form.status as any,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      notes: form.notes || null,
      follow_up_date: form.follow_up_date ? format(form.follow_up_date, "yyyy-MM-dd") : null,
    };

    let error;
    if (isEdit && lead) {
      ({ error } = await supabase.from("leads").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", lead.id));
    } else {
      ({ error } = await supabase.from("leads").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isEdit ? "Lead updated" : "Lead added" });
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lead" : "Add Lead"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update lead information" : "Create a new lead manually"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Contact name" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company} onChange={e => update("company", e.target.value)} placeholder="Company name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Source</Label>
              <Select value={form.lead_source} onValueChange={v => update("lead_source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="telecaller">Telecaller</SelectItem>
                  <SelectItem value="voice_agent">Voice Agent</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Lead Score: {form.lead_score}</Label>
            <Slider min={0} max={100} step={1} value={[form.lead_score]}
              onValueChange={v => update("lead_score", v[0])} className="mt-2" />
          </div>
          <div>
            <Label>Interest Level: {form.interest_level}/10</Label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map(i => {
                const filled = i <= Math.ceil(form.interest_level / 2);
                return (
                  <Star key={i} className={cn("h-5 w-5 cursor-pointer", filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")}
                    onClick={() => update("interest_level", i * 2)} />
                );
              })}
            </div>
          </div>
          <div>
            <Label>Tags</Label>
            <Input value={form.tags} onChange={e => update("tags", e.target.value)} placeholder="tag1, tag2, tag3" />
            <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
          </div>
          <div>
            <Label>Follow-up Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !form.follow_up_date && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {form.follow_up_date ? format(form.follow_up_date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={form.follow_up_date}
                  onSelect={d => update("follow_up_date", d)}
                  className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => update("notes", e.target.value)}
              placeholder="Add notes about this lead..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : isEdit ? "Update Lead" : "Add Lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Lead Detail Panel ─── */
function LeadDetailPanel({ lead, onClose, onEdit, onDelete, onStatusChange, onNotesUpdate, onInstantCall }: {
  lead: Lead;
  onClose: () => void;
  onEdit: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onStatusChange: (id: string, status: string) => void;
  onNotesUpdate: (id: string, notes: string) => void;
  onInstantCall: (l: Lead) => void;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const score = lead.lead_score ?? 0;
  const scoreColor = score > 70 ? "bg-primary/15 text-primary" : score > 40 ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive";
  const stars = Math.ceil((lead.interest_level || 0) / 2);

  useEffect(() => { setNotes(lead.notes || ""); }, [lead]);

  return (
    <Dialog open={true} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>{lead.name || "Unknown Lead"}</span>
            <div className="flex items-center gap-1.5">
              <TemperatureBadge score={lead.lead_score} size="md" />
              <Badge className={cn("text-xs", scoreColor)}>{score}/100</Badge>
            </div>
          </DialogTitle>
          <DialogDescription>{lead.company || "No company"}</DialogDescription>
        </DialogHeader>

        {/* Contact Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm hover:underline">
              <Phone className="h-4 w-4" />{lead.phone}
            </a>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onInstantCall(lead)}>
              <Phone className="h-3 w-3 mr-1 text-green-500" /> Instant Call
            </Button>
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm hover:underline">
                <Mail className="h-4 w-4" />{lead.email}
              </a>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Select value={lead.status || "new"} onValueChange={v => onStatusChange(lead.id, v)}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Source</p>
              <p className="mt-1">{SOURCE_LABELS[lead.lead_source || ""] || lead.lead_source || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Interest Level</p>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={cn("h-4 w-4", i <= stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Follow-up</p>
              <p className="mt-1">{lead.follow_up_date ? format(new Date(lead.follow_up_date), "MMM d, yyyy") : "—"}</p>
            </div>
          </div>

          {/* Tags */}
          {(lead.tags || []).length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Tags</p>
              <div className="flex gap-1 flex-wrap">
                {(lead.tags || []).map(t => (
                  <span key={t} className="text-xs bg-muted rounded px-2 py-0.5">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-muted-foreground text-xs mb-1">Notes</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} />
            {notes !== (lead.notes || "") && (
              <Button size="sm" className="mt-2" onClick={() => onNotesUpdate(lead.id, notes)}>Save Notes</Button>
            )}
          </div>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>Created: {format(new Date(lead.created_at), "PPp")}</p>
            <p>Updated: {format(new Date(lead.updated_at), "PPp")}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(lead)}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Mini Stat ─── */
function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <div>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Skeleton ─── */
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
