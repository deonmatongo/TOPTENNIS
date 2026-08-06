import { useMemo } from "react";
import { AsYouType, getCountryCallingCode } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fieldClass } from "./AuthLayout";

/**
 * Phone entry with a country selector, matching the mobile PhoneField.
 *
 * US-primary, not US-only: the selector defaults to US and formatting follows the
 * selected country, but any country can be picked. Formatting is cosmetic — the
 * value handed up is raw national digits plus the country, and normalisation to
 * E.164 happens in the Edge Function using this same library. The client copy is
 * UX; the server copy is the control.
 */

/**
 * Curated list rather than all ~240 ISO regions: a long list is worse UX than a
 * short one. Extend freely — nothing downstream depends on this being fixed.
 */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "ZA", name: "South Africa" },
  { code: "ZW", name: "Zimbabwe" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "GH", name: "Ghana" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "PH", name: "Philippines" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PL", name: "Poland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "GR", name: "Greece" },
  { code: "TR", name: "Türkiye" },
  { code: "IL", name: "Israel" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
];

/** ISO 3166-1 alpha-2 -> regional indicator pair, so no flag assets are needed. */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function dialCode(code: string): string {
  try {
    return `+${getCountryCallingCode(code as never)}`;
  } catch {
    return "";
  }
}

const PhoneInput: React.FC<{
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
}> = ({ country, onCountryChange, value, onChange, error, disabled, label = "Mobile number" }) => {
  // AsYouType gives country-correct grouping rather than hardcoded US parentheses.
  const formatted = useMemo(() => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    try {
      return new AsYouType(country as never).input(digits);
    } catch {
      return digits;
    }
  }, [value, country]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="phone" className="text-xs font-bold text-gray-500 uppercase tracking-widest">
        {label}
      </Label>
      <div className="flex gap-2">
        <Select value={country} onValueChange={onCountryChange} disabled={disabled}>
          <SelectTrigger className={`${fieldClass()} w-[116px] shrink-0`} aria-label="Country">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span>{flagEmoji(country)}</span>
                <span className="text-sm">{dialCode(country)}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <span>{flagEmoji(c.code)}</span>
                  <span>{c.name}</span>
                  <span className="text-gray-400">{dialCode(c.code)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatted}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          disabled={disabled}
          placeholder="555 123 4567"
          className={`${fieldClass(!!error)} flex-1`}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
