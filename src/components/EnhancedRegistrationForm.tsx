import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePasswordValidation } from '@/hooks/usePasswordValidation';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatPhoneNumber, getPhoneValidationError } from '@/utils/phoneValidation';

interface EnhancedRegistrationFormProps {
  onSubmit: (formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    agreeToTerms: boolean;
  }) => Promise<void>;
  loading: boolean;
}

const EnhancedRegistrationForm: React.FC<EnhancedRegistrationFormProps> = ({
  onSubmit,
  loading
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [passwordStrength, setPasswordStrength] = useState<any>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { validatePassword } = usePasswordValidation();
  const { signInWithGoogle } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });

  const validateForm = useCallback(async () => {
    const errors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    const phoneError = getPhoneValidationError(formData.phone);
    if (phoneError) {
      errors.phone = phoneError;
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = await validateForm();
    if (!isValid) return;

    await onSubmit(formData);
  }, [formData, onSubmit, validateForm]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    let processedValue = value;
    
    if (name === 'phone') {
      processedValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue
    }));

    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  }, [validationErrors]);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    handleInputChange(e);

    if (newPassword) {
      const result = validatePassword(newPassword);
      setPasswordStrength(result);
    } else {
      setPasswordStrength(null);
    }
  }, [handleInputChange, validatePassword]);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);

  const handleCheckboxChange = useCallback((checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      agreeToTerms: checked
    }));

    if (validationErrors.agreeToTerms) {
      setValidationErrors(prev => ({
        ...prev,
        agreeToTerms: ''
      }));
    }
  }, [validationErrors.agreeToTerms]);

  const handleGoogleSignUp = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle(`${window.location.origin}/profile-setup`);
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
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
            First Name *
          </Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={formData.firstName}
            onChange={handleInputChange}
            className={`h-12 border-gray-300 focus:border-primary focus:ring-primary ${
              validationErrors.firstName ? 'border-red-500' : ''
            }`}
            placeholder="Enter your first name"
            disabled={isLoading}
            aria-invalid={!!validationErrors.firstName}
          />
          {validationErrors.firstName && (
            <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
              <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
              {validationErrors.firstName}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
            Last Name *
          </Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={formData.lastName}
            onChange={handleInputChange}
            className={`h-12 border-gray-300 focus:border-primary focus:ring-primary ${
              validationErrors.lastName ? 'border-red-500' : ''
            }`}
            placeholder="Enter your last name"
            disabled={isLoading}
            aria-invalid={!!validationErrors.lastName}
          />
          {validationErrors.lastName && (
            <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
              <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
              {validationErrors.lastName}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
          Phone Number *
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          value={formData.phone}
          onChange={handleInputChange}
          className={`h-12 border-gray-300 focus:border-primary focus:ring-primary ${
            validationErrors.phone ? 'border-red-500' : ''
          }`}
          placeholder="(555) 123-4567"
          disabled={isLoading}
          aria-invalid={!!validationErrors.phone}
        />
        {validationErrors.phone && (
          <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            {validationErrors.phone}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email Address *
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={handleInputChange}
          className={`h-12 border-gray-300 focus:border-primary focus:ring-primary ${
            validationErrors.email ? 'border-red-500' : ''
          }`}
          placeholder="Enter your email address"
          disabled={isLoading}
          aria-invalid={!!validationErrors.email}
        />
        {validationErrors.email && (
          <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            {validationErrors.email}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium text-gray-700">
          Create your Password *
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={formData.password}
            onChange={handlePasswordChange}
            className={`h-12 border-gray-300 focus:border-primary focus:ring-primary pr-12 ${
              validationErrors.password ? 'border-red-500' : ''
            }`}
            placeholder="Create a password (minimum 8 characters)"
            disabled={isLoading}
            aria-invalid={!!validationErrors.password}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {validationErrors.password && (
          <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            {validationErrors.password}
          </div>
        )}
        <PasswordStrengthIndicator 
          password={formData.password} 
          strengthResult={passwordStrength}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
          Confirm Password *
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className={`h-12 border-gray-300 focus:border-primary focus:ring-primary pr-12 ${
              validationErrors.confirmPassword ? 'border-red-500' : ''
            }`}
            placeholder="Confirm your password"
            disabled={isLoading}
            aria-invalid={!!validationErrors.confirmPassword}
          />
          <button
            type="button"
            onClick={toggleConfirmPasswordVisibility}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            disabled={isLoading}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {validationErrors.confirmPassword && (
          <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            {validationErrors.confirmPassword}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="agreeToTerms"
            checked={formData.agreeToTerms}
            onCheckedChange={handleCheckboxChange}
            disabled={isLoading}
            className="mt-1"
          />
          <Label htmlFor="agreeToTerms" className="text-sm text-gray-700 leading-tight">
            I agree to the{" "}
            <Link to="/terms" className="text-primary hover:text-primary/80 font-medium">
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:text-primary/80 font-medium">
              Privacy Policy
            </Link>
          </Label>
        </div>
        {validationErrors.agreeToTerms && (
          <div className="flex items-center text-red-500 text-xs mt-1" role="alert">
            <AlertCircle className="w-3 h-3 mr-1" aria-hidden="true" />
            {validationErrors.agreeToTerms}
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base"
        disabled={isLoading}
      >
        {loading ? (
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" aria-hidden="true"></div>
            CREATING ACCOUNT...
          </div>
        ) : (
          'CREATE ACCOUNT'
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
        className="w-full h-12 border-gray-300 hover:bg-gray-50"
        onClick={handleGoogleSignUp}
        disabled={isLoading}
        aria-label="Sign up with Google"
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
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:text-primary/80 font-bold">
            Sign in here
          </Link>
        </p>
      </div>
    </form>
  );
};

export default EnhancedRegistrationForm;
