import React, { useEffect, useState, useCallback, useRef } from "react";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar, CheckCircle, Heart, TrendingUp, PlusCircle,
  MoreVertical, Eye, Trash2, Copy, Edit, ChevronLeft,
  ChevronRight, LayoutGrid, List, Clock, Image, Video,
  FileText, Send, X, Globe, RefreshCw, AlertCircle, Briefcase, Upload,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth,
  addMonths, subMonths, startOfWeek, endOfWeek, isToday, isBefore, parseISO,
} from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend,
} from "recharts";
import { FaFacebook, FaInstagram, FaLinkedin, FaXTwitter } from "react-icons/fa6";
import ComingSoonOverlay from "@/components/ComingSoonOverlay";
import { isComingSoon } from "@/lib/service-routes";

/* ─── Types ─── */
interface SocialPost {
  id: string;
  platform: string;
  post_type: string | null;
  content: string;
  media_urls: string[] | null;
  hashtags: string[] | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  engagement_stats: any;
  error_message: string | null;
  created_at: string;
  brand_id: string | null;
}

interface SocialBrand {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  created_at: string;
}

interface Stats {
  scheduled: number;
  published: number;
  totalEngagement: number;
  topPost: SocialPost | null;
}

const PLATFORMS = [
  { key: "facebook", label: "Facebook", icon: FaFacebook, color: "#1877F2" },
  { key: "instagram", label: "Instagram", icon: FaInstagram, color: "#E4405F" },
  { key: "linkedin", label: "LinkedIn", icon: FaLinkedin, color: "#0A66C2" },
  { key: "twitter", label: "Twitter/X", icon: FaXTwitter, color: "#000000" },
] as const;

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
};

const POST_TYPES = [
  { key: "text", label: "Text Only", icon: <FileText className="h-4 w-4" /> },
  { key: "image", label: "Image Post", icon: <Image className="h-4 w-4" /> },
  { key: "video", label: "Video Post", icon: <Video className="h-4 w-4" /> },
  { key: "carousel", label: "Carousel", icon: <LayoutGrid className="h-4 w-4" /> },
];

const getSocialCacheFromStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    const cached = uid ? localStorage.getItem(`pixora_social_cache_${uid}`) : null;
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.warn("Failed to load from localStorage:", e);
    return null;
  }
};

let socialPageCache = getSocialCacheFromStorage();

const saveSocialCacheToStorage = () => {
  try {
    const uid = localStorage.getItem("last_user_id");
    if (uid && socialPageCache) {
      localStorage.setItem(`pixora_social_cache_${uid}`, JSON.stringify(socialPageCache));
    }
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }
};

const ensureSocialCache = () => {
  if (!socialPageCache) {
    socialPageCache = {
      stats: null,
      posts: [],
      brands: [],
    };
  }
  return socialPageCache;
};

