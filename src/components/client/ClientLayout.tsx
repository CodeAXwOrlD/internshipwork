import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import { Outlet, useLocation } from "react-router-dom";
import ClientSidebar from "./ClientSidebar";
import ClientHeader from "./ClientHeader";
import MobileBottomNav from "./MobileBottomNav";
import { ClientProvider } from "@/contexts/ClientContext";

// Lazy-loaded components for keep-alive mapping
const ClientDashboardHome = lazy(() => import("@/pages/client/ClientDashboardHome"));
const VoiceAgentPage = lazy(() => import("@/pages/client/VoiceAgentPage"));
const LeadsPage = lazy(() => import("@/pages/client/LeadsPage"));
const VoiceTelecallerPage = lazy(() => import("@/pages/client/VoiceTelecallerPage"));
const VoiceReceptionistPage = lazy(() => import("@/pages/client/VoiceReceptionistPage"));
const CampaignDetailPage = lazy(() => import("@/pages/client/CampaignDetailPage"));
const CallLogsPage = lazy(() => import("@/pages/client/CallLogsPage"));
const WhatsAppPage = lazy(() => import("@/pages/client/WhatsAppPage"));
const SocialMediaPage = lazy(() => import("@/pages/client/SocialMediaPage"));
const UsageBillingPage = lazy(() => import("@/pages/client/UsageBillingPage"));
const ClientSettingsPage = lazy(() => import("@/pages/client/ClientSettingsPage"));
const ClientNotificationsPage = lazy(() => import("@/pages/client/ClientNotificationsPage"));
const HelpSupportPage = lazy(() => import("@/pages/client/HelpSupportPage"));
const InstallPage = lazy(() => import("@/pages/client/InstallPage"));
const ClientAnalyticsPage = lazy(() => import("@/pages/client/ClientAnalyticsPage"));
const ServiceCatalogPage = lazy(() => import("@/pages/client/ServiceCatalogPage"));
const EmailMarketingPage = lazy(() => import("@/pages/client/EmailMarketingPage"));
const LiveChatPage = lazy(() => import("@/pages/client/LiveChatPage"));
const LandingPageBuilder = lazy(() => import("@/pages/client/LandingPageBuilder"));
const InboundServicePage = lazy(() => import("@/pages/client/InboundServicePage"));

const ROUTES_MAP: Record<string, React.ComponentType<any>> = {
  "/client": ClientDashboardHome,
  "/client/voice-telecaller": VoiceTelecallerPage,
  "/client/voice-receptionist": VoiceReceptionistPage,
  "/client/first-voice": InboundServicePage,
  "/client/voice-agent": VoiceAgentPage,
  "/client/whatsapp": WhatsAppPage,
  "/client/social-media": SocialMediaPage,
  "/client/email-marketing": EmailMarketingPage,
  "/client/leads": LeadsPage,
  "/client/usage": UsageBillingPage,
  "/client/settings": ClientSettingsPage,
  "/client/notifications": ClientNotificationsPage,
  "/client/help": HelpSupportPage,
  "/client/install": InstallPage,
  "/client/analytics": ClientAnalyticsPage,
  "/client/services": ServiceCatalogPage,
  "/client/live-chat": LiveChatPage,
  "/client/landing-page-builder": LandingPageBuilder,
  "/client/voice-telecaller/calls": CallLogsPage,
};

const findMatchingRoute = (pathname: string) => {
  if (pathname.startsWith("/client/voice-telecaller/campaigns/")) {
    return {
      key: "/client/voice-telecaller/campaigns/:campaignId",
      Component: CampaignDetailPage
    };
  }

  const Component = ROUTES_MAP[pathname];
  if (Component) {
    return {
      key: pathname,
      Component
    };
  }

  return null;
};

export default function ClientLayout() {
  return (
    <ClientProvider>
      <ClientLayoutInner />
    </ClientProvider>
  );
}

function ClientLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const [visitedKeys, setVisitedKeys] = useState<string[]>([]);

  useEffect(() => {
    try { localStorage.setItem("sidebar-collapsed", String(collapsed)); } catch { }
  }, [collapsed]);

  useEffect(() => {
    setSidebarOpen(false);
    // Reset scroll position to top when navigating to a new page
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Track visited routes
  useEffect(() => {
    const match = findMatchingRoute(location.pathname);
    if (match && !visitedKeys.includes(match.key)) {
      setVisitedKeys(prev => [...prev, match.key]);
    }
  }, [location.pathname, visitedKeys]);

  useEffect(() => {
    const preload = () => {
      void import("@/pages/client/LeadsPage");
      void import("@/pages/client/ClientDashboardHome");
      void import("@/pages/client/WhatsAppPage");
      void import("@/pages/client/SocialMediaPage");
      void import("@/pages/client/VoiceTelecallerPage");
      void import("@/pages/client/VoiceReceptionistPage");
      void import("@/pages/client/VoiceAgentPage");
      void import("@/pages/client/UsageBillingPage");
      void import("@/pages/client/ClientSettingsPage");
      void import("@/pages/client/ClientAnalyticsPage");
      void import("@/pages/client/ServiceCatalogPage");
      void import("@/pages/client/EmailMarketingPage");
      void import("@/pages/client/LiveChatPage");
      void import("@/pages/client/ClientNotificationsPage");
      void import("@/pages/client/HelpSupportPage");
      void import("@/pages/client/InboundServicePage");
      void import("@/pages/client/CallLogsPage");
      void import("@/pages/client/CampaignDetailPage");
    };

    if (typeof window === "undefined") return;
    // Preload immediately after mount — no delay so first switch is instant
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(preload)
      : window.setTimeout(preload, 0);
    return () => {
      if (window.requestIdleCallback) window.cancelIdleCallback(id as number);
      else window.clearTimeout(id as number);
    };
  }, []);

  const currentMatch = findMatchingRoute(location.pathname);
  const showOutlet = !currentMatch;

  return (
    <div className="min-h-screen bg-mesh md:flex overflow-hidden">
      <ClientSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
      />

      <div className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        // shift the main content to the right to match sidebar width on md+
        collapsed ? "md:ml-20" : "md:ml-64"
      )}>
        <ClientHeader
          onMenuClick={() => setSidebarOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(c => !c)}
        />

        <main
          ref={scrollContainerRef}
          className="flex-1 flex flex-col overflow-y-auto pt-14 md:pt-16 pb-16 md:pb-0"
        >
          <div className="flex-1 flex flex-col p-4 md:p-5 lg:p-6 max-w-[1100px] lg:max-w-[1600px] mx-auto w-full">
            {/* Keep-alive rendered components — each has its own Suspense so they never block each other */}
            {visitedKeys.map((key) => {
              const isCurrent = currentMatch?.key === key;

              let Component = ROUTES_MAP[key];
              if (key === "/client/voice-telecaller/campaigns/:campaignId") {
                Component = CampaignDetailPage;
              }

              if (!Component) return null;

              return (
                // NO animation class — toggling display:none/flex is instant,
                // adding animate-in every switch causes a full repaint cycle each time
                <div
                  key={key}
                  className={cn("w-full flex-col flex-1", isCurrent ? "flex" : "hidden")}
                >
                  <Suspense fallback={
                    <div className="flex flex-1 flex-col items-center justify-center min-h-[400px]">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                      <p className="mt-2 text-sm text-slate-400">Loading...</p>
                    </div>
                  }>
                    <Component />
                  </Suspense>
                </div>
              );
            })}

            {/* Fallback outlet for unmatched sub-routes */}
            <Suspense fallback={
              <div className="flex flex-1 flex-col items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="mt-2 text-sm text-slate-400">Loading...</p>
              </div>
            }>
              <div className={cn("w-full flex-col flex-1", showOutlet ? "flex" : "hidden")}>
                <Outlet />
              </div>
            </Suspense>
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}

