import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AuthLayout, { submitClass, Spinner } from "@/components/auth/AuthLayout";
import OtpField, { useResendCooldown } from "@/components/auth/OtpField";

/**
 * Forgot password, step 2.
 *
 * Unlike signup, this cannot verify locally: on the username path the client is
 * never told which number the code went to. verifyResetOtp posts the identifier
 * and the code to the verify-reset-code Edge Function, which resolves the number
 * server-side and returns the short-lived session.
 *
 * A wrong code and a non-existent account produce the same message, so having
 * reached this page still reveals nothing.
 */
const VerifyResetCode = () => {
  const navigate = useNavigate();
  const { verifyResetOtp, resendResetCode } = useAuth();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { remaining, restart } = useResendCooldown(30);

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (submitted.length !== 6 || busy) return;
      setBusy(true);
      setError(null);
      const { error: err } = await verifyResetOtp(submitted);
      setBusy(false);
      if (err) {
        setError(err.message);
        setCode("");
        return;
      }
      navigate("/reset-password");
    },
    [busy, verifyResetOtp, navigate],
  );

  const handleResend = async () => {
    setError(null);
    restart();
    const { error: err } = await resendResetCode();
    if (err) setError(err.message);
  };

  return (
    <AuthLayout
      eyebrow="Account Recovery"
      headline={["Enter the", "code we sent."]}
      blurb="If that account exists, a 6-digit code is on its way to the number we have on file."
      title="Enter your code"
      subtitle="If that account exists, a 6-digit code is on its way."
      footer={
        <div className="text-center mt-6">
          {remaining > 0 ? (
            <p className="text-xs text-gray-400">You can request a new code in {remaining}s</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="text-xs text-orange-500 hover:text-orange-400 font-semibold"
            >
              Send a new code
            </button>
          )}
          <Link
            to="/forgot-password"
            className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-3"
          >
            <ArrowLeft className="w-3 h-3" />
            Start over
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <OtpField
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
          }}
          onComplete={handleVerify}
          disabled={busy}
          error={error ?? undefined}
        />

        <button
          type="button"
          onClick={() => handleVerify(code)}
          disabled={busy || code.length !== 6}
          className={submitClass}
        >
          {busy ? (
            <>
              <Spinner /> Verifying…
            </>
          ) : (
            "Verify"
          )}
        </button>
      </div>
    </AuthLayout>
  );
};

export default VerifyResetCode;
