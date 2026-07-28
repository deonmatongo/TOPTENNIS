import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#0B1526";

type PageState = "loading" | "ready" | "error" | "success";

const ResetPassword = () => {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<any>(null);

  const { validatePassword } = usePasswordValidation();
  const navigate = useNavigate();

  useEffect(() => {
    const bootstrap = async () => {
      // 1. Try PKCE code exchange (newer Supabase default)
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setPageState("error"); return; }
        setPageState("ready");
        return;
      }

      // 2. Try legacy implicit tokens from URL hash
      const hash = window.location.hash.slice(1);
      const hashParams = Object.fromEntries(
        hash.split("&").map(p => p.split("=").map(decodeURIComponent))
      );
      if (hashParams.access_token && hashParams.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: hashParams.access_token,
          refresh_token: hashParams.refresh_token,
        });
        if (error) { setPageState("error"); return; }
        setPageState("ready");
        return;
      }

      // 3. Check if there's already an active recovery session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { setPageState("ready"); return; }

      // Nothing found — invalid link
      setPageState("error");
    };

    bootstrap();
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!password) e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (!confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message || "Failed to update password. Please try again.");
      } else {
        setPageState("success");
        toast.success("Password updated successfully!");
        setTimeout(() => navigate("/login"), 2500);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordStrength(val ? validatePassword(val) : null);
    if (errors.password) setErrors(ev => ({ ...ev, password: "" }));
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: NAVY }}>
        <div className="text-center space-y-4">
          <span className="inline-block h-10 w-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-white/60 text-sm">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (pageState === "error") {
    return (
      <div className="min-h-screen flex">
        <LeftPanel
          tag="Link expired"
          heading={<>Reset link<br /><span className="text-orange-400">invalid.</span></>}
          body="This link has expired or already been used. Request a new one to reset your password."
        />
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8">
          <div className="w-full max-w-[420px] text-center">
            <MobileLogo />
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Link expired</h1>
            <p className="text-sm text-gray-500 mb-8">
              This reset link is invalid or has already been used. Request a fresh one below.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors leading-[44px] text-center"
            >
              Request new link
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              Remember your password?{" "}
              <Link to="/login" className="text-orange-500 font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="min-h-screen flex">
        <LeftPanel
          tag="All done"
          heading={<>Password<br /><span className="text-orange-400">updated!</span></>}
          body="You're all set. You can now sign in with your new password."
        />
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8">
          <div className="w-full max-w-[420px] text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Password updated!</h1>
            <p className="text-sm text-gray-500 mb-8">Redirecting you to sign in…</p>
            <span className="inline-block h-6 w-6 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      <LeftPanel
        tag="New password"
        heading={<>Set a new<br /><span className="text-orange-400">password.</span></>}
        body="Choose something strong — at least 8 characters. You'll use this to sign in going forward."
      />

      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8 py-12">
        <div className="w-full max-w-[420px]">
          <MobileLogo />

          <h1 className="text-2xl font-black text-gray-900 mb-1">Set new password</h1>
          <p className="text-sm text-gray-400 mb-8">Must be at least 8 characters long.</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* New password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                New password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password" name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password" required
                  value={password} onChange={handlePasswordChange} disabled={loading}
                  placeholder="At least 8 characters"
                  className={`pl-10 pr-11 h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${errors.password ? "border-red-400" : ""}`}
                />
                <button
                  type="button" onClick={() => setShowPassword(s => !s)} disabled={loading}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" />{errors.password}
                </p>
              )}
              <PasswordStrengthIndicator password={password} strengthResult={passwordStrength} />
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Confirm password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="confirmPassword" name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password" required
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors(ev => ({ ...ev, confirmPassword: "" }));
                  }}
                  disabled={loading}
                  placeholder="Repeat your password"
                  className={`pl-10 pr-11 h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${errors.confirmPassword ? "border-red-400" : ""}`}
                />
                <button
                  type="button" onClick={() => setShowConfirm(s => !s)} disabled={loading}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" />{errors.confirmPassword}
                </p>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Updating…</>
                : "Update Password"
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Shared sub-components ────────────────────────────────────────────────────

function LeftPanel({ tag, heading, body }: { tag: string; heading: React.ReactNode; body: string }) {
  return (
    <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden flex-col" style={{ backgroundColor: NAVY }}>
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

      <div className="relative flex flex-col h-full px-12 py-12">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <img src="/app-icon.png" alt="Top Tennis" className="h-11 w-11 rounded-xl object-cover" />
          <span className="font-bold text-base leading-none">
            <span className="text-white">Top</span>
            <span className="text-orange-400"> Tennis</span>
            <span className="block text-[10px] font-medium text-white/40 tracking-widest uppercase mt-0.5">League</span>
          </span>
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-md">
          <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-6 w-fit"
            style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
            {tag}
          </span>
          <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">{heading}</h2>
          <p className="text-base text-white/50 leading-relaxed">{body}</p>
        </div>

        <p className="text-xs text-white/20">© {new Date().getFullYear()} Top Tennis League</p>
      </div>
    </div>
  );
}

function MobileLogo() {
  return (
    <div className="flex items-center gap-2.5 mb-8 lg:hidden">
      <img src="/app-icon.png" alt="Top Tennis" className="h-10 w-10 rounded-xl object-cover" />
      <span className="font-bold text-sm leading-none">
        <span className="text-gray-900">Top</span>
        <span className="text-orange-500"> Tennis</span>
        <span className="block text-[10px] font-medium text-gray-400 tracking-widest uppercase mt-0.5">League</span>
      </span>
    </div>
  );
}

export default ResetPassword;
