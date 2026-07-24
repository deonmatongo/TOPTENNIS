import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import ProfileWizard from "@/components/ProfileWizard";

const NAVY = "#0B1526";

const STEPS = [
  { label: "Personal Info", desc: "Age, gender, location" },
  { label: "Playing Preferences", desc: "Match style & travel" },
  { label: "Skill Level", desc: "Your NTRP rating" },
  { label: "Review & Submit", desc: "Confirm your details" },
];

const ProfileSetup = () => {
  const { user } = useAuth();
  const { player, createPlayerProfile } = usePlayerProfile();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    try {
      const suppress = localStorage.getItem("suppressProfileSetupRedirect") === "true";
      if (player && !suppress) navigate("/dashboard");
    } catch {
      if (player) navigate("/dashboard");
    }
  }, [player, navigate]);

  const handleProfileCreated = () => navigate("/dashboard?tab=schedule");

  if (!user) return null;

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[38%] xl:w-[42%] relative overflow-hidden flex-col shrink-0" style={{ backgroundColor: NAVY }}>
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

        <div className="relative flex flex-col h-full px-10 py-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 w-fit">
            <img src="/app-icon.png" alt="Top Tennis" className="h-11 w-11 rounded-xl object-cover" />
            <span className="font-bold text-base leading-none">
              <span className="text-white">Top</span>
              <span className="text-orange-400"> Tennis</span>
              <span className="block text-[10px] font-medium text-white/40 tracking-widest uppercase mt-0.5">League</span>
            </span>
          </Link>

          {/* Heading */}
          <div className="mt-12 mb-10">
            <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
              One-time setup
            </span>
            <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-3">
              Build your<br />
              <span className="text-orange-400">player profile.</span>
            </h2>
            <p className="text-sm text-white/45 leading-relaxed">
              Takes about 2 minutes. We use this to match you with the right opponents and leagues.
            </p>
          </div>

          {/* Step list */}
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const num = i + 1;
              const isActive = num === currentStep;
              const isDone = num < currentStep;

              return (
                <div
                  key={num}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl transition-all"
                  style={{
                    backgroundColor: isActive ? "rgba(249,115,22,0.12)" : "transparent",
                    border: isActive ? "1px solid rgba(249,115,22,0.25)" : "1px solid transparent",
                  }}
                >
                  {/* Number / check */}
                  <div
                    className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black transition-all"
                    style={{
                      backgroundColor: isActive ? "#f97316" : isDone ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.06)",
                      color: isActive ? "#fff" : isDone ? "#fb923c" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {isDone ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : num}
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-none mb-0.5 ${isActive ? "text-white" : isDone ? "text-white/60" : "text-white/30"}`}>
                      {step.label}
                    </p>
                    <p className={`text-xs ${isActive ? "text-white/50" : "text-white/20"}`}>{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom */}
          <div className="mt-auto pt-8">
            <div className="h-px mb-6" style={{ backgroundColor: "rgba(255,255,255,0.07)" }} />
            <p className="text-xs text-white/25">© {new Date().getFullYear()} Top Tennis League</p>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-start px-4 sm:px-8 py-10">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden w-full max-w-2xl">
            <img src="/app-icon.png" alt="Top Tennis" className="h-10 w-10 rounded-xl object-cover" />
            <span className="font-bold text-sm leading-none">
              <span className="text-gray-900">Top</span>
              <span className="text-orange-500"> Tennis</span>
              <span className="block text-[10px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">League</span>
            </span>
          </div>

          <div className="w-full max-w-2xl">
            <ProfileWizard
              onProfileCreated={handleProfileCreated}
              createPlayerProfile={createPlayerProfile}
              onStepChange={setCurrentStep}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
