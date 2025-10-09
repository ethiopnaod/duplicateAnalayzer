/**
 * Phone number standardization utilities
 */

export function standardizePhoneNumber(phone: string | null | undefined): string {
  if (!phone || phone.trim() === '') {
    return '';
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different cases
  if (digits.length === 0) {
    return '';
  }
  
  // If it starts with country code, format accordingly
  if (digits.length >= 10) {
    // US/Canada format: +1-XXX-XXX-XXXX
    if (digits.length === 10) {
      return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // If it has country code already
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    // International format
    if (digits.length > 11) {
      return `+${digits}`;
    }
  }
  
  // Return original if can't format
  return phone;
}

export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const standardized = standardizePhoneNumber(phone);
  return standardized || 'No phone';
}

export function isValidPhoneNumber(phone: string | null | undefined): boolean {
  if (!phone || phone.trim() === '') {
    return false;
  }
  
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}
