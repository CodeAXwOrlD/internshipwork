import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertCircle, Clock, Plus } from "lucide-react";
import {
  Search,
  Paperclip,
  Smile,
  Send,
  MessageSquare,
  Phone,
  MoreHorizontal,
  Bot,
  Loader2,
  FileText,
  Image,
  Camera,
  User,
  ArrowLeft,
  Archive,
  Trash2,
  Filter,
  CheckSquare,
  Settings,
  Download,
  Ban,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { format, formatDistanceToNow } from "date-fns";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import {
  detectWhatsAppMediaType,
  uploadWhatsAppAttachment,
  WHATSAPP_ATTACHMENTS_BUCKET,
} from "@/utils/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EMOJI_CATEGORIES = [
  {
    label: "Smileys",
    emojis: [
      "😊",
      "😂",
      "🤣",
      "❤️",
      "😍",
      "🥰",
      "😎",
      "🤔",
      "🙄",
      "😅",
      "😭",
      "😤",
      "🤯",
      "😴",
      "😇",
      "🥳",
      "😱",
      "🤫",
      "🤥",
      "🤡",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍",
      "🙏",
      "🙌",
      "👏",
      "👋",
      "🤝",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "👌",
      "🤌",
      "🤏",
      "👈",
      "👉",
      "👆",
      "👇",
      "💪",
      "🖕",
      "✍️",
    ],
  },
  {
    label: "Symbols",
    emojis: [
      "✅",
      "❌",
      "⚠️",
      "💯",
      "🔥",
      "✨",
      "🚀",
      "💡",
      "📍",
      "📞",
      "💬",
      "🔔",
      "⭐",
      "🌈",
      "⚡",
      "❄️",
      "☀️",
      "🌙",
      "🌍",
      "🕒",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "💻",
      "📱",
      "📷",
      "🎥",
      "🎨",
      "🎭",
      "🎮",
      "📚",
      "🖊️",
      "📅",
      "🎁",
      "🏆",
      "💼",
      "🛒",
      "💰",
      "🔑",
      "📦",
      "📧",
      "🖇️",
      "🔒",
    ],
  },
];

const ATTACHMENT_OPTIONS = [
  { label: "Document", icon: FileText, color: "#7f66ff" },
  { label: "Photos & Videos", icon: Image, color: "#007bfc" },
  { label: "Camera", icon: Camera, color: "#ff2e74" },
  { label: "Contact", icon: User, color: "#00a5f4" },
];

// Below this px = mobile/tablet (single-panel navigation)
const DESKTOP_BREAKPOINT = 1280;

const KANBAN_COLUMNS = [
  "New Lead",
  "Demo Pending",
  "Follow-UP",
  "Demo",
  "Closed Deal",
  "Junk Leads"
] as const;

const COLUMN_STYLES: Record<string, { bg: string, border: string, badgeBg: string, text: string }> = {
  "New Lead": {
    bg: "bg-blue-50/20",
    border: "border-blue-100",
    badgeBg: "bg-blue-100 text-blue-700",
    text: "text-blue-900"
  },
  "Demo Pending": {
    bg: "bg-amber-50/20",
    border: "border-amber-100",
    badgeBg: "bg-amber-100 text-amber-700",
    text: "text-amber-900"
  },
  "Follow-UP": {
    bg: "bg-purple-50/20",
    border: "border-purple-100",
    badgeBg: "bg-purple-100 text-purple-700",
    text: "text-purple-900"
  },
  "Demo": {
    bg: "bg-indigo-50/20",
    border: "border-indigo-100",
    badgeBg: "bg-indigo-100 text-indigo-700",
    text: "text-indigo-900"
  },
  "Closed Deal": {
    bg: "bg-emerald-50/20",
    border: "border-emerald-100",
    badgeBg: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-900"
  },
  "Junk Leads": {
    bg: "bg-slate-50/20",
    border: "border-slate-100",
    badgeBg: "bg-slate-150 text-slate-600",
    text: "text-slate-800"
  }
};

