import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";

/**
 * Forgot password, step 1.
 *
 * On success this ALWAYS advances to the code screen, whether or not the account
 * exists — the Edge Function returns an identical response either way. Showing
 * "no account with that username" here would turn the page into a free
 * account-existence oracle. The only non-advancing outcome is a rate-limit trip,
 * which is about the caller's own behaviour.
 */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Enter your username or phone number.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await requestPasswordReset(identifier.trim());
      if (err) {
        setError(err.message);
        return;
      }
      navigate("/verify-reset");
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
      blurb="We'll text a 6-digit code to the mobile number on your account so you can set a new password."
      title="Reset your password"
      subtitle="Enter your username or phone number and we'll text you a code."
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
            htmlFor="identifier"
            className="text-xs font-bold text-gray-500 uppercase tracking-widest"
          >
            Username or phone number
          </Label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError(null);
              }}
              disabled={loading}
              placeholder="rallyking or your mobile number"
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
              <Spinner /> Sending code…
            </>
          ) : (
            "Send code"
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
