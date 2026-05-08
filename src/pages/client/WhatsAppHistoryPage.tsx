import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare,
  Search,
  User,
  Check,
  CheckCheck,
  AlertCircle,
  ChevronRight,
  Info,
  Filter,
  Clock,
  Shield,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export default function WhatsAppHistoryPage() {
  const [selectedBotId, setSelectedBotId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: assignedBots = [], isLoading: isBotsLoading } = useQuery({
    queryKey: ["client-assigned-wa-bots"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: access, error: accessErr } = await (
        supabase.from("whatsapp_user_access" as any) as any
      )
        .select("application_id, whatsapp_applications(*)")
        .eq("user_id", user.id);
      if (accessErr) throw accessErr;
      return access.map((a: any) => a.whatsapp_applications) as any[];
    },
  });

  const { data: messages = [], isLoading: isMsgsLoading } = useQuery({
    queryKey: ["wa-history", selectedBotId],
    queryFn: async () => {
      let query = (supabase.from("whatsapp_messages" as any) as any)
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);
      if (selectedBotId !== "all") {
        query = query.eq("application_id", selectedBotId);
      } else if (assignedBots.length > 0) {
        query = query.in(
          "application_id",
          assignedBots.map((b) => b.id),
        );
      } else {
        return [];
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: assignedBots.length > 0 || isBotsLoading,
  });

  const filteredMessages = messages.filter(
    (m: any) =>
      m.phone_number.includes(searchTerm) ||
      m.message_content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read":
        return <CheckCheck className="h-4 w-4 text-blue-500" />;
      case "delivered":
        return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
      case "sent":
        return <Check className="h-4 w-4 text-muted-foreground" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground/50" />;
    }
  };

  if (isBotsLoading)
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            WhatsApp Bot History
          </h1>
          <p className="text-muted-foreground font-medium">
            Monitor your automated WhatsApp interactions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
          <Select value={selectedBotId} onValueChange={setSelectedBotId}>
            <SelectTrigger className="w-full md:w-48 bg-card">
              <SelectValue placeholder="All Bots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assigned Bots</SelectItem>
              {assignedBots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-slate-100/50 px-8 py-6 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-900">
              Activity Log
            </CardTitle>
            <Badge
              variant="secondary"
              className="px-3 py-1 rounded-full text-xs font-bold bg-[#D3E4FF] text-[#0052CC] border-none"
            >
              {filteredMessages.length} Messages
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {isMsgsLoading ? (
              <div className="p-8 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full bg-white/50" />
                ))}
              </div>
            ) : filteredMessages.length > 0 ? (
              <div className="divide-y divide-slate-200/50">
                {filteredMessages.map((msg: any) => (
                  <div
                    key={msg.id}
                    className="group p-6 hover:bg-white/50 transition-colors duration-200 flex items-start gap-6"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <User className="h-6 w-6 text-slate-700" />
                      </div>
                      {getStatusIcon(msg.status)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-bold text-lg text-slate-900">
                          +{msg.phone_number}
                        </span>
                        <span className="text-xs font-mono text-slate-500">
                          {format(new Date(msg.sent_at), "MMM d, HH:mm:ss")}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed bg-white p-4 rounded-2xl shadow-sm">
                        {msg.message_content}
                      </p>
                      <div className="flex items-center gap-4 pt-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <Clock className="h-3 w-3" /> ID: {msg.id.slice(0, 8)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <Info className="h-3 w-3" /> Type: {msg.message_type}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <MessageSquare className="h-12 w-12 text-slate-700 mb-6 stroke-[1.5]" />
                <h3 className="text-xl font-bold text-slate-900">
                  No History Found
                </h3>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-white/10 bg-primary/10 rounded-3xl p-6 flex items-start gap-4">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-bold text-lg">Read-Only Access</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              Your account has been granted read-only access to this bot's
              history by the system administrator.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
