import { useEffect, useState, useCallback, useMemo } from "react";
import {
  PhoneIncoming, Settings, PhoneCall, History, Play, Pause, Trash2, RefreshCw, Bot, User, Smartphone, Info, Save, MessageSquare, Volume2, Mic, CheckCircle, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const formatDuration = (duration: any): string => {
  if (typeof duration === 'number') {
    return `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`;
  }
  if (typeof duration === 'string') {
    // Check if it's already HH:MM:SS or similar like '0.00:40.00'
    const match = duration.match(/(?:(?:(\d+)\.)?(\d+):)?(\d+)(?:\.(\d+))?$/);
    if (match) {
      const minutes = parseInt(match[2] || '0', 10);
      const seconds = parseInt(match[3] || '0', 10);
      return `${minutes}m ${seconds}s`;
    }
    // Fallback if parsing fails
    return duration;
  }
  return '0m 0s';
};

interface InboundNumber {
  id: string;
  phone_number: string;
  label: string | null;
  status: string;
  provider_id: string | null;
  provider_bot_name: string | null;
}

interface InboundAgent {
  id: string;
  number_id: string;
  name: string;
  greeting_message: string;
  system_prompt: string;
  voice_id: string;
  model: string;
  tone: string;
}

interface CallLog {
  id: string;
  phone: string;
  call_status: string;
  duration: string;
  transcript: string;
  call_url: string;
  created_at: string | null;
  started_at?: string;
  is_lead?: boolean;
}

import { useClient } from "@/contexts/ClientContext";

const getInboundCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_inbound_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

let inboundPageCache = getInboundCacheFromStorage();

const saveInboundCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && inboundPageCache) {
      localStorage.setItem(`pixora_inbound_cache_${uid}`, JSON.stringify(inboundPageCache));
    }
  } catch {}
};

const ensureInboundCache = () => {
  if (!inboundPageCache) {
    inboundPageCache = {
      assignedNumbers: [],
      logs: [],
      selectedNumId: null,
    };
  }
  return inboundPageCache;
};

