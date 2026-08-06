import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";

/**
 * Forgot password, step 3.
 *
 * No longer a deep-link landing page: there are no email recovery links, so there
 * is no token in the URL to exchange. It is reached only from /verify-reset, and
 * guards on `resetPending` so a normal signed-in session cannot wander in.
 *
 * setNewPassword revokes EVERY session including this one, so on success the user
 * is signed out and sent back to /login. That is deliberate — a recovery flow must
 * invalidate any session an attacker already holds, and must not double as a way
 * into the app.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const { setNewPassword, resetPending } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Arriving here without a verified reset code means the flow was skipped or the
  // page was reloaded (which clears the in-memory reset state).
  useEffect(() => {
    if (!resetPending) navigate("/forgot-password", { replace: true });
  }, [resetPending, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!password) errs.password = "Choose a password";
    else if (password.length < 8) errs.password = "At least 8 characters";
    if (!confirm) errs.confirm = "Confirm your password";
    else if (password !== confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { error } = await setNewPassword(password);
      if (error) {
        if (error.field) setErrors({ [error.field as string]: error.message });
        else toast.error(error.message);
        return;
      }
      toast.success("Password updated. You've been signed out everywhere — sign in again.");
      navigate("/login", { replace: true });
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      headline={["Choose a", "new password."]}
      blurb="Saving a new password signs you out on every device, including this one."
      title="New password"
      subtitle="Then sign in with it."
      footer={
        <Link
          to="/login"
          className="block text-center text-xs text-gray-400 hover:text-gray-600 mt-6"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label
            htmlFor="password"
            className="text-xs font-bold text-gray-500 uppercase tracking-widest"
          >
            New password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: "" }));
              }}
              disabled={loading}
              placeholder="At least 8 characters"
              className={`pl-10 pr-11 ${fieldClass(!!errors.password)}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              disabled={loading}
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

        <div className="space-y-1.5">
          <Label
            htmlFor="confirm"
            className="text-xs font-bold text-gray-500 uppercase tracking-widest"
          >
            Confirm new password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="confirm"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((p) => ({ ...p, confirm: "" }));
              }}
              disabled={loading}
              placeholder="Re-enter your password"
              className={`pl-10 ${fieldClass(!!errors.confirm)}`}
            />
          </div>
          {errors.confirm && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errors.confirm}
            </p>
          )}
        </div>

        <p className="text-xs text-gray-400">
          Saving this will sign you out on every device.
        </p>

        <button type="submit" disabled={loading} className={submitClass}>
          {loading ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            "Save password"
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
