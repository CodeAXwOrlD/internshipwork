import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useClient } from "@/contexts/ClientContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import {
  User, Lock, Bell, Shield, Building2, Eye, EyeOff, Check, X, Mail, Phone,
  Globe, Download, Trash2, MessageSquare, ArrowUpRight, Send, AlertTriangle,
  CheckCircle, ExternalLink,
} from "lucide-react";

/* ─── helpers ─── */
const INDUSTRIES = [
  "Technology", "Healthcare", "Retail", "Finance", "Education",
  "Manufacturing", "Real Estate", "Hospitality", "Media", "Other",
];
const COMPANY_SIZES: Array<"1-10" | "11-50" | "51-200" | "201-500" | "500+"> = [
  "1-10", "11-50", "51-200", "201-500", "500+",
];

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", pct: 25, color: "bg-destructive" };
  if (score <= 2) return { label: "Fair", pct: 50, color: "bg-yellow-500" };
  if (score <= 3) return { label: "Good", pct: 75, color: "bg-blue-500" };
  return { label: "Strong", pct: 100, color: "bg-green-500" };
}

/* ─── default notification prefs ─── */
const defaultNotifPrefs = {
  email: {
    usage_80: true, usage_100: true, daily_usage: false, weekly_report: false,
    campaign_completed: true, campaign_failed: true, campaign_reminder: false,
    new_lead: true, high_value_lead: true, daily_lead_summary: false,
    invoice_generated: true, payment_reminder: true, payment_received: true,
    new_features: true, maintenance: true, tips: false,
  },
  in_app: { all: true, realtime_campaigns: true, sound: true },
  alternative_email: "",
};

