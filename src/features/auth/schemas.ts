import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Normalizes the email (trim + lowercase) BEFORE the format check so that
 * " user@Example.COM " validates and is stored/compared as
 * "user@example.com".
 */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/**
 * Shared validation for registration. The password policy is an approved
 * implementation decision (minimum 8 characters).
 */
export const registerSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
});

/**
 * Login validates format only. Credential *verification* happens exclusively
 * inside the Auth.js Credentials provider `authorize()`.
 */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
