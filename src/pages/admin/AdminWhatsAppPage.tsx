import { useEffect, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MessageCircle, Users, Send, CheckCheck, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";

interface ClientStats {
  clientId: string;
  companyName: string;
  totalMessages: number;
  delivered: number;
  read: number;
  // campaigns: number;
}

interface DailyData {
  date: string;
  sent: number;
  delivered: number;
}

export default function AdminWhatsAppPage() {
  const { admin, primaryColor } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ totalMessages: 0, delivered: 0, read: 0, /*campaigns: 0,*/ activeClients: 0 });
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [dailyMsgs, setDailyMsgs] = useState<DailyData[]>([]);

  useEffect(() => {
    if (!admin) return;
    fetchAll();
  }, [admin]);

  async function fetchAll() {
    setLoading(true);
    try {
      const { data: clients } = await supabase
        .from("clients").select("id, company_name")
        .eq("admin_id", admin!.id);
      if (!clients?.length) { setLoading(false); return; }

      const clientIds = clients.map(c => c.id);

      const [msgsRes] = await Promise.all([
        supabase.from("whatsapp_messages").select("client_id, status, sent_at, delivered_at, read_at").in("client_id", clientIds),
        // supabase.from("whatsapp_campaigns").select("client_id, id").in("client_id", clientIds),
      ]);

      const msgs = msgsRes.data || [];
      const camps: any[] = [];
      const delivered = msgs.filter(m => m.status === "delivered" || m.status === "read").length;
      const read = msgs.filter(m => m.status === "read").length;
      const clientsWithMsgs = new Set(msgs.map(m => m.client_id));

      setOverview({
        totalMessages: msgs.length,
        delivered,
        read,
        // campaigns: camps.length,
        activeClients: clientsWithMsgs.size,
      });

      // Client stats
      const msgByClient = new Map<string, { total: number; delivered: number; read: number }>();
      msgs.forEach(m => {
        const e = msgByClient.get(m.client_id) || { total: 0, delivered: 0, read: 0 };
        e.total++;
        if (m.status === "delivered" || m.status === "read") e.delivered++;
        if (m.status === "read") e.read++;
        msgByClient.set(m.client_id, e);
      });
      // const campByClient = new Map<string, number>();
      // camps.forEach(c => campByClient.set(c.client_id, (campByClient.get(c.client_id) || 0) + 1));

      setClientStats(clients.map(cl => {
        const m = msgByClient.get(cl.id) || { total: 0, delivered: 0, read: 0 };
        return {
          clientId: cl.id,
          companyName: cl.company_name,
          totalMessages: m.total,
          delivered: m.delivered,
          read: m.read,
          // campaigns: campByClient.get(cl.id) || 0,
        };
      }));

      // Daily trend
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const byDate = new Map<string, { sent: number; delivered: number }>();
      msgs.forEach(m => {
        const d = m.sent_at?.split("T")[0];
        if (!d || new Date(d) < fourteenDaysAgo) return;
        const e = byDate.get(d) || { sent: 0, delivered: 0 };
        e.sent++;
        if (m.status === "delivered" || m.status === "read") e.delivered++;
        byDate.set(d, e);
      });
      const trend: DailyData[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        trend.push({ date: key, ...(byDate.get(key) || { sent: 0, delivered: 0 }) });
      }
      setDailyMsgs(trend);
    } finally {
      setLoading(false);
    }
  }

  const deliveryRate = overview.totalMessages > 0 ? Math.round((overview.delivered / overview.totalMessages) * 100) : 0;
  const chartConfig = {
    sent: { label: "Sent", color: primaryColor },
    delivered: { label: "Delivered", color: "hsl(var(--secondary))" },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="h-6 w-6" style={{ color: primaryColor }} />
          WhatsApp Automation
        </h1>
        <p className="text-sm text-muted-foreground">Monitor WhatsApp messaging across your clients</p>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Active Clients</p><p className="text-2xl font-bold">{overview.activeClients}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10"><Send className="h-5 w-5 text-secondary" /></div>
          <div><p className="text-sm text-muted-foreground">Messages Sent</p><p className="text-2xl font-bold">{overview.totalMessages}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent"><CheckCheck className="h-5 w-5 text-accent-foreground" /></div>
          <div><p className="text-sm text-muted-foreground">Delivery Rate</p><p className="text-2xl font-bold">{deliveryRate}%</p></div>
        </CardContent></Card>
        {/* <Card><CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10"><TrendingUp className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm text-muted-foreground">Campaigns</p><p className="text-2xl font-bold">{overview.campaigns}</p></div>
        </CardContent></Card> */}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Message Volume (Last 14 Days)</CardTitle></CardHeader>
        <CardContent>
          {dailyMsgs.some(d => d.sent > 0) ? (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={dailyMsgs} margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="waMsgsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} labelFormatter={v => format(new Date(v), "MMM d, yyyy")} />
                <Area type="monotone" dataKey="sent" stroke={primaryColor} fill="url(#waMsgsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="delivered" stroke="hsl(var(--secondary))" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No message data yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Client WhatsApp Overview</CardTitle></CardHeader>
        <CardContent className="p-0">
          {clientStats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Read</TableHead>
                  {/* <TableHead className="text-right">Campaigns</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientStats.map(cs => (
                  <TableRow key={cs.clientId}>
                    <TableCell className="font-medium">{cs.companyName}</TableCell>
                    <TableCell className="text-right font-medium">{cs.totalMessages}</TableCell>
                    <TableCell className="text-right">{cs.delivered}</TableCell>
                    <TableCell className="text-right">{cs.read}</TableCell>
                    {/* <TableCell className="text-right">{cs.campaigns}</TableCell> */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-10 text-center">No WhatsApp data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