export default function ClientSettingsPage() {
  const { client, admin, assignedServices, refetchClient, isLoading: clientLoading } = useClient();
  const { profile, user, logout } = useAuth();

  /* ─── Profile tab state ─── */
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [website, setWebsite] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  /* ─── Security tab state ─── */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  /* ─── Notification tab state ─── */
  const [notifPrefs, setNotifPrefs] = useState(defaultNotifPrefs);
  const [notifDirty, setNotifDirty] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  /* ─── Privacy tab state ─── */
  const [rawAccess, setRawAccess] = useState(false);
  const [rawAccessDialog, setRawAccessDialog] = useState<boolean | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  /* ─── Admin tab state ─── */
  const [adminProfile, setAdminProfile] = useState<{ full_name: string | null; email: string; phone: string | null } | null>(null);

  /* ─── init from context ─── */
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  useEffect(() => {
    if (client) {
      setCompanyName(client.company_name || "");
      setIndustry(client.industry || "");
      setCompanySize(client.company_size || "");
      setRawAccess(!!client.allow_admin_raw_access);
      // website and notification_preferences come from DB but aren't in context type
      // fetch them directly
      fetchExtendedClient();
    }
  }, [client]);

  const fetchExtendedClient = async () => {
    if (!client) return;
    const { data } = await supabase
      .from("clients")
      .select("website, notification_preferences")
      .eq("id", client.id)
      .maybeSingle();
    if (data) {
      setWebsite((data as any).website || "");
      const prefs = (data as any).notification_preferences;
      if (prefs && typeof prefs === "object" && Object.keys(prefs).length > 0) {
        setNotifPrefs({ ...defaultNotifPrefs, ...prefs });
      }
    }
  };

  useEffect(() => {
    if (!client) return;
    // fetch admin profile info
    (async () => {
      const { data: adminRow } = await supabase
        .from("admins")
        .select("user_id")
        .eq("id", client.admin_id)
        .maybeSingle();
      if (adminRow) {
        const { data: ap } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", adminRow.user_id)
          .maybeSingle();
        if (ap) setAdminProfile(ap);
      }
    })();
  }, [client]);

  /* ─── Profile save ─── */
  const saveProfile = async () => {
    if (!profile || !client || !user) return;
    setProfileSaving(true);
    const [r1, r2] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim() }).eq("user_id", user.id),
      supabase.from("clients").update({
        company_name: companyName.trim(),
        industry: industry || null,
        company_size: (companySize || null) as any,
        website: website.trim() || null,
      } as any).eq("id", client.id),
    ]);
    setProfileSaving(false);
    if (r1.error || r2.error) {
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
    } else {
      toast({ title: "Profile updated", description: "Your changes have been saved" });
      setProfileDirty(false);
      refetchClient();
    }
  };

  /* ─── Password update ─── */
  const updatePassword = async () => {
    if (newPw !== confirmPw) {
      toast({ title: "Mismatch", description: "Passwords don't match", variant: "destructive" });
      return;
    }
    const strength = passwordStrength(newPw);
    if (strength.pct < 50) {
      toast({ title: "Weak password", description: "Please use a stronger password", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "Your password has been changed" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    }
  };

  /* ─── Notification prefs save ─── */
  const saveNotifications = async () => {
    if (!client) return;
    setNotifSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ notification_preferences: notifPrefs } as any)
      .eq("id", client.id);
    setNotifSaving(false);
    if (error) {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Notification preferences updated" });
      setNotifDirty(false);
    }
  };

  /* ─── Raw access toggle ─── */
  const confirmRawAccess = async () => {
    if (rawAccessDialog === null || !client) return;
    const newVal = rawAccessDialog;
    const { error } = await supabase.from("clients").update({ allow_admin_raw_access: newVal } as any).eq("id", client.id);
    if (!error) {
      setRawAccess(newVal);
      // notify admin
      await supabase.from("notifications").insert({
        user_id: client.admin_id,
        title: `Data Access ${newVal ? "Granted" : "Revoked"}`,
        message: `Client ${client.company_name} has ${newVal ? "granted" : "revoked"} access to raw data`,
        type: "info" as const,
      });
      toast({ title: newVal ? "Access granted" : "Access revoked" });
    }
    setRawAccessDialog(null);
  };

  /* ─── Account deletion ─── */
  const handleDeleteAccount = async () => {
    if (!client || !user) return;
    await supabase.from("clients").update({ is_active: false }).eq("id", client.id);
    await supabase.from("profiles").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("notifications").insert({
      user_id: client.admin_id,
      title: "Client Account Deactivated",
      message: `Client ${client.company_name} has deactivated their account`,
      type: "warning" as const,
    });
    toast({ title: "Account deactivated" });
    await logout();
  };

  const setNotifPref = (section: "email" | "in_app", key: string, val: boolean) => {
    setNotifPrefs(p => ({ ...p, [section]: { ...p[section], [key]: val } }));
    setNotifDirty(true);
  };

  const pwStrength = passwordStrength(newPw);
  const pwMatch = confirmPw.length > 0 && newPw === confirmPw;

  if (clientLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!client || !profile) {
    return <div className="text-center py-20 text-muted-foreground">Unable to load settings.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="profile" className="text-xs sm:text-sm"><User className="h-3 w-3 mr-1 hidden sm:inline" />Profile</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm"><Lock className="h-3 w-3 mr-1 hidden sm:inline" />Security</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs sm:text-sm"><Bell className="h-3 w-3 mr-1 hidden sm:inline" />Notifications</TabsTrigger>
          <TabsTrigger value="privacy" className="text-xs sm:text-sm"><Shield className="h-3 w-3 mr-1 hidden sm:inline" />Privacy</TabsTrigger>
          <TabsTrigger value="admin" className="text-xs sm:text-sm"><Building2 className="h-3 w-3 mr-1 hidden sm:inline" />Admin</TabsTrigger>
        </TabsList>

        {/* ═══ PROFILE TAB ═══ */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={e => { setFullName(e.target.value); setProfileDirty(true); }} />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input value={profile.email} disabled />
                  <p className="text-xs text-muted-foreground">Cannot change email. Contact support if needed.</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input value={phone} onChange={e => { setPhone(e.target.value); setProfileDirty(true); }} placeholder="+91 9876543210" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={companyName} onChange={e => { setCompanyName(e.target.value); setProfileDirty(true); }} />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industry} onValueChange={v => { setIndustry(v); setProfileDirty(true); }}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company Size</Label>
                  <Select value={companySize} onValueChange={v => { setCompanySize(v); setProfileDirty(true); }}>
                    <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company Website</Label>
                  <Input value={website} onChange={e => { setWebsite(e.target.value); setProfileDirty(true); }} placeholder="https://yourcompany.com" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveProfile} disabled={!profileDirty || profileSaving}>
              {profileSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </TabsContent>

        {/* ═══ SECURITY TAB ═══ */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showCurrentPw ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
                  <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNewPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} />
                  <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPw && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pwStrength.color}`} style={{ width: `${pwStrength.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pwStrength.label}</span>
                    </div>
                    <ul className="text-xs space-y-1">
                      <li className={`flex items-center gap-1 ${newPw.length >= 8 ? "text-green-600" : "text-muted-foreground"}`}>
                        {newPw.length >= 8 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} At least 8 characters
                      </li>
                      <li className={`flex items-center gap-1 ${/[A-Z]/.test(newPw) ? "text-green-600" : "text-muted-foreground"}`}>
                        {/[A-Z]/.test(newPw) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} One uppercase letter
                      </li>
                      <li className={`flex items-center gap-1 ${/[0-9]/.test(newPw) ? "text-green-600" : "text-muted-foreground"}`}>
                        {/[0-9]/.test(newPw) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} One number
                      </li>
                      <li className={`flex items-center gap-1 ${/[^A-Za-z0-9]/.test(newPw) ? "text-green-600" : "text-muted-foreground"}`}>
                        {/[^A-Za-z0-9]/.test(newPw) ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} One special character
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <div className="relative">
                  <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                  {confirmPw && (
                    <span className="absolute right-3 top-2.5">
                      {pwMatch ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-destructive" />}
                    </span>
                  )}
                </div>
              </div>
              <Button onClick={updatePassword} disabled={!currentPw || !newPw || !pwMatch || pwSaving}>
                {pwSaving ? "Updating..." : "Update Password"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary">Not Available</Badge>
                  <p className="text-xs text-muted-foreground mt-1">2FA will be available in a future update</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ NOTIFICATIONS TAB ═══ */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Choose which emails you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <NotifSection title="Service Usage" items={[
                { key: "usage_80", label: "Usage reaches 80% of limit" },
                { key: "usage_100", label: "Usage reaches 100% of limit" },
                { key: "daily_usage", label: "Daily usage summary" },
                { key: "weekly_report", label: "Weekly usage report" },
              ]} prefs={notifPrefs.email} onChange={(k, v) => setNotifPref("email", k, v)} />

              <Separator />

              <NotifSection title="Campaigns" items={[
                { key: "campaign_completed", label: "Campaign completed" },
                { key: "campaign_failed", label: "Campaign failed" },
                { key: "campaign_reminder", label: "Campaign scheduled reminder" },
              ]} prefs={notifPrefs.email} onChange={(k, v) => setNotifPref("email", k, v)} />

              <Separator />

              <NotifSection title="Leads" items={[
                { key: "new_lead", label: "New lead captured" },
                { key: "high_value_lead", label: "High-value lead identified" },
                { key: "daily_lead_summary", label: "Daily lead summary" },
              ]} prefs={notifPrefs.email} onChange={(k, v) => setNotifPref("email", k, v)} />

              <Separator />

              <NotifSection title="Billing" items={[
                { key: "invoice_generated", label: "New invoice generated" },
                { key: "payment_reminder", label: "Payment reminder" },
                { key: "payment_received", label: "Payment received confirmation" },
              ]} prefs={notifPrefs.email} onChange={(k, v) => setNotifPref("email", k, v)} />

              <Separator />

              <NotifSection title="Platform Updates" items={[
                { key: "new_features", label: "New features announcement" },
                { key: "maintenance", label: "Service maintenance notifications" },
                { key: "tips", label: "Tips and best practices" },
              ]} prefs={notifPrefs.email} onChange={(k, v) => setNotifPref("email", k, v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>In-App Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "all", label: "Show all email notifications in-app" },
                { key: "realtime_campaigns", label: "Show real-time campaign updates" },
                { key: "sound", label: "Play notification sound" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm">{item.label}</span>
                  <Switch
                    checked={!!(notifPrefs.in_app as any)[item.key]}
                    onCheckedChange={v => setNotifPref("in_app", item.key, v)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notification Delivery</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Primary Email</Label>
                <Input value={profile.email} disabled />
              </div>
              <div className="space-y-2">
                <Label>Alternative Email (optional)</Label>
                <Input
                  value={notifPrefs.alternative_email}
                  onChange={e => { setNotifPrefs(p => ({ ...p, alternative_email: e.target.value })); setNotifDirty(true); }}
                  placeholder="backup@company.com"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveNotifications} disabled={!notifDirty || notifSaving}>
              {notifSaving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </TabsContent>

        {/* ═══ DATA & PRIVACY TAB ═══ */}
        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Access Permissions</CardTitle>
              <CardDescription>
                Your admin ({admin?.company_name || "your admin"}) can view your usage statistics and service assignments.
                Control what additional data they can access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Grant {admin?.company_name || "admin"} access to raw data</p>
                  <ul className={`text-xs space-y-0.5 ${rawAccess ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    <li>• Call recordings & transcripts</li>
                    <li>• WhatsApp message content</li>
                    <li>• Lead details & campaign contacts</li>
                  </ul>
                  <p className="text-xs text-muted-foreground">This allows your admin to provide better support</p>
                </div>
                <Switch checked={rawAccess} onCheckedChange={v => setRawAccessDialog(v)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Your Data</CardTitle>
              <CardDescription>Download all your data in machine-readable format</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Includes: profile, usage history, call logs, messages, leads, and invoices.
              </p>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" /> Download My Data
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Call recordings: <strong className="text-foreground">90 days</strong></p>
              <p>• Message history: <strong className="text-foreground">1 year</strong></p>
              <p>• Lead data: <strong className="text-foreground">Indefinite</strong> (until you delete)</p>
            </CardContent>
          </Card>

        </TabsContent>

        {/* ═══ ADMIN ACCESS TAB ═══ */}
        <TabsContent value="admin" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Admin</CardTitle>
              <CardDescription>Information about the admin managing your services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                {admin?.logo_url ? (
                  <img src={admin.logo_url} alt="Admin logo" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{admin?.company_name || "—"}</p>
                  {adminProfile && (
                    <>
                      {adminProfile.full_name && <p className="text-sm text-muted-foreground">{adminProfile.full_name}</p>}
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <a href={`mailto:${adminProfile.email}`} className="text-primary hover:underline">{adminProfile.email}</a>
                      </p>
                      {adminProfile.phone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${adminProfile.phone}`} className="text-primary hover:underline">{adminProfile.phone}</a>
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Services Managed By Admin</CardTitle>
            </CardHeader>
            <CardContent>
              {assignedServices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No services assigned yet.</p>
              ) : (
                <div className="space-y-3">
                  {assignedServices.map(svc => {
                    const pct = svc.usage_limit > 0 ? Math.round((svc.usage_consumed / svc.usage_limit) * 100) : 0;
                    return (
                      <div key={svc.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm text-foreground">{svc.service_name}</p>
                          <p className="text-xs text-muted-foreground">{svc.service_category}</p>
                        </div>
                        <div className="w-32">
                          <Progress value={Math.min(pct, 100)} className="h-1.5" />
                          <p className="text-xs text-muted-foreground text-right mt-0.5">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Billing is managed by <strong className="text-foreground">{admin?.company_name}</strong></p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/client/usage">View Invoices <ArrowUpRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Raw Access Confirmation ─── */}
      <AlertDialog open={rawAccessDialog !== null} onOpenChange={() => setRawAccessDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rawAccessDialog ? "Grant data access?" : "Revoke data access?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {rawAccessDialog
                ? `This will allow ${admin?.company_name || "your admin"} to view your call recordings, messages, and lead details.`
                : `${admin?.company_name || "Your admin"} will no longer be able to see recordings and messages.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRawAccess}>
              {rawAccessDialog ? "Grant Access" : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Account Dialog ─── */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Deactivate Account</DialogTitle>
            <DialogDescription>
              This will deactivate your account. Type your company name <strong>{client.company_name}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type company name to confirm"
            value={deleteConfirmName}
            onChange={e => setDeleteConfirmName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== client.company_name}
              onClick={handleDeleteAccount}
            >
              Deactivate Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Notification Section Helper ─── */
function NotifSection({
  title, items, prefs, onChange,
}: {
  title: string;
  items: { key: string; label: string }[];
  prefs: Record<string, boolean>;
  onChange: (key: string, val: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      {items.map(item => (
        <div key={item.key} className="flex items-center space-x-3">
          <Checkbox
            checked={!!prefs[item.key]}
            onCheckedChange={v => onChange(item.key, !!v)}
          />
          <span className="text-sm text-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
