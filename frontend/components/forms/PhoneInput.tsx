"use client";

import * as React from "react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Phone, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string, e164Value: string | null) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  defaultCountry?: CountryCode;
  className?: string;
  showCountryFlag?: boolean;
  allowInternational?: boolean;
}

// Common country codes with flags and names
const COUNTRY_CODES: Array<{
  code: CountryCode;
  name: string;
  flag: string;
  callingCode: string;
}> = [
  { code: "US", name: "United States", flag: "🇺🇸", callingCode: "+1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", callingCode: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", callingCode: "+44" },
  { code: "AU", name: "Australia", flag: "🇦🇺", callingCode: "+61" },
  { code: "DE", name: "Germany", flag: "🇩🇪", callingCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", callingCode: "+33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", callingCode: "+39" },
  { code: "ES", name: "Spain", flag: "🇪🇸", callingCode: "+34" },
  { code: "JP", name: "Japan", flag: "🇯🇵", callingCode: "+81" },
  { code: "CN", name: "China", flag: "🇨🇳", callingCode: "+86" },
  { code: "IN", name: "India", flag: "🇮🇳", callingCode: "+91" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", callingCode: "+55" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", callingCode: "+52" },
  { code: "RU", name: "Russia", flag: "🇷🇺", callingCode: "+7" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", callingCode: "+27" },
];

const PhoneInput = React.memo(function PhoneInput({
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  label,
  helperText,
  error,
  disabled = false,
  required = false,
  defaultCountry = "US",
  className,
  showCountryFlag = true,
  allowInternational = true,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = React.useState<CountryCode>(defaultCountry);
  const [isFocused, setIsFocused] = React.useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Parse the current phone number
  const phoneNumber = React.useMemo(() => {
    if (!value) return null;
    try {
      return parsePhoneNumberFromString(value, selectedCountry);
    } catch {
      return null;
    }
  }, [value, selectedCountry]);

  // Validation state
  const isValid = phoneNumber?.isValid() ?? false;
  const isInvalid = touched && value && !isValid;
  const e164Value = phoneNumber?.number ?? null;

  // Format display value
  const displayValue = React.useMemo(() => {
    if (!value) return "";
    
    // If it's already in E.164 format, format it for display
    if (phoneNumber?.isValid()) {
      return phoneNumber.formatInternational().replace(/\s+/g, "-");
    }
    
    return value;
  }, [value, phoneNumber]);

  // Handle input change
  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow only digits, spaces, dashes, parentheses, and plus sign
    const cleanedValue = inputValue.replace(/[^\d\s\-\(\)\+]/g, "");
    
    // Auto-add country code if user starts typing without it
    let processedValue = cleanedValue;
    if (cleanedValue && !cleanedValue.startsWith("+") && !cleanedValue.startsWith("1")) {
      const country = COUNTRY_CODES.find(c => c.code === selectedCountry);
      if (country) {
        processedValue = `${country.callingCode}${cleanedValue}`;
      }
    }
    
    onChange(processedValue, e164Value);
  }, [selectedCountry, onChange, e164Value]);

  // Handle country selection
  const handleCountrySelect = React.useCallback((countryCode: CountryCode) => {
    setSelectedCountry(countryCode);
    setShowCountryDropdown(false);
    
    // If there's a current value, try to parse it with the new country
    if (value) {
      try {
        const phone = parsePhoneNumberFromString(value, countryCode);
        if (phone?.isValid()) {
          onChange(phone.formatInternational().replace(/\s+/g, "-"), phone.number);
        }
      } catch {
        // Keep current value if parsing fails
      }
    }
    
    inputRef.current?.focus();
  }, [value, onChange]);

  // Handle blur
  const handleBlur = React.useCallback(() => {
    setTouched(true);
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Handle focus
  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get current country info
  const currentCountry = COUNTRY_CODES.find(c => c.code === selectedCountry);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <div className="flex items-center">
          {/* Country Selector */}
          {allowInternational && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className={cn(
                "h-9 px-3 rounded-r-none border-r-0 flex items-center gap-2",
                isInvalid && "border-destructive"
              )}
              disabled={disabled}
            >
              {showCountryFlag && currentCountry && (
                <span className="text-lg">{currentCountry.flag}</span>
              )}
              <span className="text-sm font-mono">{currentCountry?.callingCode}</span>
              <Globe className="h-3 w-3" />
            </Button>
          )}
          
          {/* Phone Input */}
          <Input
            ref={inputRef}
            type="tel"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder || `${currentCountry?.callingCode} (555) 123-4567`}
            disabled={disabled}
            className={cn(
              allowInternational && "rounded-l-none",
              isInvalid && "border-destructive focus-visible:ring-destructive/20",
              isValid && touched && "border-green-500 focus-visible:ring-green-500/20"
            )}
          />
          
          {/* Validation Icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid && touched && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {isInvalid && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>

        {/* Country Dropdown */}
        {showCountryDropdown && allowInternational && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-auto rounded-md border bg-background shadow-lg"
          >
            {COUNTRY_CODES.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => handleCountrySelect(country.code)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent",
                  selectedCountry === country.code && "bg-accent"
                )}
              >
                <span className="text-lg">{country.flag}</span>
                <span className="font-mono text-sm">{country.callingCode}</span>
                <span className="text-sm text-muted-foreground">{country.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helper Text / Error Messages */}
      <div className="min-h-4 space-y-1">
        {isInvalid && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {error || "Please enter a valid phone number"}
          </p>
        )}
        
        {isValid && touched && e164Value && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid: {e164Value}
            </Badge>
          </div>
        )}
        
        {helperText && !isInvalid && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
});

export default PhoneInput;
