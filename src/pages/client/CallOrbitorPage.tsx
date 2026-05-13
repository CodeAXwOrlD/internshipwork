import { useEffect, useState, useCallback, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone, PhoneIncoming, PhoneForwarded, Headphones, 
  Play, Pause, Plus, MoreVertical, Zap, Users, 
  BarChart3, FileText, Settings, Sparkles, 
  ArrowUpRight, Clock, Shield, Brain, Calendar,
  Mic, Search, Filter, RefreshCw, Trash2, Save
} from "lucide-react";

import { formatDistanceToNow, format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CreateCampaignWizard from "@/components/client/telecaller/CreateCampaignWizard";
import { initiateInstantCall } from "@/lib/instant-call";
import { cn } from "@/lib/utils";

export default function CallOrbitorPage() {
  const { client, assignedServices, isLoading: contextLoading, primaryColor } = useClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("outbound");
  const [isLoading, setIsLoading] = useState(true);
  const [telecallerService, setTelecallerService] = useState<any>(null);
  
  // -- Outbound State --
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [recentOutbound, setRecentOutbound] = useState<any[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  // -- Inbound/Receptionist State --
  const [recentInbound, setRecentInbound] = useState<any[]>([]);
  const [receptionistActive, setReceptionistActive] = useState(true);

  useEffect(() => {
    const svc = assignedServices.find(s => s.service_slug.includes("voice"));
    setTelecallerService(svc);
    setIsLoading(false);
  }, [assignedServices]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!telecallerService) return <Navigate to="/client" replace />;

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Branded Hub Header */}
      <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-primary/30 p-10 text-white shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Zap className="w-96 h-96 rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/20 hover:bg-primary/30 text-primary border-primary/30 py-1 px-3">
                <Sparkles className="w-3 h-3 mr-2 fill-primary" />
                AI Call Infrastructure
              </Badge>
              <div className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-xs font-bold text-slate-400">v2.4.0 Engine</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/40">
              Call <span className="text-primary italic">Orbitor</span>
            </h1>
            <p className="text-lg text-slate-400 font-medium max-w-xl">
              Centralized intelligence for all your business voice operations. Manage outbound campaigns, inbound routing, and AI receptionist personality.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-6 rounded-[32px] bg-white/5 bg-opacity-95 border border-white/10 shadow-inner">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Engaged Time</p>
               <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-black">12.5k</span>
                 <span className="text-xs font-bold text-green-400">min</span>
               </div>
             </div>
             <div className="p-6 rounded-[32px] bg-primary text-white shadow-xl shadow-primary/20 border border-white/20">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">Service Status</p>
               <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                 <span className="text-sm font-bold">ALL SYSTEMS LIVE</span>
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Main Module Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-center">
          <TabsList className="bg-slate-100/50 p-1.5 rounded-[32px] h-20 border border-slate-200">
            <TabsTrigger 
              value="outbound" 
              className="px-10 rounded-[28px] h-full font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary transition-colors gap-3"
            >
              <ArrowUpRight className="w-5 h-5" />
              OUTBOUND
            </TabsTrigger>
            <TabsTrigger 
              value="inbound" 
              className="px-10 rounded-[28px] h-full font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary transition-colors gap-3"
            >
              <PhoneIncoming className="w-5 h-5" />
              INBOUND
            </TabsTrigger>
            <TabsTrigger 
              value="receptionist" 
              className="px-10 rounded-[28px] h-full font-black text-sm data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary transition-colors gap-3"
            >
              <Brain className="w-5 h-5" />
              RECEPTIONIST
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 3. Tab Contents */}
        
          <TabsContent value="outbound">
            <div
              
              
              
              className="space-y-8"
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <ModuleStatCard label="Total Dials" value="4,200" icon={<Phone />} color="blue" />
                <ModuleStatCard label="Live Answered" value="68%" icon={<Headphones />} color="green" />
                <ModuleStatCard label="Leads Generated" value="142" icon={<Users />} color="purple" />
                <ModuleStatCard label="Avg. Call Time" value="2:45" icon={<Clock />} color="orange" />
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                <Card className="lg:col-span-2 rounded-[32px] border-slate-100 shadow-xl shadow-slate-200/50">
                  <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 px-8 py-6">
                    <div>
                      <CardTitle className="text-xl font-black text-slate-800">Active <span className="text-primary italic">Campaigns</span></CardTitle>
                      <CardDescription>High-conversion cold calling sequences</CardDescription>
                    </div>
                    <Button 
                      className="rounded-2xl font-black h-12 px-6 shadow-lg shadow-primary/20"
                      onClick={() => setWizardOpen(true)}
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Campaign
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-slate-50">
                          <TableHead className="pl-8 text-[10px] font-black uppercase tracking-widest text-slate-400">Campaign</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</TableHead>
                          <TableHead className="pr-8 text-right"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <CampaignRow name="Real Estate Followup" status="Running" progress={72} />
                        <CampaignRow name="Summer Lead Gen" status="Scheduled" progress={0} />
                        <CampaignRow name="Debt Collection Beta" status="Paused" progress={45} />
                      </TableBody>
                    </Table>
                    <div className="p-8 text-center bg-slate-50/20">
                      <Button variant="ghost" className="text-xs font-black uppercase tracking-widest text-primary">
                        View Detailed Logs <ArrowUpRight className="ml-2 w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                   <Card className="rounded-[32px] bg-slate-900 border-0 p-8 text-white relative overflow-hidden shadow-2xl">
                     <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-24 h-24" /></div>
                     <h3 className="text-xl font-black mb-2">Outbound <span className="text-primary italic">Live</span></h3>
                     <p className="text-sm text-slate-400 mb-6">AI is currently dialing 3 numbers simultaneously.</p>
                     
                     <div className="space-y-4">
                       {[1, 2, 3].map(i => (
                         <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 group hover:border-primary/50 transition-colors cursor-pointer">
                           <div className="flex items-center gap-3">
                             <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center animate-pulse"><Phone className="w-4 h-4 text-primary" /></div>
                             <span className="text-xs font-bold font-mono">+91 98*** 450</span>
                           </div>
                           <Badge className="bg-primary/20 text-primary border-0 text-[9px] font-black">RINGING...</Badge>
                         </div>
                       ))}
                     </div>
                   </Card>

                   <Card className="rounded-[32px] border-slate-100 p-8 shadow-xl">
                     <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Quick Batch Call</h4>
                     <div className="space-y-4">
                        <Input placeholder="Enter comma separated numbers" className="rounded-2xl border-slate-100 bg-slate-50/50" />
                        <Button className="w-full h-12 rounded-2xl font-black bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                          <Zap className="w-4 h-4 mr-2" /> Start Flash Call
                        </Button>
                     </div>
                   </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inbound">
            <div
              
              
              className="space-y-8"
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <ModuleStatCard label="Inbound Calls" value="1,240" icon={<PhoneIncoming />} color="indigo" />
                <ModuleStatCard label="Auto-Handled" value="92%" icon={<CheckCircle2 />} color="emerald" />
                <ModuleStatCard label="Forwarded" value="85" icon={<PhoneForwarded />} color="orange" />
                <ModuleStatCard label="Avg. Handling" value="1:12" icon={<Clock />} color="rose" />
              </div>

              <div className="grid gap-8 lg:grid-cols-3">
                <Card className="lg:col-span-2 rounded-[40px] border-slate-100 shadow-2xl">
                   <CardHeader className="flex flex-row items-center justify-between px-10 py-8">
                     <div>
                        <CardTitle className="text-2xl font-black text-slate-800">Inbound <span className="text-primary italic">Live Feed</span></CardTitle>
                        <CardDescription>Real-time stream of incoming interactions</CardDescription>
                     </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-slate-200"><RefreshCw className="w-4 h-4" /></Button>
                        <Button variant="outline" className="rounded-full h-10 w-10 p-0 border-slate-200"><Filter className="w-4 h-4" /></Button>
                     </div>
                   </CardHeader>
                   <CardContent className="px-10 pb-10">
                      <div className="space-y-4">
                         <InboundCallItem name="Unknown Caller" phone="+1 424 555 0192" status="Handled" time="2m ago" summary="Customer inquiring about premium subscription and pricing tiers." />
                         <InboundCallItem name="John Smith" phone="+44 20 7946 0123" status="Forwarded" time="15m ago" summary="Re-activation request. Forwarded to Retention Team." />
                         <InboundCallItem name="Sarah Parker" phone="+91 91234 56789" status="Voicemail" time="1h ago" summary="Interested in enterprise solution. Left a message." />
                         <InboundCallItem name="Unknown Caller" phone="+1 212 555 0144" status="Handled" time="3h ago" summary="Standard support call regarding login issues." />
                      </div>
                   </CardContent>
                </Card>

                <div className="space-y-6">
                  <div className="p-8 rounded-[40px] bg-gradient-to-br from-indigo-600 to-indigo-900 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute -bottom-10 -right-10 opacity-10"><PhoneIncoming className="w-48 h-48" /></div>
                    <Badge className="bg-white/20 text-white border-0 text-[10px] font-black uppercase tracking-widest mb-4">Live Number</Badge>
                    <h3 className="text-3xl font-black mb-2 font-mono">+91 800 240 120</h3>
                    <p className="text-indigo-200 text-sm font-medium mb-6">Provisioned globally across 4 regions for redundancy.</p>
                    <div className="flex gap-2">
                      <Button className="flex-1 rounded-2xl bg-white text-indigo-900 font-black h-12 shadow-lg hover:bg-slate-50 transition-colors">
                        Copy Number
                      </Button>
                      <Button className="h-12 w-12 rounded-2xl bg-white/10 text-white bg-opacity-90 hover:bg-white/20 transition-colors">
                        <Settings className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>

                  <Card className="rounded-[40px] border-slate-100 shadow-xl p-8 bg-slate-50/50">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Routing Rules</h4>
                    <div className="space-y-4">
                       <RoutingRule label="After Hours" action="Voicemail" active={true} />
                       <RoutingRule label="VIP Customers" action="Priority Team" active={true} />
                       <RoutingRule label="Spam Protection" action="Auto-Block" active={false} />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="receptionist">
            <div
              
              
              className="space-y-8"
            >
              <div className="grid gap-8 lg:grid-cols-2">
                {/* 1. Personality & Logic */}
                <Card className="rounded-[40px] border-slate-100 shadow-2xl overflow-hidden">
                   <div className="bg-slate-900 p-8 text-white relative">
                     <div className="absolute top-0 right-0 p-8 opacity-10"><Brain className="w-24 h-24" /></div>
                     <Badge className="bg-primary text-white border-0 text-[10px] font-black uppercase tracking-widest mb-4">Core Intelligence</Badge>
                     <h3 className="text-2xl font-black">AI System <span className="text-primary italic">Prompts</span></h3>
                     <p className="text-slate-400 text-sm mt-2">Define how your virtual receptionist interacts with the world.</p>
                   </div>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Universal Greeting</Label>
                        <Input defaultValue="Thank you for calling Pixora Nest. How can I assist you today?" className="h-12 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-700" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">System Personality Instructions</Label>
                        <Textarea 
                          defaultValue="You are 'Aria', a professional, friendly, and efficient AI receptionist. You speak with a gentle tone. Your goal is to collect the caller's purpose, handle basic FAQs about availability, and either route to the human team or take a detailed message. Never sound robotic."
                          className="min-h-[200px] rounded-[32px] border-slate-100 bg-slate-50 p-6 leading-relaxed font-medium text-slate-600"
                        />
                      </div>
                      <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20">
                        <Save className="w-5 h-5 mr-3" /> Update Brain Configuration
                      </Button>
                   </CardContent>
                </Card>

                {/* 2. Advanced Routing & Controls */}
                <div className="space-y-8">
                   <Card className="rounded-[40px] border-slate-100 shadow-xl p-8">
                      <div className="flex items-center justify-between mb-8">
                         <h4 className="text-lg font-black text-slate-800">Operational <span className="text-primary italic">Hub</span></h4>
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live Engine</span>
                           <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <ControlItem icon={<Users />} label="Team Forwarding" description="Route calls to mobile if AI can't help" enabled={true} />
                         <ControlItem icon={<Calendar />} label="Appointment Booking" description="Allow AI to access internal calendar" enabled={true} />
                         <ControlItem icon={<Mic />} label="Voice Commands" description="Enable keypad and voice response" enabled={true} />
                         <ControlItem icon={<Shield />} label="Fraud Protection" description="Screen suspicious international calls" enabled={false} />
                      </div>
                   </Card>

                   <Card className="rounded-[40px] bg-gradient-to-br from-[#1e293b] to-black p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
                      <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:scale-110 transition-transform duration-700"><Search className="w-48 h-48" /></div>
                      <h4 className="text-xl font-black mb-4">Deep Learning <span className="text-primary">Logs</span></h4>
                      <p className="text-sm text-slate-500 mb-8 leading-relaxed">Analyze the transcripts of the last 50 calls to improve AI response quality and sentiment score.</p>
                      <Button variant="outline" className="w-full h-12 rounded-2xl border-white/10 text-white font-bold hover:bg-white/10 hover:text-white transition-colors">
                        <Sparkles className="w-4 h-4 mr-2" /> Open AI Lab
                      </Button>
                   </Card>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-md">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sentiment Score</p>
                        <p className="text-2xl font-black text-green-500">92%</p>
                      </div>
                      <div className="p-6 rounded-[32px] bg-white border border-slate-100 shadow-md">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hand-off Rate</p>
                        <p className="text-2xl font-black text-primary">8%</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </TabsContent>
        
      </Tabs>

      {/* 4. Wizard */}
      {telecallerService && (
        <CreateCampaignWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          primaryColor={primaryColor}
          usageLimit={telecallerService.usage_limit}
          usageConsumed={telecallerService.usage_consumed}
          clientId={client?.id || ""}
          userId={client?.user_id || ""}
        />
      )}
    </div>
  );
}

