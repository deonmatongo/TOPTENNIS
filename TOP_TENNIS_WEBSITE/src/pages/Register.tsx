import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import EnhancedRegistrationForm from "@/components/EnhancedRegistrationForm";

const Register = () => {
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleFormSubmit = async (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    agreeToTerms: boolean;
  }) => {
    setLoading(true);
    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.phone,
      );

      if (error) {
        if (
          error.message?.includes('already registered') ||
          error.message?.includes('already taken') ||
          error.message?.includes('User already registered')
        ) {
          toast.error('Email already taken. Please sign in instead.', {
            action: { label: 'Go to Sign In', onClick: () => navigate('/login') },
          });
        } else {
          toast.error(error.message || 'Failed to create account. Please try again.');
        }
        return;
      }

      toast.success('Account created! Set up your player profile.');
      navigate('/profile-setup');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      {/* Left Side */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 text-center w-full">
          <div className="text-center mb-8">
            <div className="w-64 h-64 mx-auto mb-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
              <img src="/logo.png" alt="Tennis League Logo" className="h-40 w-56 object-contain" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Join our community</h1>
            <p className="text-lg text-white/80">Create your account and start your tennis journey</p>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <img src="/logo.png" alt="Tennis League Logo" className="h-32 w-48 object-contain mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-foreground mb-2">Create Account</h2>
            <p className="text-base text-muted-foreground">Join the league and start playing!</p>
          </div>
          <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8">
            <EnhancedRegistrationForm onSubmit={handleFormSubmit} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Register;