import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, HelpCircle, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";

/**
 * Forgot password, step 2 — answer the security question and choose a new
 * password in one screen, matching mobile's consolidated ResetPasswordScreen.
 *
 * Reached only from /forgot-password, which hands the question along as route
 * state. verifySecurityAnswer mints a short-lived session server-side (no
 * email/SMS sent); setNewPassword then saves the password and revokes every
 * session, this one included, so the user is signed out and returned to
 * /login on success.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifySecurityAnswer, setNewPassword } = useAuth();

  const question: string | undefined = (location.state as { question?: string } | null)?.question;

  const [answer, setAnswer] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Arriving here without a question means the flow was skipped, the page was
  // reloaded (which clears route state), or the URL was typed directly.
  useEffect(() => {
    if (!question) navigate("/forgot-password", { replace: true });
  }, [question, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!answer.trim()) errs.answer = "Enter your answer";
    if (!password) errs.password = "Choose a password";
    else if (password.length < 8) errs.password = "At least 8 characters";
    if (!confirm) errs.confirm = "Confirm your password";
    else if (password !== confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const { error: answerError } = await verifySecurityAnswer(answer.trim());
      if (answerError) {
        setErrors({ answer: answerError.message });
        return;
      }

      const { error: passwordError } = await setNewPassword(password);
      if (passwordError) {
        if (passwordError.field) setErrors({ [passwordError.field]: passwordError.message });
        else toast.error(passwordError.message);
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

  if (!question) return null;

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      headline={["Answer & choose", "a new password."]}
      blurb="Saving a new password signs you out on every device, including this one."
      title="Reset your password"
      subtitle={question}
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
            htmlFor="answer"
            className="text-xs font-bold text-gray-500 uppercase tracking-widest"
          >
            Your answer
          </Label>
          <div className="relative">
            <HelpCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="answer"
              name="answer"
              type="text"
              autoComplete="off"
              autoFocus
              required
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setErrors((p) => ({ ...p, answer: "" }));
              }}
              disabled={loading}
              placeholder="Enter your answer"
              className={`pl-10 ${fieldClass(!!errors.answer)}`}
            />
          </div>
          {errors.answer && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errors.answer}
            </p>
          )}
        </div>

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