/* ─── Main Component ─── */
export default function SocialMediaPage() {
  const { client, assignedServices, isLoading: contextLoading } = useClient();
  const { toast } = useToast();

  const [stats, setStats] = useState<Stats | null>(socialPageCache?.stats || null);
  const [posts, setPosts] = useState<SocialPost[]>(socialPageCache?.posts || []);
  const [brands, setBrands] = useState<SocialBrand[]>(socialPageCache?.brands || []);
  const [isLoading, setIsLoading] = useState(!socialPageCache);

  useEffect(() => {
    if (client?.user_id) {
      localStorage.setItem("last_user_id", client.user_id);
    }
  }, [client?.user_id]);

  const [viewMode, setViewMode] = useState<"calendar" | "list" | "brands" | "analytics" | "accounts">("calendar");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createBrandOpen, setCreateBrandOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [detailPost, setDetailPost] = useState<SocialPost | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");

  const smService = assignedServices.find(s =>
    s.service_slug === "social-media-automation" ||
    s.service_slug === "social-media" ||
    s.service_slug === "socialium"
  );
  const smUnlocked = smService?.is_coming_soon_unlocked ?? false;


  const fetchAll = useCallback(async () => {
    if (!client) return;
    if (!socialPageCache) {
      setIsLoading(true);
    }
    await Promise.all([fetchStats(), fetchPosts(), fetchBrands()]);
    setIsLoading(false);
  }, [client]);

  async function fetchBrands() {
    if (!client) return;
    const { data } = await (supabase as any)
      .from("social_media_brands")
      .select("*")
      .eq("client_id", client.id)
      .order("name");
    const list = (data as SocialBrand[]) || [];
    setBrands(list);
    ensureSocialCache().brands = list;
    saveSocialCacheToStorage();
  }

  async function fetchStats() {
    if (!client) return;
    const monthStart = startOfMonth(new Date()).toISOString();

    const [scheduledRes, publishedRes, engagementRes, topRes] = await Promise.all([
      supabase.from("social_media_posts").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "scheduled"),
      supabase.from("social_media_posts").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "posted").gte("posted_at", monthStart),
      supabase.from("social_media_posts").select("engagement_stats").eq("client_id", client.id).eq("status", "posted").gte("posted_at", monthStart),
      supabase.from("social_media_posts").select("*").eq("client_id", client.id).eq("status", "posted").order("posted_at", { ascending: false }).limit(1),
    ]);

    let totalEng = 0;
    engagementRes.data?.forEach(p => {
      const s = p.engagement_stats as any;
      if (s) {
        totalEng += (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0);
      }
    });

    // Find top post by engagement
    let topPost: SocialPost | null = null;
    if (topRes.data && topRes.data.length > 0) {
      topPost = topRes.data[0] as SocialPost;
    }

    const computedStats = {
      scheduled: scheduledRes.count || 0,
      published: publishedRes.count || 0,
      totalEngagement: totalEng,
      topPost,
    };
    setStats(computedStats);
    ensureSocialCache().stats = computedStats;
    saveSocialCacheToStorage();
  }

  async function fetchPosts() {
    if (!client) return;
    const { data } = await supabase
      .from("social_media_posts")
      .select("*")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const postList = (data as SocialPost[]) || [];
    setPosts(postList);
    ensureSocialCache().posts = postList;
    saveSocialCacheToStorage();
  }

  useEffect(() => {
    if (!client || contextLoading || !smService) return;
    fetchAll();
  }, [client, contextLoading, smService]);

  if (contextLoading || isLoading) return <LoadingSkeleton />;
  if (!smService) return <Navigate to="/client" replace />;

  const formatEngagement = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="relative space-y-6">
      {isComingSoon("social-media", smUnlocked) && (
        <ComingSoonOverlay
          title="Socialium"
          description="Manage and schedule posts across all platforms in one central hub."
          features={[
            "Multi-Platform Publishing",
            "AI-Powered Content Generation",
            "Advanced Audience Analytics",
            "Unified Social Media Calendar"
          ]}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Socialium</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and schedule posts across all platforms</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setCreateBrandOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-1" /> Create Brand
          </Button>
          <Button size="sm" onClick={() => { setEditingPost(null); setCreateModalOpen(true); }}>
            <PlusCircle className="h-4 w-4 mr-1" /> Create Post
          </Button>
        </div>
      </div>

      {/* Connected Platforms */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {PLATFORMS.map(p => (
          <Card key={p.key} className="min-w-[160px] shrink-0">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <p.icon className="h-8 w-8" style={{ color: p.color }} />
              <div>
                <p className="text-sm font-medium text-foreground">{p.label}</p>
                <div className="flex flex-col gap-1 mt-0.5">
                  <Badge variant="outline" className="text-[10px] w-fit">Not Connected</Badge>
                  <Button variant="link" size="sm" className="h-auto p-0 text-[10px] justify-start text-primary hover:no-underline" onClick={() => setViewMode("accounts")}>Connect Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={<Calendar className="h-5 w-5" />} color="#3b82f6" label="Scheduled" value={stats?.scheduled ?? 0} sub="Upcoming posts" />
        <StatsCard icon={<CheckCircle className="h-5 w-5" />} color="#22c55e" label="Published" value={stats?.published ?? 0} sub="This month" />
        <StatsCard icon={<Heart className="h-5 w-5" />} color="#ef4444" label="Engagement" value={formatEngagement(stats?.totalEngagement ?? 0)} sub="Likes, comments, shares" />
        <StatsCard icon={<TrendingUp className="h-5 w-5" />} color="#f59e0b" label="Top Post" value={stats?.topPost ? "View →" : "—"} sub={stats?.topPost?.content?.slice(0, 30) || "No posts yet"} onClick={stats?.topPost ? () => setDetailPost(stats.topPost) : undefined} />
      </div>

      {/* View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "calendar" ? "default" : "outline"} size="sm" onClick={() => setViewMode("calendar")}><Calendar className="h-4 w-4 mr-1" /> Calendar</Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}><List className="h-4 w-4 mr-1" /> List</Button>
          <Button variant={viewMode === "accounts" ? "default" : "outline"} size="sm" onClick={() => setViewMode("accounts")}><Globe className="h-4 w-4 mr-1" /> Accounts</Button>
          <Button variant={viewMode === "brands" ? "default" : "outline"} size="sm" onClick={() => setViewMode("brands")}><Briefcase className="h-4 w-4 mr-1" /> Brands</Button>
          <Button variant={viewMode === "analytics" ? "default" : "outline"} size="sm" onClick={() => setViewMode("analytics")}><TrendingUp className="h-4 w-4 mr-1" /> Analytics</Button>
        </div>

        {viewMode === "analytics" && brands.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Filter by Brand:</Label>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {viewMode === "calendar" && <CalendarView posts={posts} month={calendarMonth} setMonth={setCalendarMonth} onDayClick={(day) => { }} onPostClick={setDetailPost} />}
      {viewMode === "list" && <ListView posts={posts} onEdit={p => { setEditingPost(p); setCreateModalOpen(true); }} onView={setDetailPost} onDelete={async (id) => { await supabase.from("social_media_posts").delete().eq("id", id); fetchPosts(); fetchStats(); }} />}
      {viewMode === "brands" && <BrandsView brands={brands} posts={posts} onRefresh={fetchBrands} onDelete={async (id) => { await supabase.from("social_media_brands").delete().eq("id", id); fetchBrands(); }} />}
      {viewMode === "analytics" && <AnalyticsView posts={selectedBrandId === "all" ? posts : posts.filter(p => p.brand_id === selectedBrandId)} brands={brands} selectedBrandId={selectedBrandId} />}
      {viewMode === "accounts" && <AccountsView />}

      {/* Empty State */}
      {posts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-5 mb-4"><Globe className="h-10 w-10 text-muted-foreground" /></div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Start building your social media presence</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">Create and schedule posts across all your platforms</p>
            <Button onClick={() => setCreateModalOpen(true)}><PlusCircle className="h-4 w-4 mr-2" /> Create First Post</Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <CreatePostModal open={createModalOpen} onOpenChange={setCreateModalOpen} clientId={client?.id || ""} brands={brands} existingPost={editingPost} onSaved={() => { fetchPosts(); fetchStats(); setEditingPost(null); }} />
      <CreateBrandModal open={createBrandOpen} onOpenChange={setCreateBrandOpen} clientId={client?.id || ""} onSaved={fetchBrands} />
      <PostDetailModal post={detailPost} onClose={() => setDetailPost(null)} onEdit={p => { setDetailPost(null); setEditingPost(p); setCreateModalOpen(true); }} />
    </div>
  );
}

/* ─── Stats Card ─── */
function StatsCard({ icon, color, label, value, sub, onClick }: { icon: React.ReactNode; color: string; label: string; value: string | number; sub: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""} onClick={onClick}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ backgroundColor: `${color}15` }}><div style={{ color }}>{icon}</div></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Calendar View ─── */
function CalendarView({ posts, month, setMonth, onDayClick, onPostClick }: {
  posts: SocialPost[]; month: Date; setMonth: (d: Date) => void; onDayClick: (d: Date) => void; onPostClick: (p: SocialPost) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getPostsForDay = (day: Date) => posts.filter(p => {
    const d = p.scheduled_at || p.posted_at || p.created_at;
    return d && isSameDay(parseISO(d), day);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{format(month, "MMMM yyyy")}</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {days.map((day, i) => {
            const dayPosts = getPostsForDay(day);
            const inMonth = isSameMonth(day, month);
            return (
              <div
                key={i}
                className={`min-h-[80px] border rounded-md p-1 cursor-pointer hover:bg-muted/50 transition-colors ${!inMonth ? "opacity-40" : ""} ${isToday(day) ? "ring-2 ring-primary" : ""}`}
                onClick={() => onDayClick(day)}
              >
                <p className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map(p => (
                    <div
                      key={p.id}
                      className="text-[9px] rounded px-1 py-0.5 truncate cursor-pointer"
                      style={{ backgroundColor: getPlatformColor(p.platform) + "20", color: getPlatformColor(p.platform) }}
                      onClick={e => { e.stopPropagation(); onPostClick(p); }}
                    >
                      {getPlatformIcon(p.platform)} {p.content.slice(0, 20)}
                    </div>
                  ))}
                  {dayPosts.length > 3 && <p className="text-[9px] text-muted-foreground">+{dayPosts.length - 3} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── List View ─── */
function ListView({ posts, onEdit, onView, onDelete }: {
  posts: SocialPost[]; onEdit: (p: SocialPost) => void; onView: (p: SocialPost) => void; onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        {posts.length > 0 ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Content</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map(p => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => onView(p)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {p.media_urls && p.media_urls.length > 0 ? (
                            <div className="h-10 w-10 rounded overflow-hidden bg-muted shrink-0">
                              {p.post_type === "video" ? (
                                <video src={p.media_urls[0]} className="h-full w-full object-cover" />
                              ) : (
                                <img src={p.media_urls[0]} alt="" className="h-full w-full object-cover" />
                              )}
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded border border-dashed flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <p className="text-sm truncate max-w-[200px] font-medium">{p.content}</p>
                        </div>
                      </TableCell>
                      <TableCell><PlatformBadge platform={p.platform} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.posted_at ? format(parseISO(p.posted_at), "MMM d, h:mm a") : p.scheduled_at ? format(parseISO(p.scheduled_at), "MMM d, h:mm a") : "—"}</TableCell>
                      <TableCell><PostStatusBadge status={p.status} /></TableCell>
                      <TableCell>{p.status === "posted" ? <EngagementMini stats={p.engagement_stats} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onView(p); }}><Eye className="h-3 w-3 mr-2" /> View</DropdownMenuItem>
                            {(p.status === "draft" || p.status === "scheduled") && <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(p); }}><Edit className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>}
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit({ ...p, id: "" }); }}><Copy className="h-3 w-3 mr-2" /> Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); onDelete(p.id); }}><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 md:hidden">
              {posts.map(p => (
                <div key={p.id} className="rounded-lg border p-3 space-y-2 cursor-pointer" onClick={() => onView(p)}>
                  <div className="flex items-center justify-between">
                    <PlatformBadge platform={p.platform} />
                    <PostStatusBadge status={p.status} />
                  </div>
                  <div className="flex gap-3">
                    {p.media_urls && p.media_urls.length > 0 && (
                      <div className="h-12 w-12 rounded overflow-hidden bg-muted shrink-0">
                        <img src={p.media_urls[0]} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <p className="text-sm line-clamp-2 flex-1">{p.content}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {p.status === "posted" && <EngagementMini stats={p.engagement_stats} />}
                    <span>{p.posted_at || p.scheduled_at ? formatDistanceToNow(parseISO(p.posted_at || p.scheduled_at || ""), { addSuffix: true }) : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-10"><p className="text-sm text-muted-foreground">No posts yet</p></div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Analytics View ─── */
function AnalyticsView({ posts, brands, selectedBrandId }: { posts: SocialPost[]; brands: SocialBrand[]; selectedBrandId: string }) {
  const publishedPosts = posts.filter(p => p.status === "posted");
  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  // Posts by platform
  const platformCounts = PLATFORMS.map(pl => ({
    name: pl.label,
    count: publishedPosts.filter(p => p.platform === pl.key).length,
    fill: pl.color,
  }));

  // Engagement over time
  const engagementByDay = new Map<string, number>();
  publishedPosts.forEach(p => {
    if (!p.posted_at) return;
    const day = format(parseISO(p.posted_at), "MMM dd");
    const s = p.engagement_stats as any;
    const eng = s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0;
    engagementByDay.set(day, (engagementByDay.get(day) || 0) + eng);
  });
  const engagementData = Array.from(engagementByDay.entries()).map(([day, value]) => ({ day, engagement: value }));

  // Content performance
  const typePerf = POST_TYPES.map(t => {
    const typePosts = publishedPosts.filter(p => p.post_type === t.key);
    const totalEng = typePosts.reduce((sum, p) => {
      const s = p.engagement_stats as any;
      return sum + (s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0);
    }, 0);
    return { name: t.label, avg: typePosts.length > 0 ? Math.round(totalEng / typePosts.length) : 0 };
  });

  const totalEng = publishedPosts.reduce((sum, p) => {
    const s = p.engagement_stats as any;
    return sum + (s ? (parseInt(s.likes) || 0) + (parseInt(s.comments) || 0) + (parseInt(s.shares) || 0) : 0);
  }, 0);

  return (
    <div className="space-y-4">
      {selectedBrand && (
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {selectedBrand.logo_url ? <img src={selectedBrand.logo_url} className="h-6 w-6 object-contain" /> : <Briefcase className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <h3 className="text-lg font-bold">{selectedBrand.name} Analytics</h3>
            <p className="text-xs text-muted-foreground">{selectedBrand.description || "Performance overview for this brand"}</p>
          </div>
        </div>
      )}
      {/* Overview */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Total Published" value={publishedPosts.length} />
        <MiniStat label="Total Engagement" value={totalEng} />
        <MiniStat label="Avg per Post" value={publishedPosts.length > 0 ? Math.round(totalEng / publishedPosts.length) : 0} />
        <MiniStat label="Platforms Used" value={new Set(publishedPosts.map(p => p.platform)).size} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Posts by Platform</CardTitle></CardHeader>
          <CardContent>
            {platformCounts.some(p => p.count > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={platformCounts}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Posts">
                    {platformCounts.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Engagement Over Time</CardTitle></CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="engagement" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Content Type Performance (Avg Engagement)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typePerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

/* ─── Create/Edit Post Modal ─── */
function CreatePostModal({ open, onOpenChange, clientId, brands, existingPost, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; clientId: string; brands: SocialBrand[]; existingPost: SocialPost | null; onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = existingPost && existingPost.id;

  const [selectedBrandId, setSelectedBrandId] = useState<string>(existingPost?.brand_id || "");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(existingPost ? [existingPost.platform] : []);
  const [postType, setPostType] = useState(existingPost?.post_type || "text");
  const [content, setContent] = useState(existingPost?.content || "");
  const [hashtags, setHashtags] = useState(existingPost?.hashtags?.join(", ") || "");
  const [scheduleType, setScheduleType] = useState<"now" | "later" | "draft">(existingPost?.status === "draft" ? "draft" : existingPost?.scheduled_at ? "later" : "now");
  const [scheduledAt, setScheduledAt] = useState(existingPost?.scheduled_at ? format(parseISO(existingPost.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(existingPost?.media_urls || []);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingIdx === null) return;

    setSaving(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${clientId}/${Date.now()}-${uploadingIdx}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("social-media-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("social-media-assets")
        .getPublicUrl(filePath);

      const newUrls = [...mediaUrls];
      newUrls[uploadingIdx] = urlData.publicUrl;
      setMediaUrls(newUrls);
      toast({ title: "Upload successful", description: "Media has been uploaded." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setUploadingIdx(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (existingPost) {
      setSelectedBrandId(existingPost.brand_id || "");
      setSelectedPlatforms([existingPost.platform]);
      setPostType(existingPost.post_type || "text");
      setContent(existingPost.content);
      setHashtags(existingPost.hashtags?.join(", ") || "");
      setScheduleType(existingPost.status === "draft" ? "draft" : existingPost.scheduled_at ? "later" : "now");
      setScheduledAt(existingPost.scheduled_at ? format(parseISO(existingPost.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
      setMediaUrls(existingPost.media_urls || []);
    } else {
      setSelectedBrandId("");
      setSelectedPlatforms([]);
      setPostType("text");
      setContent("");
      setHashtags("");
      setScheduleType("now");
      setScheduledAt("");
      setMediaUrls([]);
    }
  }, [existingPost, open]);

  const togglePlatform = (key: string) => {
    setSelectedPlatforms(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  const charWarnings = selectedPlatforms.filter(p => content.length > (CHAR_LIMITS[p] || Infinity));

  const handleSave = async () => {
    if (selectedPlatforms.length === 0 || !content.trim()) {
      toast({ title: "Missing fields", description: "Select at least one platform and enter content.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const hashtagsArr = hashtags.split(",").map(h => h.trim()).filter(Boolean);
    const status = scheduleType === "draft" ? "draft" : scheduleType === "later" ? "scheduled" : "scheduled";

    if (isEdit) {
      await supabase.from("social_media_posts").update({
        brand_id: selectedBrandId || null,
        platform: selectedPlatforms[0] as any,
        post_type: postType as any,
        content: content.trim(),
        hashtags: hashtagsArr,
        status: status as any,
        scheduled_at: scheduleType === "later" ? scheduledAt : null,
        media_urls: mediaUrls.filter(u => u.trim() !== ""),
      }).eq("id", existingPost!.id);
    } else {
      // Create one record per platform
      const records = selectedPlatforms.map(pl => ({
        client_id: clientId,
        brand_id: selectedBrandId || null,
        platform: pl as any,
        post_type: postType as any,
        content: content.trim(),
        hashtags: hashtagsArr,
        status: status as any,
        scheduled_at: scheduleType === "later" ? scheduledAt : null,
        media_urls: mediaUrls.filter(u => u.trim() !== ""),
      }));
      await supabase.from("social_media_posts").insert(records);
    }

    setSaving(false);
    toast({ title: isEdit ? "Post updated" : "Post created!", description: scheduleType === "draft" ? "Saved as draft." : scheduleType === "later" ? "Post scheduled." : "Post queued." });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Post" : "Create Post"}</DialogTitle>
          <DialogDescription>Compose and schedule your social media post</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Editor */}
          <div className="lg:col-span-3 space-y-4">
            {/* Brand Selection */}
            {brands.length > 0 && (
              <div>
                <Label className="text-xs font-semibold">Brand (Optional)</Label>
                <Select
                  value={selectedBrandId || "none"}
                  onValueChange={v => setSelectedBrandId(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Brand</SelectItem>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Platform Selection */}
            <div>
              <Label className="text-xs font-semibold">Platforms</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {PLATFORMS.map(p => (
                  <Button
                    key={p.key}
                    variant={selectedPlatforms.includes(p.key) ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => togglePlatform(p.key)}
                  >
                    <p.icon className="h-3 w-3 mr-1.5" style={{ color: selectedPlatforms.includes(p.key) ? "white" : p.color }} />
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Post Type */}
            <div>
              <Label className="text-xs font-semibold">Content Type</Label>
              <div className="flex gap-2 mt-1">
                {POST_TYPES.map(t => (
                  <Button key={t.key} variant={postType === t.key ? "default" : "outline"} size="sm" className="text-xs" onClick={() => {
                    setPostType(t.key);
                    if (t.key === "text") setMediaUrls([]);
                    else if (mediaUrls.length === 0) setMediaUrls([""]);
                  }}>
                    {t.icon} <span className="ml-1">{t.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Media URL Inputs */}
            {postType !== "text" && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold flex items-center gap-2">
                    {postType === "image" ? <Image className="h-3 w-3" /> : postType === "video" ? <Video className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
                    {postType === "carousel" ? "Carousel Items" : postType === "video" ? "Video URL" : "Image URL"}
                  </Label>
                  {postType === "carousel" && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setMediaUrls([...mediaUrls, ""])}>
                      <PlusCircle className="h-3 w-3 mr-1" /> Add Slide
                    </Button>
                  )}
                </div>

                {mediaUrls.map((url, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder={`https://example.com/${postType === "video" ? "video.mp4" : "image.jpg"}`}
                        value={url}
                        onChange={e => {
                          const newUrls = [...mediaUrls];
                          newUrls[idx] = e.target.value;
                          setMediaUrls(newUrls);
                        }}
                        className="h-8 text-xs bg-background pr-8"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setUploadingIdx(idx);
                          fileInputRef.current?.click();
                        }}
                        disabled={saving}
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                    {postType === "carousel" && mediaUrls.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setMediaUrls(mediaUrls.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={postType === "video" ? "video/*" : "image/*"}
                  onChange={handleFileUpload}
                />
                <p className="text-[10px] text-muted-foreground italic">Provide direct URLs to your media hosted on a CDN or cloud storage.</p>
              </div>
            )}

            {/* Content */}
            <div>
              <Label className="text-xs font-semibold">Content</Label>
              <Textarea placeholder="What do you want to share?" value={content} onChange={e => setContent(e.target.value)} rows={6} className="mt-1" />
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedPlatforms.map(p => {
                  const limit = CHAR_LIMITS[p] || 0;
                  const over = content.length > limit;
                  return (
                    <span key={p} className={`text-[10px] ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      {getPlatformIcon(p)} {content.length}/{limit}
                    </span>
                  );
                })}
              </div>
              {charWarnings.length > 0 && <p className="text-[10px] text-destructive mt-1">⚠️ Content exceeds limit for: {charWarnings.join(", ")}</p>}
            </div>

            {/* Hashtags */}
            <div>
              <Label className="text-xs font-semibold">Hashtags</Label>
              <Input placeholder="#marketing, #business, #ai" value={hashtags} onChange={e => setHashtags(e.target.value)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Comma-separated</p>
            </div>

            {/* Schedule */}
            <div>
              <Label className="text-xs font-semibold">Publish</Label>
              <div className="flex gap-2 mt-1">
                <Button variant={scheduleType === "now" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("now")}>Post Now</Button>
                <Button variant={scheduleType === "later" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("later")}>Schedule</Button>
                <Button variant={scheduleType === "draft" ? "default" : "outline"} size="sm" onClick={() => setScheduleType("draft")}>Save Draft</Button>
              </div>
              {scheduleType === "later" && <Input type="datetime-local" className="mt-2" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />}
            </div>
          </div>

          {/* Right: Preview */}
          <div className="lg:col-span-2 space-y-4">
            <Label className="text-xs font-semibold">Preview</Label>
            {content ? (
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">U</div>
                  <div>
                    <p className="text-xs font-semibold">Your Page</p>
                    <p className="text-[10px] text-muted-foreground">{scheduleType === "now" ? "Just now" : scheduleType === "later" && scheduledAt ? format(new Date(scheduledAt), "MMM d, h:mm a") : "Draft"}</p>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{content}</p>
                {hashtags && (
                  <p className="text-xs text-primary">{hashtags.split(",").map(h => h.trim()).filter(Boolean).map(h => h.startsWith("#") ? h : `#${h}`).join(" ")}</p>
                )}

                {mediaUrls.filter(u => u.trim() !== "").length > 0 && (
                  <div className={`grid gap-2 mt-3 ${mediaUrls.filter(u => u.trim() !== "").length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {mediaUrls.filter(u => u.trim() !== "").map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-md overflow-hidden bg-muted group">
                        {postType === "video" ? (
                          <video src={url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={url} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={(e) => {
                            e.stopPropagation();
                            setMediaUrls(mediaUrls.filter((_, i) => i !== idx));
                          }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <div className="flex justify-around text-xs text-muted-foreground">
                  <span>👍 Like</span>
                  <span>💬 Comment</span>
                  <span>🔄 Share</span>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-8 text-center border-dashed">
                <p className="text-xs text-muted-foreground">Your post preview will appear here</p>
              </div>
            )}

            {selectedPlatforms.length > 1 && (
              <p className="text-[10px] text-muted-foreground">📌 {selectedPlatforms.length} platforms selected — one post will be created per platform</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || selectedPlatforms.length === 0 || !content.trim()} onClick={handleSave}>
            {saving ? "Saving..." : scheduleType === "draft" ? "Save Draft" : scheduleType === "later" ? "Schedule Post" : "Publish Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Post Detail Modal ─── */
function PostDetailModal({ post, onClose, onEdit }: { post: SocialPost | null; onClose: () => void; onEdit: (p: SocialPost) => void }) {
  if (!post) return null;

  const eng = post.engagement_stats as any;
  const likes = eng ? parseInt(eng.likes) || 0 : 0;
  const comments = eng ? parseInt(eng.comments) || 0 : 0;
  const shares = eng ? parseInt(eng.shares) || 0 : 0;
  const reach = eng ? parseInt(eng.reach) || 0 : 0;

  return (
    <Dialog open={!!post} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformBadge platform={post.platform} />
            <PostStatusBadge status={post.status} />
          </DialogTitle>
          <DialogDescription>
            {post.posted_at ? `Posted ${formatDistanceToNow(parseISO(post.posted_at), { addSuffix: true })}` :
              post.scheduled_at ? `Scheduled for ${format(parseISO(post.scheduled_at), "PPp")}` :
                `Created ${formatDistanceToNow(parseISO(post.created_at), { addSuffix: true })}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {post.media_urls && post.media_urls.length > 0 && (
            <div className={`grid gap-2 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {post.media_urls.map((url, idx) => (
                <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                  {post.post_type === "video" ? (
                    <video src={url} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-contain" />
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.hashtags.map((h, i) => <Badge key={i} variant="secondary" className="text-[10px]">#{h}</Badge>)}
            </div>
          )}

          {post.status === "posted" && (
            <div>
              <Label className="text-xs font-semibold">Engagement</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{likes}</p><p className="text-[10px] text-muted-foreground">Likes</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{comments}</p><p className="text-[10px] text-muted-foreground">Comments</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{shares}</p><p className="text-[10px] text-muted-foreground">Shares</p></div>
                <div className="text-center border rounded-md p-2"><p className="text-lg font-bold">{reach}</p><p className="text-[10px] text-muted-foreground">Reach</p></div>
              </div>
            </div>
          )}

          {post.status === "failed" && post.error_message && (
            <div className="border border-destructive/30 rounded-md p-3 bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1"><AlertCircle className="h-4 w-4" /> Failed</div>
              <p className="text-xs text-muted-foreground">{post.error_message}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {(post.status === "draft" || post.status === "scheduled") && (
            <Button variant="outline" onClick={() => onEdit(post)}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Brands View ─── */
function BrandsView({ brands, posts, onRefresh, onDelete }: { brands: SocialBrand[]; posts: SocialPost[]; onRefresh: () => void; onDelete: (id: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {brands.map(brand => {
        const brandPosts = posts.filter(p => p.brand_id === brand.id);
        const publishedCount = brandPosts.filter(p => p.status === "posted").length;
        const scheduledCount = brandPosts.filter(p => p.status === "scheduled").length;

        return (
          <Card key={brand.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {brand.logo_url ? <img src={brand.logo_url} className="h-6 w-6 object-contain" /> : <Briefcase className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <CardTitle className="text-base">{brand.name}</CardTitle>
                    <p className="text-[10px] text-muted-foreground">{brand.created_at ? format(parseISO(brand.created_at), "MMM d, yyyy") : "Just now"}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(brand.id)}><Trash2 className="h-3 w-3 mr-2" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">{brand.description || "No description provided."}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{publishedCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Published</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2 text-center">
                  <p className="text-lg font-bold">{scheduledCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {brands.length === 0 && (
        <div className="col-span-full text-center py-12 border rounded-lg border-dashed">
          <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
          <p className="text-sm text-muted-foreground">No brands created yet.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Create Brand Modal ─── */
function CreateBrandModal({ open, onOpenChange, clientId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; clientId: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("social_media_brands").insert({
      client_id: clientId,
      name: name.trim(),
      description: description.trim(),
      logo_url: logoUrl.trim() || null
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Brand Created", description: "Your new brand has been added." });
      setName("");
      setDescription("");
      setLogoUrl("");
      onOpenChange(false);
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Brand</DialogTitle>
          <DialogDescription>Add a new brand to manage its social presence.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Brand Name</Label>
            <Input id="name" placeholder="e.g. Acme Corp" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description (Optional)</Label>
            <Textarea id="desc" placeholder="Briefly describe the brand" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL (Optional)</Label>
            <Input id="logo" placeholder="https://example.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || !name.trim()} onClick={handleSave}>
            {saving ? "Creating..." : "Create Brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Helpers ─── */
function getPlatformColor(platform: string): string {
  return PLATFORMS.find(p => p.key === platform)?.color || "#666";
}

function getPlatformIcon(platform: string) {
  const p = PLATFORMS.find(pl => pl.key === platform);
  if (!p) return <FileText className="h-4 w-4" />;
  return <p.icon className="h-4 w-4" style={{ color: p.color }} />;
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = PLATFORMS.find(pl => pl.key === platform);
  return (
    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 h-5" style={{ borderColor: p?.color + "40", color: p?.color }}>
      {p ? <p.icon className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
      {p?.label || platform}
    </Badge>
  );
}

function PostStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Draft", variant: "secondary" },
    scheduled: { label: "Scheduled", variant: "outline" },
    publishing: { label: "Publishing", variant: "default" },
    posted: { label: "Posted", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant} className={status === "publishing" ? "animate-pulse" : ""}>{info.label}</Badge>;
}

function EngagementMini({ stats }: { stats: any }) {
  if (!stats) return <span className="text-xs text-muted-foreground">—</span>;
  const likes = parseInt(stats.likes) || 0;
  const comments = parseInt(stats.comments) || 0;
  const shares = parseInt(stats.shares) || 0;
  return <span className="text-xs text-muted-foreground">👍{likes} 💬{comments} 🔄{shares}</span>;
}

/* ─── Loading ─── */
function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between"><Skeleton className="h-8 w-56" /><Skeleton className="h-9 w-36" /></div>
      <div className="flex gap-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-40" />)}</div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );
}

/* ─── Accounts View ─── */
function AccountsView() {
  const [connectingPlatform, setConnectingPlatform] = useState<typeof PLATFORMS[0] | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Media Accounts</CardTitle>
          <CardDescription>Connect and manage the social media accounts you want to post to.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {PLATFORMS.map(p => (
              <div key={p.key} className="flex items-center justify-between p-5 border rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-background border flex items-center justify-center shadow-sm">
                    <p.icon className="h-7 w-7" style={{ color: p.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-lg group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                  onClick={() => setConnectingPlatform(p)}
                >
                  Connect
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConnectPlatformModal
        platform={connectingPlatform}
        onClose={() => setConnectingPlatform(null)}
      />
    </>
  );
}

/* ─── Connect Platform Modal ─── */
function ConnectPlatformModal({ platform, onClose }: { platform: typeof PLATFORMS[0] | null, onClose: () => void }) {
  if (!platform) return null;

  return (
    <Dialog open={!!platform} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <platform.icon className="h-5 w-5" style={{ color: platform.color }} />
            Connect {platform.label}
          </DialogTitle>
          <DialogDescription>
            Authorize Socialium to manage your {platform.label} presence.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-10 space-y-8">
          <div className="flex items-center justify-center w-full">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                <Globe className="h-10 w-10 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full border-2 border-background animate-pulse" />
            </div>

            <div className="flex items-center px-4">
              <div className="h-[1px] w-12 bg-gradient-to-r from-primary/50 to-transparent relative">
                <div className="absolute top-1/2 left-0 h-1 w-1 bg-primary rounded-full -translate-y-1/2 animate-[ping_2s_infinite]" />
              </div>
              <div className="mx-2 p-1 rounded-full bg-muted border">
                <PlusCircle className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-border" />
            </div>

            <div className="h-20 w-20 rounded-2xl bg-muted/30 border-2 border-dashed flex items-center justify-center">
              <platform.icon className="h-10 w-10 opacity-50" style={{ color: platform.color }} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h4 className="text-sm font-semibold">Permission Request</h4>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              By continuing, you'll be redirected to {platform.label} to securely authorize Socialium to create and manage posts.
            </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" onClick={onClose} className="text-xs">Cancel</Button>
          <Button
            className="rounded-lg px-6 font-semibold shadow-lg transition-transform active:scale-95"
            style={{ backgroundColor: platform.color, color: 'white' }}
            onClick={() => {
              window.open("#", "_blank");
              onClose();
            }}
          >
            Authenticate with {platform.label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
