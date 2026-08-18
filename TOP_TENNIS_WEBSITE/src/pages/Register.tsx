import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertCircle, AtSign, Check, Eye, EyeOff, HelpCircle, Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthRedirect from "@/components/AuthRedirect";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";
import { SECURITY_QUESTIONS } from "@/constants/securityQuestions";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Register = () => {
  const navigate = useNavigate();
  const { signUp, claimProfile, checkUsername } = useAuth();

  // Tracks whether signUp() already created the account, so a username
  // collision can be retried with claimProfile() alone instead of trying (and
  // failing) to create the account a second time.
  const accountCreated = useRef(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Debounced availability check. Advisory only: claim_username re-checks against
  // the unique constraint after the account is created, which is what closes the race.
  const [checking, setChecking] = useState(false);
  const [availableFor, setAvailableFor] = useState<string | null>(null);
  // Tracks WHY the handle is unconfirmed, so submit can say "couldn't verify"
  // instead of falsely asserting "taken".
  const [checkFailed, setCheckFailed] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    setAvailableFor(null);
    setCheckFailed(false);

    const candidate = username.trim();
    if (!USERNAME_RE.test(candidate)) {
      setChecking(false);
      return;
    }

    setChecking(true);
    debounce.current = setTimeout(async () => {
      const result = await checkUsername(candidate);
      setChecking(false);
      setCheckFailed(!!result.failed);
      if (result.available) {
        setAvailableFor(candidate);
        setErrors((p) => ({ ...p, username: "" }));
      } else {
        setErrors((p) => ({ ...p, username: result.reason ?? "That username is taken." }));
      }
    }, 450);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [username, checkUsername]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const handle = username.trim();

    if (!handle) e.username = "Pick a username";
    else if (!USERNAME_RE.test(handle)) {
      e.username = "3–20 characters, letters, numbers and underscores only.";
    } else if (availableFor !== handle) {
      // Three genuinely different states. Reporting "taken" for the other two
      // blamed the user for a lookup that never completed.
      e.username = checking
        ? "Still checking that username…"
        : checkFailed
          ? "Couldn't check that username. Check your connection and try again."
          : "That username is taken.";
    }

    if (!email.trim()) e.email = "Enter your email address";
    else if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";

    if (!password) e.password = "Choose a password";
    else if (password.length < 8) e.password = "At least 8 characters";

    if (!confirm) e.confirm = "Confirm your password";
    else if (password !== confirm) e.confirm = "Passwords do not match";

    if (!securityAnswer.trim()) e.securityAnswer = "Enter an answer you will remember";
    else if (securityAnswer.trim().length < 2) e.securityAnswer = "At least 2 characters";

    if (!agree) e.agree = "You must agree to continue";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (!accountCreated.current) {
        const { error } = await signUp({ email: email.trim(), password });
        if (error) {
          if (error.field) setErrors((p) => ({ ...p, [error.field as string]: error.message }));
          else toast.error(error.message);
          return;
        }
        accountCreated.current = true;
      }

      const { error } = await claimProfile({
        username: username.trim(),
        securityQuestion,
        securityAnswer: securityAnswer.trim(),
      });
      if (error) {
        if (error.field) setErrors((p) => ({ ...p, [error.field as string]: error.message }));
        else toast.error(error.message);
        return;
      }
      // No navigate() call: AuthRedirect takes over once pendingClaim clears.
      toast.success("You're all set!");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handle = username.trim();
  const usernameOk = availableFor === handle && handle.length > 0;

  return (
    <AuthRedirect>
      <AuthLayout
        eyebrow="Join The League"
        headline={["Find your", "next match."]}
        blurb="Create an account to join leagues, track your ranking, and get matched with players at your level."
        title="Create account"
        subtitle={
          <>
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-orange-500 hover:text-orange-400 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-bold text-gray-500 uppercase tracking-widest"
            >
              Username
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                placeholder="rallyking"
                className={`pl-10 pr-10 ${fieldClass(!!errors.username)}`}
              />
              {checking && (
                <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
              {!checking && usernameOk && (
                <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              )}
            </div>
            {errors.username ? (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {errors.username}
              </p>
            ) : (
              <p className="text-xs text-gray-400">This is how other players will find you.</p>
            )}
          </div>

          {/* Email */}
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
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({ ...p, email: "" }));
                }}
                disabled={loading}
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

          {/* Password */}
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-bold text-gray-500 uppercase tracking-widest"
            >
              Password
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
                // No maxLength and no character filtering: long passphrases and
                // pasted password-manager output must both keep working.
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

          {/* Confirm */}
          <div className="space-y-1.5">
            <Label
              htmlFor="confirm"
              className="text-xs font-bold text-gray-500 uppercase tracking-widest"
            >
              Confirm password
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

          {/* Security question */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Security question
            </Label>
            <p className="text-xs text-gray-400">Used to reset your password if you forget it.</p>
            <Select
              value={securityQuestion}
              onValueChange={setSecurityQuestion}
              disabled={loading}
            >
              <SelectTrigger className={fieldClass()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECURITY_QUESTIONS.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Security answer */}
          <div className="space-y-1.5">
            <Label
              htmlFor="securityAnswer"
              className="text-xs font-bold text-gray-500 uppercase tracking-widest"
            >
              Your answer
            </Label>
            <div className="relative">
              <HelpCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="securityAnswer"
                name="securityAnswer"
                type="text"
                autoComplete="off"
                required
                value={securityAnswer}
                onChange={(e) => {
                  setSecurityAnswer(e.target.value);
                  setErrors((p) => ({ ...p, securityAnswer: "" }));
                }}
                disabled={loading}
                placeholder="Enter your answer"
                className={`pl-10 ${fieldClass(!!errors.securityAnswer)}`}
              />
            </div>
            {errors.securityAnswer && (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {errors.securityAnswer}
              </p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox
              id="agree"
              checked={agree}
              onCheckedChange={(v) => {
                setAgree(v === true);
                setErrors((p) => ({ ...p, agree: "" }));
              }}
              disabled={loading}
              className="mt-0.5"
            />
            <Label htmlFor="agree" className="text-xs text-gray-500 leading-relaxed font-normal">
              I agree to the{" "}
              <Link to="/terms" className="text-orange-500 hover:text-orange-400 font-semibold">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-orange-500 hover:text-orange-400 font-semibold">
                Privacy Policy
              </Link>
              , including a zero-tolerance policy for objectionable content and abusive behavior.
            </Label>
          </div>
          {errors.agree && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {errors.agree}
            </p>
          )}

          <button type="submit" disabled={loading} className={submitClass}>
            {loading ? (
              <>
                <Spinner /> Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </AuthLayout>
    </AuthRedirect>
  );
};

export default Register;
