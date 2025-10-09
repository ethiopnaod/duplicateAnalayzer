export class PhoneFormatter {
  /**
   * Format phone number to international format
   * @param phone - Raw phone number string
   * @returns Formatted phone number
   */
  static format(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Handle different country codes and formats
    if (digits.length === 0) return '';
    
    // US/Canada format: +1-XXX-XXX-XXXX
    if (digits.length === 10) {
      return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // US/Canada with country code: +1-XXX-XXX-XXXX
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    // International format: +XX-XXX-XXX-XXXX
    if (digits.length >= 10) {
      const countryCode = digits.slice(0, digits.length - 10);
      const number = digits.slice(digits.length - 10);
      return `+${countryCode}-${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`;
    }
    
    // Fallback: return with dashes every 3 digits
    return digits.replace(/(\d{3})(?=\d)/g, '$1-');
  }
  
  /**
   * Validate phone number format
   * @param phone - Phone number to validate
   * @returns True if valid phone number
   */
  static validate(phone: string): boolean {
    if (!phone) return false;
    
    const digits = phone.replace(/\D/g, '');
    
    // Must be between 7 and 15 digits (international standard)
    return digits.length >= 7 && digits.length <= 15;
  }
  
  /**
   * Extract country code from phone number
   * @param phone - Phone number
   * @returns Country code or null
   */
  static getCountryCode(phone: string): string | null {
    if (!phone) return null;
    
    const digits = phone.replace(/\D/g, '');
    
    // Common country codes
    if (digits.startsWith('1') && digits.length === 11) return '1'; // US/Canada
    if (digits.startsWith('44') && digits.length >= 10) return '44'; // UK
    if (digits.startsWith('33') && digits.length >= 10) return '33'; // France
    if (digits.startsWith('49') && digits.length >= 10) return '49'; // Germany
    if (digits.startsWith('86') && digits.length >= 10) return '86'; // China
    if (digits.startsWith('91') && digits.length >= 10) return '91'; // India
    
    return null;
  }
  
  /**
   * Normalize phone number for comparison
   * @param phone - Phone number to normalize
   * @returns Normalized phone number
   */
  static normalize(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Remove leading 1 for US/Canada numbers
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.slice(1);
    }
    
    return digits;
  }
}

export const phoneFormatter = new PhoneFormatter();
