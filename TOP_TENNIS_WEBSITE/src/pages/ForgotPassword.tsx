import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";

/**
 * Forgot password, step 1.
 *
 * On success this ALWAYS advances to /reset-password with a question to show,
 * whether or not the account exists — the Edge Function returns a plausible
 * fallback question for an unknown email. Showing "no account with that
 * email" here would turn this page into a free account-existence oracle. The
 * only non-advancing outcome is a rate-limit trip, which is about the
 * caller's own behaviour.
 */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const { getSecurityQuestion } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { question, error: err } = await getSecurityQuestion(email.trim());
      if (err || !question) {
        setError(err?.message ?? "Something went wrong. Please try again.");
        return;
      }
      navigate("/reset-password", { state: { question } });
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      headline={["Locked out?", "Let's fix that."]}
      blurb="We'll ask your security question so you can set a new password — no code, no text message."
      title="Reset your password"
      subtitle="Enter your email and we'll ask your security question."
      footer={
        <Link
          to="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-bold text-gray-500 uppercase tracking-widest"
          >
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              disabled={loading}
              placeholder="you@example.com"
              className={`pl-10 ${fieldClass(!!error)}`}
            />
          </div>
          {error && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
        </div>

        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? (
            <>
              <Spinner /> Continuing…
            </>
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