/* ─── Sub-Components ─── */

function ModuleStatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-500 border-blue-100",
    green: "bg-green-50 text-green-500 border-green-100",
    purple: "bg-purple-50 text-purple-500 border-purple-100",
    orange: "bg-orange-50 text-orange-500 border-orange-100",
    indigo: "bg-indigo-50 text-indigo-500 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-500 border-emerald-100",
    rose: "bg-rose-50 text-rose-500 border-rose-100",
  };

  return (
    <Card className="rounded-[32px] border-slate-50 bg-white/50 bg-opacity-85 shadow-xl shadow-slate-200/20 hover:shadow-2xl hover:shadow-primary/5 transition-colors group overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500", colorMap[color])}>
            {icon}
          </div>
          <Badge variant="secondary" className="bg-slate-50 text-slate-400 font-black text-[9px] tracking-widest uppercase border-0">Live Data</Badge>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
          <p className="text-2xl font-black text-slate-800">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignRow({ name, status, progress }: { name: string; status: string; progress: number }) {
  return (
    <TableRow className="group hover:bg-slate-50/80 transition-colors border-slate-50">
      <TableCell className="pl-8 py-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/5 text-primary group-hover:scale-110 transition-transform">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-700 text-sm leading-none">{name}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Goal: Leads</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn(
          "rounded-full font-black text-[9px] uppercase tracking-wider px-3 border-0 shadow-sm",
          status === "Running" ? "bg-green-100 text-green-600" :
          status === "Paused" ? "bg-orange-100 text-orange-600" :
          "bg-blue-100 text-blue-600"
        )}>
          {status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 w-24">
          <div className="flex justify-between text-[10px] font-black">
            <span className="text-slate-400 uppercase tracking-widest">Progress</span>
            <span className="text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-slate-100" />
        </div>
      </TableCell>
      <TableCell className="pr-8 text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white hover:shadow-md">
          <MoreVertical className="h-4 w-4 text-slate-400" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function InboundCallItem({ name, phone, status, time, summary }: { name: string; phone: string; status: string; time: string; summary: string }) {
  return (
    <div className="group p-5 rounded-3xl border border-slate-50 bg-white hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center">
       <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <PhoneIncoming className="w-5 h-5" />
       </div>
       <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
             <h4 className="font-bold text-slate-800">{name}</h4>
             <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{phone}</span>
             <Badge className={cn(
               "text-[9px] font-black uppercase tracking-widest border-0",
               status === "Handled" ? "bg-emerald-100 text-emerald-600" :
               status === "Forwarded" ? "bg-indigo-100 text-indigo-600" :
               "bg-amber-100 text-amber-600"
             )}>{status}</Badge>
          </div>
          <p className="text-sm text-slate-500 font-medium line-clamp-1">{summary}</p>
       </div>
       <div className="text-right shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{time}</p>
          <Button variant="ghost" size="sm" className="h-8 rounded-xl font-bold text-primary group-hover:bg-primary/5">Details</Button>
       </div>
    </div>
  );
}

function RoutingRule({ label, action, active }: { label: string; action: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-50">
       <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", active ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400")}>
             <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">{label}</p>
            <p className="text-[10px] text-slate-400 font-medium italic">{action}</p>
          </div>
       </div>
       <div className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-300")} />
    </div>
  );
}

function ControlItem({ icon, label, description, enabled }: { icon: React.ReactNode; label: string; description: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-3xl border border-slate-50 hover:border-primary/10 hover:shadow-lg hover:shadow-primary/5 transition-colors">
       <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold group-hover:text-primary transition-colors">
            {icon}
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 leading-none mb-1">{label}</p>
            <p className="text-[10px] text-slate-400 font-medium">{description}</p>
          </div>
       </div>
       <div className={cn("px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors border", enabled ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-slate-300 border-slate-100")}>
         {enabled ? "ENABLED" : "DISABLED"}
       </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8 pb-20">
      <Skeleton className="h-[280px] w-full rounded-[40px]" />
      <div className="flex justify-center"><Skeleton className="h-20 w-[600px] rounded-[32px]" /></div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-[32px]" />)}
      </div>
      <div className="grid gap-8 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-[500px] rounded-[40px]" />
        <Skeleton className="h-[500px] rounded-[40px]" />
      </div>
    </div>
  );
}

// Icons needed but not in original list
import { CheckCircle2 } from "lucide-react";
