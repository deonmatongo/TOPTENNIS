
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface RegistrationFormProps {
  onSubmit: (formData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    agreeToTerms: boolean;
  }) => Promise<void>;
  loading: boolean;
}

const RegistrationForm = ({ onSubmit, loading }: RegistrationFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (!formData.agreeToTerms) {
      toast.error('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    await onSubmit(formData);
  }, [formData, onSubmit]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleCheckboxChange = useCallback((checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      agreeToTerms: checked
    }));
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName" className="text-xs sm:text-sm font-medium text-gray-700">
            First Name
          </Label>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleInputChange}
            className="h-10 sm:h-12 border-gray-300 focus:border-orange-600 focus:ring-orange-600 text-sm sm:text-base"
            placeholder="First name"
            disabled={loading}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="lastName" className="text-xs sm:text-sm font-medium text-gray-700">
            Last Name
          </Label>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleInputChange}
            className="h-10 sm:h-12 border-gray-300 focus:border-orange-600 focus:ring-orange-600 text-sm sm:text-base"
            placeholder="Last name"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs sm:text-sm font-medium text-gray-700">
          Email Address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleInputChange}
          className="h-10 sm:h-12 border-gray-300 focus:border-orange-600 focus:ring-orange-600 text-sm sm:text-base"
          placeholder="Enter your email"
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-gray-700">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            value={formData.password}
            onChange={handleInputChange}
            className="h-10 sm:h-12 border-gray-300 focus:border-orange-600 focus:ring-orange-600 pr-10 sm:pr-12 text-sm sm:text-base"
            placeholder="Create a password"
            disabled={loading}
          />
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-xs sm:text-sm font-medium text-gray-700">
          Confirm Password
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            required
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="h-10 sm:h-12 border-gray-300 focus:border-orange-600 focus:ring-orange-600 pr-10 sm:pr-12 text-sm sm:text-base"
            placeholder="Confirm your password"
            disabled={loading}
          />
          <button
            type="button"
            onClick={toggleConfirmPasswordVisibility}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            disabled={loading}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      <div className="flex items-start space-x-2 pt-2">
        <Checkbox 
          id="terms" 
          checked={formData.agreeToTerms}
          onCheckedChange={handleCheckboxChange}
          disabled={loading}
          className="mt-1"
        />
        <Label htmlFor="terms" className="text-xs sm:text-sm text-gray-600 leading-relaxed">
          I agree to the{" "}
          <Link to="/terms" className="text-orange-600 hover:text-orange-700 font-medium">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-orange-600 hover:text-orange-700 font-medium">
            Privacy Policy
          </Link>
        </Label>
      </div>

      <Button 
        type="submit" 
        className="w-full h-10 sm:h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm sm:text-lg"
        disabled={!formData.agreeToTerms || loading}
      >
        {loading ? (
          <div className="flex items-center">
            <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            CREATING ACCOUNT...
          </div>
        ) : (
          'CREATE ACCOUNT'
        )}
      </Button>

      <div className="text-center pt-3 sm:pt-4 border-t border-gray-200">
        <p className="text-xs sm:text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="text-orange-600 hover:text-orange-700 font-bold">
            Sign in here
          </Link>
        </p>
      </div>
    </form>
  );
};

export default RegistrationForm;
