import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, AtSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AuthLayout, { fieldClass, submitClass, Spinner } from "@/components/auth/AuthLayout";
import OtpField, { useResendCooldown } from "@/components/auth/OtpField";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/**
 * Signup step 2: enter the SMS code, then claim the username.
 *
 * Deliberately NOT wrapped in AuthRedirect. verifyOtp establishes a real session,
 * and AuthRedirect would immediately bounce to /dashboard — unmounting this page
 * before claim_identity ran and leaving an account with a verified phone and no
 * username.
 *
 * If the handle is taken in the race window the verified session is kept and the
 * user picks another one right here, rather than redoing SMS verification because
 * of someone else's timing.
 */
const VerifyCode = () => {
  const navigate = useNavigate();
  const { pendingSignup, verifyPhoneOtp, completeSignup, resendSignupCode, cancelSignup } =
    useAuth();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { remaining, restart } = useResendCooldown(30);

  const [needsUsername, setNeedsUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Nothing to verify — most likely a direct visit or a reload.
  useEffect(() => {
    if (!pendingSignup) navigate("/register", { replace: true });
  }, [pendingSignup, navigate]);

  const finish = useCallback(
    async (usernameOverride?: string) => {
      const { error: err } = await completeSignup(usernameOverride);
      if (!err) {
        toast.success("You're all set!");
        navigate("/profile-setup", { replace: true });
        return;
      }
      if (err.field === "username") {
        setNeedsUsername(true);
        setUsernameError(err.message);
      } else {
        setError(err.message);
      }
    },
    [completeSignup, navigate],
  );

  const handleVerify = useCallback(
    async (submitted: string) => {
      if (submitted.length !== 6 || busy) return;
      setBusy(true);
      setError(null);
      const { error: err } = await verifyPhoneOtp(submitted);
      if (err) {
        setError(err.message);
        setCode("");
        setBusy(false);
        return;
      }
      await finish();
      setBusy(false);
    },
    [busy, verifyPhoneOtp, finish],
  );

  const handleResend = async () => {
    setError(null);
    restart();
    const { error: err } = await resendSignupCode();
    // The server enforces the real limit (3 per number per hour); this countdown
    // only stops the button being spammed.
    if (err) setError(err.message);
  };

  if (needsUsername) {
    return (
      <AuthLayout
        eyebrow="Almost There"
        headline={["Pick another", "username."]}
        blurb="Your number is verified. You just need a handle that nobody else has taken."
        title="Pick another username"
        subtitle="Your number is verified — you only need a free handle."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="newUsername"
              className="text-xs font-bold text-gray-500 uppercase tracking-widest"
            >
              Username
            </Label>
            <div className="relative">
              <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="newUsername"
                autoFocus
                maxLength={20}
                value={newUsername}
                onChange={(e) => {
                  setNewUsername(e.target.value);
                  setUsernameError(null);
                }}
                disabled={busy}
                placeholder="rallyking"
                className={`pl-10 ${fieldClass(!!usernameError)}`}
              />
            </div>
            {usernameError && (
              <p className="flex items-center gap-1 text-xs text-red-500">
                <AlertCircle className="w-3 h-3" />
                {usernameError}
              </p>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            className={submitClass}
            onClick={async () => {
              const candidate = newUsername.trim();
              if (!USERNAME_RE.test(candidate)) {
                setUsernameError("3–20 characters, letters, numbers and underscores only.");
                return;
              }
              setBusy(true);
              await finish(candidate);
              setBusy(false);
            }}
          >
            {busy ? (
              <>
                <Spinner /> Claiming…
              </>
            ) : (
              "Claim username"
            )}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="One More Step"
      headline={["Check your", "messages."]}
      blurb="We sent a 6-digit code to the mobile number you entered. Enter it to finish creating your account."
      title="Enter your code"
      subtitle="We texted a 6-digit code to your mobile number."
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
          <button
            type="button"
            onClick={() => {
              cancelSignup();
              navigate("/register", { replace: true });
            }}
            className="block mx-auto mt-3 text-xs text-gray-400 hover:text-gray-600"
          >
            Use a different number
          </button>
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

export default VerifyCode;
