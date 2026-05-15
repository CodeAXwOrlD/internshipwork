import { useState } from "react";

import {
  Sparkles,
  BookOpen,
  Link as LinkIcon,
  Database,
  MessageSquare,
  Phone,
  Settings2,
  Upload,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Globe,
  FileText,
  Brain,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

export default function AIConfigurationPage() {
  const { primaryColor } = useClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Chatbot State
  const [chatbot, setChatbot] = useState<any>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);

  // Knowledge State
  const [faqs, setFaqs] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [isAddingFaq, setIsAddingFaq] = useState(false);
  const [activeTab, setActiveTab] = useState("brain");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFaqId, setSelectedFaqId] = useState<string | null>(null);

  // UI-only template presets (no backend changes)
  const templates = [
    {
      id: "default",
      name: "Default Assistant",
      description: "Neutral, helpful and concise assistant for general queries.",
      prompt:
        "You are a helpful and professional assistant for PIXORA. Provide concise and friendly answers about services and pricing.",
      temp: 0.6,
    },
    {
      id: "sales",
      name: "Sales Assistant",
      description: "Proactive, persuasive and lead-focused persona.",
      prompt:
        "You are a friendly sales assistant. Ask clarifying questions and nudge visitors towards pricing and trial information.",
      temp: 0.6,
    },
    {
      id: "support",
      name: "Support Agent",
      description: "Calm, procedural and troubleshooting-focused persona.",
      prompt:
        "You are a calm technical support assistant. Provide step-by-step guidance, ask diagnostic questions and escalate when needed.",
      temp: 0.2,
    },
  ];

  useEffect(() => {
    fetchChatbotConfig();
  }, []);

  const fetchChatbotConfig = async () => {
    try {
      setIsLoading(true);
      console.log("Starting fetchChatbotConfig...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.warn("fetchChatbotConfig: No authenticated user found.");
        return;
      }
      console.log("Authenticated User ID:", user.id);

      // 1. Get Client ID for this user
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!clientData) {
        console.warn(
          "fetchChatbotConfig: No client profile found for user_id:",
          user.id,
        );
        toast.error("Could not load client profile.");
        setIsLoading(false);
        return;
      }
      console.log("Client ID fetched successfully:", clientData.id);

      // 2. Get existing chatbot or create a default one
      // Use limit(1) + maybeSingle to safely handle cases where duplicate rows exist
      const { data: bot, error } = await supabase
        .from("ai_chatbots")
        .select("*")
        .eq("client_id", clientData.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("fetchChatbotConfig: ai_chatbots fetch error:", error);
        throw error;
      }
      console.log("Existing bot row result:", bot);

      if (!bot) {
        console.log(
          "No chatbot found. Instantiating default bot configuration...",
        );
        // Create Default Bot configuration automatically
        const { data: inserted, error: createError } = await supabase
          .from("ai_chatbots")
          .insert([
            {
              client_id: clientData.id,
              name: "Pixora AI Assistant",
              system_prompt:
                "You are a helpful and professional real estate or service assistant. Be kinds and concise.",
              temperature: 0.7,
            },
          ])
          .select("*");

        if (createError) {
          console.error(
            "fetchChatbotConfig: Failed to insert default bot:",
            createError,
          );
          throw createError;
        }

        if (inserted && inserted.length > 0) {
          const newBot = inserted[0];
          console.log("Default chatbot initialized successfully:", newBot.id);
          setChatbot(newBot);
          setSystemPrompt(newBot.system_prompt || "");
          setTemperature(Number(newBot.temperature) || 0.7);
          fetchKnowledge(newBot.id);
        } else {
          console.error(
            "fetchChatbotConfig: Insert succeeded but returned empty result array.",
          );
          toast.error("Failed to initialize default AI chatbot.");
        }
      } else {
        console.log("Loading existing chatbot setup:", bot.id);
        setChatbot(bot);
        setSystemPrompt(bot.system_prompt || "");
        setTemperature(Number(bot.temperature) || 0.7);
        fetchKnowledge(bot.id);
      }
    } catch (err: any) {
      console.error("Error fetching bot configuration:", err);
      toast.error("Failed to load AI settings.");
    } finally {
      console.log("fetchChatbotConfig sequence completed.");
      setIsLoading(false);
    }
  };

  const fetchKnowledge = async (botId: string) => {
    const { data: knowledgeDocs } = await supabase
      .from("ai_knowledge")
      .select("*")
      .eq("chatbot_id", botId)
      .eq("source_type", "qa")
      .order("created_at", { ascending: false });

    setFaqs(knowledgeDocs || []);
    if (knowledgeDocs && knowledgeDocs.length > 0) setSelectedFaqId(knowledgeDocs[0].id);
  };

  const handleSave = async () => {
    if (!chatbot) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("ai_chatbots")
        .update({
          system_prompt: systemPrompt,
          temperature: temperature,
        })
        .eq("id", chatbot.id);

      if (error) throw error;
      toast.success("AI Configuration synchronized successfully!");
    } catch (err: any) {
      console.error("Save Error:", err);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaq = async () => {
    if (!chatbot) {
      toast.error("AI chatbot configuration is missing or loading.");
      return;
    }
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast.error("Both question and answer are required keywords.");
      return;
    }

    try {
      console.log("Adding FAQ snippet bound to bot:", chatbot.id);
      const combinedContent = `Q: ${newQuestion.trim()}\nA: ${newAnswer.trim()}`;
      const { data, error } = await supabase
        .from("ai_knowledge")
        .insert([
          {
            chatbot_id: chatbot.id,
            content: combinedContent,
            source_type: "qa",
            title: `FAQ: ${newQuestion.trim().substring(0, 30)}...`,
          },
        ] as any)
        .select("*");

      if (error) throw error;

      if (data && data.length > 0) {
        setFaqs((prev) => [data[0], ...prev]);
      }
      setNewQuestion("");
      setNewAnswer("");
      toast.success("FAQ knowledge item added.");
    } catch (err: any) {
      toast.error("Failed to add FAQ.");
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ai_knowledge")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setFaqs((prev) => prev.filter((item) => item.id !== id));
      if (selectedFaqId === id) setSelectedFaqId(null);
      toast.success("Knowledge snippet removed.");
    } catch (err) {
      toast.error("Failed to delete item.");
    }
  };

  // Derived UI helpers
  const filteredFaqs = faqs.filter((f) => {
    try {
      const q = f.content.split("\nA: ")[0].replace("Q: ", "").toLowerCase();
      return q.includes(searchQuery.toLowerCase());
    } catch {
      return true;
    }
  });

  const selectedFaq = faqs.find((f) => f.id === selectedFaqId) || null;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-primary font-bold">
        Synchronizing Brain...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-white to-accent/10 border border-primary/20 p-8 md:p-12 shadow-sm group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
          <Sparkles className="w-64 h-64 text-primary" />
        </div>

        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Brain className="w-3 h-3" />
            Central Intelligence
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            AI Control <span className="text-primary font-black">Panel</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            Configure your AI's personality, knowledge base, and connections
            across all channels.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              className="rounded-xl shadow-lg shadow-primary/20 font-bold"
              style={{ backgroundColor: primaryColor }}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Synchronizing..." : "Save All Changes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Configuration Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-8"
      >
        <TabsList className="bg-white/50 bg-opacity-85 p-1 rounded-2xl border border-primary/10 w-full md:w-auto h-auto grid grid-cols-2 gap-1 shadow-sm">
          <TabsTrigger
            value="brain"
            className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Brain
          </TabsTrigger>
          <TabsTrigger
            value="knowledge"
            className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge
          </TabsTrigger>
        </TabsList>

        {/* AI Brain Tab */}
        {activeTab === "brain" && (
          <TabsContent value="brain" key="brain" forceMount>
              <div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid gap-6 md:grid-cols-3"
              >
                {/* Templates column */}
                <div className="space-y-4">
                  <Card className="bg-white/95 border-primary/10 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Templates
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Pick a starting personality for your assistant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSystemPrompt(t.prompt);
                            setTemperature(t.temp);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-shadow border ${
                            systemPrompt === t.prompt
                              ? "border-primary bg-primary/5 shadow"
                              : "border-slate-100 bg-white/50 hover:border-primary/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                              <div className="text-xs text-slate-500">{t.description}</div>
                            </div>
                            <div className="text-[11px] text-slate-400">Temp {t.temp}</div>
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-white/95 border-primary/10 shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-primary" /> Utilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          navigator.clipboard?.writeText(systemPrompt || "");
                          toast.success("System prompt copied to clipboard");
                        }}
                      >
                        Copy Prompt
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSystemPrompt("");
                          setTemperature(0.7);
                          toast.success("Reset to defaults (UI only)");
                        }}
                      >
                        Reset UI
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden md:col-span-2">
                <CardHeader className="border-b border-sidebar-border/5 pb-6">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    System Prompt & Personality
                  </CardTitle>
                  <CardDescription>
                    Define how your AI behaves and speaks to users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Global AI Personality
                    </Label>
                    <Textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="e.g., You are a helpful and professional real estate assistant for Pixoranest..."
                      className="min-h-[200px] bg-slate-100/50 border-black focus-visible:ring-2 focus-visible:ring-primary/20 rounded-2xl p-4 transition-colors text-slate-700 font-medium"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Strict & Precise */}
                    <div
                      className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                        temperature === 0.2
                          ? "bg-primary border-primary shadow-lg shadow-primary/20"
                          : "bg-slate-50 border-slate-100 hover:border-primary/20 hover:bg-slate-50/80"
                      }`}
                      onClick={() => setTemperature(0.2)}
                    >
                      <Label
                        className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                          temperature === 0.2 ? "text-white" : "text-slate-700"
                        }`}
                      >
                        Strict & Precise
                      </Label>
                      <div
                        className={`h-1.5 w-full rounded-full overflow-hidden ${temperature === 0.2 ? "bg-white/20" : "bg-slate-200"}`}
                      >
                        <div
                          className={`h-full ${temperature === 0.2 ? "bg-white" : "bg-primary"}`}
                          style={{ width: "20%" }}
                        />
                      </div>
                      <div
                        className={`flex justify-between mt-2 text-[10px] font-bold ${
                          temperature === 0.2
                            ? "text-white/80"
                            : "text-slate-400"
                        }`}
                      >
                        <span>
                          {temperature === 0.2 ? "★ Selected" : "Precise"}
                        </span>
                      </div>
                    </div>

                    {/* Balanced & Professional */}
                    <div
                      className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                        temperature === 0.6
                          ? "bg-slate-800 border-slate-800 shadow-lg shadow-slate-800/20"
                          : "bg-slate-50 border-slate-100 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                      onClick={() => setTemperature(0.6)}
                    >
                      <Label
                        className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                          temperature === 0.6 ? "text-white" : "text-slate-700"
                        }`}
                      >
                        Balanced & Professional
                      </Label>
                      <div
                        className={`h-1.5 w-full rounded-full overflow-hidden ${temperature === 0.6 ? "bg-white/20" : "bg-slate-200"}`}
                      >
                        <div
                          className={`h-full ${temperature === 0.6 ? "bg-white" : "bg-slate-800"}`}
                          style={{ width: "60%" }}
                        />
                      </div>
                      <div
                        className={`flex justify-between mt-2 text-[10px] font-bold ${
                          temperature === 0.6
                            ? "text-white/80"
                            : "text-slate-400"
                        }`}
                      >
                        <span>
                          {temperature === 0.6 ? "★ Selected" : "Professional"}
                        </span>
                      </div>
                    </div>

                    {/* Creative & Warm */}
                    <div
                      className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                        temperature === 0.95
                          ? "bg-orange-500 border-orange-500 shadow-lg shadow-orange-500/20"
                          : "bg-slate-50 border-slate-100 hover:border-orange-200 hover:bg-slate-50/80"
                      }`}
                      onClick={() => setTemperature(0.95)}
                    >
                      <Label
                        className={`text-[10px] font-bold uppercase tracking-widest block mb-2 ${
                          temperature === 0.95 ? "text-white" : "text-slate-700"
                        }`}
                      >
                        Creative & Warm
                      </Label>
                      <div
                        className={`h-1.5 w-full rounded-full overflow-hidden ${temperature === 0.95 ? "bg-white/20" : "bg-slate-200"}`}
                      >
                        <div
                          className={`h-full ${temperature === 0.95 ? "bg-white" : "bg-orange-500"}`}
                          style={{ width: "95%" }}
                        />
                      </div>
                      <div
                        className={`flex justify-between mt-2 text-[10px] font-bold ${
                          temperature === 0.95
                            ? "text-white/80"
                            : "text-slate-400"
                        }`}
                      >
                        <span>
                          {temperature === 0.95 ? "★ Selected" : "Creative"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-sidebar-border/5">
                    <Button
                      className="rounded-xl font-bold shadow-lg shadow-primary/20"
                      style={{ backgroundColor: primaryColor }}
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save AI Brain"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === "knowledge" && (
          <TabsContent value="knowledge" key="knowledge" forceMount>
            <div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      Q&A / FAQs
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl font-bold border-slate-200"
                      onClick={() => setIsAddingFaq(!isAddingFaq)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {isAddingFaq ? "Cancel" : "Add FAQ"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {isAddingFaq && (
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3 mb-4">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">
                        Question
                      </Label>
                      <Input
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="e.g., Do you offer trial?"
                        className="bg-white rounded-xl"
                      />
                      <Label className="text-[10px] font-bold text-slate-500 uppercase block mt-2">
                        Answer
                      </Label>
                      <Textarea
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        placeholder="e.g., Yes, we offer 14-day trials."
                        className="bg-white rounded-xl"
                      />
                      <Button
                        className="w-full mt-2 rounded-xl"
                        size="sm"
                        onClick={handleAddFaq}
                        style={{ backgroundColor: primaryColor }}
                      >
                        Save FAQ Knowledge
                      </Button>
                    </div>
                  )}

                  <div className="mb-4">
                    <Input
                      placeholder="Search FAQs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-full bg-slate-50"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-1">
                      {filteredFaqs.length === 0 ? (
                        <div className="text-xs text-slate-400 p-6 text-center rounded-2xl border border-slate-100">
                          No matching FAQs. Add one to get started.
                        </div>
                      ) : (
                        filteredFaqs.map((q) => {
                          const lines = q.content.split("\nA: ");
                          const question = lines[0].replace("Q: ", "");
                          return (
                            <button
                              key={q.id}
                              onClick={() => setSelectedFaqId(q.id)}
                              className={`w-full text-left p-3 rounded-lg transition-colors border ${
                                selectedFaqId === q.id
                                  ? 'border-primary bg-primary/5 shadow'
                                  : 'border-slate-100 bg-white/50 hover:border-primary/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-800">{question}</div>
                                <div className="text-[11px] text-slate-400">View</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="md:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 min-h-[160px]">
                      {selectedFaq ? (
                        (() => {
                          const lines = selectedFaq.content.split("\nA: ");
                          const question = lines[0].replace("Q: ", "");
                          const answer = lines[1] || "";
                          return (
                            <div className="space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="text-sm font-bold text-slate-700">Q: {question}</div>
                                  <div className="text-xs text-slate-500 mt-1 italic">Preview</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(answer || "");
                                      toast.success('Answer copied');
                                    }}
                                  >
                                    Copy Answer
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => selectedFaq && handleDeleteKnowledge(selectedFaq.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{answer}</div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-center text-slate-400">Select an FAQ to preview its content.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Footer Save Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 bg-opacity-90 border-t border-slate-100 md:hidden z-50">
        <Button
          className="w-full rounded-2xl h-12 font-bold text-lg"
          style={{ backgroundColor: primaryColor }}
          onClick={handleSave}
        >
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? "Saving..." : "Save AI Brain"}
        </Button>
      </div>
    </div>
  );
}
