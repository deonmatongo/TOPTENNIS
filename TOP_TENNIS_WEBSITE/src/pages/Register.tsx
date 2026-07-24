import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import EnhancedRegistrationForm from "@/components/EnhancedRegistrationForm";

const NAVY = "#0B1526";

const Register = () => {
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleFormSubmit = async (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    agreeToTerms: boolean;
  }) => {
    setLoading(true);
    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.phone,
      );

      if (error) {
        if (
          error.message?.includes("already registered") ||
          error.message?.includes("already taken") ||
          error.message?.includes("User already registered")
        ) {
          toast.error("Email already taken. Please sign in instead.", {
            action: { label: "Go to Sign In", onClick: () => navigate("/login") },
          });
        } else {
          toast.error(error.message || "Failed to create account. Please try again.");
        }
        return;
      }

      toast.success("Account created! Set up your player profile.");
      navigate("/profile-setup");
    } catch (err) {
      console.error("Registration error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[46%] relative overflow-hidden flex-col" style={{ backgroundColor: NAVY }}>
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Orange glow blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

        <div className="relative flex flex-col h-full px-12 py-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group w-fit">
            <img src="/app-icon.png" alt="Top Tennis" className="h-11 w-11 rounded-xl object-cover" />
            <span className="font-bold text-base leading-none">
              <span className="text-white">Top</span>
              <span className="text-orange-400"> Tennis</span>
              <span className="block text-[10px] font-medium text-white/40 tracking-widest uppercase mt-0.5">League</span>
            </span>
          </Link>

          {/* Centre copy */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-6 w-fit" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
              Join the League
            </span>
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Start your<br />
              <span className="text-orange-400">tennis journey.</span>
            </h2>
            <p className="text-base text-white/50 leading-relaxed mb-10">
              Join hundreds of players competing in structured leagues across all skill levels. Create your free account and start climbing the ladder.
            </p>

            {/* Perks */}
            <div className="space-y-3">
              {[
                "Match with players at your skill level",
                "Flexible scheduling around your calendar",
                "Real-time ladder rankings & stats",
                "Singles, doubles, and mixed leagues",
              ].map(perk => (
                <div key={perk} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(249,115,22,0.18)" }}>
                    <svg className="h-3 w-3 text-orange-400" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm text-white/60">{perk}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/20">© {new Date().getFullYear()} Top Tennis League</p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-start justify-center bg-white px-4 sm:px-8 py-10 overflow-y-auto">
        <div className="w-full max-w-[440px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <img src="/app-icon.png" alt="Top Tennis" className="h-10 w-10 rounded-xl object-cover" />
            <span className="font-bold text-sm leading-none">
              <span className="text-gray-900">Top</span>
              <span className="text-orange-500"> Tennis</span>
              <span className="block text-[10px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">League</span>
            </span>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-400 mb-8">
            Already have an account?{" "}
            <Link to="/login" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">
              Sign in
            </Link>
          </p>

          <EnhancedRegistrationForm onSubmit={handleFormSubmit} loading={loading} />
        </div>
      </div>
    </div>
  );
};

export default Register;
