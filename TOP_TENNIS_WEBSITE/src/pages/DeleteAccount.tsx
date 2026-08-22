import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, Mail, Lock, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const NAVY = "#0B1526";

const fieldClass = (hasError?: boolean) =>
  `h-11 rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-400/20 ${
    hasError ? "border-red-400" : ""
  }`;

const submitClass =
  "w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2";

const Spinner = () => (
  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
);

/**
 * Public account-deletion page, reachable without the app installed —
 * satisfies Apple's requirement that account deletion be available via a URL.
 * Identity is confirmed with the same email+password sign-in as the app,
 * then deletion goes through the same `delete-account` Edge Function the
 * mobile app calls from Settings.
 */
const DeleteAccount = () => {
  const { user, signIn, signOut } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [signingIn, setSigningIn] = useState(false);

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((ev) => ({ ...ev, [name]: "" }));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!formData.email.trim()) nextErrors.email = "Enter your email address";
    if (!formData.password) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSigningIn(true);
    try {
      const { error } = await signIn(formData.email.trim(), formData.password);
      if (error) toast.error(error.message);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", { body: { userId: user.id } });
      if (error) throw error;
      await signOut();
      setDone(true);
    } catch (e: any) {
      toast.error(e?.message || "Deletion failed. Please contact support@toptennis.app.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <div className="pt-16 md:pt-[4.25rem]" style={{ backgroundColor: NAVY }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <span
            className="inline-block text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
            style={{ color: "#fb923c", backgroundColor: "rgba(249,115,22,0.12)" }}
          >
            Account
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">Delete Your Account</h1>
          <p className="text-sm text-white/40 max-w-md mx-auto">
            Permanently remove your Top Tennis account and all associated data.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-4 sm:px-6 py-14 sm:py-20">
        {done ? (
          <div className="text-center space-y-3 border border-gray-100 rounded-2xl p-8">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-black text-gray-900">Your account has been deleted</h2>
            <p className="text-sm text-gray-500">
              All of your data has been permanently removed. Thanks for playing with Top Tennis.
            </p>
            <Link to="/" className="inline-block text-sm font-bold text-orange-500 hover:text-orange-400">
              Back to Home
            </Link>
          </div>
        ) : !user ? (
          <>
            <p className="text-sm text-gray-500 mb-6 text-center">
              Sign in to confirm your identity before deleting your account.
            </p>
            <form onSubmit={handleSignIn} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    disabled={signingIn}
                    placeholder="you@example.com"
                    className={`pl-10 ${fieldClass(!!errors.email)}`}
                  />
                </div>
                {errors.email && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    disabled={signingIn}
                    placeholder="Your password"
                    className={`pl-10 pr-11 ${fieldClass(!!errors.password)}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={signingIn}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <button type="submit" disabled={signingIn} className={submitClass}>
                {signingIn ? (
                  <>
                    <Spinner /> Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 text-center">
              Signed in as <span className="font-bold text-gray-900">{user.email}</span>
            </p>

            <div className="rounded-2xl border border-red-100 bg-red-50 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                <p className="text-sm font-black text-red-700">This cannot be undone</p>
              </div>
              <p className="text-sm text-red-600/90 leading-relaxed">
                Deleting your account permanently removes your profile, match history, availability, messages, and
                league standings. You will lose access immediately.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Type DELETE to confirm
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
                placeholder="DELETE"
                className={fieldClass(false)}
              />
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || confirmText.trim().toUpperCase() !== "DELETE"}
              className="w-full h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <Spinner /> Deleting…
                </>
              ) : (
                "Permanently Delete My Account"
              )}
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              disabled={deleting}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel and sign out
            </button>
          </div>
        )}

        {/* Contact callout — matches Privacy/Terms pages */}
        <div className="mt-10 flex items-start gap-4 p-6 rounded-2xl" style={{ backgroundColor: NAVY }}>
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(249,115,22,0.15)" }}
          >
            <Mail className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white mb-0.5">Prefer not to sign in here?</p>
            <p className="text-sm text-white/50">
              You can also delete your account from the app under Settings → Delete Account, or email{" "}
              <a
                href="mailto:support@toptennis.app"
                className="text-orange-400 hover:text-orange-300 transition-colors"
              >
                support@toptennis.app
              </a>{" "}
              and we'll take care of it for you.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default DeleteAccount;
