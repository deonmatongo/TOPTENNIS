/**
 * Phone validation utilities for US phone numbers
 */

export const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const phoneNumber = value.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (phoneNumber.length >= 10) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
  } else if (phoneNumber.length >= 6) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;
  } else if (phoneNumber.length >= 3) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  } else {
    return phoneNumber;
  }
};

export const validateUSPhoneNumber = (phoneNumber: string): boolean => {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');
  
  // US phone numbers should have exactly 10 digits
  if (digits.length !== 10) {
    return false;
  }
  
  // First digit should not be 0 or 1
  if (digits[0] === '0' || digits[0] === '1') {
    return false;
  }
  
  // Area code (first 3 digits) should not start with 0 or 1
  if (digits[1] === '0' || digits[1] === '1') {
    return false;
  }
  
  // Exchange code (digits 4-6) should not start with 0 or 1
  if (digits[3] === '0' || digits[3] === '1') {
    return false;
  }
  
  return true;
};

export const getPhoneValidationError = (phoneNumber: string): string | null => {
  if (!phoneNumber.trim()) {
    return 'Phone number is required';
  }
  
  const digits = phoneNumber.replace(/\D/g, '');
  
  if (digits.length === 0) {
    return 'Please enter a valid phone number';
  }
  
  if (digits.length < 10) {
    return 'Please enter a valid 10-digit phone number';
  }
  
  if (digits.length > 10) {
    return 'Please enter a valid 10-digit phone number';
  }
  
  if (!validateUSPhoneNumber(phoneNumber)) {
    return 'Please enter a valid US phone number';
  }
  
  return null;
};