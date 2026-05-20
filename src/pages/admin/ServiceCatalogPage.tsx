import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAdmin } from "@/contexts/AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  DollarSign, Lock, Check, Package, ChevronDown, ChevronUp,
  Users, Phone, MessageSquare, Share2, Eye,
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_price: number;
  base_pricing_model: string;
  icon_url: string | null;
  features: any;
  is_active: boolean;
}

interface AdminPricing {
  id: string;
  service_id: string;
  markup_percentage: number | null;
  custom_price_per_unit: number | null;
  is_custom_pricing: boolean | null;
}

interface ServicePlan {
  id: string;
  plan_name: string;
  plan_tier: string | null;
  monthly_price: number | null;
  price_per_unit: number | null;
  usage_limit: number | null;
  features_included: any;
  is_active: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  voice: { label: "Voice", icon: Phone, color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  messaging: { label: "Messaging", icon: MessageSquare, color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" },
  social_media: { label: "Social Media", icon: Share2, color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
};

const UNIT_LABELS: Record<string, string> = {
  per_minute: "minute",
  per_call: "call",
  per_message: "message",
  monthly: "month",
};

export default function ServiceCatalogPage() {
  const { admin, primaryColor } = useAdmin();
  const [activeTab, setActiveTab] = useState("all");
  const [expandedDesc, setExpandedDesc] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());

  // Pricing modal
  const [pricingService, setPricingService] = useState<Service | null>(null);
  const [pricingMode, setPricingMode] = useState<"markup" | "custom">("markup");
  const [markupValue, setMarkupValue] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  // Plans modal
  const [plansService, setPlansService] = useState<Service | null>(null);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  const { data: catalogData, isLoading, refetch } = useQuery({
    queryKey: ["admin-services-catalog", admin?.id],
    queryFn: async () => {
      if (!admin) return { services: [], adminPricing: new Map<string, AdminPricing>(), clientCounts: new Map<string, number>() };

      const [servicesRes, pricingRes] = await Promise.all([
        supabase.from("services").select("*").eq("is_active", true).neq("slug", "ai-voice-receptionist").neq("slug", "voice-receptionist").order("category").order("name"),
        supabase.from("admin_pricing").select("*").eq("admin_id", admin.id),
      ]);

      const servicesList = (servicesRes.data || []) as Service[];

      const pMap = new Map<string, AdminPricing>();
      pricingRes.data?.forEach((p: any) => pMap.set(p.service_id, p));

      // Fetch client counts per service
      const { data: cs } = await supabase
        .from("client_services")
        .select("service_id, client_id")
        .in("client_id", (await supabase.from("clients").select("id").eq("admin_id", admin.id)).data?.map(c => c.id) || [])
        .eq("is_active", true);

      const countMap = new Map<string, number>();
      cs?.forEach(r => countMap.set(r.service_id, (countMap.get(r.service_id) || 0) + 1));

      return { services: servicesList, adminPricing: pMap, clientCounts: countMap };
    },
    enabled: !!admin,
  });

  const services = catalogData?.services || [];
  const adminPricing = catalogData?.adminPricing || new Map<string, AdminPricing>();
  const clientCounts = catalogData?.clientCounts || new Map<string, number>();

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: services.length };
    services.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, [services]);

  const filteredServices = useMemo(() => {
    if (activeTab === "all") return services;
    return services.filter(s => s.category === activeTab);
  }, [services, activeTab]);

  const unitLabel = (model: string) => UNIT_LABELS[model] || model;

  // Open pricing modal
  const openPricingModal = (service: Service) => {
    const existing = adminPricing.get(service.id);
    setPricingService(service);
    if (existing?.is_custom_pricing) {
      setPricingMode("custom");
      setCustomPrice(String(existing.custom_price_per_unit || ""));
      setMarkupValue("");
    } else if (existing) {
      setPricingMode("markup");
      setMarkupValue(String(existing.markup_percentage || ""));
      setCustomPrice("");
    } else {
      setPricingMode("markup");
      setMarkupValue("");
      setCustomPrice("");
    }
  };

  // Calculations
  const calcFromMarkup = (base: number, markup: string) => {
    const m = parseFloat(markup);
    if (isNaN(m) || m < 0) return null;
    const price = base * (1 + m / 100);
    return { price, profit: price - base, markup: m };
  };