export default function InboundServicePage() {
  const { toast } = useToast();
  const { client, isLoading: clientLoading } = useClient();
  const [loading, setLoading] = useState(!inboundPageCache);
  const [logsLoading, setLogsLoading] = useState(false);
  const [assignedNumbers, setAssignedNumbers] = useState<InboundNumber[]>(inboundPageCache?.assignedNumbers || []);
  const [selectedNumId, setSelectedNumId] = useState<string | null>(inboundPageCache?.selectedNumId || null);
  const [logs, setLogs] = useState<CallLog[]>(inboundPageCache?.logs || []);
  const [selectedLog, setSelectedLog] = useState<CallLog | null>(null);
  const [isMarkingLead, setIsMarkingLead] = useState(false);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);

  const leads = useMemo(() => logs.filter(l => l.is_lead), [logs]);

  const fetchNumbers = useCallback(async () => {
    if (!client?.user_id) return;
    if (!inboundPageCache) {
      setLoading(true);
    }
    try {
      // 1. Fetch assigned numbers
      const { data: rawNums, error: numError } = await supabase
        .from("inbound_numbers" as any)
        .select("*")
        .eq("assigned_user_id", client.user_id);

      if (numError) throw numError;

      const nums = rawNums as InboundNumber[] | null;
      const finalNums = nums || [];
      setAssignedNumbers(finalNums);
      ensureInboundCache().assignedNumbers = finalNums;
      saveInboundCacheToStorage();

      if (finalNums.length > 0 && !selectedNumId) {
        setSelectedNumId(finalNums[0].id);
        ensureInboundCache().selectedNumId = finalNums[0].id;
        saveInboundCacheToStorage();
      }
    } catch (error: any) {
      console.error("Error fetching inbound numbers:", error);
      toast({ title: "Error", description: "Failed to fetch assigned numbers: " + error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [client?.user_id, selectedNumId, toast]);

  const fetchLogs = useCallback(async (numId: string) => {
    if (!numId || !client?.user_id) return;
    if (!inboundPageCache) {
      setLogsLoading(true);
    }
    try {
      const { data: rawLogData, error: logError } = await supabase
        .from("inbound_call_logs" as any)
        .select("*")
        // .eq("number_id", numId)
        .eq("owner_user_id", client?.user_id)
        .order("created_at", { ascending: false });

      if (logError) throw logError;
      const mapped: CallLog[] = (rawLogData || []).map((d: any) => ({
        ...d,
        phone: d.phone || d.caller_number || d.caller_id || "",
        created_at: d.created_at || d.started_at || null,
      }));
      setLogs(mapped);
      ensureInboundCache().logs = mapped;
      saveInboundCacheToStorage();
    } catch (error: any) {
      console.error("Error fetching inbound logs:", error);
      toast({
        title: "Error fetching logs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLogsLoading(false);
    }
  }, [client?.user_id, toast]);

  const handleRefresh = useCallback(async () => {
    await fetchNumbers();
    if (selectedNumId) {
      await fetchLogs(selectedNumId);
    }
  }, [fetchNumbers, fetchLogs, selectedNumId]);

  const handleToggleLeadStatus = async () => {
    if (!selectedLog || !client) return;
    setIsMarkingLead(true);
    try {
      const newStatus = !selectedLog.is_lead;
      const { error } = await supabase
        .from("inbound_call_logs" as any)
        .update({ is_lead: newStatus })
        .eq("id", selectedLog.id);

      if (error) throw error;

      // Update local state and cache
      setLogs(prev => {
        const updated = prev.map(l =>
          l.id === selectedLog.id ? { ...l, is_lead: newStatus } : l
        );
        ensureInboundCache().logs = updated;
        saveInboundCacheToStorage();
        return updated;
      });
      
      setSelectedLog(prev => prev ? { ...prev, is_lead: newStatus } : null);

      toast({
        title: newStatus ? "Marked as Lead" : "Lead Status Removed",
        description: `Successfully ${newStatus ? 'marked' : 'unmarked'} ${selectedLog.phone} as a lead.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update lead status: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsMarkingLead(false);
    }
  };


  useEffect(() => {
    if (client?.user_id) {
      fetchNumbers();
    }
  }, [client?.user_id, fetchNumbers]);

  useEffect(() => {
    if (selectedNumId) {
      fetchLogs(selectedNumId);
    }
  }, [selectedNumId, fetchLogs]);

  if (clientLoading || (loading && assignedNumbers.length === 0)) return <LoadingSkeleton />;

  if (assignedNumbers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="bg-primary/5 rounded-full p-6 mb-6">
          <Smartphone className="h-16 w-16 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No Inbound Number Assigned</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          You don't have any inbound phone numbers assigned to your account yet.
          Please contact support or your administrator to get a number.
        </p>
        <Button variant="outline" onClick={fetchNumbers}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Status
        </Button>
      </div>
    );
  }

  const activeNum = assignedNumbers.find(n => n.id === selectedNumId);
  const isBotReady = activeNum?.provider_id && activeNum?.provider_bot_name;

  return (
    <div className="space-y-6">
      {/* Configuration Warning Banner */}
      {!isBotReady && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-center gap-3 mb-6">
          <Bot className="h-6 w-6 shrink-0" />
          <div>
            <p className="text-sm font-bold">Bot Configuration Incomplete</p>
            <p className="text-xs opacity-80">This inbound number setup is missing provider agent ID or bot name coordinates. Contact your administrator to complete the configuration.</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              First Voice
            </h1>
            {activeNum?.provider_id && (
              <Badge variant="outline" className="text-[10px] font-mono">
                ID: {activeNum.provider_id}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Configure your AI receptionist and view call history</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedNumId || ""} onValueChange={setSelectedNumId}>
            <SelectTrigger className="w-[200px]">
              <PhoneIncoming className="mr-2 h-4 w-4 text-primary" />
              <SelectValue placeholder="Select Number" />
            </SelectTrigger>
            <SelectContent>
              {assignedNumbers.map(n => (
                <SelectItem key={n.id} value={n.id}>{n.phone_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh} 
            disabled={loading || logsLoading}
            title="Refresh numbers and history"
          >
            <RefreshCw className={cn("h-4 w-4", (loading || logsLoading) && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calls" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="calls">Calls ({logs.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>
        <TabsContent value="calls">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-primary" /> Call History
              </CardTitle>
              <CardDescription>
                Detailed log of all inbound calls handled by this agent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Fetching call logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <PhoneCall className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                  <p>No calls recorded yet.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.phone}</TableCell>
                          <TableCell>
                            {log.created_at
                              ? format(new Date(log.created_at), "MMM d, yyyy h:mm a")
                              : "—"}
                          </TableCell>
                          <TableCell>{formatDuration(log.duration)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "uppercase text-[10px]",
                              log.call_status === 'answered' ? "bg-green-50 text-green-600 border-green-200" : "text-muted-foreground"
                            )}>
                              {log.call_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Overview Stats */}
            <div className="space-y-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Current Status
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">Online</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Number</span>
                    <span className="font-mono font-medium">{activeNum?.phone_number}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="capitalize">Twilio</span>
                  </div>
                  <div className="pt-2 border-t flex justify-around text-center">
                    <div>
                      <p className="text-2xl font-bold">{logs.length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Total Calls</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {logs.filter(l => l.call_status === 'answered').length}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">Answered</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600">
                        {logs.filter(l => l.call_status === 'missed').length}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">Missed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No calls recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{log.phone}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {log.created_at
                                ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true })
                                : "No date"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={cn(
                              "text-[10px] uppercase h-5",
                              log.call_status === 'answered' ? "text-green-600 border-green-200 bg-green-50" : "text-muted-foreground"
                            )}>
                              {log.call_status}
                            </Badge>
                            <div className="text-[10px] font-mono">
                              {formatDuration(log.duration)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                {logs.length > 5 && (
                  <div className="p-3 bg-muted/30 border-t text-center">
                    <Button variant="ghost" size="sm" className="text-xs h-7">View All Logs</Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="leads">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Captured Leads
              </CardTitle>
              <CardDescription>
                Contacts automatically identified as leads by your AI agent during their calls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="text-center py-20">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Fetching leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-4" />
                  <p>No leads captured yet.</p>
                  <p className="text-sm">When the AI identifies a caller as a warm lead, they will appear here.</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.phone}</TableCell>
                          <TableCell>
                            {lead.created_at
                              ? format(new Date(lead.created_at), "MMM d, yyyy h:mm a")
                              : "—"}
                          </TableCell>
                          <TableCell>{formatDuration(lead.duration)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                              Warm Lead
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(lead)}>
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              Details and transcript for the call with {selectedLog?.phone}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <>
              <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Date & Time</span>
                  <span className="font-medium">
                    {selectedLog.created_at
                      ? format(new Date(selectedLog.created_at), "MMM d, yyyy h:mm a")
                      : "Unknown Time"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Duration</span>
                  <span className="font-medium">{formatDuration(selectedLog.duration)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Status</span>
                  <Badge variant="outline" className={cn(
                    "uppercase text-[10px] mt-1",
                    selectedLog.call_status === 'answered' ? "bg-green-50 text-green-600 border-green-200" : "text-muted-foreground"
                  )}>
                    {selectedLog.call_status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground block">Lead Status</span>
                  {selectedLog.is_lead ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200 mt-1">Warm Lead</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs mt-1 block">Not marked as lead</span>
                  )}
                </div>
              </div>

              {selectedLog.recording_url && (
                <div className="pt-2 border-t">
                  <span className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Play className="h-4 w-4" /> Recording
                  </span>
                  <audio controls className="w-full" src={selectedLog.recording_url} />
                </div>
              )}

              <div className="pt-2 border-t">
                <span className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Transcript
                </span>
                <div className="bg-muted p-3 rounded-md max-h-[200px] overflow-y-auto text-sm whitespace-pre-wrap">
                  {selectedLog.transcript ? selectedLog.transcript : <span className="text-muted-foreground italic">No transcript available for this call.</span>}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                variant={selectedLog.is_lead ? "destructive" : "default"} 
                className={cn(!selectedLog.is_lead && "bg-green-600 hover:bg-green-700")}
                onClick={handleToggleLeadStatus}
                disabled={isMarkingLead}
              >
                {isMarkingLead ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : selectedLog.is_lead ? (
                  <User className="h-4 w-4 mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {selectedLog.is_lead ? "Remove Lead Status" : "Mark as Lead"}
              </Button>
              <Button variant="outline" onClick={() => setSelectedLog(null)}>Close</Button>
            </DialogFooter>
          </>
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[500px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  );
}
