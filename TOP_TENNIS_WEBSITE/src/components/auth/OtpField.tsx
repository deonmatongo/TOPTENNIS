import { useEffect, useRef, useState } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AlertCircle } from "lucide-react";

/**
 * Six-digit SMS code entry.
 *
 * `autoComplete="one-time-code"` lets Safari and Chrome offer the code from a
 * paired device or SMS. onComplete fires once the sixth digit lands, including on
 * an autofill paste, so the user does not also have to press a button.
 */
const OtpField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: string;
  disabled?: boolean;
}> = ({ value, onChange, onComplete, error, disabled }) => {
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === 6 && firedFor.current !== value) {
      firedFor.current = value;
      onComplete?.(value);
    }
    if (value.length < 6) firedFor.current = null;
  }, [value, onComplete]);

  return (
    <div className="space-y-2">
      <InputOTP
        maxLength={6}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete="one-time-code"
        containerClassName="justify-center"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              className={`h-12 w-11 text-lg rounded-xl border-gray-200 ${
                error ? "border-red-400" : ""
              }`}
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && (
        <p className="flex items-center justify-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};

export default OtpField;

/**
 * 30s resend cooldown. Courtesy only — the real limit (3 sends per number per
 * hour) is enforced server-side, so bypassing this timer gains nothing.
 */
export function useResendCooldown(seconds = 30) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  return { remaining, restart: () => setRemaining(seconds) };
}