export default function WhatsAppInbox({
  selectedAppId,
  assignedBots,
  templates = [],
  onNewChat,
}: {
  selectedAppId?: string | null;
  assignedBots?: any[];
  templates?: any[];
  onNewChat?: () => void;
}) {
  const { client } = useClient();
  const { toast } = useToast();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Template dialogue state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Status Filter Tag state
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // Lead Info Sidebar state
  const [leadInfo, setLeadInfo] = useState<any>(null);
  const [isLoadingLead, setIsLoadingLead] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState<{
    status: string;
    follow_up_date: string;
  }>({ status: '', follow_up_date: '' });

  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [contactStatuses, setContactStatuses] = useState<Record<string, string>>({});
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);

  // Load status mapping from localStorage when client changes
  useEffect(() => {
    if (!client) return;
    try {
      const stored = localStorage.getItem(`whatsapp_lead_status_${client.id}`);
      setContactStatuses(stored ? JSON.parse(stored) : {});
    } catch {
      setContactStatuses({});
    }
  }, [client]);

  const handleUpdateStatus = useCallback(async (phone: string, newStatus: string) => {
    if (!client) return;
    const cleanPhone = phone.replace(/^\+/, '');
    
    // Update local state
    setContactStatuses(prev => {
      const next = { ...prev, [cleanPhone]: newStatus };
      try {
        localStorage.setItem(`whatsapp_lead_status_${client.id}`, JSON.stringify(next));
      } catch (e) {
        console.error("Failed to write status to localStorage:", e);
      }
      return next;
    });

    // Update DB metadata
    try {
      const plusPhone = `+${cleanPhone}`;
      const { data: msgs, error: fetchErr } = await supabase
        .from("whatsapp_messages")
        .select("id, metadata")
        .eq("client_id", client.id)
        .in("phone_number", [cleanPhone, plusPhone]);
        
      if (fetchErr) throw fetchErr;
      
      if (msgs && msgs.length > 0) {
        const promises = msgs.map(m => {
          const currentMeta = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
          const updatedMeta = { ...currentMeta, lead_status: newStatus };
          return supabase
            .from("whatsapp_messages")
            .update({ metadata: updatedMeta })
            .eq("id", m.id);
        });
        await Promise.all(promises);
      }
    } catch (err: any) {
      console.warn("DB metadata sync failed:", err.message);
    }
  }, [client]);

  const handleDragStart = (e: React.DragEvent, chatId: string) => {
    e.dataTransfer.setData("text/plain", chatId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    const chatId = e.dataTransfer.getData("text/plain");
    if (!chatId) return;
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    await handleUpdateStatus(chatId, targetColumn);
    
    toast({
      title: "Status updated",
      description: `Moved ${chat.name} to ${targetColumn}.`,
      duration: 2000,
    });
  };

  const getChatsByColumn = (column: string) => {
    return filteredChats.filter(chat => {
      const status = contactStatuses[chat.id] || "New Lead";
      return status === column;
    });
  };

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // true = narrow screen (mobile/tablet): navigate list -> chat
  // false = wide screen (desktop): show both panels side by side
  const [isMobileMode, setIsMobileMode] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < DESKTOP_BREAKPOINT
      : false,
  );

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToLatestMessage = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useLayoutEffect(() => {
    const update = () =>
      setIsMobileMode(window.innerWidth < DESKTOP_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleBackToList = useCallback(() => setActiveChatId(null), []);
  const handleSelectChat = useCallback((id: string) => setActiveChatId(id), []);

  // Derive which panels to show
  // In Kanban mode: left panel always shown (full width); chat panel shows only when a card is clicked
  const showListPanel = viewMode === "kanban" ? true : (!isMobileMode || activeChatId === null);
  const showChatPanel = viewMode === "kanban"
    ? (activeChatId !== null)
    : (!isMobileMode || activeChatId !== null);

  // Auto-scroll messages to bottom when a chat opens or new messages land.
  useEffect(() => {
    if (!activeChatId) return;

    const timers = [50, 200, 500].map((ms) =>
      window.setTimeout(() => scrollToLatestMessage(), ms),
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [activeChatId, messages.length, isLoadingMessages, scrollToLatestMessage]);

  const onEmojiSelect = (emoji: string) =>
    setMessageInput((prev) => prev + emoji);

  const handleAttachmentClick = (label: string) => {
    if (label === "Document") docInputRef.current?.click();
    else if (label === "Photos & Videos") photoInputRef.current?.click();
    else if (label === "Camera") cameraInputRef.current?.click();
    else
      toast({
        title: "Feature coming soon",
        description: "Contact sharing is being prepared for the next update!",
      });
  };

  const getMessageAttachmentUrl = (msg: any) => {
    // Try metadata URLs first (works for fresh messages)
    const metaUrl =
      msg?.metadata?.mediaUrl ||
      msg?.metadata?.attachment?.mediaUrl ||
      msg?.metadata?.attachment?.signedUrl;
    if (metaUrl) return metaUrl;

    // After refresh, rebuild public URL from storage_path
    const storagePath = msg?.metadata?.attachment?.storagePath;
    if (storagePath) {
      return `https://ukxoyojiztuvaqgslegw.supabase.co/storage/v1/object/public/whatsapp-attachments/${storagePath}`;
    }

    return "";
  };

  const getMessageAttachmentName = (msg: any) =>
    msg?.metadata?.attachment?.fileName || msg?.message_content || "View Attachment";

  const handleDownloadAttachment = useCallback(
    async (url: string, fileName: string) => {
      if (!url) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName || "attachment";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (error: any) {
        toast({
          title: "Download failed",
          description: error?.message || "Unable to download attachment",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const dedupeMessagesById = useCallback((list: any[]) => {
    const seen = new Set<string>();
    return list.filter((msg) => {
      const id = String(msg?.id ?? "");
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = "";
      if (!activeChatId || !selectedAppId || !client) {
        toast({
          title: "Select a chat first",
          description: "Open a conversation before sending an attachment.",
          variant: "destructive",
        });
        return;
      }

      const bot = assignedBots?.find((b) => b.id === selectedAppId);
      if (!bot) {
        toast({
          title: "No bot selected",
          description: "Please choose a WhatsApp bot before sending files.",
          variant: "destructive",
        });
        return;
      }

      const sendAttachment = async () => {
        setIsSending(true);
        try {
          const folder = `${client.id}/${selectedAppId}/${activeChatId}`;
          const uploaded = await uploadWhatsAppAttachment(file, folder);
          const mediaType = detectWhatsAppMediaType(file);
          const caption = messageInput.trim();
          let usedLocalFallback = false;

          if (bot.provider_type === "api") {
            const result = await sendWhatsAppMessage(
              {
                to: activeChatId,
                body: caption || file.name,
                type: mediaType,
                mediaUrl: uploaded.signedUrl,
                application_id: selectedAppId,
                client_id: client.id,
                phoneNoId: bot.api_config?.phone_id,
                attachment: {
                  storagePath: uploaded.path,
                  fileName: uploaded.fileName,
                  mimeType: uploaded.mimeType,
                  fileSize: uploaded.fileSize,
                  bucket: WHATSAPP_ATTACHMENTS_BUCKET,
                  caption: caption || file.name,
                },
              },
              bot.api_config?.meta_access_token || bot.api_config?.api_key,
            );

            if (!result.success) throw new Error(result.message);

            // Frontend fallback only: if backend/API sent the media but DB logging failed,
            // render an optimistic local message so the attachment is still visible in chat.
            if (
              typeof result.message === "string" &&
              result.message.toLowerCase().includes("failed to log")
            ) {
              usedLocalFallback = true;
              const localMessage = {
                id: `local-attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                client_id: client.id,
                application_id: selectedAppId,
                phone_number: activeChatId,
                message_type: mediaType,
                message_content: caption || file.name,
                direction: "outbound",
                status: "sent",
                sent_at: new Date().toISOString(),
                metadata: {
                  mediaUrl: uploaded.signedUrl,
                  attachment: {
                    bucket: WHATSAPP_ATTACHMENTS_BUCKET,
                    storagePath: uploaded.path,
                    fileName: uploaded.fileName,
                    mimeType: uploaded.mimeType,
                    fileSize: uploaded.fileSize,
                    mediaUrl: uploaded.signedUrl,
                    caption: caption || file.name,
                  },
                },
              };

              setMessages((prev) => dedupeMessagesById([...prev, localMessage]));

              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === activeChatId
                    ? {
                      ...chat,
                      lastMessage: caption || file.name,
                      time: "just now",
                    }
                    : chat,
                ),
              );
            }
          } else {
            const { data: messageRow, error } = await (supabase.from("whatsapp_messages") as any).insert({
              client_id: client.id,
              application_id: selectedAppId,
              phone_number: activeChatId,
              message_type: mediaType,
              message_content: caption || file.name,
              direction: "outbound",
              status: "queued",
              metadata: {
                attachment: {
                  bucket: WHATSAPP_ATTACHMENTS_BUCKET,
                  storagePath: uploaded.path,
                  fileName: uploaded.fileName,
                  mimeType: uploaded.mimeType,
                  fileSize: uploaded.fileSize,
                  mediaUrl: uploaded.signedUrl,
                  caption: caption || file.name,
                },
              },
              sent_at: new Date().toISOString(),
            }).select("id").single();

            if (error) throw error;

            if (messageRow?.id) {
              const { error: attachmentError } = await (supabase as any)
                .from("whatsapp_message_attachments")
                .insert({
                  client_id: client.id,
                  message_id: messageRow.id,
                  storage_bucket: WHATSAPP_ATTACHMENTS_BUCKET,
                  storage_path: uploaded.path,
                  file_name: uploaded.fileName,
                  mime_type: uploaded.mimeType,
                  file_size: uploaded.fileSize,
                  caption: caption || file.name,
                });

              if (attachmentError) {
                console.warn("Attachment record failed:", attachmentError);
              }
            }
          }

          setMessageInput("");
          if (!usedLocalFallback) {
            await fetchMessages(activeChatId);
            await fetchChats();
          }
          toast({
            title: "File sent",
            description: `${file.name} was sent successfully.`,
            duration: 2000,
          });
        } catch (error: any) {
          toast({
            title: "Error sending file",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsSending(false);
        }
      };

      void sendAttachment();
    }
  };

  const fetchChats = useCallback(async () => {
    if (!client) return;
    setIsLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("client_id", client.id)
        .order("sent_at", { ascending: false });
      if (error) throw error;
      const chatMap = new Map();
      const dbStatuses: Record<string, string> = {};

      data?.forEach((msg) => {
        if (msg.phone_number) {
          const cleanPhone = msg.phone_number.replace(/^\+/, '');
          
          if (msg.metadata && typeof msg.metadata === "object" && (msg.metadata as any).lead_status) {
            if (!dbStatuses[cleanPhone]) {
              dbStatuses[cleanPhone] = (msg.metadata as any).lead_status;
            }
          }

          if (!chatMap.has(cleanPhone)) {
            chatMap.set(cleanPhone, {
              id: cleanPhone,
              name: msg.phone_number.startsWith('+') ? msg.phone_number : `+${msg.phone_number}`,
              lastMessage: msg.message_content || "",
              time: msg.sent_at
                ? formatDistanceToNow(new Date(msg.sent_at), { addSuffix: true })
                : "just now",
              unread: 0,
              status: "online",
              phone: cleanPhone,
            });
          }
        }
      });

      // Merge DB statuses with localStorage statuses
      setContactStatuses(prev => {
        const merged = { ...dbStatuses, ...prev };
        try {
          localStorage.setItem(`whatsapp_lead_status_${client.id}`, JSON.stringify(merged));
        } catch (e) {
          console.error("Failed to merge statuses in localStorage:", e);
        }
        return merged;
      });

      setChats(Array.from(chatMap.values()));
    } catch (error: any) {
      toast({
        title: "Error fetching chats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingChats(false);
    }
  }, [client]);

  const fetchMessages = useCallback(
    async (phone: string) => {
      if (!client) return;
      setIsLoadingMessages(true);
      try {
        const cleanPhone = phone.replace(/^\+/, '');
        const plusPhone = `+${cleanPhone}`;
        
        const { data, error } = await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("client_id", client.id)
          .in("phone_number", [cleanPhone, plusPhone])
          .order("sent_at", { ascending: true });
        if (error) throw error;
        setMessages(dedupeMessagesById(data || []));
      } catch (error: any) {
        toast({
          title: "Error fetching messages",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [client, dedupeMessagesById],
  );

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (activeChatId && client) {
      fetchMessages(activeChatId);
      
      const cleanPhone = activeChatId.replace(/^\+/, '');
      const randomId = Math.random().toString(36).substring(2, 9);
      const channelName = `whatsapp_messages:${cleanPhone}-${randomId}`;

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "whatsapp_messages",
            filter: `client_id=eq.${client.id}`,
          },
          (payload) => {
            const msg = payload.new;
            const msgPhone = msg.phone_number?.replace(/^\+/, '');
            if (msgPhone === cleanPhone) {
              setMessages((prev) => dedupeMessagesById([...prev, msg]));
            }
          },
        )
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChatId, client?.id, fetchMessages, dedupeMessagesById]);

  useEffect(() => {
    if (!activeChatId && !client) {
      setLeadInfo(null);
      return;
    }
    const fetchLead = async () => {
      if (!activeChatId || !client) return;
      setIsLoadingLead(true);
      const cleanPhone = activeChatId.replace(/^\+/, '');
      const plusPhone = `+${cleanPhone}`;
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('client_id', client.id)
        .in('phone', [cleanPhone, plusPhone])
        .maybeSingle();
      setLeadInfo(data ?? null);
      setLeadFormData({
        status: data?.status ?? 'new',
        follow_up_date: data?.follow_up_date ?? '',
      });
      setIsLoadingLead(false);
    };
    void fetchLead();
  }, [activeChatId, client]);

  const handleSaveLead = async () => {
    if (!leadInfo?.id || !activeChatId) return;
    setIsSavingLead(true);
    const { error } = await supabase
      .from('leads')
      .update({
        status: leadFormData.status as any,
        follow_up_date: leadFormData.follow_up_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadInfo.id);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead updated' });
      setLeadInfo((prev: any) => ({ ...prev, ...leadFormData }));
      if (leadFormData.status) {
        const mappedStatus = leadFormData.status === 'new' ? 'New Lead' : 
                             leadFormData.status === 'contacted' ? 'Follow-UP' :
                             leadFormData.status === 'qualified' ? 'Demo Pending' :
                             leadFormData.status === 'converted' ? 'Closed Deal' : 'Junk Leads';
        await handleUpdateStatus(activeChatId, mappedStatus);
      }
    }
    setIsSavingLead(false);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeChatId || !selectedAppId || !client)
      return;
    setIsSending(true);
    const bot = assignedBots?.find((b) => b.id === selectedAppId);
    try {
      if (bot?.provider_type === "api") {
        const result = await sendWhatsAppMessage(
          {
            to: activeChatId,
            body: messageInput.trim(),
            application_id: selectedAppId,
            client_id: client.id,
            phoneNoId: bot.api_config?.phone_id,
            type: "text",
          },
          bot.api_config?.meta_access_token || bot.api_config?.api_key,
        );
        if (result.success) setMessageInput("");
        else
          toast({
            title: "Error",
            description: result.message,
            variant: "destructive",
          });
      } else {
        const { error } = await (supabase.from("whatsapp_messages") as any).insert({
          client_id: client.id,
          application_id: selectedAppId,
          phone_number: activeChatId,
          message_type: "text",
          message_content: messageInput.trim(),
          direction: "outbound",
          status: "queued",
          sent_at: new Date().toISOString(),
        } as any);
        if (error) throw error;
        setMessageInput("");
      }
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedChats.size === 0 || !client) return;
    setShowDeleteConfirm(false);

    try {
      const phoneNumbers = Array.from(selectedChats).flatMap((phone) => {
        const clean = phone.replace(/^\+/, '');
        return [clean, `+${clean}`];
      });

      // Delete messages associated with these phone numbers for this client
      const { error } = await (supabase as any)
        .from("whatsapp_messages")
        .delete()
        .eq("client_id", client.id)
        .in("phone_number", phoneNumbers);

      if (error) throw error;

      const { count: remainingCount, error: verifyError } = await (supabase as any)
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .in("phone_number", phoneNumbers);

      if (verifyError) throw verifyError;

      if ((remainingCount || 0) > 0) {
        toast({
          title: "Delete blocked",
          description:
            "No rows were deleted from database. This is likely a Supabase RLS/policy permission issue.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Conversations deleted",
        description: `Successfully deleted ${selectedChats.size} conversation(s) from database.`,
      });

      // Update local state
      setChats((prev) => prev.filter((c) => !selectedChats.has(c.id)));
      if (activeChatId && selectedChats.has(activeChatId)) {
        setActiveChatId(null);
      }

      setIsSelectionMode(false);
      setSelectedChats(new Set());
    } catch (error: any) {
      toast({
        title: "Error deleting conversations",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSelection = (chatId: string) => {
    setSelectedChats((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedChats.size === filteredChats.length && filteredChats.length > 0) {
      setSelectedChats(new Set());
    } else {
      setSelectedChats(new Set(filteredChats.map((c) => c.id)));
    }
  };

  const lastInboundAt = useMemo(() => {
    const inbound = messages.filter(m => m.direction === 'inbound');
    if (inbound.length === 0) return null;
    const latest = inbound[inbound.length - 1];
    return latest.sent_at ? new Date(latest.sent_at) : null;
  }, [messages]);

  const isConversationExpired = useMemo(() => {
    if (!lastInboundAt) return false;
    const hoursSince = (Date.now() - lastInboundAt.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  }, [lastInboundAt]);

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const matchesSearch =
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.phone.includes(searchQuery);

      const status = contactStatuses[chat.id] ?? 'New Lead';
      const matchesFilter = activeFilter === 'All' || status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [chats, searchQuery, contactStatuses, activeFilter]);

  useEffect(() => {
    if (isMobileMode) return;
    if (activeChatId) return;
    if (filteredChats.length === 0) return;

    setActiveChatId(filteredChats[0].id);
  }, [isMobileMode, activeChatId, filteredChats]);

  const handleClearChat = async () => {
    if (!activeChatId || !client) return;
    try {
      const cleanPhone = activeChatId.replace(/^\+/, '');
      const plusPhone = `+${cleanPhone}`;
      
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("client_id", client.id)
        .in("phone_number", [cleanPhone, plusPhone]);

      if (error) throw error;

      const { count: remainingCount, error: verifyError } = await supabase
        .from("whatsapp_messages")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .in("phone_number", [cleanPhone, plusPhone]);

      if (verifyError) throw verifyError;

      if ((remainingCount || 0) > 0) {
        toast({
          title: "Clear blocked",
          description:
            "No rows were deleted from database. This is likely a Supabase RLS/policy permission issue.",
          variant: "destructive",
        });
        return;
      }

      setMessages([]);
      void fetchChats();
      toast({
        title: "Chat cleared",
        description: "All messages in this conversation have been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error clearing chat",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportChat = () => {
    if (!activeChatId || messages.length === 0) {
      toast({
        title: "Export failed",
        description: "No messages found in this conversation to export.",
        variant: "destructive"
      });
      return;
    }
    const exportData = messages.map(m => ({
      direction: m.direction,
      content: m.message_content,
      type: m.message_type,
      time: m.sent_at
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_${activeChatId}_${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Chat exported",
      description: "Conversation has been downloaded as JSON.",
    });
  };

  const handleArchiveChat = () => {
    toast({
      title: "Chat Archived",
      description: "Conversation has been moved to archives.",
    });
  };

  const handleBlockContact = () => {
    toast({
      title: "Contact Blocked",
      description: "You will no longer receive messages from this number.",
      variant: "destructive"
    });
  };

  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);

  const handleDeleteMessage = async (messageId: string) => {
    if (!messageId) return;
    setDeletingMsgId(messageId);
    try {
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast({ title: "Message deleted" });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingMsgId(null);
    }
  };

  const isOutboundMessage = (msg: any) =>
    msg.direction === "outbound" ||
    ["sent", "delivered", "read", "queued", "failed"].includes(msg.status);

  return (
    <>
      {/* ── Delete Confirmation Dialog ─────────────────────────── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900">Delete Conversations?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This will permanently delete <span className="font-bold text-slate-700">{selectedChats.size} conversation{selectedChats.size !== 1 ? "s" : ""}</span> and all their messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteSelected}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-1 w-full min-w-0 min-h-0 overflow-hidden flex-col xl:flex-row rounded-none xl:rounded-3xl xl:border xl:border-slate-200 bg-white xl:shadow-2xl h-full">
        {/* ── LEFT PANEL: Contact list ─────────────────────────── */}
        {showListPanel && (
          <div
            className={cn(
              "flex flex-col bg-white border-r border-slate-200/60 min-w-0 min-h-0 overflow-hidden",
              isMobileMode
                ? "w-full flex-1"
                : viewMode === "list"
                  ? "w-72 2xl:w-80 shrink-0 h-full"
                  : "flex-1 h-full",
            )}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-3 pb-3 space-y-3">
              {isSelectionMode ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100"
                        onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedChats(new Set());
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900">
                        {selectedChats.size} Selected
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={selectedChats.size === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedChats.size === filteredChats.length && filteredChats.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-600">Select All</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="pl-3 text-lg font-bold tracking-tight text-slate-900">
                      Messages
                    </h2>
                    <div className="flex items-center gap-1">
                      {onNewChat && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                          onClick={onNewChat}
                          title="New Chat"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-xl">
                          <DropdownMenuLabel className="text-xs tracking-wider uppercase text-slate-500">Inbox Options</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2" onClick={() => setIsSelectionMode(true)}>
                            <CheckSquare className="h-4 w-4" />
                            <span>Delete messages</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <Filter className="h-4 w-4" />
                            <span>Filter unread messages</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <Archive className="h-4 w-4" />
                            <span>Archive all conversations</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <Settings className="h-4 w-4" />
                            <span>Inbox Settings</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="relative group flex-1 min-w-0 ml-3">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-all group-focus-within:text-blue-600" />
                    <Input
                      placeholder="Search conversations..."
                      className="h-9 w-full border-slate-200 bg-slate-50 pl-9 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-xs font-semibold"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Filter Tags */}
            {!isSelectionMode && (
              <div className="flex-shrink-0 px-4 pb-2 overflow-x-auto">
                <div className="flex gap-1.5 min-w-max">
                  {['All', 'New Lead', 'Demo Pending', 'Follow-UP', 'Demo', 'Closed Deal', 'Junk Leads'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveFilter(tag)}
                      className={cn(
                        'px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border',
                        activeFilter === tag
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* View mode toggle — always visible in its own row */}
            {!isSelectionMode && (
              <div className="flex-shrink-0 px-4 pb-2">
                <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all",
                      viewMode === "list"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    ☰ List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("kanban")}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-all",
                      viewMode === "kanban"
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    ⬛ Kanban
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable list or Kanban Board */}
            {viewMode === "list" ? (
              <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4 h-full">
                {isLoadingChats ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-40">
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-xs font-bold uppercase tracking-widest">
                      Scanning Inbox...
                    </p>
                  </div>
                ) : filteredChats.length > 0 ? (
                  <div className="space-y-0.5 pt-1">
                    {filteredChats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={(e) => {
                          if (isSelectionMode) {
                            toggleSelection(chat.id);
                          } else {
                            handleSelectChat(chat.id);
                          }
                        }}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 min-w-0 text-left transition-all duration-200",
                          activeChatId === chat.id && !isMobileMode && !isSelectionMode
                            ? "border border-blue-100 bg-blue-50 shadow-sm"
                            : "hover:bg-slate-50 active:scale-[0.985]",
                          isSelectionMode && selectedChats.has(chat.id) && "bg-slate-50",
                        )}
                      >
                        {activeChatId === chat.id && !isMobileMode && !isSelectionMode && (
                          <div className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                        )}

                        {isSelectionMode && (
                          <div
                            className="mr-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedChats.has(chat.id)}
                              onChange={() => toggleSelection(chat.id)}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div className="relative shrink-0">
                          <Avatar className="h-10 w-10 border-2 border-white shadow-md">
                            <AvatarFallback
                              className={cn(
                                "text-xs font-black",
                                activeChatId === chat.id && !isMobileMode
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-600",
                              )}
                            >
                              {chat.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                              chat.status === "online"
                                ? "bg-green-500"
                                : "bg-slate-300",
                            )}
                          />
                        </div>

                        <div className="flex min-w-0 w-0 flex-1 flex-col items-start overflow-hidden">
                          <div className="mb-0.5 flex w-full items-center justify-between">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {chat.name}
                            </span>
                            <span className="ml-2 shrink-0 whitespace-nowrap text-[10px] font-semibold text-slate-400">
                              {chat.time}
                            </span>
                          </div>
                          <span className="block w-full truncate text-[11px] font-medium text-slate-500">
                            {chat.lastMessage}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                      <MessageSquare className="h-7 w-7" />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      No conversations found
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto flex gap-4 p-4 min-h-0 select-none bg-slate-50/30 border-t border-slate-100">
                {KANBAN_COLUMNS.map((column) => {
                  const columnChats = getChatsByColumn(column);
                  return (
                    <div
                      key={column}
                      onDragOver={handleDragOver}
                      onDragEnter={() => setDraggedOverColumn(column)}
                      onDragLeave={() => setDraggedOverColumn(null)}
                      onDrop={(e) => {
                        setDraggedOverColumn(null);
                        handleDrop(e, column);
                      }}
                      className={cn(
                        "flex flex-col rounded-2xl border p-4 min-w-[280px] w-[280px] sm:w-[300px] shrink-0 min-h-0 bg-slate-50/50 transition-all duration-200",
                        COLUMN_STYLES[column].bg,
                        COLUMN_STYLES[column].border,
                        draggedOverColumn === column && "ring-2 ring-blue-500 ring-offset-2 bg-blue-50/20"
                      )}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-3 shrink-0">
                        <span className={cn("text-[11px] font-black uppercase tracking-wider", COLUMN_STYLES[column].text)}>
                          {column}
                        </span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black", COLUMN_STYLES[column].badgeBg)}>
                          {columnChats.length}
                        </span>
                      </div>

                      {/* Cards Container */}
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-10">
                        {columnChats.map((chat) => (
                          <div
                            key={chat.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, chat.id)}
                            onClick={() => handleSelectChat(chat.id)}
                            className={cn(
                              "relative p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all text-left space-y-2 select-none",
                              activeChatId === chat.id && "border-blue-500 ring-2 ring-blue-500/10 bg-blue-50/10"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 border-2 border-white shadow">
                                <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-black">
                                  {chat.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-slate-900">
                                  {chat.name}
                                </p>
                              </div>
                              <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                                {chat.time}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-[10px] font-medium text-slate-500 leading-normal">
                              {chat.lastMessage}
                            </p>
                          </div>
                        ))}
                        {columnChats.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200/50 rounded-xl opacity-30 text-[10px] font-bold text-slate-400">
                            Drag leads here
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── RIGHT PANEL: Chat or Welcome ─────────────────────── */}
        {showChatPanel && (
          <div
            className={cn(
              "flex flex-col overflow-hidden bg-slate-50/30 min-w-0 min-h-0",
              isMobileMode ? "w-full flex-1" : "flex-1 h-full",
            )}
          >
            <AnimatePresence mode="wait">
              {activeChatId ? (
                <motion.div
                  key={activeChatId}
                  initial={{ opacity: 0, x: isMobileMode ? 20 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isMobileMode ? -20 : 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 35 }}
                  className="flex flex-col h-full w-full overflow-hidden"
                >
                  {/* Chat header */}
                  <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200/60 bg-white/90 px-3 py-2.5 backdrop-blur-md">
                    <div className="flex items-center gap-2 min-w-0">
                      {isMobileMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100 shrink-0"
                          onClick={handleBackToList}
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                      )}
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9 border border-slate-100 shadow-sm">
                          <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                            {activeChatId.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-slate-900 leading-tight">
                          {activeChatId}
                        </h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-[0.1em]">
                          Online Now
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-200">
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 py-2"
                            onClick={() => toast({ title: "Contact Info", description: `Number: ${activeChatId}` })}
                          >
                            <User className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Contact Info</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2" onClick={() => toast({ title: "Search coming soon" })}>
                            <Search className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Search Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2" onClick={handleExportChat}>
                            <Download className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Export Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 py-2 text-yellow-600 focus:text-yellow-700 focus:bg-yellow-50"
                            onClick={handleArchiveChat}
                          >
                            <Archive className="h-4 w-4" />
                            <span className="font-medium">Archive Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                            onClick={handleBlockContact}
                          >
                            <Ban className="h-4 w-4" />
                            <span className="font-medium">Block Contact</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                            onClick={handleClearChat}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="font-medium">Clear Chat</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Messages – scrollable, fills space */}
                  <div
                    className="flex-1 min-h-0 overflow-hidden"
                    style={{
                      backgroundColor: "#e5ddd5",
                      backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`,
                      backgroundBlendMode: "overlay",
                      backgroundSize: "400px",
                    }}
                  >
                    <div ref={scrollRef} className="h-full overflow-y-auto">
                      <div className="flex w-full flex-col gap-4 px-3 py-4 md:px-5">
                        {messages.length === 0 && !isLoadingMessages && (
                          <div className="flex flex-col items-center justify-center py-20 opacity-40">
                            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                              <MessageSquare className="h-7 w-7 text-slate-400" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                              No messages yet
                            </p>
                          </div>
                        )}
                        {messages.map((msg, index) => {
                          const attachmentUrl = getMessageAttachmentUrl(msg);
                          const attachmentName = getMessageAttachmentName(msg);
                          const messageContent = (msg?.message_content || "").trim();
                          const isOutbound = isOutboundMessage(msg);
                          const isAttachmentType = ["image", "video", "audio", "document"].includes(msg.message_type);
                          const isAttachmentMessage = isAttachmentType && !!attachmentUrl;
                          const isGhostAttachmentBubble =
                            isOutbound &&
                            isAttachmentType &&
                            !attachmentUrl &&
                            !messageContent;

                          if (isGhostAttachmentBubble) return null;

                          return (
                            <div
                              key={`${msg?.id ?? "message"}-${msg?.sent_at ?? index}`}
                              className={cn(
                                "group/msg relative flex w-full items-end gap-2",
                                isOutbound
                                  ? "flex-row-reverse"
                                  : "flex-row",
                              )}
                            >
                              <Avatar className="mb-1 h-6 w-6 shrink-0 border border-slate-200 shadow-sm">
                                <AvatarFallback
                                  className={cn(
                                    "text-[8px] font-bold",
                                    isOutbound
                                      ? "bg-blue-600 text-white"
                                      : "bg-slate-100 text-slate-700",
                                  )}
                                >
                                  {isOutbound ? "AI" : "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={cn(
                                  "flex max-w-[78%] flex-col gap-1",
                                  isOutbound
                                    ? "items-end ml-auto"
                                    : "items-start mr-auto",
                                )}
                              >
                                <div
                                  className={cn(
                                    "text-[13px] font-medium leading-relaxed break-words whitespace-pre-wrap",
                                    isAttachmentMessage
                                      ? "bg-transparent p-0 shadow-none"
                                      : isOutbound
                                        ? "rounded-2xl rounded-br-none bg-blue-600 px-4 py-2.5 text-white shadow-sm"
                                        : "rounded-2xl rounded-bl-none border border-slate-100 bg-white px-4 py-2.5 text-slate-800 shadow-sm",
                                  )}
                                >
                                  {msg.message_type === 'image' && attachmentUrl ? (
                                    <div className="flex flex-col gap-2">
                                      <img
                                        src={attachmentUrl}
                                        alt="attachment"
                                        className="max-w-[200px] sm:max-w-[250px] rounded-xl object-contain bg-black/5 ring-1 ring-black/5"
                                      />
                                      {msg.message_content && (
                                        <span className="text-[12px] text-slate-700">{msg.message_content}</span>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={attachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          Open
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => void handleDownloadAttachment(attachmentUrl, attachmentName)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                          <Download className="h-3 w-3" />
                                          Download
                                        </button>
                                      </div>
                                    </div>
                                  ) : msg.message_type === 'video' && attachmentUrl ? (
                                    <div className="flex flex-col gap-2">
                                      <video
                                        src={attachmentUrl}
                                        controls
                                        className="max-w-[200px] sm:max-w-[250px] rounded-xl object-contain bg-black/5 ring-1 ring-black/5"
                                      />
                                      {msg.message_content && (
                                        <span className="text-[12px] text-slate-700">{msg.message_content}</span>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={attachmentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          Open
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => void handleDownloadAttachment(attachmentUrl, attachmentName)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                          <Download className="h-3 w-3" />
                                          Download
                                        </button>
                                      </div>
                                    </div>
                                  ) : (msg.message_type === 'document' || msg.message_type === 'audio' || attachmentUrl) && msg.message_type !== 'text' ? (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 shadow-sm">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                                          <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-xs font-semibold text-slate-900">
                                            {attachmentName}
                                          </p>
                                          <p className="truncate text-[11px] text-slate-500">
                                            {msg.message_type === 'audio' ? 'Audio attachment' : msg.message_type === 'document' ? 'Document attachment' : 'Open attachment'}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <a
                                          href={attachmentUrl || "#"}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                          Open
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => void handleDownloadAttachment(attachmentUrl, attachmentName)}
                                          disabled={!attachmentUrl}
                                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <Download className="h-3 w-3" />
                                          Download
                                        </button>
                                      </div>
                                      {msg.message_type === 'audio' && attachmentUrl && (
                                        <audio
                                          controls
                                          src={attachmentUrl}
                                          className="mt-1 w-full max-w-[250px]"
                                        />
                                      )}
                                      {msg.message_content && msg.message_content !== msg.metadata?.attachment?.fileName && (
                                        <span className="text-[12px] text-slate-700">{msg.message_content}</span>
                                      )}
                                    </div>
                                  ) : (
                                    msg.message_content
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-medium text-slate-400">
                                    {msg.sent_at
                                      ? format(new Date(msg.sent_at), "HH:mm")
                                      : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    disabled={deletingMsgId === msg.id}
                                    className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 p-1 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500"
                                    title="Delete message"
                                  >
                                    {deletingMsgId === msg.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {isLoadingMessages && (
                          <div className="flex justify-center py-4 opacity-50">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          </div>
                        )}
                        {/* Scroll sentinel – always stays at bottom */}
                        <div ref={bottomRef} className="h-0 w-full" />
                      </div>
                    </div>
                  </div>

                  {/* Message input – fixed at bottom, never scrolls */}
                  <div className="flex-shrink-0 border-t border-slate-200/60 bg-white/95 px-2 py-2 md:px-3 md:py-3 backdrop-blur-md w-full">
                    {isConversationExpired ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-xs font-semibold text-amber-800">
                            Conversation expired. More than 24 hours have passed since the customer's last reply. You must send a template.
                          </p>
                        </div>
                        <Button
                          className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-9"
                          onClick={() => setTemplateDialogOpen(true)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-2" />
                          Send Template
                        </Button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="file"
                          className="hidden"
                          ref={photoInputRef}
                          accept="image/*,video/*"
                          onChange={handleFileChange}
                        />
                        <input
                          type="file"
                          className="hidden"
                          ref={docInputRef}
                          accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx"
                          onChange={handleFileChange}
                        />
                        <input
                          type="file"
                          className="hidden"
                          ref={cameraInputRef}
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileChange}
                        />

                        <div className="flex items-center gap-0.5 md:gap-1 rounded-2xl md:rounded-3xl border border-slate-200 bg-white px-1 py-1 md:px-2 md:py-1.5 shadow-sm md:shadow-md w-full min-w-0">
                          {/* Emoji */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100"
                              >
                                <Smile className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="start"
                              className="w-[280px] p-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl"
                            >
                              <div className="bg-white">
                                <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Emoji
                                  </p>
                                </div>
                                <ScrollArea className="h-56">
                                  <div className="p-2 space-y-3">
                                    {EMOJI_CATEGORIES.map((cat) => (
                                      <div key={cat.label} className="space-y-1">
                                        <p className="px-2 text-[9px] font-bold text-slate-400 uppercase">
                                          {cat.label}
                                        </p>
                                        <div className="grid grid-cols-6 gap-1">
                                          {cat.emojis.map((emoji) => (
                                            <button
                                              key={emoji}
                                              onClick={() => onEmojiSelect(emoji)}
                                              className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-blue-50 text-lg transition-all hover:scale-110 active:scale-95"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </div>
                            </PopoverContent>
                          </Popover>

                          {/* Attachment */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 text-slate-500 hover:bg-slate-100"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="top"
                              align="start"
                              className="w-48 p-2 rounded-2xl border-slate-200 shadow-2xl"
                            >
                              <div className="grid gap-1">
                                {ATTACHMENT_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.label}
                                    onClick={() => handleAttachmentClick(opt.label)}
                                    className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                                  >
                                    <div
                                      className="p-1.5 rounded-lg transition-transform group-hover:scale-110"
                                      style={{
                                        backgroundColor: `${opt.color}15`,
                                        color: opt.color,
                                      }}
                                    >
                                      <opt.icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {opt.label}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

                          <textarea
                            placeholder="Type a message..."
                            className="flex-1 min-w-0 resize-none border-none bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                            rows={1}
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            className={cn(
                              "h-8 w-8 shrink-0 rounded-2xl transition-all",
                              messageInput.trim()
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-500"
                                : "bg-slate-100 text-slate-500",
                            )}
                            onClick={handleSendMessage}
                            disabled={!messageInput.trim() || isSending}
                          >
                            {isSending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-1 h-full min-h-[520px] items-center justify-center p-6"
                >
                  <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-50 text-blue-600">
                      <MessageSquare className="h-8 w-8" />
                    </div>
                    <h2 className="mb-2 text-2xl font-black text-slate-900 tracking-tight">
                      No conversation selected
                    </h2>
                    <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-slate-500">
                      Choose a contact from the list to view the chat thread and
                      continue the conversation.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* LEAD SIDEBAR — only show on desktop when a chat is active */}
        {!isMobileMode && activeChatId && (
          <div className="w-64 2xl:w-72 shrink-0 h-full flex flex-col border-l border-slate-200/60 bg-white overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Lead Info</h3>
            </div>

            {isLoadingLead ? (
              <div className="flex items-center justify-center py-10 opacity-40">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : leadInfo ? (
              <div className="p-4 space-y-4">
                {/* Name & Phone */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact</p>
                  <p className="text-sm font-bold text-slate-900">{leadInfo.name || activeChatId}</p>
                  <p className="text-xs text-slate-500">{leadInfo.phone}</p>
                </div>

                {/* Notes */}
                {leadInfo.notes && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{leadInfo.notes}</p>
                  </div>
                )}

                {/* Follow-up flags */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Follow-ups Sent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['24h', '48h', '72h'] as const).map(label => {
                      const key = `followup_${label}_sent` as keyof typeof leadInfo;
                      return (
                        <span
                          key={label}
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            leadInfo[key]
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          )}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Status selector */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lead Status</p>
                  <Select
                    value={leadFormData.status}
                    onValueChange={v => setLeadFormData(prev => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['new', 'contacted', 'qualified', 'converted', 'lost'].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Follow-up date */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Follow-up Date</p>
                  <Input
                    type="date"
                    className="h-8 text-xs rounded-lg"
                    value={leadFormData.follow_up_date}
                    onChange={e => setLeadFormData(prev => ({ ...prev, follow_up_date: e.target.value }))}
                  />
                </div>

                <Button
                  className="w-full h-8 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  onClick={handleSaveLead}
                  disabled={isSavingLead}
                >
                  {isSavingLead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Changes'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 opacity-30 px-4 text-center">
                <User className="h-6 w-6 mb-2 text-slate-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No lead record found</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Send Template</DialogTitle>
            <DialogDescription>
              Select a pre-approved template to re-open this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => (
                  <SelectItem key={t.id ?? t.name} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!selectedTemplate || isSending}
              onClick={async () => {
                if (!activeChatId || !selectedAppId || !client || !selectedTemplate) return;
                setIsSending(true);
                const bot = assignedBots?.find(b => b.id === selectedAppId);
                try {
                  const tplObj = templates.find(t => t.name === selectedTemplate);
                  const tplLang = tplObj?.language || tplObj?.language_code || 'en_US';
                  const result = await sendWhatsAppMessage(
                    {
                      to: activeChatId,
                      body: selectedTemplate,
                      type: 'template',
                      name: selectedTemplate,
                      language: tplLang,
                      application_id: selectedAppId,
                      client_id: client.id,
                      phoneNoId: bot?.api_config?.phone_id,
                    },
                    bot?.api_config?.meta_access_token || bot?.api_config?.api_key,
                  );
                  if (result.success) {
                    toast({ title: 'Template sent' });
                    setTemplateDialogOpen(false);
                    setSelectedTemplate('');
                    await fetchMessages(activeChatId);
                  } else {
                    toast({ title: 'Error', description: result.message, variant: 'destructive' });
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e.message, variant: 'destructive' });
                } finally {
                  setIsSending(false);
                }
              }}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
