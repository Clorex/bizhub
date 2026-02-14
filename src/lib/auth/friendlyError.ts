// FILE: src/lib/auth/friendlyError.ts

type FriendlyErrorResult = {
  message: string;
  showSignIn?: boolean;
  showSignUp?: boolean;
};

const ERROR_MAP: Record<string, FriendlyErrorResult> = {
  "auth/email-already-in-use": {
    message: "This email is already registered.",
    showSignIn: true,
  },
  "auth/invalid-email": {
    message: "Please enter a valid email address.",
  },
  "auth/operation-not-allowed": {
    message: "This sign-in method is not enabled. Please contact support.",
  },
  "auth/weak-password": {
    message: "Password is too weak. Please use at least 6 characters.",
  },
  "auth/user-disabled": {
    message: "This account has been disabled. Please contact support.",
  },
  "auth/user-not-found": {
    message: "No account found with this email.",
    showSignUp: true,
  },
  "auth/wrong-password": {
    message: "Incorrect password. Please try again.",
  },
  "auth/invalid-credential": {
    message: "Invalid email or password. Please try again.",
  },
  "auth/too-many-requests": {
    message: "Too many attempts. Please wait a moment and try again.",
  },
  "auth/network-request-failed": {
    message: "Network error. Please check your connection and try again.",
  },
  "auth/popup-closed-by-user": {
    message: "Sign-in was cancelled. Please try again.",
  },
  "auth/requires-recent-login": {
    message: "Please sign in again to continue.",
  },
};

export function getFriendlyAuthError(error: any): FriendlyErrorResult {
  const rawMessage = String(error?.message || error || "");
  const code = String(error?.code || "");

  // Check direct code match
  if (code && ERROR_MAP[code]) {
    return ERROR_MAP[code];
  }

  // Check if code is embedded in message (Firebase format: "Firebase: Error (auth/xxx).")
  for (const key of Object.keys(ERROR_MAP)) {
    if (rawMessage.includes(key)) {
      return ERROR_MAP[key];
    }
  }

  // Clean up Firebase prefix if present
  let cleaned = rawMessage
    .replace(/^Firebase:\s*/i, "")
    .replace(/\s*\(auth\/[^)]+\)\.?$/i, "")
    .trim();

  if (!cleaned || cleaned.length > 150) {
    cleaned = "Something went wrong. Please try again.";
  }

  return { message: cleaned };
}