  const calcFromCustom = (base: number, price: string) => {
    const p = parseFloat(price);
    if (isNaN(p) || p < base) return null;
    const markup = ((p - base) / base) * 100;
    return { price: p, profit: p - base, markup };
  };

  const currentCalc = useMemo(() => {
    if (!pricingService) return null;
    if (pricingMode === "markup") return calcFromMarkup(pricingService.base_price, markupValue);
    return calcFromCustom(pricingService.base_price, customPrice);
  }, [pricingService, pricingMode, markupValue, customPrice]);

  const handleSavePricing = async () => {
    if (!pricingService || !admin || !currentCalc) return;
    setIsSavingPrice(true);

    try {
      const existing = adminPricing.get(pricingService.id);
      const payload = {
        admin_id: admin.id,
        service_id: pricingService.id,
        markup_percentage: currentCalc.markup,
        custom_price_per_unit: currentCalc.price,
        is_custom_pricing: pricingMode === "custom",
      };

      let error;
      if (existing) {
        ({ error } = await supabase.from("admin_pricing").update(payload).eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("admin_pricing").insert(payload));
      }

      if (error) throw error;

      toast({ title: `Pricing updated for ${pricingService.name}` });
      setPricingService(null);
      refetch();
    } catch (err: any) {
      toast({ title: "Error saving pricing", description: err.message, variant: "destructive" });
    } finally {
      setIsSavingPrice(false);
    }
  };

  // Plans modal
  const openPlansModal = async (service: Service) => {
    setPlansService(service);
    setIsLoadingPlans(true);
    const { data } = await supabase
      .from("service_plans")
      .select("*")
      .eq("service_id", service.id)
      .eq("is_active", true)
      .order("plan_tier");
    setPlans((data || []) as ServicePlan[]);
    setIsLoadingPlans(false);
  };

  const tierOrder = ["basic", "standard", "premium", "enterprise"];
  const sortedPlans = useMemo(() =>
    [...plans].sort((a, b) => tierOrder.indexOf(a.plan_tier || "") - tierOrder.indexOf(b.plan_tier || "")),
    [plans]
  );

