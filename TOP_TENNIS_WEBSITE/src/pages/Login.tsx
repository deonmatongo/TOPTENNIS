import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, Mail, Lock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthRedirect from "@/components/AuthRedirect";

const NAVY = "#0B1526";

const GOOGLE_SVG = (
  <svg className="w-5 h-5 mr-2.5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = "Enter a valid email address";
    if (!formData.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await signIn(formData.email, formData.password);
      if (error) toast.error(error.message || "Failed to sign in. Please try again.");
      else toast.success("Welcome back!");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(ev => ({ ...ev, [name]: "" }));
  };

  const handleGoogle = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle(`${window.location.origin}/dashboard`);
      if (error) { toast.error(error.message); setGoogleLoading(false); }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
      setGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  const isLoading = loading || googleLoading;

  return (
    <AuthRedirect>
      <div className="min-h-screen flex">

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col" style={{ backgroundColor: NAVY }}>
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
                Welcome Back
              </span>
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
                Your game<br />
                <span className="text-orange-400">awaits you.</span>
              </h2>
              <p className="text-base text-white/50 leading-relaxed mb-10">
                Sign back in to track your rankings, schedule matches, and stay connected with your league.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "500+", label: "Active Players" },
                  { value: "50+", label: "Active Leagues" },
                  { value: "1 000+", label: "Matches Played" },
                ].map(({ value, label }) => (
                  <div key={label} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="text-xl font-black text-orange-400 mb-1">{value}</div>
                    <div className="text-xs text-white/40 font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom */}
            <p className="text-xs text-white/20">© {new Date().getFullYear()} Top Tennis League</p>
          </div>
        </div>

        {/* ── Right panel — form ── */}
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8 py-12 overflow-y-auto">
          <div className="w-full max-w-[420px]">

            {/* Mobile logo */}
            <div className="flex items-center gap-2.5 mb-8 lg:hidden">
              <img src="/app-icon.png" alt="Top Tennis" className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-bold text-sm leading-none">
                <span className="text-gray-900">Top</span>
                <span className="text-orange-500"> Tennis</span>
                <span className="block text-[10px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">League</span>
              </span>
            </div>

            <h1 className="text-2xl font-black text-gray-900 mb-1">Sign in</h1>
            <p className="text-sm text-gray-400 mb-8">
              Don't have an account?{" "}
              <Link to="/register" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">
                Create one free
              </Link>
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isLoading}
              className="w-full flex items-center justify-center h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors disabled:opacity-50 mb-6"
            >
              {googleLoading
                ? <span className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin mr-2" />
                : GOOGLE_SVG
              }
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={formData.email} onChange={handleChange} disabled={isLoading}
                    placeholder="you@example.com"
                    className={`pl-10 h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${errors.email ? "border-red-400" : ""}`}
                  />
                </div>
                {errors.email && <p className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password" name="password" type={showPassword ? "text" : "password"}
                    autoComplete="current-password" required
                    value={formData.password} onChange={handleChange} disabled={isLoading}
                    placeholder="Your password"
                    className={`pl-10 pr-11 h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${errors.password ? "border-red-400" : ""}`}
                  />
                  <button
                    type="button" onClick={() => setShowPassword(s => !s)} disabled={isLoading}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{errors.password}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit" disabled={isLoading}
                className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Signing in…</>
                  : "Sign In"
                }
              </button>
            </form>

            <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-6">
              <Shield className="w-3 h-3" />
              We only access your name and email for authentication.
            </p>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
};

export default Login;
