import { useEffect, useState, useCallback } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Mail, CheckCircle, CheckCheck, Zap, MessageSquare,
  Users, FileText, BarChart3, MoreVertical, Plus, Send,
  Clock, X, RefreshCw, Trash2, Eye, MousePointer2,
  Sparkles, TrendingUp, Target, Calendar, ArrowUpRight,
  Filter, Layout, Layers, Globe
} from "lucide-react";

import { formatDistanceToNow, format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// --- Mock Campaigns ---
const MOCK_CAMPAIGNS = [
  { id: "1", name: "Welcome Sequence", status: "Active", sent: 1240, opened: 820, clicks: 145, rate: "66%" },
  { id: "2", name: "Summer Sale 2024", status: "Draft", sent: 0, opened: 0, clicks: 0, rate: "0%" },
  { id: "3", name: "Engagement Re-activation", status: "Active", sent: 5200, opened: 1200, clicks: 88, rate: "23%" },
  { id: "4", name: "Product Launch X", status: "Scheduled", sent: 0, opened: 0, clicks: 0, rate: "0%" },
];

export default function EmailMarketingPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();

  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");

  const emailService = assignedServices.find(s => s.service_slug === "email-marketing");

  if (contextLoading) return <LoadingSkeleton />;
  if (!emailService) return <Navigate to="/client" replace />;

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Branded Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-primary/40 p-10 text-white shadow-2xl border border-white/5">
        <div className="absolute -right-20 -top-20 opacity-10">
          <Mail className="w-80 h-80 rotate-12" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-xl">
            <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 py-1 px-3">
              <Sparkles className="w-3 h-3 mr-2" />
              Automated Lifecycle
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
              Reach Every <span className="text-primary italic">Inbox</span>
            </h1>
            <p className="text-slate-400 font-medium">
              Create high-performing email campaigns with our drag-and-drop builder and AI-driven sequence optimizer.
            </p>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
            <div className="bg-white/5 bg-opacity-90 rounded-2xl p-4 border border-white/10 shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Usage</span>
                <span className="text-[10px] font-black text-primary">{emailService.usage_consumed} / {emailService.usage_limit}</span>
              </div>
              <Progress value={(emailService.usage_consumed / emailService.usage_limit) * 100} className="h-1.5 bg-white/10" />
              <p className="text-[10px] text-slate-500 mt-2">Resetting in 12 days</p>
            </div>
            <Button 
              className="h-12 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform" 
              style={{ backgroundColor: primaryColor }}
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-5 h-5 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Stats Overview */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<Target />} label="Total Recipients" value="24,500" trend="+12%" color="blue" />
        <StatsCard icon={<TrendingUp />} label="Avg. Open Rate" value="48.2%" trend="+3.4%" color="green" />
        <StatsCard icon={<BarChart3 />} label="Click Rate" value="8.5%" trend="-0.5%" color="purple" />
        <StatsCard icon={<Users />} label="Active Leads" value="12,100" trend="+18%" color="indigo" />
      </div>

      {/* 3. Main Content Area */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Side: Campaigns Table */}
        <Card className="lg:col-span-2 overflow-hidden rounded-3xl border-primary/10 bg-white shadow-xl shadow-primary/5">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 px-8 py-6">
            <div>
              <CardTitle className="text-lg font-black text-slate-800">Email <span className="text-primary">Campaigns</span></CardTitle>
              <CardDescription>Manage your ongoing and scheduled sequences</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="rounded-full"><Filter className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50">
                  <TableHead className="pl-8 font-black uppercase text-[10px] tracking-widest text-slate-400">Campaign Name</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Status</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest text-slate-400">Engagement</TableHead>
                  <TableHead className="pr-8 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((camp) => (
                  <TableRow key={camp.id} className="group hover:bg-slate-50/80 transition-colors border-slate-50">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:scale-110 transition-transform">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm leading-none">{camp.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-1">Created 2 days ago</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-full font-black text-[9px] uppercase tracking-wider px-3",
                        camp.status === "Active" ? "bg-green-100 text-green-600 border-green-200" :
                        camp.status === "Draft" ? "bg-slate-100 text-slate-500 border-slate-200" :
                        "bg-blue-100 text-blue-600 border-blue-200"
                      )} variant="outline">
                        {camp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 w-24">
                        <div className="flex justify-between text-[10px] font-black">
                          <span className="text-slate-400 uppercase tracking-widest">Rate</span>
                          <span className="text-primary">{camp.rate}</span>
                        </div>
                        <Progress value={parseInt(camp.rate)} className="h-1 bg-slate-100" />
                      </div>
                    </TableCell>
                    <TableCell className="pr-8 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white hover:shadow-md">
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-8 text-center bg-slate-50/30">
              <Button variant="ghost" className="text-primary font-black text-xs uppercase tracking-widest">
                View All Campaigns <ArrowUpRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Side: Quick Tools / Insights */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-primary/10 bg-slate-900 overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-32 h-32 text-primary" />
            </div>
            <CardHeader className="pb-2 relative z-10">
              <Badge className="w-fit bg-primary/20 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest mb-2">AI Insights</Badge>
              <CardTitle className="text-xl font-black text-white">Subject Optimizer</CardTitle>
              <CardDescription className="text-slate-400">AI predicts your next open rate</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Best Time to Send</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-white">Tuesday, 10:45 AM</span>
                </div>
              </div>
              <Button className="w-full h-11 rounded-xl bg-white text-slate-900 font-black hover:bg-slate-100 transition-colors shadow-lg">
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze New Subject
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-primary/10 bg-white shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest">Automation Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-xs font-bold text-slate-500">Auto-Responders</span>
                </div>
                <span className="text-sm font-black text-slate-800">12 Active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-indigo-400" />
                  <span className="text-xs font-bold text-slate-500">Follow-up Flows</span>
                </div>
                <span className="text-sm font-black text-slate-800">8 Active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-200" />
                  <span className="text-xs font-bold text-slate-500">Manual Broadcast</span>
                </div>
                <span className="text-sm font-black text-slate-800">2 Sent</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Modals */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl rounded-[32px] p-0 overflow-hidden border-0">
          <div className="bg-slate-900 p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Wand2 className="w-20 h-20" /></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black tracking-tight">Create <span className="text-primary italic">Campaign</span></DialogTitle>
              <DialogDescription className="text-slate-400">Launch a new high-converting sequence in minutes.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-8 bg-white">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Campaign Title</Label>
                <Input placeholder="e.g., Summer Discount Sequence" className="h-12 rounded-xl border-slate-100 bg-slate-50/50 font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border-2 border-primary bg-primary/5 cursor-pointer flex flex-col items-center text-center gap-2 group">
                  <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg"><Layout className="w-5 h-5" /></div>
                  <span className="text-sm font-black text-slate-800">Standard Builder</span>
                  <p className="text-[10px] text-slate-500 font-medium">Drag & drop sections</p>
                </div>
                <div className="p-4 rounded-2xl border-2 border-slate-100 hover:border-primary/30 transition-colors cursor-pointer flex flex-col items-center text-center gap-2 group">
                  <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center group-hover:bg-primary transition-colors"><Sparkles className="w-5 h-5" /></div>
                  <span className="text-sm font-black text-slate-800">AI Component Generator</span>
                  <p className="text-[10px] text-slate-500 font-medium">Prompt to Page</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-widest text-slate-400">Cancel</Button>
              <Button className="h-12 px-8 rounded-xl font-black bg-slate-900 text-white" onClick={() => setIsCreating(false)}>
                Start Building <ArrowUpRight className="ml-2 w-4 h-4" />
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsCard({ icon, label, value, trend, color }: { icon: React.ReactNode; label: string; value: string; trend: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 text-blue-500 border-blue-100",
    green: "bg-green-50 text-green-500 border-green-100",
    purple: "bg-purple-50 text-purple-500 border-purple-100",
    indigo: "bg-indigo-50 text-indigo-500 border-indigo-100",
  };

  return (
    <Card className="rounded-3xl border-slate-50 bg-white/50 bg-opacity-85 shadow-xl shadow-slate-200/20 hover:shadow-2xl hover:shadow-primary/5 transition-colors group overflow-hidden relative">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform", colorClasses[color])}>
            {icon}
          </div>
          <Badge variant="secondary" className="bg-slate-50 text-slate-500 font-black text-[10px] tracking-widest border-0">
            {trend}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 pb-20 p-8">
      <Skeleton className="h-48 w-full rounded-3xl" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-96 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}

// Icons needed but not in original list
import { Wand2 } from "lucide-react";
