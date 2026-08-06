import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, User as UserIcon, Lock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthRedirect from "@/components/AuthRedirect";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";

/**
 * One identifier field for both usernames and phone numbers.
 *
 * The page does not decide which one it is — signIn sends whatever was typed to
 * the login-with-username Edge Function, which classifies it server-side.
 * Branching here would give the two paths different latencies and hand back the
 * account-enumeration signal that function exists to remove.
 */
const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.identifier.trim()) e.identifier = "Enter your username or phone number";
    if (!formData.password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await signIn(formData.identifier.trim(), formData.password);
      if (error) toast.error(error.message);
      else toast.success("Welcome back!");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((ev) => ({ ...ev, [name]: "" }));
  };

  return (
    <AuthRedirect>
      <AuthLayout
        eyebrow="Welcome Back"
        headline={["Your game", "awaits you."]}
        blurb="Sign back in to track your rankings, schedule matches, and stay connected with your league."
        title="Sign in"
        subtitle={
          <>
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-orange-500 hover:text-orange-400 font-semibold transition-colors"
            >
              Create one free
            </Link>
          </>
        }
        footer={
          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-6">
            <Shield className="w-3 h-3" />
            We verify your account with a text message. Standard rates may apply.
          </p>
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
                // 'username' rather than 'tel': password managers key on this
                // field, and the value is a handle more often than a number.
                autoComplete="username"
                required
                value={formData.identifier}
                onChange={handleChange}
                disabled={loading}
                placeholder="rallyking or your mobile number"
                className={`pl-10 ${fieldClass(!!errors.identifier)}`}
              />
            </div>
            {errors.identifier && (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {errors.identifier}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-xs font-bold text-gray-500 uppercase tracking-widest"
              >
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-xs text-orange-500 hover:text-orange-400 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
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
                disabled={loading}
                placeholder="Your password"
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

          <button type="submit" disabled={loading} className={submitClass}>
            {loading ? (
              <>
                <Spinner /> Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </AuthLayout>
    </AuthRedirect>
  );
};

export default Login;
