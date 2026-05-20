import { Routes, Route } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { lazy } from "react";

// Lazy-loaded Admin pages
const AdminDashboardHome = lazy(() => import("@/pages/admin/AdminDashboardHome"));
const WhiteLabelSettingsPage = lazy(() => import("@/pages/admin/WhiteLabelSettingsPage"));
const ServiceCatalogPage = lazy(() => import("@/pages/admin/ServiceCatalogPage"));
const MyPricingPage = lazy(() => import("@/pages/admin/MyPricingPage"));
const MyClientsPage = lazy(() => import("@/pages/admin/MyClientsPage"));
const AdminClientDetailPage = lazy(() => import("@/pages/admin/AdminClientDetailPage"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin/AdminAnalyticsPage"));
const AdminBillingPage = lazy(() => import("@/pages/admin/AdminBillingPage"));
const AdminSettingsPage = lazy(() => import("@/pages/admin/AdminSettingsPage"));
const VoiceAgentPage = lazy(() => import("@/pages/admin/VoiceAgentPage"));
const AdminVoiceReceptionistPage = lazy(() => import("@/pages/admin/AdminVoiceReceptionistPage"));
const AdminVoiceTelecallerPage = lazy(() => import("@/pages/admin/AdminVoiceTelecallerPage"));
const AdminWhatsAppPage = lazy(() => import("@/pages/admin/AdminWhatsAppPage"));
const AdminWhatsAppBotsPage = lazy(() => import("@/pages/admin/AdminWhatsAppBotsPage"));
const AdminSocialMediaPage = lazy(() => import("@/pages/admin/AdminSocialMediaPage"));

export default function AdminDashboard() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminDashboardHome />} />
        <Route path="white-label" element={<WhiteLabelSettingsPage />} />
        <Route path="services" element={<ServiceCatalogPage />} />
        <Route path="pricing" element={<MyPricingPage />} />
        <Route path="clients" element={<MyClientsPage />} />
        <Route path="clients/:clientId" element={<AdminClientDetailPage />} />
        <Route path="voice-agent" element={<VoiceAgentPage />} />
        <Route path="voice-receptionist" element={<AdminVoiceReceptionistPage />} />
        <Route path="voice-telecaller" element={<AdminVoiceTelecallerPage />} />
        <Route path="whatsapp" element={<AdminWhatsAppPage />} />
        <Route path="whatsapp/bots" element={<AdminWhatsAppBotsPage />} />
        <Route path="social-media" element={<AdminSocialMediaPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="billing" element={<AdminBillingPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>
    </Routes>
  );
}
