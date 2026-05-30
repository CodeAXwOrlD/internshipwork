import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AssignedService {
  id: string;
  service_id: string;
  service_name: string;
  service_slug: string;
  service_category: string;
  icon_url: string | null;
  usage_limit: number;
  usage_consumed: number;
  is_active: boolean;
  plan_id: string | null;
  reset_period: string | null;
  is_coming_soon_unlocked: boolean;
}

interface ClientProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_size: string | null;
  industry: string | null;
  is_active: boolean;
  admin_id: string;
  onboarded_at: string | null;
  allow_admin_raw_access: boolean | null;
}

interface AdminBranding {
  company_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface ClientContextType {
  client: ClientProfile | null;
  admin: AdminBranding | null;
  assignedServices: AssignedService[];
  primaryColor: string;
  secondaryColor: string;
  isLoading: boolean;
  /** Increments each time client_services changes via realtime — use as a query-key dep */
  servicesVersion: number;
  refetchClient: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType>({
  client: null,
  admin: null,
  assignedServices: [],
  primaryColor: "#3B82F6",
  secondaryColor: "#10B981",
  isLoading: true,
  servicesVersion: 0,
  refetchClient: async () => { },
});

export const useClient = () => useContext(ClientContext);

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [admin, setAdmin] = useState<AdminBranding | null>(null);
  const [assignedServices, setAssignedServices] = useState<AssignedService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [servicesVersion, setServicesVersion] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    // 1. Fetch client record
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!clientData) {
      setIsLoading(false);
      return;
    }
    setClient(clientData as ClientProfile);

    // 2. Fetch admin branding
    const { data: adminData } = await supabase
      .from("admins")
      .select("company_name, logo_url, primary_color, secondary_color")
      .eq("id", clientData.admin_id)
      .maybeSingle();

    if (adminData) {
      setAdmin({
        company_name: adminData.company_name,
        logo_url: adminData.logo_url,
        primary_color: adminData.primary_color || "#3B82F6",
        secondary_color: adminData.secondary_color || "#10B981",
      });
    }

    // 3. Fetch assigned services
    const { data: csData } = await supabase
      .from("client_services")
      .select("id, service_id, usage_limit, usage_consumed, is_active, plan_id, reset_period, is_coming_soon_unlocked")
      .eq("client_id", clientData.id)
      .eq("is_active", true);

    if (csData && csData.length > 0) {
      const serviceIds = csData.map(s => s.service_id);
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, slug, category, icon_url")
        .neq("slug", "ai-voice-receptionist")
        .neq("slug", "voice-receptionist")
        .in("id", serviceIds);

      const serviceMap = new Map(servicesData?.map(s => [s.id, s]) || []);

      setAssignedServices(csData.map(cs => {
        const svc = serviceMap.get(cs.service_id);
        return {
          id: cs.id,
          service_id: cs.service_id,
          service_name: svc?.name || "Unknown",
          service_slug: svc?.slug || "",
          service_category: svc?.category || "",
          icon_url: svc?.icon_url || null,
          usage_limit: cs.usage_limit,
          usage_consumed: cs.usage_consumed || 0,
          is_active: cs.is_active ?? true,
          plan_id: cs.plan_id,
          reset_period: cs.reset_period,
          is_coming_soon_unlocked: cs.is_coming_soon_unlocked ?? false,

        };
      }));
    } else {
      setAssignedServices([]);
    }

    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const channelName = `client_services_ctx_${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_services" },
        () => {
          fetchAll();
          // Bump version so dependent hooks (useServiceCatalog etc.) auto-refetch
          setServicesVersion((v) => v + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchAll]);
  const primaryColor = admin?.primary_color || "#3B82F6";
  const secondaryColor = admin?.secondary_color || "#10B981";

  // Apply CSS custom properties for white-label branding
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--client-primary", primaryColor);
    root.style.setProperty("--client-secondary", secondaryColor);
    return () => {
      root.style.removeProperty("--client-primary");
      root.style.removeProperty("--client-secondary");
    };
  }, [primaryColor, secondaryColor]);

  return (
    <ClientContext.Provider
      value={{
        client,
        admin,
        assignedServices,
        primaryColor,
        secondaryColor,
        isLoading,
        servicesVersion,
        refetchClient: fetchAll,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}
