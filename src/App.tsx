import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";

// Lazy-loaded components
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ClientLayout = lazy(() => import("./components/client/ClientLayout"));
const ClientDashboardHome = lazy(() => import("./pages/client/ClientDashboardHome"));
const VoiceAgentPage = lazy(() => import("./pages/client/VoiceAgentPage"));
const LeadsPage = lazy(() => import("./pages/client/LeadsPage"));
const CallOrbitorPage = lazy(() => import("./pages/client/CallOrbitorPage"));
const VoiceTelecallerPage = lazy(() => import("./pages/client/VoiceTelecallerPage"));
const VoiceReceptionistPage = lazy(() => import("./pages/client/VoiceReceptionistPage"));
const CampaignDetailPage = lazy(() => import("./pages/client/CampaignDetailPage"));
const CallLogsPage = lazy(() => import("./pages/client/CallLogsPage"));
const WhatsAppPage = lazy(() => import("./pages/client/WhatsAppPage"));
const WhatsAppHistoryPage = lazy(() => import("./pages/client/WhatsAppHistoryPage"));
const SocialMediaPage = lazy(() => import("./pages/client/SocialMediaPage"));
const UsageBillingPage = lazy(() => import("./pages/client/UsageBillingPage"));
const ClientSettingsPage = lazy(() => import("./pages/client/ClientSettingsPage"));
const ClientNotificationsPage = lazy(() => import("./pages/client/ClientNotificationsPage"));
const HelpSupportPage = lazy(() => import("./pages/client/HelpSupportPage"));
const InboundServicePage = lazy(() => import("./pages/client/InboundServicePage"));
const InstallPage = lazy(() => import("./pages/client/InstallPage"));
const ClientAnalyticsPage = lazy(() => import("./pages/client/ClientAnalyticsPage"));
const ServiceCatalogPage = lazy(() => import("./pages/client/ServiceCatalogPage"));
const EmailMarketingPage = lazy(() => import("./pages/client/EmailMarketingPage"));
const AIConfigurationPage = lazy(() => import("./pages/client/AIConfigurationPage"));
const LiveChatPage = lazy(() => import("./pages/client/LiveChatPage"));
const LandingPageBuilder = lazy(() => import("./pages/client/LandingPageBuilder"));
const NotFound = lazy(() => import("./pages/NotFound"));
import FloatingChatWidget from "./components/chat/FloatingChatWidget";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      staleTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={
              <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="text-sm text-slate-400 animate-pulse">Loading app...</p>
                </div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/super-admin/*"
                  element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/*"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/client"
                  element={
                    <ProtectedRoute allowedRoles={["client"]}>
                      <ClientLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ClientDashboardHome />} />
                  <Route path="voice-telecaller" element={<VoiceTelecallerPage />} />
                  <Route path="voice-telecaller/calls" element={<CallLogsPage />} />
                  <Route path="voice-telecaller/campaigns/:campaignId" element={<CampaignDetailPage />} />
                  <Route path="voice-receptionist" element={<VoiceReceptionistPage />} />
                  <Route path="first-voice" element={<InboundServicePage />} />
                  <Route path="inbound" element={<Navigate to="/client/first-voice" replace />} />
                  <Route path="voice-agent" element={<VoiceAgentPage />} />
                  <Route path="whatsapp" element={<WhatsAppPage />} />
                  <Route path="whatsapp/history" element={<WhatsAppHistoryPage />} />
                  <Route path="social-media" element={<SocialMediaPage />} />
                  <Route path="email-marketing" element={<EmailMarketingPage />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="usage" element={<UsageBillingPage />} />
                  <Route path="settings" element={<ClientSettingsPage />} />
                  <Route path="notifications" element={<ClientNotificationsPage />} />
                  <Route path="help" element={<HelpSupportPage />} />
                  <Route path="install" element={<InstallPage />} />
                  <Route path="analytics" element={<ClientAnalyticsPage />} />
                  <Route path="services" element={<ServiceCatalogPage />} />
                  <Route path="ai-config" element={<AIConfigurationPage />} />
                  <Route path="live-chat" element={<LiveChatPage />} />
                  <Route path="landing-page-builder" element={<LandingPageBuilder />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <FloatingChatWidget />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
