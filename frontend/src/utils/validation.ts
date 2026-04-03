/**
 * Account validation — keep in sync with backend/service/validation.py
 * and GET /api/validation-rules.
 */

export const USERNAME_RULES =
  "3–32 characters; letters, digits, and underscores only; must start with a letter or underscore.";

export const EMAIL_RULES = "Use a valid email address (e.g. name@domain.com).";

export const PASSWORD_RULES =
  "8–128 characters; at least one uppercase letter, one lowercase letter, one digit, and one special character (!@#$%^&* etc.).";

const USERNAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{2,31}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
/** Same character class as backend PASSWORD_SPECIAL_PATTERN */
const PASSWORD_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

export function validateUsername(value: string): string | null {
  const s = value.trim();
  if (!USERNAME_RE.test(s)) {
    return `Invalid username. ${USERNAME_RULES}`;
  }
  return null;
}

export function validateEmail(value: string): string | null {
  const s = value.trim().toLowerCase();
  if (s.length > 254) {
    return "Email is too long.";
  }
  if (!EMAIL_RE.test(s)) {
    return `Invalid email. ${EMAIL_RULES}`;
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) {
    return "Password is too short. Use at least 8 characters.";
  }
  if (value.length > 128) {
    return "Password is too long (maximum 128 characters).";
  }
  if (!/[a-z]/.test(value)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[A-Z]/.test(value)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/\d/.test(value)) {
    return "Password must include at least one digit.";
  }
  if (!value.split("").some((c) => PASSWORD_SPECIAL_CHARS.includes(c))) {
    return "Password must include at least one special character (!@#$%^&* etc.).";
  }
  return null;
}

/** Returns first error message or null if all valid. */
export function validateSignupFields(username: string, email: string, password: string): string | null {
  return (
    validateUsername(username) ||
    validateEmail(email) ||
    validatePassword(password)
  );
}
