import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, AlertCircle, Mail, Lock, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthRedirect from "@/components/AuthRedirect";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);
      
      if (error) {
        toast.error(error.message || 'Failed to sign in. Please try again.');
      } else {
        toast.success('Welcome back!');
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle(`${window.location.origin}/dashboard`);
      if (error) {
        toast.error(error.message);
        setGoogleLoading(false);
      }
      // Note: Don't set loading to false on success as redirect happens
    } catch (err: any) {
      toast.error('An unexpected error occurred. Please try again.');
      setGoogleLoading(false);
    }
  }, [signInWithGoogle]);

  const isLoading = loading || googleLoading;

  return (
    <AuthRedirect>
      <div className="min-h-screen flex overflow-x-hidden">
        {/* Left Side - Illustration */}
        <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 relative overflow-hidden">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          </div>
          
          {/* Tennis Court Lines Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-1/4 left-0 right-0 h-px bg-white"></div>
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-white"></div>
            <div className="absolute top-3/4 left-0 right-0 h-px bg-white"></div>
            <div className="absolute left-1/4 top-0 bottom-0 w-px bg-white"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white"></div>
            <div className="absolute left-3/4 top-0 bottom-0 w-px bg-white"></div>
          </div>

          <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 text-center w-full">
            {/* Welcome Text */}
            <div className="space-y-4 mb-12">
              <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
                Welcome Back!
              </h1>
              <p className="text-xl text-white/90 max-w-md mx-auto leading-relaxed">
                Your tennis community awaits. Connect, compete, and conquer the court.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">500+</div>
                <div className="text-sm text-white/80">Active Players</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">1000+</div>
                <div className="text-sm text-white/80">Matches Played</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                <div className="text-3xl font-bold mb-1">50+</div>
                <div className="text-sm text-white/80">Active Leagues</div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-white/60 rounded-full animate-pulse delay-100"></div>
              <div className="w-2 h-2 bg-white/40 rounded-full animate-pulse delay-200"></div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="flex-1 lg:flex-1 flex items-center justify-center p-4 sm:p-8 bg-white overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <img 
                src="/logo.png" 
                alt="Tennis League Logo" 
                className="h-32 w-48 object-contain mx-auto mb-4" 
              />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome</h2>
              <p className="text-base text-gray-600">Sign in to your account</p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" aria-hidden="true" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`pl-11 h-12 border-gray-300 focus:border-primary focus:ring-primary ${
                        validationErrors.email ? 'border-red-500' : ''
                      }`}
                      placeholder="Enter your email address"
                      disabled={isLoading}
                      aria-describedby={validationErrors.email ? "email-error" : undefined}
                      aria-invalid={!!validationErrors.email}
                    />
                  </div>
                  {validationErrors.email && (
                    <div id="email-error" className="flex items-center text-red-500 text-xs mt-1" role="alert">
                      <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                      {validationErrors.email}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" aria-hidden="true" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`pl-11 pr-11 h-12 border-gray-300 focus:border-primary focus:ring-primary ${
                        validationErrors.password ? 'border-red-500' : ''
                      }`}
                      placeholder="Enter your password"
                      disabled={isLoading}
                      aria-describedby={validationErrors.password ? "password-error" : undefined}
                      aria-invalid={!!validationErrors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {validationErrors.password && (
                    <div id="password-error" className="flex items-center text-red-500 text-xs mt-1" role="alert">
                      <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                      {validationErrors.password}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base"
                  disabled={isLoading}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true"></div>
                      SIGNING IN...
                    </div>
                  ) : (
                    'SIGN IN'
                  )}
                </Button>

                <div className="flex items-center my-6" role="separator">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <span className="px-4 text-sm text-gray-500 bg-white">OR</span>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  aria-label="Sign in with Google"
                >
                  {googleLoading ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true"></div>
                      Connecting...
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </Button>

                {/* Privacy notice */}
                <p className="text-xs text-center text-gray-500 mt-4">
                  <Shield className="w-3 h-3 inline mr-1" aria-hidden="true" />
                  We only access your name and email for authentication.
                </p>

                <div className="text-center pt-4 border-t border-gray-200 mt-6">
                  <p className="text-sm text-gray-600">
                    Have no account yet?{" "}
                    <Link 
                      to="/register" 
                      className="text-primary hover:text-primary/80 font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                    >
                      Registration
                    </Link>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AuthRedirect>
  );
};

export default Login;
