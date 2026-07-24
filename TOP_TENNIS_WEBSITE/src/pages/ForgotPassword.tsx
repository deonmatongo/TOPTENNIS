import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const NAVY = "#0B1526";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [validationError, setValidationError] = useState("");
  const { resetPassword } = useAuth();

  const validate = (val: string) => {
    if (!val.trim()) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(val)) return "Enter a valid email address";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    if (err) { setValidationError(err); return; }
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) toast.error(error.message || "Failed to send reset email. Please try again.");
      else { setEmailSent(true); toast.success("Password reset email sent!"); }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (validationError) setValidationError("");
  };

  /* ── Success state ── */
  if (emailSent) {
    return (
      <div className="min-h-screen flex">
        {/* Left panel */}
        <LeftPanel
          tag="Check your inbox"
          heading={<>We sent the<br /><span className="text-orange-400">reset link.</span></>}
          body="If an account exists for that email address you'll receive a password reset link shortly. Check your spam folder if it doesn't arrive within a minute."
        />

        {/* Right */}
        <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8">
          <div className="w-full max-w-[420px] text-center">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(34,197,94,0.1)" }}>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 leading-relaxed mb-2">
              We've sent a reset link to <span className="font-semibold text-gray-700">{email}</span>
            </p>
            <p className="text-sm text-gray-400 mb-8">
              Didn't receive it?{" "}
              <button onClick={() => setEmailSent(false)} className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">
                Try again
              </button>
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <LeftPanel
        tag="Password reset"
        heading={<>Forgot your<br /><span className="text-orange-400">password?</span></>}
        body="No worries — it happens to everyone. Enter your email and we'll send you a secure link to set a new one."
      />

      {/* Right */}
      <div className="flex-1 flex items-center justify-center bg-white px-4 sm:px-8 py-12">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <MobileLogo />

          <h1 className="text-2xl font-black text-gray-900 mb-1">Reset your password</h1>
          <p className="text-sm text-gray-400 mb-8">
            Remember it?{" "}
            <Link to="/login" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors">
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email" name="email" type="email" autoComplete="email" required
                  value={email} onChange={handleChange} disabled={loading}
                  placeholder="you@example.com"
                  className={`pl-10 h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${validationError ? "border-red-400" : ""}`}
                />
              </div>
              {validationError && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="w-3 h-3" />{validationError}
                </p>
              )}
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Sending…</>
                : "Send Reset Link"
              }
            </button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Sign In
            </Link>
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
      {/* Grid texture */}
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

export default ForgotPassword;
