import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, AlertTriangle, ChevronDown, ChevronRight,
  Package, Info, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientCompanyName: string;
  onSuccess?: () => void;
};

type ServiceItem = {
  id: string;
  name: string;
  category: string;
  base_price: number;
  slug: string;
  existing_is_coming_soon_unlocked: boolean | null;
  base_pricing_model: string;
  description: string | null;
  admin_price: number | null;
  markup_percentage: number | null;
  has_admin_pricing: boolean;
  already_assigned: boolean;
  is_deactivated: boolean;
  existing_plan_id: string | null;
  existing_usage_limit: number | null;
  existing_usage_consumed: number | null;
  existing_reset_period: string | null;
  existing_is_active: boolean | null;
  plans: {
    id: string;
    plan_name: string;
    plan_tier: string | null;

    usage_limit: number | null;
    monthly_price: number | null;
    price_per_unit: number | null;
  }[];
};

type ServiceConfig = {
  selected: boolean;
  expanded: boolean;
  isComingSoonUnlocked: boolean;
  planId: string | null; // null = custom
  usageLimit: number;
  resetPeriod: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  voice: "Voice Services",
  messaging: "Messaging Services",
  social_media: "Social Media Services",
};

const CATEGORY_ORDER = ["voice", "messaging", "social_media"];

const UNIT_LABELS: Record<string, string> = {
  per_minute: "minute",
  per_call: "call",
  per_message: "message",
  monthly: "month",
};

