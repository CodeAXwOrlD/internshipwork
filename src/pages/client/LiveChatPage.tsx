import { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  Search, 
  User, 
  Paperclip, 
  Send, 
  MoreHorizontal, 
  Sparkles, 
  CheckCheck, 
  Clock, 
  Phone, 
  Mail, 
  ExternalLink,
  Bot,
  UserCheck,
  Filter,
  Trash2,
  Archive,
  Star,
  Plus,
  ChevronDown
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";

import { toast } from "sonner";

export default function LiveChatPage() {
  const { primaryColor } = useClient();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [isAIActive, setIsAIActive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Real Chat State
  const [chats, setChats] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveSessions();
    
    // Subscribe to session changes
    const sessionChannel = supabase.channel('sessions-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_chat_sessions' }, () => {
         fetchActiveSessions();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(sessionChannel); };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setSessionId(selectedChat.id);
      fetchChatMessages(selectedChat.id);
      
      // Subscribe to messages for this active chat
      const msgChannel = supabase.channel(`messages-${selectedChat.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_chat_messages', filter: `session_id=eq.${selectedChat.id}` }, () => {
           fetchChatMessages(selectedChat.id);
        })
        .subscribe();
        
      return () => { supabase.removeChannel(msgChannel); };
    } else {
      setChatMessages([]);
      setSessionId(null);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [chatMessages, selectedChat]);

  const fetchActiveSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) return;

      const { data: bot } = await supabase
        .from('ai_chatbots')
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (!bot) return;

      const { data: sessions, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, visitor_id, status, created_at')
        .eq('chatbot_id', bot.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (sessions && sessions.length > 0) {
         const parsed = sessions.map(s => ({
            id: s.id,
            name: s.visitor_id ? `Admin User` : `Guest Visitor #${s.id.substring(0, 4)}`,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`,
            lastMessage: "Loading...",
            time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unread: 0,
            status: s.status === 'active' ? "online" : "offline",
            assignedTo: "AI Agent",
            labels: [s.status.toUpperCase()]
         }));
         setChats(parsed);
         setSelectedChat(parsed[0]);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleToggleAI = async (checked: boolean) => {
    setIsAIActive(checked);
    if (!selectedChat) return;
    try {
      await supabase.from('ai_chat_sessions').update({ status: checked ? 'active' : 'human' }).eq('id', selectedChat.id);
    } catch (err) {
      console.error("Failed to update AI status:", err);
    }
  };

  const fetchChatMessages = async (sid: string) => {
    try {
      const { data: msgs, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (msgs) {
         setChatMessages(msgs.map(m => ({
            id: m.id,
            sender: m.role === 'user' ? 'customer' : 'ai',
            text: m.content,
            time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isAI: m.role === 'assistant'
         })));
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const handleCreateTestSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!client) return;

      const { data: bot } = await supabase
        .from('ai_chatbots')
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (!bot) {
         toast.error("Please configure your AI Chatbot first in config page.");
         return;
      }

      const { data: newSession, error } = await supabase
        .from('ai_chat_sessions')
        .insert([{
           chatbot_id: bot.id,
           status: 'active',
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      
      await supabase
        .from('ai_chat_messages')
        .insert([{
           session_id: newSession.id,
           role: 'user',
           content: 'Hello! I am a test visitor inquiring about prices.'
        }]);

      toast.success("Test session created!");
      fetchActiveSessions();
    } catch (err) {
      console.error("Test session error:", err);
      toast.error("Failed to make test session.");
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !sessionId) return;
    
    const userText = message.trim();
    setMessage(""); // Clear input immediately
    
    // Optimistic UI update
    const userMsg = { 
        id: Date.now().toString(), 
        sender: "ai", // Sending FROM agent context
        text: userText, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: false 
    };
    
    setChatMessages(prev => [...prev, userMsg]);

    try {
        // Insert directly into messages as 'assistant' or 'agent'
        const { error } = await supabase
          .from('ai_chat_messages')
          .insert([{
             session_id: sessionId,
             role: 'assistant',
             content: userText
          }]);

        if (error) throw error;
        toast.success("Message pushed to visitor.");
    } catch (err) {
        toast.error("Failed to send message.");
        console.error("Failed to send message:", err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-3xl bg-white/50 bg-opacity-95 border border-primary/10 shadow-2xl">
      
      {/* 1. Sidebar: Chat List */}
      <div className={cn(
        "flex flex-col border-r border-sidebar-border/10 bg-white/30 shrink-0",
        selectedChat ? "hidden md:flex md:w-80" : "flex w-full md:w-80"
      )}>
        <div className="p-4 border-b border-sidebar-border/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">LeadNest <span className="text-primary">Chat</span></h2>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Filter className="w-4 h-4 text-slate-500" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search conversations..." 
              className="pl-9 bg-white/50 border-white/20 rounded-xl text-sm focus:ring-primary/20"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isInitializing ? (
               <div className="text-center py-4 text-xs font-bold text-slate-400">Loading inbox...</div>
            ) : chats.length === 0 ? (
               <div className="text-center py-6 px-4 space-y-3">
                 <div className="text-xs font-bold text-slate-400">No active chat sessions.</div>
                 <Button 
                   className="w-full rounded-xl font-bold text-xs" 
                   style={{ backgroundColor: primaryColor }}
                   onClick={handleCreateTestSession}
                 >
                   <Plus className="w-3 h-3 mr-1" /> Create Test Session
                 </Button>
               </div>
             ) : (
             chats.map((chat) => (
              <div
                key={chat.id}
                
                onClick={() => setSelectedChat(chat)}
                className={cn(
                  "p-3 rounded-2xl cursor-pointer transition-colors flex items-center gap-3 relative overflow-hidden group",
                  selectedChat?.id === chat.id 
                    ? "bg-white shadow-md border border-primary/10" 
                    : "hover:bg-white/40"
                )}
              >
                {selectedChat?.id === chat.id && (
                  <div 
                    layoutId="chat-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary" 
                  />
                )}
                
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={chat.avatar} />
                    <AvatarFallback>{chat.name[0]}</AvatarFallback>
                  </Avatar>
                  {chat.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-slate-800 truncate">{chat.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate leading-relaxed">
                    Live Session
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
                    {chat.labels.map(l => (
                      <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">{l}</span>
                    ))}
                  </div>
                </div>
              </div>
             ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Main: Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col bg-white/20 min-w-0",
        !selectedChat && "hidden md:flex"
      )}>
        {/* Chat Header */}
        {selectedChat ? (
          <>
            <div className="p-4 flex items-center justify-between border-b border-sidebar-border/10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 mr-1 shrink-0" onClick={() => setSelectedChat(null)}>
                  <ChevronDown className="h-5 w-5 rotate-90 text-slate-500" />
                </Button>
                <Avatar className="h-10 w-10 border border-white">
                  <AvatarImage src={selectedChat.avatar} />
                  <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight">{selectedChat.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <UserCheck className="w-3 h-3" />
                      Assigned to: <span className="text-primary">{selectedChat.assignedTo}</span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-wider">AI Agent Active</span>
                  <Switch checked={isAIActive} onCheckedChange={handleToggleAI} className="scale-75 data-[state=checked]:bg-primary" />
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50">
                  <Phone className="w-4 h-4 text-slate-500" />
                </Button>
                <DropdownMenuWrapper />
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex justify-center my-4">
                  <span className="text-[10px] font-bold text-slate-400 border border-slate-100 rounded-full px-3 py-1 uppercase tracking-widest bg-white/30">Conversation started today</span>
                </div>

                
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        msg.sender === "customer" ? "mr-auto items-start" : "ml-auto items-end"
                      )}
                    >
                      <div className={cn(
                        "relative p-4 rounded-3xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                        msg.sender === "customer" 
                          ? "bg-white text-slate-700 rounded-tl-none border border-slate-100" 
                          : msg.isAI 
                            ? "bg-gradient-to-br from-primary/90 to-primary text-white rounded-tr-none shadow-lg shadow-primary/10"
                            : "bg-slate-800 text-white rounded-tr-none shadow-lg shadow-black/10"
                      )}>
                        {msg.isAI && (
                          <div className="absolute -top-3 -right-2 bg-white/20 bg-opacity-90 rounded-full p-1 border border-white/20 shadow-sm">
                            <Bot className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {msg.text}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 px-2">
                        <span className="text-[9px] font-bold text-slate-400">{msg.time}</span>
                        {msg.sender !== "customer" && <CheckCheck className="w-3 h-3 text-primary" />}
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="flex flex-col max-w-[80%] ml-auto items-end"
                    >
                      <div className="relative p-4 rounded-3xl text-sm leading-relaxed shadow-sm bg-gradient-to-br from-primary/90 to-primary text-white rounded-tr-none shadow-lg shadow-primary/10">
                        <div className="absolute -top-3 -right-2 bg-white/20 bg-opacity-90 rounded-full p-1 border border-white/20 shadow-sm">
                          <Sparkles className="h-3 w-3 text-white animate-spin" />
                        </div>
                        <div className="flex gap-1 items-center h-5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 bg-white/30 border-t border-sidebar-border/10">
              <div className="max-w-4xl mx-auto relative flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type your message here..."
                    className="w-full bg-white border-white/20 h-12 pl-4 pr-24 rounded-2xl shadow-inner focus:ring-primary/20 overflow-hidden"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-slate-100">
                      <Paperclip className="w-4 h-4 text-slate-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-slate-100">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </div>
                <Button 
                  onClick={handleSendMessage}
                  className="h-12 w-12 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <MessageSquare className="w-12 h-12 text-slate-200" />
            <p className="font-bold text-sm">Select a conversation to trigger chat response panel</p>
          </div>
        )}
      </div>

      {/* 3. Details: Lead Panel */}
      <div className="w-72 border-l border-sidebar-border/10 bg-white/40 hidden xl:flex flex-col">
        {selectedChat ? (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* User Overview */}
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 border-4 border-white shadow-xl mb-4">
                  <AvatarImage src={selectedChat.avatar} />
                  <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-bold text-slate-800">{selectedChat.name}</h3>
                <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">Lead High Potential</p>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Contact Context</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 group">
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-600">+91 XXXXX XXXXX</span>
                  </div>
                  <div className="flex items-center gap-3 group">
                    <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-600 truncate">{selectedChat.id.substring(0, 8)}@anon.com</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Recent Activity</h4>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  <ActivityItem title="Session Opened" time="Just now" icon={<div className="w-2.5 h-2.5 rounded-full bg-primary" />} />
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9">
                  <Archive className="w-3 h-3 mr-2" /> Archive
                </Button>
                <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3 h-3 mr-2" /> Delete
                </Button>
                <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9 col-span-2">
                  <ExternalLink className="w-3 h-3 mr-2" /> View Full CRM Lead
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">No lead data</div>
        )}
      </div>
    </div>
  );
}

function DropdownMenuWrapper() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50">
          <MoreHorizontal className="w-4 h-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100">
        <DropdownMenuItem className="py-2.5 font-bold text-xs"><UserCheck className="w-3.5 h-3.5 mr-2" /> Assign to Agent</DropdownMenuItem>
        <DropdownMenuItem className="py-2.5 font-bold text-xs"><Archive className="w-3.5 h-3.5 mr-2" /> Archive Conversation</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-2.5 font-bold text-xs text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Chat</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityItem({ title, time, icon }: { title: string; time: string; icon: React.ReactNode }) {
  return (
    <div className="relative group">
      <div className="absolute -left-[1.35rem] top-1 z-10">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-700 leading-none">{title}</p>
        <p className="text-[10px] text-slate-400 mt-1">{time}</p>
      </div>
    </div>
  );
}
