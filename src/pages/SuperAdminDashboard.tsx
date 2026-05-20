import { Routes, Route } from "react-router-dom";
import SuperAdminLayout from "@/components/super-admin/SuperAdminLayout";
import { lazy } from "react";

// Lazy-loaded Super Admin pages
const DashboardHome = lazy(() => import("./super-admin/DashboardHome"));
const ServicesPage = lazy(() => import("./super-admin/ServicesPage"));
const AdminsPage = lazy(() => import("./super-admin/AdminsPage"));
const AdminDetailPage = lazy(() => import("./super-admin/AdminDetailPage"));
const ClientsPage = lazy(() => import("./super-admin/ClientsPage"));
const ClientDetailPage = lazy(() => import("./super-admin/ClientDetailPage"));
const InboundNumbersPage = lazy(() => import("./super-admin/InboundNumbersPage"));
const BotsPage = lazy(() => import("./super-admin/BotsPage"));
const OutboundCampaignsPage = lazy(() => import("./super-admin/OutboundCampaignsPage"));
const OutboundCallLogsPage = lazy(() => import("./super-admin/OutboundCallLogsPage"));
const N8nControllerPage = lazy(() => import("./super-admin/N8nControllerPage"));
const AnalyticsPage = lazy(() => import("./super-admin/AnalyticsPage"));
const AdminWhatsAppPage = lazy(() => import("./admin/AdminWhatsAppPage"));
const AdminWhatsAppBotsPage = lazy(() => import("./admin/AdminWhatsAppBotsPage"));
const SettingsPage = lazy(() => import("./super-admin/SettingsPage"));
const NotificationsPage = lazy(() => import("./super-admin/NotificationsPage"));

export default function SuperAdminDashboard() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="admins/:adminId" element={<AdminDetailPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:clientId" element={<ClientDetailPage />} />
        <Route path="inbound-numbers" element={<InboundNumbersPage />} />
        <Route path="outbound-bots" element={<BotsPage />} />
        <Route path="outbound-campaigns" element={<OutboundCampaignsPage />} />
        <Route path="outbound-call-logs" element={<OutboundCallLogsPage />} />
        <Route path="n8n-controller" element={<N8nControllerPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="whatsapp" element={<AdminWhatsAppPage />} />
        <Route path="whatsapp/bots" element={<AdminWhatsAppBotsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}
