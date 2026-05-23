import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CheckCircle2, ArrowLeft, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ComingSoonOverlayProps {
  title: string;
  description: string;
  features: string[];
}

export default function ComingSoonOverlay({ title, description, features }: ComingSoonOverlayProps) {
  const [isNotified, setIsNotified] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Locate the main scroll container from layout
    const mainEl = document.querySelector("main");
    const bodyEl = document.body;

    if (mainEl) {
      mainEl.style.overflow = "hidden";
    }
    bodyEl.style.overflow = "hidden";

    return () => {
      if (mainEl) {
        mainEl.style.overflow = "";
      }
      bodyEl.style.overflow = "";
    };
  }, []);

  const handleNotifyClick = () => {
    setIsNotified(true);
    toast({
      title: "Notification Registered! 🚀",
      description: `You will receive early access updates for ${title}.`,
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4 md:p-8 bg-slate-950/45 backdrop-blur-[5px] overflow-hidden">
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes cardEnter {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes floatGlow {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(10px, -15px) scale(1.1); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-card-in {
          animation: cardEnter 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-float-glow {
          animation: floatGlow 6s ease-in-out infinite;
        }
      `}} />

      <div className="max-w-lg w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-white animate-card-in">
        {/* Glow effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/30 rounded-full blur-3xl pointer-events-none animate-float-glow" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/25 rounded-full blur-3xl pointer-events-none animate-float-glow" style={{ animationDelay: "2s" }} />

        <div className="relative z-10 space-y-6 text-left">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-400/40 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.35)] animate-pulse">
              <Sparkles className="h-3.5 w-3.5 text-blue-400 fill-blue-400/30" /> Coming Soon
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tight leading-none text-white">
              {title}
            </h2>
            <p className="text-slate-300 text-sm font-medium leading-relaxed">
              {description}
            </p>
          </div>

          <div className="border-t border-white/10 my-4" />

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Key Features Included:
            </h3>
            <ul className="space-y-3">
              {features.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 text-sm text-slate-200 font-medium"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-white/10 my-4" />

          {/* Call to Actions with click scale transformations */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate("/client")}
              className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 active:scale-[0.96] transition-all duration-200 text-white font-bold rounded-2xl border border-white/10 hover:border-white/20 text-xs md:text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Go Back
            </button>

            <button
              onClick={handleNotifyClick}
              disabled={isNotified}
              className={`flex-[1.5] py-3 px-4 font-bold rounded-2xl text-xs md:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] ${isNotified
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default"
                  : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30"
                }`}
            >
              <Bell className="h-4 w-4" />
              {isNotified ? "Subscribed!" : "Notify Me"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
