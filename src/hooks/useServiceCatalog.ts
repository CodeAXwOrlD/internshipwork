import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { isComingSoon } from "@/lib/service-routes";

interface ServicePlan {
  id: string;
  plan_name: string;
  plan_tier: string | null;
  price_per_unit: number | null;
  monthly_price: number | null;
  usage_limit: number | null;
  features_included: unknown;
  is_active: boolean;
}

interface PurchaseRequest {
  id: string;
  service_id: string;
  status: string;
  created_at: string;
}

export interface CatalogService {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  description: string | null;
  category: string;
  features: unknown;
  is_unlocked: boolean;
  is_locked: boolean;
  lock_reason?: string;
  request_status?: "pending" | "approved" | "rejected" | null;
  request_id?: string;
  // If unlocked, client service info
  plan_name?: string;
  price_per_unit?: number | null;
  usage_limit?: number;
  usage_consumed?: number;
  reset_period?: string | null;
  // Available plans (for locked services)
  available_plans: ServicePlan[];
}

export function useServiceCatalog() {
  const { client, servicesVersion } = useClient();

  const { data: services = [], isLoading: loading, refetch } = useQuery({
    // servicesVersion in the key ensures automatic refetch when admin toggles a service
    queryKey: ["service-catalog", client?.id, servicesVersion],
    queryFn: async () => {
      if (!client) return [];

      const [
        { data: allServices },
        { data: clientServices },
        { data: plans },
        { data: requests },
      ] = await Promise.all([
        supabase.from("services").select("id, name, slug, icon_url, description, category, features").eq("is_active", true).neq("slug", "ai-voice-receptionist").neq("slug", "voice-receptionist").order("name"),
        supabase.from("client_services").select("service_id, is_active, usage_limit, usage_consumed, reset_period, plan_id, is_coming_soon_unlocked").eq("client_id", client.id),
        supabase.from("service_plans").select("id, plan_name, plan_tier, price_per_unit, monthly_price, usage_limit, features_included, is_active, service_id").eq("is_active", true),
        supabase.from("service_purchase_requests").select("id, service_id, status, created_at").eq("client_id", client.id).in("status", ["pending", "approved"]),
      ]);

      // A service is unlocked if the client has an active client_services record for it
      const clientServiceMap = new Map(
        (clientServices ?? []).filter((c) => c.is_active).map((c) => [c.service_id, c])
      );
      const approvedRequestIds = new Set(
        (requests ?? []).filter(r => r.status === "approved").map(r => r.service_id)
      );
      const plansByService = new Map<string, ServicePlan[]>();
      (plans ?? []).forEach((p) => {
        const existing = plansByService.get(p.service_id) || [];
        existing.push(p);
        plansByService.set(p.service_id, existing);
      });
      const requestMap = new Map(
        (requests ?? []).map((r) => [r.service_id, r])
      );

      // Get plan names for client services
      const planNameMap = new Map((plans ?? []).map(p => [p.id, p.plan_name]));

      return (allServices ?? []).map((s) => {
        const cs = clientServiceMap.get(s.id);
        const isComingSoonSvc = isComingSoon(s.slug);
        const isUnlocked = !!cs && (!isComingSoonSvc || !!cs.is_coming_soon_unlocked);
        const request = requestMap.get(s.id);

        const lock_reason = !isUnlocked
          ? "Contact your administrator to activate this service."
          : undefined;

        return {
          ...s,
          is_unlocked: isUnlocked,
          is_locked: !isUnlocked,
          lock_reason,
          request_status: request?.status as CatalogService["request_status"] ?? null,
          request_id: request?.id,
          plan_name: cs?.plan_id ? planNameMap.get(cs.plan_id) : undefined,
          price_per_unit: null,
          usage_limit: cs?.usage_limit,
          usage_consumed: cs?.usage_consumed ?? 0,
          reset_period: cs?.reset_period,
          available_plans: plansByService.get(s.id) || [],
        };
      });
    },
    enabled: !!client,
  });

  return { services, loading, refetch };
}

