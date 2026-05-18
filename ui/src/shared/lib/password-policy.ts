export const PASSWORD_POLICY_HINT =
  "At least 10 characters, with uppercase, lowercase, and a number.";

export function validatePassword(password: string): string | null {
  if (password.length < 10) {
    return "Password must be at least 10 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }
  return null;
}
