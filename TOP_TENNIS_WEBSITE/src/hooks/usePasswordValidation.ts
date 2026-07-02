
import { useState } from 'react';

export interface PasswordStrengthResult {
  score: number; // 0-4 scale
  strength: string; // 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong'
  suggestions: string[];
}

export const usePasswordValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validatePassword = (password: string): PasswordStrengthResult => {
    if (!password) {
      return { 
        score: 0, 
        strength: 'Very Weak', 
        suggestions: ['Password is required'] 
      };
    }

    let score = 0;
    const suggestions: string[] = [];

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      suggestions.push('Use at least 8 characters');
    }

    // Complexity checks
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add uppercase letters');
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add lowercase letters');
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add special characters');
    }

    // Bonus points for length
    if (password.length >= 12) {
      score = Math.min(score + 1, 5);
    }

    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const strength = strengthLabels[Math.min(score, 5)];

    return { score, strength, suggestions };
  };

  return { validatePassword, isValidating };
};
