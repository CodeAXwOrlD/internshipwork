import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Lock, ArrowRight, Sparkles, Send, Clock, Check, Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getServicePath, getServiceIcon, SERVICE_ROUTE_MAP, isComingSoon } from "@/lib/service-routes";
import { getServiceFeatures } from "@/lib/service-features";
import { getRouteSlug } from "@/lib/service-routes";
import type { CatalogService } from "@/hooks/useServiceCatalog";

interface CatalogServiceCardProps {
  service: CatalogService;
  primaryColor: string;
  onViewDetails: (service: CatalogService) => void;
  onRequestAccess: (service: CatalogService) => void;
}

export function CatalogServiceCard({
  service, primaryColor, onViewDetails, onRequestAccess,
}: CatalogServiceCardProps) {
  const navigate = useNavigate();
  const features = getServiceFeatures(getRouteSlug(service.slug));
  const Icon = getServiceIcon(service.slug) || Sparkles;

  const isPending = service.request_status === "pending";
  const isUnlocked = service.is_unlocked;
  const comingSoon = isComingSoon(service.slug);

  const usagePct = isUnlocked && service.usage_limit && service.usage_limit > 0
    ? Math.round(((service.usage_consumed ?? 0) / service.usage_limit) * 100)
    : 0;

  const handleOpen = () => {
    const routeSlug = SERVICE_ROUTE_MAP[service.slug];
    if (!routeSlug) return;
    navigate(getServicePath(service.slug));
  };

  // Card accent based on state
  const borderClass = isUnlocked
    ? "border-emerald-200 dark:border-emerald-800"
    : isPending
      ? "border-amber-200 dark:border-amber-800"
      : "border-border";

  return (
    <Card className={cn("relative overflow-hidden transition-all hover-lift", borderClass)}>
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {service.icon_url ? (
            <img src={service.icon_url} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${primaryColor}15` }}
            >
              <Icon className="h-5 w-5" style={{ color: primaryColor }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{service.name}</p>
            <Badge variant="outline" className="text-[10px] capitalize mt-0.5">
              {service.category}
            </Badge>
          </div>
          {/* Status badge */}
          {isUnlocked && (
            <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] shrink-0">
              <Check className="mr-1 h-3 w-3" />
              Active
            </Badge>
          )}
          {isPending && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px] shrink-0">
              <Clock className="mr-1 h-3 w-3" />
              Pending
            </Badge>
          )}
          {service.is_locked && !isPending && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              <Lock className="mr-1 h-3 w-3" />
              Locked
            </Badge>
          )}
          {isUnlocked && comingSoon && (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20 text-[10px] shrink-0">
              <Clock className="mr-1 h-3 w-3" />
              Coming Soon
            </Badge>
          )}
        </div>

        {service.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
        )}

        {/* Plan info for unlocked */}
        {isUnlocked && service.plan_name && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{service.plan_name}</span>
            </div>
            {service.usage_limit != null && service.usage_limit > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usage</span>
                  <span className="font-medium">
                    {(service.usage_consumed ?? 0).toLocaleString()} / {service.usage_limit.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={Math.min(usagePct, 100)}
                  className={cn("h-1.5", usagePct >= 90 ? "[&>div]:bg-destructive" : usagePct >= 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500")}
                />
              </>
            )}
          </div>
        )}

        {/* Features (always visible) */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Features
          </p>
          <div className="space-y-1.5">
            {features.slice(0, 4).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                {f}
              </div>
            ))}
            {features.length > 4 && (
              <p className="text-[11px] text-muted-foreground pl-5">
                +{features.length - 4} more features
              </p>
            )}
          </div>
        </div>

        {/* Available plans preview for locked */}
        {service.is_locked && service.available_plans.length > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Plans from
            </p>
            <p className="text-sm font-bold" style={{ color: primaryColor }}>
              {service.available_plans[0].monthly_price != null
                ? `₹${service.available_plans[0].monthly_price.toLocaleString()}/mo`
                : service.available_plans[0].price_per_unit != null
                  ? `₹${service.available_plans[0].price_per_unit}/unit`
                  : "Contact for pricing"}
            </p>
            {service.available_plans.length > 1 && (
              <p className="text-[11px] text-muted-foreground">
                {service.available_plans.length} plans available
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {isUnlocked && !comingSoon ? (
            <Button
              size="sm"
              className="flex-1 text-white"
              style={{ backgroundColor: primaryColor }}
              onClick={handleOpen}
            >
              Open Dashboard
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          ) : isUnlocked && comingSoon ? (
            <Button
              size="sm"
              className="flex-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
              onClick={() => onRequestAccess(service)}
            >
              <Send className="mr-1 h-3 w-3" />
              Request Access from Admin
            </Button>
          ) : isPending ? (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onViewDetails(service)}
              >
                <Eye className="mr-1 h-3 w-3" />
                View Details
              </Button>
              <Button size="sm" disabled variant="secondary" className="flex-1 text-xs">
                <Clock className="mr-1 h-3 w-3" />
                Pending
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => onViewDetails(service)}
              >
                <Eye className="mr-1 h-3 w-3" />
                View Details
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={() => onRequestAccess(service)}
              >
                <Send className="mr-1 h-3 w-3" />
                Request Access
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