  const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const parseFeatures = (features: any): string[] => {
    if (!features) return [];
    if (Array.isArray(features)) return features.map(f => typeof f === "string" ? f : JSON.stringify(f));
    return [];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72 mt-2" /></div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-80" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">Available services — Set your pricing to offer to clients</p>
      </div>

      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Services ({categoryCounts.all || 0})</TabsTrigger>
          <TabsTrigger value="voice">Voice ({categoryCounts.voice || 0})</TabsTrigger>
          <TabsTrigger value="messaging">Messaging ({categoryCounts.messaging || 0})</TabsTrigger>
          <TabsTrigger value="social_media">Social Media ({categoryCounts.social_media || 0})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Service Cards */}
      {filteredServices.length === 0 ? (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <Package className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No services available yet</p>
            <p className="text-sm text-muted-foreground">Contact support to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredServices.map((service) => {
            const pricing = adminPricing.get(service.id);
            const features = parseFeatures(service.features);
            const showAllFeatures = expandedFeatures.has(service.id);
            const displayFeatures = showAllFeatures ? features : features.slice(0, 4);
            const catConf = CATEGORY_CONFIG[service.category];
            const CatIcon = catConf?.icon || Package;
            const profit = pricing?.custom_price_per_unit
              ? pricing.custom_price_per_unit - service.base_price
              : 0;
            const clients = clientCounts.get(service.id) || 0;

            return (
              <Card key={service.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${primaryColor}15` }}
                      >
                        {service.icon_url ? (
                          <img src={service.icon_url} alt="" className="h-6 w-6 object-contain" />
                        ) : (
                          <CatIcon className="h-5 w-5" style={{ color: primaryColor }} />
                        )}
                      </div>
                      <CardTitle className="text-base leading-tight">{service.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className={catConf?.color || ""}>
                      {catConf?.label || service.category}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4 text-sm">
                  {/* Description */}
                  {service.description && (
                    <div>
                      <p className={`text-muted-foreground ${expandedDesc.has(service.id) ? "" : "line-clamp-3"}`}>
                        {service.description}
                      </p>
                      {service.description.length > 120 && (
                        <button
                          className="text-xs font-medium mt-1"
                          style={{ color: primaryColor }}
                          onClick={() => toggleSet(expandedDesc, service.id, setExpandedDesc)}
                        >
                          {expandedDesc.has(service.id) ? "Show less" : "Learn more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Base Pricing */}
                  <div className="rounded-md border border-border p-3 bg-muted/40">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Lock className="h-3 w-3" /> Base Pricing
                    </div>
                    <p className="font-semibold">
                      ₹{service.base_price.toLocaleString("en-IN")} per {unitLabel(service.base_pricing_model)}
                    </p>
                  </div>

                  {/* Your Pricing */}
                  {pricing ? (
                    <div className="rounded-md border border-border p-3">
                      <p className="text-xs font-semibold mb-1">Your Pricing</p>
                      <p className="font-semibold">
                        ₹{(pricing.custom_price_per_unit || 0).toLocaleString("en-IN")} per {unitLabel(service.base_pricing_model)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300">
                          +{(pricing.markup_percentage || 0).toFixed(1)}% markup
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          You earn ₹{profit.toLocaleString("en-IN")} per {unitLabel(service.base_pricing_model)}
                        </span>
                      </div>
                      <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => openPricingModal(service)}>
                        Edit Pricing
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-border p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-2">You haven't set your pricing yet</p>
                      <Button size="sm" className="w-full" onClick={() => openPricingModal(service)}>
                        <DollarSign className="h-4 w-4 mr-1" /> Set My Price
                      </Button>
                      <p className="text-[10px] text-muted-foreground mt-1">Set markup to earn commission</p>
                    </div>
                  )}

                  {/* Features */}
                  {features.length > 0 && (
                    <div className="space-y-1.5">
                      {displayFeatures.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: primaryColor }} />
                          <span className="text-xs text-muted-foreground">{f}</span>
                        </div>
                      ))}
                      {features.length > 4 && (
                        <button
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color: primaryColor }}
                          onClick={() => toggleSet(expandedFeatures, service.id, setExpandedFeatures)}
                        >
                          {showAllFeatures ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show all ({features.length})</>}
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex items-center justify-between pt-3 border-t">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {clients} client{clients !== 1 ? "s" : ""}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => openPlansModal(service)}>
                    <Eye className="h-4 w-4 mr-1" /> View Plans
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pricing Modal */}
      <Dialog open={!!pricingService} onOpenChange={(o) => !o && setPricingService(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Your Pricing — {pricingService?.name}</DialogTitle>
            <DialogDescription>Configure how much you charge your clients</DialogDescription>
          </DialogHeader>

          {pricingService && (
            <div className="space-y-5">
              {/* Base price display */}
              <div className="rounded-md border border-border p-3 bg-muted/40 flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Platform Base Price</p>
                  <p className="font-semibold">₹{pricingService.base_price.toLocaleString("en-IN")} per {unitLabel(pricingService.base_pricing_model)}</p>
                </div>
              </div>

              {/* Pricing mode */}
              <RadioGroup value={pricingMode} onValueChange={(v) => setPricingMode(v as "markup" | "custom")} className="space-y-4">
                {/* Markup option */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="markup" id="markup" />
                    <Label htmlFor="markup" className="font-medium">Markup Percentage <Badge variant="secondary" className="ml-1 text-[10px]">Recommended</Badge></Label>
                  </div>
                  {pricingMode === "markup" && (
                    <div className="pl-6 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Markup Percentage (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={500}
                          step={0.1}
                          placeholder="e.g., 40"
                          value={markupValue}
                          onChange={(e) => setMarkupValue(e.target.value)}
                        />
                      </div>
                      {currentCalc && (
                        <PriceBreakdown
                          base={pricingService.base_price}
                          price={currentCalc.price}
                          profit={currentCalc.profit}
                          markup={currentCalc.markup}
                          unit={unitLabel(pricingService.base_pricing_model)}
                        />
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Custom price option */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="custom" />
                    <Label htmlFor="custom" className="font-medium">Custom Price</Label>
                  </div>
                  {pricingMode === "custom" && (
                    <div className="pl-6 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Your Price per {unitLabel(pricingService.base_pricing_model)}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                          <Input
                            type="number"
                            min={pricingService.base_price}
                            step={0.01}
                            placeholder="e.g., 7.00"
                            className="pl-7"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                          />
                        </div>
                        {customPrice && parseFloat(customPrice) < pricingService.base_price && (
                          <p className="text-xs text-destructive">Price cannot be less than base price (₹{pricingService.base_price})</p>
                        )}
                      </div>
                      {currentCalc && (
                        <PriceBreakdown
                          base={pricingService.base_price}
                          price={currentCalc.price}
                          profit={currentCalc.profit}
                          markup={currentCalc.markup}
                          unit={unitLabel(pricingService.base_pricing_model)}
                        />
                      )}
                    </div>
                  )}
                </div>
              </RadioGroup>

              {/* Profit projection */}
              {currentCalc && (
                <div className="rounded-md border border-border p-3 bg-muted/30">
                  <p className="text-xs font-medium mb-2">Monthly Projection (500 {unitLabel(pricingService.base_pricing_model)}s)</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Client pays</p>
                      <p className="font-semibold text-sm">₹{(currentCalc.price * 500).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Platform cost</p>
                      <p className="font-semibold text-sm">₹{(pricingService.base_price * 500).toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your profit</p>
                      <p className="font-semibold text-sm text-green-600">₹{(currentCalc.profit * 500).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingService(null)}>Cancel</Button>
            <Button onClick={handleSavePricing} disabled={!currentCalc || isSavingPrice}>
              {isSavingPrice ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plans Modal */}
      <Dialog open={!!plansService} onOpenChange={(o) => !o && setPlansService(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plans — {plansService?.name}</DialogTitle>
            <DialogDescription>Available plans for this service</DialogDescription>
          </DialogHeader>

          {isLoadingPlans ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : sortedPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No plans configured for this service yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {sortedPlans.map((plan) => {
                const pricing = plansService ? adminPricing.get(plansService.id) : null;
                const markup = pricing?.markup_percentage || 0;
                const planFeatures = parseFeatures(plan.features_included);
                const yourPrice = plan.price_per_unit
                  ? plan.price_per_unit * (1 + markup / 100)
                  : plan.monthly_price
                    ? plan.monthly_price * (1 + markup / 100)
                    : null;

                return (
                  <Card key={plan.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{plan.plan_name}</CardTitle>
                        {plan.plan_tier && (
                          <Badge variant="outline" className="capitalize text-xs">{plan.plan_tier}</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {/* Platform price */}
                      <div>
                        <p className="text-xs text-muted-foreground">Platform Price</p>
                        <p className="font-medium">
                          {plan.monthly_price != null && `₹${plan.monthly_price.toLocaleString("en-IN")}/mo`}
                          {plan.price_per_unit != null && ` • ₹${plan.price_per_unit}/unit`}
                        </p>
                        {plan.usage_limit && (
                          <p className="text-xs text-muted-foreground">{plan.usage_limit.toLocaleString()} units included</p>
                        )}
                      </div>

                      {/* Your price */}
                      {pricing && yourPrice != null && (
                        <div className="rounded bg-muted/50 p-2">
                          <p className="text-xs text-muted-foreground">Your Price (+{markup.toFixed(1)}%)</p>
                          <p className="font-semibold">₹{yourPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                        </div>
                      )}

                      {/* Features */}
                      {planFeatures.length > 0 && (
                        <div className="space-y-1">
                          {planFeatures.map((f, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-600" />
                              <span className="text-xs text-muted-foreground">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceBreakdown({ base, price, profit, markup, unit }: {
  base: number; price: number; profit: number; markup: number; unit: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-3 space-y-1 text-xs">
      <div className="flex justify-between"><span className="text-muted-foreground">Base Price:</span><span>₹{base.toLocaleString("en-IN")}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Your Markup:</span><span>+{markup.toFixed(1)}%</span></div>
      <Separator className="my-1" />
      <div className="flex justify-between font-medium"><span>Your Price:</span><span>₹{price.toLocaleString("en-IN", { maximumFractionDigits: 2 })} per {unit}</span></div>
      <div className="flex justify-between text-green-600 font-medium"><span>Your Profit:</span><span>₹{profit.toLocaleString("en-IN", { maximumFractionDigits: 2 })} per {unit}</span></div>
    </div>
  );
}
