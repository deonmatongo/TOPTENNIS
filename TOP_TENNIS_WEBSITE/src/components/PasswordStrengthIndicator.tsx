
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Check, AlertCircle } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
  password: string;
  strengthResult?: {
    score: number;
    strength: string;
    suggestions: string[];
  };
}

const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  strengthResult
}) => {
  if (!password) return null;

  const getStrengthColor = (score: number) => {
    if (score <= 1) return 'bg-red-500';
    if (score <= 2) return 'bg-orange-500';
    if (score <= 3) return 'bg-yellow-500';
    if (score <= 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthTextColor = (score: number) => {
    if (score <= 1) return 'text-red-600';
    if (score <= 2) return 'text-orange-600';
    if (score <= 3) return 'text-yellow-600';
    if (score <= 4) return 'text-blue-600';
    return 'text-green-600';
  };

  const requirements = [
    { text: 'At least 8 characters', check: password.length >= 8 },
    { text: 'Contains uppercase letter', check: /[A-Z]/.test(password) },
    { text: 'Contains lowercase letter', check: /[a-z]/.test(password) },
    { text: 'Contains number', check: /[0-9]/.test(password) },
    { text: 'Contains special character', check: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
  ];

  const score = strengthResult?.score || 0;
  const strength = strengthResult?.strength || 'Very Weak';
  const progressValue = (score / 5) * 100;

  return (
    <div className="mt-2 space-y-3">
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Password Strength:</span>
          <span className={`text-sm font-medium ${getStrengthTextColor(score)}`}>
            {strength}
          </span>
        </div>
        <Progress 
          value={progressValue} 
          className="h-2"
        />
      </div>

      {/* Requirements Checklist */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 mb-1">Requirements:</div>
        {requirements.map((requirement, index) => (
          <div key={index} className="flex items-center text-xs">
            {requirement.check ? (
              <Check className="w-3 h-3 text-green-500 mr-2" />
            ) : (
              <AlertCircle className="w-3 h-3 text-gray-400 mr-2" />
            )}
            <span className={requirement.check ? 'text-green-700' : 'text-gray-500'}>
              {requirement.text}
            </span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      {strengthResult && strengthResult.suggestions.length > 0 && score < 4 && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="text-blue-700 font-medium mb-1">Suggestions to improve:</div>
          {strengthResult.suggestions.map((suggestion, index) => (
            <div key={index} className="text-blue-600">• {suggestion}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
