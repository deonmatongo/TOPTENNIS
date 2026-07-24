import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { usePasswordValidation } from "@/hooks/usePasswordValidation";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";

const NAVY = "#0B1526";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<any>(null);

  const { updatePassword, session } = useAuth();
  const { validatePassword } = usePasswordValidation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session) {
      const t = setTimeout(() => {
        if (!session) {
          toast.error("Invalid or expired reset link. Please request a new one.");
          navigate("/forgot-password");
        }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [session, navigate]);

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
      const { error } = await updatePassword(password);
      if (error) toast.error(error.message || "Failed to update password. Please try again.");
      else {
        setSuccess(true);
        toast.success("Password updated successfully!");
        setTimeout(() => navigate("/login"), 2000);
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

  /* ── Success state ── */
  if (success) {
    return (
      <div className="min-h-screen flex">
        <LeftPanel
          tag="All done"
          heading={<>Password<br /><span className="text-orange-400">updated!</span></>}
          body="You're all set. You can now sign in with your new password."
        />
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8">
          <div className="w-full max-w-[420px] text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
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

  /* ── Main form ── */
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
              <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-widest">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password" name="password" type={showPassword ? "text" : "password"}
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
              <Label htmlFor="confirmPassword" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="confirmPassword" name="confirmPassword" type={showConfirm ? "text" : "password"}
                  autoComplete="new-password" required
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(ev => ({ ...ev, confirmPassword: "" })); }}
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

/* ── Shared sub-components ── */

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
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

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
          <span className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-6 w-fit" style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}>
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
