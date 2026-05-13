import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import AdminHeader from "./AdminHeader";
import MessagesDrawer from "./MessagesDrawer";
import { AdminProvider, useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import QuickActionsFAB from "./QuickActionsFAB";

export default function AdminLayout() {
  return (
    <AdminProvider>
      <AdminLayoutInner />
    </AdminProvider>
  );
}

function AdminLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { admin } = useAdmin();
  const { user } = useAuth();

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("is_read", false);
    setUnreadMessages(count || 0);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Realtime unread count
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("unread-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchUnreadCount();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return (
    <div className="min-h-screen bg-mesh">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AdminHeader
        onMenuClick={() => setSidebarOpen(true)}
        onMessagesClick={() => setMessagesOpen(true)}
        unreadMessages={unreadMessages}
      />

      <main
        className="md:ml-60 pt-14 md:pt-16 flex flex-col"
        style={{ height: "100dvh" }}
      >
        <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <MessagesDrawer
        open={messagesOpen}
        onOpenChange={(open) => {
          setMessagesOpen(open);
          if (!open) fetchUnreadCount();
        }}
      />

      <QuickActionsFAB onOpenMessages={() => setMessagesOpen(true)} />
    </div>
  );
}
