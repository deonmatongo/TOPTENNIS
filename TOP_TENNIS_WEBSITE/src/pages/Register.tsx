import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EnhancedRegistrationForm from "@/components/EnhancedRegistrationForm";
import WhatsAppOTPVerification from "@/components/WhatsAppOTPVerification";
import { parsePhoneForPrefill } from "@/utils/phoneValidation";
import { CheckCircle2 } from "lucide-react";

type RegistrationStep = 'form' | 'otp';

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<RegistrationStep>('form');
  const [registeredPhone, setRegisteredPhone] = useState('');
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

      // Account created — move to WhatsApp verification step
      setRegisteredPhone(formData.phone);
      setStep('otp');
      toast.success('Account created! Verify your WhatsApp to continue.');
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = async (verifiedE164: string) => {
    // Persist the verified number against the new profile row
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase
          .from('profiles')
          .update({ phone_number: verifiedE164 })
          .eq('id', currentUser.id);
      }
    } catch {
      // Non-fatal — profile can be updated later
    }

    toast.success('Phone verified! Now set up your player profile.');
    navigate('/profile-setup');
  };

  const handleOtpSkip = () => {
    toast.info("You can verify your WhatsApp later in your profile settings.");
    navigate('/profile-setup');
  };

  // Left panel content changes subtly per step
  const leftPanelStep = step === 'otp';

  return (
    <div className="min-h-screen flex overflow-x-hidden">
      {/* Left Side */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12 text-center w-full">
          <div className="text-center mb-8">
            <div className="w-64 h-64 mx-auto mb-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
              {leftPanelStep ? (
                <CheckCircle2 className="w-28 h-28 text-white/90" />
              ) : (
                <img src="/logo.png" alt="Tennis League Logo" className="h-40 w-56 object-contain" />
              )}
            </div>
            {leftPanelStep ? (
              <>
                <h1 className="text-4xl font-bold mb-4">Almost there!</h1>
                <p className="text-lg text-white/80">
                  Verify your WhatsApp so teammates and<br />opponents can reach you instantly.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-bold mb-4">Join our community</h1>
                <p className="text-lg text-white/80">Create your account and start your tennis journey</p>
              </>
            )}
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-3 mt-8">
            {(['form', 'otp'] as RegistrationStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s
                    ? 'bg-white text-primary'
                    : s === 'form' && step === 'otp'
                      ? 'bg-white/40 text-white'
                      : 'bg-white/20 text-white/60'
                }`}>
                  {s === 'form' && step === 'otp' ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${step === s ? 'text-white font-semibold' : 'text-white/60'}`}>
                  {s === 'form' ? 'Create Account' : 'Verify WhatsApp'}
                </span>
                {i === 0 && <div className="w-6 h-px bg-white/30" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-md">

          {step === 'form' && (
            <>
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Tennis League Logo" className="h-32 w-48 object-contain mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-foreground mb-2">Create Account</h2>
                <p className="text-base text-muted-foreground">Join the league and start playing!</p>
              </div>
              <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8">
                <EnhancedRegistrationForm onSubmit={handleFormSubmit} loading={loading} />
              </div>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="text-center mb-6">
                <img src="/logo.png" alt="Tennis League Logo" className="h-32 w-48 object-contain mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-foreground mb-2">Verify WhatsApp</h2>
                <p className="text-base text-muted-foreground">
                  We'll send a 6-digit code to confirm your number.
                </p>
              </div>
              <div className="bg-card rounded-2xl shadow-lg p-6 sm:p-8">
                <WhatsAppOTPVerification
                  initialPhone={parsePhoneForPrefill(registeredPhone) ?? undefined}
                  onVerified={handleOtpVerified}
                  onSkip={handleOtpSkip}
                />
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
export default Register;