export default function AssignServicesModal({ open, onOpenChange, clientId, clientCompanyName, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [configs, setConfigs] = useState<Record<string, ServiceConfig>>({});
  const [categoryOpen, setCategoryOpen] = useState<Record<string, boolean>>({ voice: true, messaging: true, social_media: true });
  const [successResult, setSuccessResult] = useState<{ count: number; names: string[] } | null>(null);
  const [unassignConfirm, setUnassignConfirm] = useState<{ serviceId: string; serviceName: string } | null>(null);

  // Fetch services with pricing and assignment status
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["assign-services", clientId],
    queryFn: async () => {
      const [servicesRes, pricingRes, plansRes, assignedRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).neq("slug", "ai-voice-receptionist").neq("slug", "voice-receptionist").order("category").order("name"),
        supabase.from("admin_pricing").select("service_id, custom_price_per_unit, markup_percentage"),
        supabase.from("service_plans").select("*").eq("is_active", true),
        supabase.from("client_services").select("service_id, plan_id, usage_limit, usage_consumed, reset_period, is_active, is_coming_soon_unlocked").eq("client_id", clientId),
      ]);

      const pricingMap = new Map(pricingRes.data?.map((p) => [p.service_id, p]) || []);
      const assignedMap = new Map(assignedRes.data?.map((a) => [a.service_id, a]) || []);
      const plansByService = new Map<string, typeof plansRes.data>();
      plansRes.data?.forEach((p) => {
        const list = plansByService.get(p.service_id) || [];
        list.push(p);
        plansByService.set(p.service_id, list);
      });

      return (servicesRes.data || []).map((s): ServiceItem => {
        const pricing = pricingMap.get(s.id);
        const assigned = assignedMap.get(s.id);
        const plans = (plansByService.get(s.id) || []).sort((a, b) => {
          const order = { basic: 1, standard: 2, premium: 3, enterprise: 4 };
          return (order[a.plan_tier as keyof typeof order] || 5) - (order[b.plan_tier as keyof typeof order] || 5);
        });
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          slug: s.slug,
          base_price: Number(s.base_price),
          base_pricing_model: s.base_pricing_model,
          description: s.description,
          admin_price: pricing ? Number(pricing.custom_price_per_unit) : null,
          markup_percentage: pricing ? Number(pricing.markup_percentage) : null,
          has_admin_pricing: !!pricing,
          already_assigned: !!assigned && assigned.is_active !== false,
          is_deactivated: !!assigned && assigned.is_active === false,
          existing_is_coming_soon_unlocked: assigned?.is_coming_soon_unlocked ?? null,
          existing_plan_id: assigned?.plan_id || null,
          existing_usage_limit: assigned?.usage_limit || null,
          existing_usage_consumed: assigned?.usage_consumed ?? null,
          existing_reset_period: assigned?.reset_period || null,
          existing_is_active: assigned?.is_active ?? null,
          plans,
        };
      });
    },
    enabled: open && !!clientId,
  });

  // Initialize configs when services load or modal opens
  useEffect(() => {
    if (open && services.length > 0 && Object.keys(configs).length === 0) {
      const initial: Record<string, ServiceConfig> = {};
      services.forEach((s) => {
        initial[s.id] = {
          selected: s.already_assigned,
          expanded: s.already_assigned,
          isComingSoonUnlocked: s.existing_is_coming_soon_unlocked ?? false,
          planId: s.existing_plan_id || (s.plans.length > 0 ? s.plans[0].id : null),
          usageLimit: s.existing_usage_limit || s.plans[0]?.usage_limit || 100,
          resetPeriod: s.existing_reset_period || "monthly",
        };
      });
      setConfigs(initial);
    }
  }, [services, open, configs]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setConfigs({});
      setSuccessResult(null);
      setCategoryOpen({ voice: true, messaging: true, social_media: true });
    }
  }, [open]);

  const updateConfig = (serviceId: string, patch: Partial<ServiceConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], ...patch },
    }));
  };

  const toggleService = (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service?.has_admin_pricing) return;
    const current = configs[serviceId];
    updateConfig(serviceId, {
      selected: !current.selected,
      expanded: !current.selected,
    });
  };

  // Select all that have pricing
  const selectAll = () => {
    const allPriced = services.filter((s) => s.has_admin_pricing);
    const allSelected = allPriced.every((s) => configs[s.id]?.selected);
    const next = { ...configs };
    allPriced.forEach((s) => {
      next[s.id] = { ...next[s.id], selected: !allSelected, expanded: !allSelected };
    });
    setConfigs(next);
  };

  // Grouped services
  const grouped = useMemo(() => {
    const groups: Record<string, ServiceItem[]> = {};
    services.forEach((s) => {
      (groups[s.category] ||= []).push(s);
    });
    return groups;
  }, [services]);

  // Summary calculations
  const summary = useMemo(() => {
    const selected = services.filter((s) => configs[s.id]?.selected && !s.already_assigned);
    const updated = services.filter((s) => configs[s.id]?.selected && s.already_assigned);
    let totalCost = 0;
    let totalProfit = 0;
    const items: { name: string; cost: number; unit: string }[] = [];

    [...selected, ...updated].forEach((s) => {
      const cfg = configs[s.id];
      if (!cfg || !s.admin_price) return;
      const isMonthlySub = s.base_pricing_model === "monthly";
      const cost = isMonthlySub ? s.admin_price : s.admin_price * cfg.usageLimit;
      const baseCost = isMonthlySub ? s.base_price : s.base_price * cfg.usageLimit;
      totalCost += cost;
      totalProfit += cost - baseCost;
      items.push({
        name: s.name,
        cost,
        unit: isMonthlySub ? "monthly" : `${cfg.usageLimit} ${UNIT_LABELS[s.base_pricing_model] || "units"}`,
      });
    });

    return {
      newCount: selected.length,
      updateCount: updated.length,
      totalCount: selected.length + updated.length,
      totalCost,
      totalProfit,
      items,
    };
  }, [services, configs]);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const toAssign = services.filter((s) => configs[s.id]?.selected);
      if (toAssign.length === 0) throw new Error("No services selected");

      // Get admin id
      const { data: adminData } = await supabase.rpc("get_admin_id_for_user");
      if (!adminData) throw new Error("Admin not found");

      for (const s of toAssign) {
        const cfg = configs[s.id];
        const isReactivation = s.is_deactivated;
        const upsertData: Record<string, unknown> = {
          client_id: clientId,
          service_id: s.id,
          plan_id: cfg.planId || null,
          is_active: true,
          usage_limit: cfg.usageLimit,
          is_coming_soon_unlocked: cfg.isComingSoonUnlocked,
          reset_period: cfg.resetPeriod as any,
          assigned_by: adminData,
          assigned_at: new Date().toISOString(),
        };
        // Only reset usage for brand-new assignments, not re-activations
        if (!isReactivation) {
          upsertData.usage_consumed = 0;
          upsertData.last_reset_at = new Date().toISOString();
        }
        const { error } = await supabase.from("client_services").upsert(
          upsertData as any,
          { onConflict: "client_id,service_id" }
        );
        if (error) throw error;
      }

      return { count: toAssign.length, names: toAssign.map((s) => s.name) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["assign-services", clientId] });
      setSuccessResult(data);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to assign services");
    },
  });

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase
        .from("client_services")
        .update({ is_active: false, is_coming_soon_unlocked: false })
        .eq("client_id", clientId)
        .eq("service_id", serviceId);
      if (error) throw error;
      return serviceId;
    },
    onSuccess: (serviceId) => {
      const name = services.find((s) => s.id === serviceId)?.name || "Service";
      toast.success(`${name} unassigned from ${clientCompanyName}`);
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      queryClient.invalidateQueries({ queryKey: ["assign-services", clientId] });
      // Reset all configs so they re-initialize from fresh query data
      setConfigs({});
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to unassign service");
    },
  });

  // Success view
  if (successResult) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Services Assigned Successfully!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {successResult.count} service{successResult.count > 1 ? "s have" : " has"} been assigned to <strong>{clientCompanyName}</strong>
            </p>
            <div className="space-y-2">
              {successResult.names.map((name) => (
                <div key={name} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-foreground">{name}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { onOpenChange(false); onSuccess?.(); }}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-3 sm:p-4 pb-0">
          <DialogTitle className="text-base sm:text-lg line-clamp-1">Assign Services — {clientCompanyName}</DialogTitle>
        </DialogHeader>

        {/* Select All */}
        <div className="px-3 sm:px-4 flex items-center gap-2">
          <Checkbox
            id="select-all-services"
            className="h-3.5 w-3.5"
            checked={services.filter((s) => s.has_admin_pricing).length > 0 &&
              services.filter((s) => s.has_admin_pricing).every((s) => configs[s.id]?.selected)}
            onCheckedChange={selectAll}
          />
          <Label htmlFor="select-all-services" className="text-xs cursor-pointer font-medium">Select all services</Label>
        </div>

        <Separator />

        {/* Services List */}
        <div className="flex-1 px-3 sm:px-4 overflow-y-auto min-h-0 py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped[cat];
                if (!items?.length) return null;
                return (
                  <Collapsible
                    key={cat}
                    open={categoryOpen[cat]}
                    onOpenChange={(v) => setCategoryOpen((p) => ({ ...p, [cat]: v }))}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1">
                      {categoryOpen[cat] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[cat] || cat}</span>
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {items.map((service) => {
                        const cfg = configs[service.id];
                        if (!cfg) return null;
                        const unit = UNIT_LABELS[service.base_pricing_model] || "unit";
                        const canSelect = service.has_admin_pricing;
                        const isExpanded = cfg.selected && cfg.expanded;

                        return (
                          <div key={service.id} className="border rounded-lg overflow-hidden">
                            {/* Collapsed row */}
                            <div
                              className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors ${!canSelect ? "opacity-60" : ""}`}
                              onClick={() => canSelect && toggleService(service.id)}
                            >
                              <Checkbox
                                checked={cfg.selected}
                                disabled={!canSelect}
                                onCheckedChange={() => canSelect && toggleService(service.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-foreground">{service.name}</span>
                                  {service.already_assigned && (
                                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">Assigned</Badge>
                                  )}
                                  {service.is_deactivated && (
                                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Deactivated</Badge>
                                  )}
                                </div>
                                {service.is_deactivated && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-muted-foreground">
                                      Previous usage: {service.existing_usage_consumed ?? 0}/{service.existing_usage_limit ?? 0}
                                    </p>
                                  </div>
                                )}
                                {service.already_assigned && (
                                  <div className="mt-1.5">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-[10px] sm:text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUnassignConfirm({ serviceId: service.id, serviceName: service.name });
                                      }}
                                      disabled={unassignMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Unassign
                                    </Button>
                                  </div>
                                )}
                                {canSelect ? (
                                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">₹{service.admin_price?.toFixed(2)} / {unit}</p>
                                ) : (
                                  <p className="text-[11px] sm:text-xs text-destructive flex items-center gap-1 mt-0.5">
                                    <AlertTriangle className="h-3 w-3" /> Set pricing first
                                  </p>
                                )}
                              </div>
                              {cfg.selected && (
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8 shrink-0 focus-visible:ring-0"
                                  onClick={(e) => { e.stopPropagation(); updateConfig(service.id, { expanded: !cfg.expanded }); }}
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>

                            {/* Expanded config */}
                            {isExpanded && (
                              <div className="border-t bg-muted/30 p-4 space-y-4">
                                {/* Plan selection */}
                                {service.plans.length > 0 && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Select Plan</Label>
                                    <RadioGroup
                                      value={cfg.planId || "custom"}
                                      onValueChange={(v) => {
                                        const plan = service.plans.find((p) => p.id === v);
                                        updateConfig(service.id, {
                                          planId: v === "custom" ? null : v,
                                          usageLimit: plan?.usage_limit || cfg.usageLimit,
                                        });
                                      }}
                                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                                    >
                                      {service.plans.map((plan) => (
                                        <div key={plan.id} className="flex items-center gap-2 rounded-md border p-2.5 bg-background">
                                          <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} />
                                          <div className="flex-1 min-w-0">
                                            <Label htmlFor={`plan-${plan.id}`} className="text-xs font-medium truncate block">
                                              {plan.plan_name}
                                              {plan.plan_tier && <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[9px] uppercase">{plan.plan_tier}</Badge>}
                                            </Label>
                                            <p className="text-[10px] text-muted-foreground">
                                              {plan.usage_limit ? `${plan.usage_limit} ${unit}s` : "Unlimited"}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-2 rounded-md border p-2.5 bg-background">
                                        <RadioGroupItem value="custom" id={`plan-${service.id}-custom`} />
                                        <Label htmlFor={`plan-${service.id}-custom`} className="text-xs font-medium">Custom Limits</Label>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                )}

                                {/* Usage limit */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-medium uppercase text-muted-foreground">Usage Limit</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={1000000}
                                      className="h-9"
                                      value={cfg.usageLimit}
                                      onChange={(e) => updateConfig(service.id, { usageLimit: Math.max(1, parseInt(e.target.value) || 1) })}
                                    />
                                    <p className="text-[10px] text-muted-foreground">{cfg.usageLimit} {unit}s / {cfg.resetPeriod}</p>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-medium uppercase text-muted-foreground">Reset Period</Label>
                                    <Select value={cfg.resetPeriod} onValueChange={(v) => updateConfig(service.id, { resetPeriod: v })}>
                                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="never">Never (Unlimited)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {/* Price summary */}
                                {/* Coming Soon Unlock toggle */}
                                {(service.slug === "social-media-automation" || service.slug === "social-media" || service.slug === "socialium" || service.slug === "voice-agent" || service.slug === "ai-voice-agent") && (
                                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">Unlock Coming Soon</p>
                                      <p className="text-[10px] text-muted-foreground">Remove Coming Soon restriction for this client</p>
                                    </div>
                                    <Checkbox
                                      checked={cfg.isComingSoonUnlocked}
                                      onCheckedChange={(v) => updateConfig(service.id, { isComingSoonUnlocked: !!v })}
                                    />
                                  </div>
                                )}

                                {/* Price summary */}
                                {service.admin_price && (
                                  <div className="rounded bg-muted p-3 text-xs space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Your price</span>
                                      <span className="text-foreground font-medium">₹{service.admin_price.toFixed(2)} per {unit}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Usage limit</span>
                                      <span className="text-foreground font-medium">{cfg.usageLimit} {unit}s</span>
                                    </div>
                                    {service.base_pricing_model !== "monthly" && (
                                      <div className="flex justify-between border-t pt-1">
                                        <span className="text-muted-foreground">Est. monthly cost</span>
                                        <span className="text-foreground font-semibold">₹{(service.admin_price * cfg.usageLimit).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom summary */}
        {summary.totalCount > 0 && (
          <div className="mt-auto bg-muted/40 whitespace-nowrap">
            <Separator />
            <div className="px-3 py-1.5 space-y-0.5">
              <div className="max-h-16 overflow-y-auto pr-1">
                {summary.items.map((item) => (
                  <div key={item.name} className="flex justify-between text-[10px] leading-tight py-0.5">
                    <span className="text-muted-foreground truncate mr-4">{item.name}</span>
                    <span className="text-foreground font-medium">₹{item.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-end pt-1 border-t border-muted-foreground/10 flex-wrap gap-1">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-foreground">Total Estimated</span>
                  {summary.totalProfit > 0 && (
                    <span className="text-[9px] text-green-600 font-medium">Earn +₹{summary.totalProfit.toLocaleString()}</span>
                  )}
                </div>
                <div className="text-sm font-bold text-foreground text-right shrink-0">
                  ₹{summary.totalCost.toLocaleString()}<span className="text-[10px] font-normal text-muted-foreground">/mo</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-3 border-t flex flex-col sm:flex-row justify-end gap-2 bg-background">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto order-2 sm:order-1 h-8">Cancel</Button>
          <Button
            size="sm"
            onClick={() => assignMutation.mutate()}
            disabled={summary.totalCount === 0 || assignMutation.isPending}
            className="w-full sm:w-auto order-1 sm:order-2 h-8"
          >
            {assignMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {assignMutation.isPending ? "Assigning..." : `Assign ${summary.totalCount} Service${summary.totalCount > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={!!unassignConfirm} onOpenChange={(o) => !o && setUnassignConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign "{unassignConfirm?.serviceName}" from <span className="font-semibold text-foreground">{clientCompanyName}</span>?<br/><br/>
              They will lose access immediately and it will be moved back to "Coming Soon".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (unassignConfirm) unassignMutation.mutate(unassignConfirm.serviceId);
                setUnassignConfirm(null);
              }} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
