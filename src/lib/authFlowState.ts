/**
 * Pure helpers for email confirmation, callback outcomes, and resend cooldowns.
 * Kept free of UI/Supabase client imports for straightforward unit testing.
 */

export const RESEND_COOLDOWN_SECONDS = 60;

export type AuthCallbackOutcome =
  | {
      kind: "cross_device_confirmed";
      title: string;
      message: string;
    }
  | {
      kind: "expired_or_used";
      title: string;
      message: string;
    }
  | {
      kind: "error";
      title: string;
      message: string;
    };

/**
 * Returns remaining whole cooldown seconds before another verification email can be sent.
 */
export function getResendCooldownRemaining(
  lastSentAtMs: number | null,
  nowMs: number = Date.now(),
  cooldownSeconds: number = RESEND_COOLDOWN_SECONDS
): number {
  if (!lastSentAtMs || lastSentAtMs <= 0) return 0;
  const elapsedSeconds = (nowMs - lastSentAtMs) / 1000;
  const remaining = Math.ceil(cooldownSeconds - elapsedSeconds);
  return remaining > 0 ? remaining : 0;
}

/**
 * Classifies an Auth callback error into clear user-facing guidance:
 * - Cross-device / different browser confirmation where PKCE code_verifier is missing
 * - Expired or already-used confirmation link
 * - Other transient or unexpected failures
 */
export function classifyAuthCallbackFailure(input: {
  errorCode?: string | null;
  errorDescription?: string | null;
  errorMessage?: string | null;
}): AuthCallbackOutcome {
  const combined = `${input.errorCode || ""} ${input.errorDescription || ""} ${
    input.errorMessage || ""
  }`.toLowerCase();

  // Supabase PKCE flow opened in a different browser/device after confirming on server
  if (
    combined.includes("code verifier") ||
    combined.includes("code_verifier") ||
    combined.includes("both auth code and code verifier") ||
    combined.includes("pkce")
  ) {
    return {
      kind: "cross_device_confirmed",
      title: "Email confirmed! Please log in.",
      message:
        "You opened this confirmation link in a different browser or device. Your email verification has been processed—please sign in with your email and password.",
    };
  }

  // Expired or already-consumed OTP / link
  if (
    combined.includes("otp_expired") ||
    combined.includes("expired") ||
    combined.includes("invalid") ||
    combined.includes("access_denied") ||
    combined.includes("already been used") ||
    combined.includes("token has expired")
  ) {
    return {
      kind: "expired_or_used",
      title: "Confirmation link expired or already used",
      message:
        "This link has expired or was already used. If you already clicked it, try signing in—otherwise request a fresh confirmation email below.",
    };
  }

  return {
    kind: "error",
    title: "Could not finish verification",
    message:
      "We could not complete email verification automatically. Please request a fresh confirmation email or try signing in.",
  };
}
