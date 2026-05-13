import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Sparkles,
  Minimize2,
  Paperclip
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Basic styling matches Pixora brand: sleek, modern, glassmorphic
export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([
    { 
        id: "welcome", 
        sender: "ai", 
        text: "Hi there! I'm the Pixora AI assistant. How can I help you regarding our pricing, services, or getting access today?", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        isAI: true 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatbotId, setChatbotId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch user's chatbot config on mount
    const fetchChatbot = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (clientData) {
            const { data: bot } = await supabase
              .from('ai_chatbots')
              .select('id')
              .eq('client_id', clientData.id)
              .maybeSingle();
            
            if (bot) {
              setChatbotId(bot.id);
            }
          }
        } else {
          // Public Visitor Test Fallback (Incognito Mode)
          const { data: defaultBot } = await supabase
            .from('ai_chatbots')
            .select('id')
            .limit(1)
            .maybeSingle();
            
          if (defaultBot) {
            setChatbotId(defaultBot.id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chatbot mapping:", err);
      }
    };
    fetchChatbot();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [chatMessages, isOpen, isLoading]);

  useEffect(() => {
    if (!sessionId) return;
    
    // Subscribe to incoming messages (like Admin human takeovers)
    const channel = supabase.channel(`widget-msgs-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_chat_messages', filter: `session_id=eq.${sessionId}` }, (payload) => {
         const dbMsg = payload.new;
         
         setChatMessages(prev => {
           // Prevent optimistic UI duplication
           if (prev.some(m => m.text === dbMsg.content)) return prev;
           
           return [...prev, {
             id: dbMsg.id || Date.now().toString(),
             sender: dbMsg.role === 'user' ? 'customer' : 'ai',
             text: dbMsg.content,
             time: new Date(dbMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
             isAI: dbMsg.role === 'assistant'
           }];
         });
         
         if (dbMsg.role === 'assistant' || dbMsg.role === 'agent') {
           setIsLoading(false);
         }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userText = message.trim();
    setMessage("");
    
    // Add User Message Optimistically
    const userMsg = { 
        id: Date.now().toString(), 
        sender: "customer", 
        text: userText, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
                userMessage: userText,
                sessionId: sessionId,
                chatbotId: chatbotId,
                isNewSession: !sessionId
            }
        });

        if (error) {
            console.error("Error from AI:", error);
            const errorMsg = { 
                id: Date.now().toString(), 
                sender: "ai", 
                text: "Sorry, I am having trouble connecting to my servers.", 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                isAI: true 
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } else if (data) {
            if (data.sessionId) setSessionId(data.sessionId);
            
            if (data.message) {
              const aiMsg = { 
                  id: Date.now().toString(), 
                  sender: "ai", 
                  text: data.message, 
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                  isAI: true 
              };
              setChatMessages(prev => [...prev, aiMsg]);
            }
        }
    } catch (err) {
        console.error("Failed to send message:", err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-16 right-4 md:bottom-6 md:right-6 h-14 w-14 md:h-16 md:w-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center z-50 overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-blue-600 opacity-100 group-hover:opacity-90 transition-opacity" />
            <Sparkles className="w-6 h-6 md:w-8 md:h-8 relative z-10" />
            {/* Ping animation indicator */}
            <span className="absolute top-0 right-0 h-3 w-3 md:h-4 md:w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 md:h-4 md:w-4 bg-red-500 border-2 border-primary"></span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-4 left-4 md:left-auto md:bottom-6 md:right-6 md:w-[380px] h-[600px] max-h-[70vh] md:max-h-[85vh] bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden border border-primary/20"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-blue-600 p-4 text-white flex items-center justify-between shadow-md relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 bg-white/20  backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                  <img src="/logo.png" alt="Pixora Logo" className="w-10 h-10 rounded-full" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-transparent rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Pixora Assistant</h3>
                  <p className="text-[10px] text-white/80 uppercase font-medium tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4 bg-slate-50/50">
              <div className="space-y-4">
                <div className="flex justify-center my-2">
                   <span className="text-[9px] font-bold text-slate-400 bg-white border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                     Today
                   </span>
                </div>

                <AnimatePresence>
                  {chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        msg.sender === "customer" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "relative p-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap",
                        msg.sender === "customer" 
                          ? "bg-primary text-white rounded-br-sm shadow-primary/20" 
                          : "bg-white text-slate-700 rounded-bl-sm border border-slate-100 shadow-slate-200/50"
                      )}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] font-medium text-slate-400 mt-1.5 px-1">{msg.time}</span>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div
                      key="loading-bubble"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="flex flex-col max-w-[80%] mr-auto items-start"
                    >
                      <div className="relative p-4 rounded-2xl bg-white border border-slate-100 rounded-bl-sm shadow-sm">
                        <div className="flex gap-1.5 items-center h-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={scrollRef} />
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100">
              <div className="relative flex items-center bg-slate-50 border border-slate-100 rounded-2xl p-1 shadow-inner focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                
                <Input 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask a question..."
                  className="w-full bg-transparent border-black mr-1 focus-visible:ring-0 px-2 text-[13px] shadow-none"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isLoading}
                  className="h-9 w-9 rounded-xl bg-primary text-white shrink-0 shadow-md shadow-primary/20 hover:scale-105 transition-transform"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </Button>
              </div>
            </div>
            
            <div className="bg-slate-50 py-1.5 text-center border-t border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 flex items-center justify-center gap-1 uppercase tracking-widest">
                    <Sparkles className="w-3 h-3 text-primary" /> Powered by Pixora AI
                </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
