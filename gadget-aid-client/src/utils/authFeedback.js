export const returnPath = (state) => {
  const from = state?.from || state?.form;
  const path = from?.pathname;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || /[\s\\]/.test(path) || ["/login","/register","/forgot-password"].includes(path)) return "/";
  return path + (typeof from.search === "string" && from.search.startsWith("?") ? from.search : "") + (typeof from.hash === "string" && from.hash.startsWith("#") ? from.hash : "");
};

export const authMessage = (error) => {
  const messages = {
    "auth/invalid-credential": "The email or password is incorrect. Please try again.",
    "auth/user-not-found": "The email or password is incorrect. Please try again.",
    "auth/wrong-password": "The email or password is incorrect. Please try again.",
    "auth/email-already-in-use": "This email already has an account. Try logging in or reset your password.",
    "auth/weak-password": "Use a stronger password with at least six characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "There have been too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Check your connection and try again.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed. You can try again.",
    "auth/popup-blocked": "Allow the Google sign-in popup, then try again.",
    "auth/user-disabled": "This account is unavailable. Contact support for help.",
    "auth/account-exists-with-different-credential": "Use the sign-in method you originally used for this email."
  };
  return Object.hasOwn(messages,error?.code) ? messages[error.code] : "We could not complete that request. Please try again.";
};
