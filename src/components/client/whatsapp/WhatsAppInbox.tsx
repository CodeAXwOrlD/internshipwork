import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Search, Paperclip, Smile, Send, 
  MessageSquare, Phone, CheckCheck, 
  ChevronDown, Zap, MoreHorizontal, Bot, X, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/contexts/ClientContext";
import { format, formatDistanceToNow } from "date-fns";
import { sendWhatsAppMessage } from "@/utils/whatsapp";
import { useToast } from "@/hooks/use-toast";

const FILTERS = ["All", "Closed Deal", "Demo", "Demo Pending", "Follow-UP", "Junk Leads", "New Lead"];

export default function WhatsAppInbox() {
  const { client } = useClient();
  const { toast } = useToast();
  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [messageInput, setMessageInput] = useState("");
  // sidebarOpen state removed in favor of activeChatId for mobile routing
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch Chats (Generated from Messages)
  const fetchChats = useCallback(async () => {
    if (!client) return;
    setIsLoadingChats(true);
    
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('phone_number, sender_name, message_content, sent_at, status, direction')
      .eq('client_id', client.id)
      .order('sent_at', { ascending: false });
    
    if (!error && data) {
      const chatMap = new Map();
      data.forEach(msg => {
        if (!chatMap.has(msg.phone_number)) {
          chatMap.set(msg.phone_number, {
            id: msg.phone_number,
            phone_number: msg.phone_number,
            contact_name: msg.sender_name || msg.phone_number,
            last_message_snippet: msg.message_content,
            last_message_at: msg.sent_at,
            status: 'New Lead'
          });
        }
      });
      
      const chatList = Array.from(chatMap.values());
      setChats(chatList);
      if (chatList.length > 0 && !activeChatId) {
        setActiveChatId(chatList[0].id);
      }
    }
    setIsLoadingChats(false);
  }, [client, activeChatId]);

  const fetchMessages = useCallback(async (chatId: string) => {
    if (!client) return;
    setIsLoadingMessages(true);
    const { data, error } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('phone_number', chatId)
      .eq('client_id', client.id)
      .order('sent_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data);
    }
    setIsLoadingMessages(false);
  }, [client]);

  useEffect(() => {
    if (client) fetchChats();
  }, [client]);

  useEffect(() => {
    if (activeChatId) fetchMessages(activeChatId);
    else setMessages([]);
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const messagesChannel = supabase
      .channel(`messages_${activeChatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'whatsapp_messages',
        filter: `phone_number=eq.${activeChatId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        fetchChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(messagesChannel); };
  }, [activeChatId]);

  const activeChat = useMemo(() => 
    chats.find(c => c.id === activeChatId), 
  [chats, activeChatId]);

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const matchesSearch = (chat.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                           chat.phone_number.includes(searchQuery);
      const matchesFilter = activeFilter === "All" || chat.status === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [chats, searchQuery, activeFilter]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeChat || isSending) return;
    setIsSending(true);
    try {
      const result = await sendWhatsAppMessage({
        to: activeChat.phone_number,
        body: messageInput,
        client_id: client?.id,
        type: "text",
        phoneNoId,
      });
      if (result.success) setMessageInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white/40 shadow-sm rounded-[2rem]">
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-slate-200/50 bg-transparent transition-all duration-300",
        activeChatId ? "hidden md:flex md:w-80 lg:w-96 flex-shrink-0" : "flex w-full md:w-80 lg:w-96 flex-shrink-0"
      )}>
        <div className="p-4 space-y-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Messages</h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search..." 
              className="pl-9 bg-white shadow-sm border-none text-slate-900 placeholder:text-slate-400 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-1 px-1">
            {FILTERS.map(f => (
              <Button
                key={f}
                variant={activeFilter === f ? "default" : "outline"}
                size="sm"
                className={cn(
                  "rounded-full text-[10px] h-7 whitespace-nowrap transition-all border-none", 
                  activeFilter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm"
                )}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingChats ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 text-blue-500 animate-spin" /></div>
            ) : filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all",
                  activeChatId === chat.id ? "bg-white shadow-sm" : "hover:bg-white/60"
                )}
              >
                <Avatar className="h-12 w-12 border border-white shadow-sm">
                  <AvatarFallback className="bg-blue-600 text-white font-bold">
                    {chat.contact_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900 truncate text-sm">{chat.contact_name}</h3>
                    <span className="text-[10px] text-slate-400">
                      {chat.last_message_at ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: false }) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{chat.last_message_snippet}</p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className={cn("flex-1 flex flex-col min-w-0", !activeChatId && "hidden md:flex")}>
        {activeChat ? (
          <>
            <div className="p-4 border-b border-slate-200/50 flex items-center justify-between bg-white/40 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveChatId(null)}>
                  <ChevronDown className="h-5 w-5 rotate-90 text-slate-500" />
                </Button>
                <Avatar className="h-10 w-10 border border-white shadow-sm">
                  <AvatarFallback className="bg-slate-100 text-slate-700 font-bold">
                    {activeChat.contact_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">{activeChat.contact_name}</h3>
                  <p className="text-[10px] text-slate-500">{activeChat.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"><Phone className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex items-end gap-2", msg.direction === 'outbound' ? "flex-row-reverse" : "flex-row")}>
                    <Avatar className="h-8 w-8 shrink-0 mb-1 border border-white shadow-sm">
                      <AvatarFallback className={cn("text-[10px] font-bold", msg.direction === 'outbound' ? "bg-slate-100 text-slate-700" : "bg-blue-600 text-white")}>
                        {msg.direction === 'outbound' ? 'AI' : (msg.sender_name || 'U').substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn("max-w-[80%] flex flex-col gap-1", msg.direction === 'outbound' ? "items-end" : "items-start")}>
                      <div className={cn("p-3 rounded-2xl text-sm shadow-sm", msg.direction === 'outbound' ? "bg-blue-600 text-white rounded-br-none" : "bg-white text-slate-800 rounded-bl-none")}>
                        {msg.message_content}
                      </div>
                      <span className="text-[9px] text-slate-400">{format(new Date(msg.sent_at), 'hh:mm a')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-slate-200/50 bg-white/40 flex-shrink-0">
              <div className="max-w-4xl mx-auto flex items-center gap-2 bg-white shadow-sm rounded-2xl p-2 pr-3">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 h-8 w-8"><Smile className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                <textarea
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent border-none text-slate-900 placeholder:text-slate-400 text-sm focus:ring-0 resize-none py-2 max-h-32"
                  rows={1}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                />
                <Button 
                  size="icon" 
                  className={cn("h-8 w-8 rounded-xl transition-all", messageInput.trim() ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-400")}
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/20">
            <MessageSquare className="h-12 w-12 text-slate-300 mb-4 stroke-[1.5]" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Select a chat</h2>
          </div>
        )}
      </div>
    </div>
  );
}
