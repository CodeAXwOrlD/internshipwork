  import {
    useState,
    useMemo,
    useEffect,
    useCallback,
    useRef,
    useLayoutEffect,
  } from "react";
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

  export default function WhatsAppInbox({
    selectedAppId,
    assignedBots,
  }: {
    selectedAppId?: string | null;
    assignedBots?: any[];
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
    
    // Bulk selection state
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());

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
    const showListPanel = !isMobileMode || activeChatId === null;
    const showChatPanel = !isMobileMode || activeChatId !== null;

    // Auto-scroll messages to bottom when messages or active chat changes
    useEffect(() => {
      const scrollToBottom = () => {
        if (!scrollRef.current) return;

        const tryFindViewport = (): HTMLElement | null => {
          const selectors = [
            '[data-radix-scroll-area-viewport]',
            '.radix-scroll-area-viewport',
            '.scroll-area-viewport',
            'div[style*="overflow"]',
          ];
          for (const sel of selectors) {
            const el = scrollRef.current!.querySelector(sel) as HTMLElement | null;
            if (el) return el;
          }
          // Fallback: pick first div that can scroll
          const divs = scrollRef.current.querySelectorAll<HTMLElement>('div');
          for (const d of divs) {
            if (d.scrollHeight > d.clientHeight) return d;
          }
          return null;
        };

        const viewport = tryFindViewport();
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      };

      // Try multiple timings to ensure after render and any async content we scroll
      scrollToBottom();
      const raf = requestAnimationFrame(scrollToBottom);
      const t1 = setTimeout(scrollToBottom, 50);
      const t2 = setTimeout(scrollToBottom, 200);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [messages, activeChatId]);

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
                bot.api_config?.api_key,
              );

              if (!result.success) throw new Error(result.message);
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
            toast({
              title: "File sent",
              description: `${file.name} was sent successfully.`,
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
        data?.forEach((msg) => {
          if (msg.phone_number && !chatMap.has(msg.phone_number)) {
            chatMap.set(msg.phone_number, {
              id: msg.phone_number,
              name: msg.phone_number,
              lastMessage: msg.message_content || "",
              time: msg.sent_at
                ? formatDistanceToNow(new Date(msg.sent_at), { addSuffix: true })
                : "just now",
              unread: 0,
              status: "online",
              phone: msg.phone_number,
            });
          }
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
    }, [client, selectedAppId]);

    const fetchMessages = useCallback(
      async (phone: string) => {
        if (!client) return;
        setIsLoadingMessages(true);
        try {
          const { data, error } = await supabase
            .from("whatsapp_messages")
            .select("*")
            .eq("client_id", client.id)
            .eq("phone_number", phone)
            .order("sent_at", { ascending: true });
          if (error) throw error;
          setMessages(data || []);
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
      [client, selectedAppId],
    );

    useEffect(() => {
      fetchChats();
    }, [fetchChats]);

    useEffect(() => {
      if (activeChatId) {
        fetchMessages(activeChatId);
        const channel = supabase
          .channel(`whatsapp_messages:${activeChatId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "whatsapp_messages",
              filter: `phone_number=eq.${activeChatId}`,
            },
            (payload) => setMessages((prev) => [...prev, payload.new]),
          )
          .subscribe();
        return () => {
          supabase.removeChannel(channel);
        };
      }
    }, [activeChatId, fetchMessages]);

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
            bot.api_config?.api_key,
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
      const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedChats.size} conversation(s)? This will delete all messages in these chats.`);
      if (!confirmDelete) return;

      try {
        const phoneNumbers = Array.from(selectedChats);
        
        // Delete messages associated with these phone numbers for this client
        const { error } = await supabase
          .from("whatsapp_messages")
          .delete()
          .eq("client_id", client.id)
          .in("phone_number", phoneNumbers);

        if (error) throw error;

        toast({
          title: "Conversations deleted",
          description: `Successfully deleted ${selectedChats.size} conversation(s).`,
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

    const filteredChats = useMemo(
      () =>
        chats.filter(
          (chat) =>
            chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            chat.phone.includes(searchQuery),
        ),
      [chats, searchQuery],
    );

    useEffect(() => {
      if (isMobileMode) return;
      if (activeChatId) return;
      if (filteredChats.length === 0) return;

      setActiveChatId(filteredChats[0].id);
    }, [isMobileMode, activeChatId, filteredChats]);

    const isOutboundMessage = (msg: any) =>
      msg.direction === "outbound" ||
      ["sent", "delivered", "read", "queued", "failed"].includes(msg.status);

    return (
      <div className="flex flex-1 w-full min-w-0 min-h-0 overflow-hidden flex-col xl:flex-row rounded-none xl:rounded-3xl xl:border xl:border-slate-200 bg-white xl:shadow-2xl">
        {/* ── LEFT PANEL: Contact list ─────────────────────────── */}
        {showListPanel && (
          <div
            className={cn(
              "flex flex-col bg-white border-r border-slate-200/60 min-w-0",
              isMobileMode
                ? "w-full flex-1 min-h-0"
                : "w-56 2xl:w-72 shrink-0",
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
                      onClick={handleDeleteSelected}
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
                  <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-all group-focus-within:text-blue-600" />
                    <Input
                      placeholder="Search conversations..."
                      className="h-9 border-slate-200 bg-slate-50 pl-9 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-xs font-semibold"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4 h-full">
              {isLoadingChats ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
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
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-3 min-w-0 transition-all duration-200 relative text-left",
                        activeChatId === chat.id && !isMobileMode && !isSelectionMode
                          ? "bg-blue-50 border border-blue-100"
                          : "hover:bg-slate-50 active:scale-[0.98]",
                        isSelectionMode && selectedChats.has(chat.id) && "bg-slate-50"
                      )}
                    >
                      {activeChatId === chat.id && !isMobileMode && !isSelectionMode && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-blue-600 rounded-r-full" />
                      )}
                      
                      {isSelectionMode && (
                        <div className="shrink-0 mr-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedChats.has(chat.id)}
                            onChange={() => toggleSelection(chat.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
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
                      <div className="flex flex-1 flex-col items-start overflow-hidden min-w-0 w-0">
                        <div className="flex w-full items-center justify-between mb-0.5">
                          <span className="truncate text-sm font-bold text-slate-900">
                            {chat.name}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 whitespace-nowrap ml-2 shrink-0">
                            {chat.time}
                          </span>
                        </div>
                        <span className="truncate text-[11px] font-medium text-slate-500 w-full block">
                          {chat.lastMessage}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 mb-4">
                    <MessageSquare className="h-7 w-7" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    No conversations found
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RIGHT PANEL: Chat or Welcome ─────────────────────── */}
        {showChatPanel && (
          <div
            className={cn(
              "flex flex-col overflow-hidden bg-slate-50/30 min-w-0 min-h-0",
              isMobileMode ? "w-full flex-1" : "flex-1",
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
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <User className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Contact Info</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <Search className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Search Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2">
                            <Download className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">Export Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-yellow-600 focus:text-yellow-700 focus:bg-yellow-50">
                            <Archive className="h-4 w-4" />
                            <span className="font-medium">Archive Chat</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-700 focus:bg-red-50">
                            <Ban className="h-4 w-4" />
                            <span className="font-medium">Block Contact</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-700 focus:bg-red-50">
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
                    <ScrollArea
                      className="h-full px-3 py-4 md:px-5"
                      viewportRef={scrollRef}
                    >
                      <div className="mx-auto flex max-w-3xl flex-col gap-4">
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
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex items-end gap-2",
                              isOutboundMessage(msg)
                                ? "flex-row-reverse"
                                : "flex-row",
                            )}
                          >
                            <Avatar className="mb-1 h-6 w-6 shrink-0 border border-slate-200 shadow-sm">
                              <AvatarFallback
                                className={cn(
                                  "text-[8px] font-bold",
                                  isOutboundMessage(msg)
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-100 text-slate-700",
                                )}
                              >
                                {isOutboundMessage(msg) ? "AI" : "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={cn(
                                "flex max-w-[78%] flex-col gap-1",
                                isOutboundMessage(msg)
                                  ? "items-end"
                                  : "items-start",
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-2xl px-4 py-2.5 shadow-sm text-[13px] font-medium leading-relaxed",
                                  isOutboundMessage(msg)
                                    ? "rounded-br-none bg-blue-600 text-white"
                                    : "rounded-bl-none bg-white text-slate-800 border border-slate-100",
                                )}
                              >
                                {msg.message_type === 'image' && (msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl) ? (
                                  <div className="flex flex-col gap-2">
                                    <img 
                                      src={msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl} 
                                      alt="attachment" 
                                      className="max-w-[200px] sm:max-w-[250px] rounded-lg object-contain bg-black/5" 
                                    />
                                    {msg.message_content && <span>{msg.message_content}</span>}
                                  </div>
                                ) : msg.message_type === 'video' && (msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl) ? (
                                  <div className="flex flex-col gap-2">
                                    <video 
                                      src={msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl} 
                                      controls
                                      className="max-w-[200px] sm:max-w-[250px] rounded-lg object-contain bg-black/5" 
                                    />
                                    {msg.message_content && <span>{msg.message_content}</span>}
                                  </div>
                                ) : (msg.message_type === 'document' || msg.message_type === 'audio' || msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl) && msg.message_type !== 'text' ? (
                                  <div className="flex flex-col gap-2">
                                    <a 
                                      href={msg.metadata?.mediaUrl || msg.metadata?.attachment?.mediaUrl || "#"} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
                                    >
                                      <FileText className="h-5 w-5 shrink-0" />
                                      <span className="truncate underline font-semibold text-xs">
                                        {msg.metadata?.attachment?.fileName || "View Attachment"}
                                      </span>
                                    </a>
                                    {msg.message_content && <span>{msg.message_content}</span>}
                                  </div>
                                ) : (
                                  msg.message_content
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-slate-400">
                                {msg.sent_at
                                  ? format(new Date(msg.sent_at), "HH:mm")
                                  : ""}
                              </span>
                            </div>
                          </div>
                        ))}
                        {isLoadingMessages && (
                          <div className="flex justify-center py-4 opacity-50">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Message input – fixed at bottom, never scrolls */}
                  <div className="flex-shrink-0 border-t border-slate-200/60 bg-white/95 p-2 md:p-3 backdrop-blur-md">
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

                    <div className="flex items-center gap-1 rounded-3xl border border-slate-200 bg-white px-2 py-1.5 shadow-md">
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
      </div>
    );
  }
