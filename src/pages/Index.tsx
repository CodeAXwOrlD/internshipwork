import { Link } from "react-router-dom";
import { useAuth, getRedirectPath } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Phone, 
  UserCheck, 
  MessageSquare, 
  Share2, 
  Bot, 
  ShieldCheck, 
  Zap, 
  BarChart3,
  ChevronRight,
  Globe,
  Sparkles
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { motion } from "framer-motion";

const Index = () => {
  const { session, profile, loading } = useAuth();

  const features = [
    {
      title: "AI Voice Telecaller",
      description: "Automate outbound calls with natural-sounding AI and reach thousands of leads instantly, multiplying your sales force without the overhead.",
      icon: <Phone className="h-6 w-6 text-primary" />,
      color: "from-primary/20 to-transparent",
    },
    {
      title: "AI Voice Receptionist",
      description: "Handle inbound calls 24/7. Route calls, take messages, and assist customers continuously without any human delay or fatigue.",
      icon: <UserCheck className="h-6 w-6 text-purple-500" />,
      color: "from-purple-500/20 to-transparent",
    },
    {
      title: "WhatsApp Automation",
      description: "Scale your customer outreach on WhatsApp with intelligent conversational workflows, automated messaging, and smart drip campaigns.",
      icon: <MessageSquare className="h-6 w-6 text-green-500" />,
      color: "from-green-500/20 to-transparent",
    },
    {
      title: "Social Media Automation",
      description: "Manage and automate your social presence across platforms with AI-driven content scheduling, engagement, and trend analysis.",
      icon: <Share2 className="h-6 w-6 text-pink-500" />,
      color: "from-pink-500/20 to-transparent",
    },
    {
      title: "Custom AI Agents",
      description: "Deploy highly specialized custom AI agents for specialized voice tasks, deep customer interactions, and complex problem-solving.",
      icon: <Bot className="h-6 w-6 text-indigo-500" />,
      color: "from-indigo-500/20 to-transparent",
    },
    {
      title: "Advanced Analytics",
      description: "Track performance, real-time call sentiment, conversion rates, and ROI with our powerful, beautifully designed analytics engine.",
      icon: <BarChart3 className="h-6 w-6 text-orange-500" />,
      color: "from-orange-500/20 to-transparent",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-50 selection:bg-primary/30 overflow-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <motion.div
          animate={{
            /* Keep only subtle opacity shifts to avoid costly transforms */
            opacity: [0.22, 0.30, 0.22],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-5%] left-[-5%] h-[30%] w-[30%] rounded-full bg-primary/18 blur-[48px] gpu-accel"
        />
        <motion.div
          animate={{
            opacity: [0.12, 0.18, 0.12],
          }}
          transition={{ duration: 36, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-5%] right-[-5%] h-[28%] w-[28%] rounded-full bg-blue-600/16 blur-[48px] gpu-accel"
        />
        <div className="absolute top-[40%] left-[60%] h-[20%] w-[20%] rounded-full bg-purple-600/8 blur-[40px]" />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] opacity-10" />
      </div>

      {/* Header */}
      <header className="relative z-50 w-full border-b border-white/5 bg-slate-950/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <motion.div
              /* micro-interaction only; avoid rotate to reduce repaints */
              whileHover={{ scale: 1.02 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-600"
            >
             <img src="/logo.png" alt="Logo" className="h-10 w-10" loading="lazy" />
            </motion.div>
            <span className="text-xl font-bold tracking-tight text-white">Pixoranest</span>
          </Link>
          <nav className="flex items-center gap-4">
            {loading ? (
              <Button variant="ghost" disabled size="sm" className="w-24 bg-white/5 text-slate-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </Button>
            ) : session ? (
              <Link to={getRedirectPath(profile?.role || "client")}>
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 rounded-full px-6">
                  Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/5 rounded-full px-6">
                    Sign In
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="sm" className="gap-2 bg-white text-slate-950 hover:bg-slate-200 rounded-full px-6 font-semibold transition-opacity">
                    Get Started <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="relative px-6 py-32 lg:px-8 lg:py-40 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary-foreground mb-8 shadow-sm transition-opacity cursor-default"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Next-Gen AI Automation Platform</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mx-auto max-w-5xl text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-sm pb-2"
          >
            Scale Your Communications <br className="hidden md:block"/>
            <span className="bg-gradient-to-r from-primary via-blue-400 to-indigo-500 bg-clip-text text-transparent filter drop-shadow-[0_0_30px_rgba(48,79,159,0.3)]">with AI</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed font-light"
          >
            The all-in-one multi-tenant SaaS for white-labeled AI Voice, WhatsApp, and Social Media automation. Transform how your business connects globally.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row w-full max-w-md mx-auto sm:max-w-none"
          >
            {loading ? (
              <Button size="lg" disabled className="h-14 w-48 rounded-full bg-white/10">Loading...</Button>
            ) : session ? (
                <Link to={getRedirectPath(profile?.role || "client") }>
                <Button size="lg" className="h-14 px-8 gap-3 text-lg rounded-full bg-primary hover:bg-primary/90 w-full sm:w-auto shadow-sm transition-opacity">
                  Launch Dashboard <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button size="lg" className="h-14 px-8 gap-3 text-lg rounded-full bg-white text-slate-950 hover:bg-slate-200 w-full sm:w-auto shadow-sm transition-opacity font-semibold">
                    Start Growing Today <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="w-full sm:w-auto mt-4 sm:mt-0">
                  <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full bg-white text-slate-950 hover:bg-white/10 text-black hover:text-white w-full sm:w-auto transition-opacity hover:border-white/50 font-semibold">
                    Book a Demo
                  </Button>
                </div>
              </>
            )}
          </motion.div>
          
          {/* Trusted By */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="mt-24 w-full max-w-4xl mx-auto border-t border-white/10 pt-10"
          >
            <p className="text-sm font-medium text-slate-500 tracking-widest uppercase mb-8">Integrated with industry leaders</p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-60">
              {['Exotel', 'Meta', 'Twilio', 'Retell AI', 'ElevenLabs'].map((brand, i) => (
                <div key={i} className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-400 to-slate-600 bg-clip-text text-transparent filter hover:brightness-150 transition-all duration-300 cursor-default">
                  {brand}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="relative px-6 py-24 lg:px-8 border-t border-white/5 bg-slate-950/20">
          <div className="container mx-auto max-w-7xl">
            <div className="mb-20 text-center max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent pb-2">Engineered for Success</h2>
              <p className="mt-6 text-lg text-slate-400 font-light">Comprehensive suite of autonomous AI services effortlessly managed under one unified, beautiful roof.</p>
            </div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-opacity duration-300 overflow-hidden"
                >
                  {/* Subtle glowing background orb inside the card */}
                  <div className={`absolute -top-24 -right-24 h-48 w-48 rounded-full bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700 pointer-events-none`} />
                  
                  <div className="relative z-10">
                    <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-opacity duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">{feature.title}</h3>
                    <p className="text-slate-400 leading-relaxed font-light text-sm md:text-base">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Why Us Section */}
        <section className="relative px-6 py-32 lg:px-8 border-t border-white/5">
          <div className="container mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-16 lg:flex-row">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="w-full max-w-xl text-left"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400 mb-6 uppercase tracking-wider backdrop-blur-sm">
                  Enterprise Grade
                </div>
                <h2 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl mb-8 leading-[1.1] text-white">Built for Scale & <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">White-Labeling</span></h2>
                <div className="space-y-8 mt-12">
                  <div className="group flex gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 transition-opacity">
                      <ShieldCheck className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-slate-200 mb-2">Multi-Tenant Isolation</h4>
                      <p className="text-slate-400 font-light leading-relaxed">Advanced Row-Level Security in PostgreSQL ensures your client data is perfectly isolated, completely secure, and strictly private at all times.</p>
                    </div>
                  </div>
                  <div className="group flex gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 transition-opacity">
                      <Zap className="h-7 w-7 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-semibold text-slate-200 mb-2">Real-time Performance</h4>
                      <p className="text-slate-400 font-light leading-relaxed">Monitor your AI's conversational performance and latency in real-time with stunning, lag-free dashboards engineered for instant feedback.</p>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="relative w-full max-w-lg lg:max-w-xl"
              >
                {/* Floating decorative elements */}
                <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blue-500/18 blur-[36px]" />
                <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/18 blur-[36px]" />

                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-10 text-white shadow-sm group hover:border-primary/20 transition-opacity duration-300">
                  <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity rotate-12 group-hover:rotate-0 duration-700">
                    <Bot className="w-32 h-32 text-primary" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between min-h-[300px]">
                    <div>
                      <div className="flex gap-1 mb-6">
                        {[1,2,3,4,5].map(i => (
                          <svg key={i} className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <h3 className="text-3xl lg:text-4xl font-semibold mb-6 leading-snug tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-opacity">
                        "The most robust, intelligent communication AI platform we've ever scaled with."
                      </h3>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-primary-foreground">Sarah Jenkins</p>
                      <p className="text-slate-400 text-sm">CTO, TechFlow Solutions</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950 py-12">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <Globe className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white opacity-90">Pixoranest</span>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Pixoranest Corp. All rights reserved.
            </p>
            <div className="flex gap-8">
              <Link to="#" className="text-sm text-slate-500 hover:text-white transition-colors">Privacy</Link>
              <Link to="#" className="text-sm text-slate-500 hover:text-white transition-colors">Terms</Link>
              <Link to="#" className="text-sm text-slate-500 hover:text-white transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

