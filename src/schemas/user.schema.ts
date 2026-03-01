import { z } from "zod";
const username = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(30, "Username must be less than or equal to 30 characters")
  .regex(
    /^[A-Za-z0-9._]+$/,
    "Username can only contain lowercase letters, numbers, dots, and underscores",
  )
  .transform((u) => u.toLowerCase());

const email = z
  .email("Invalid email format")
  .trim()
  .transform((e) => e.toLowerCase());

const displayName = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters")
  .max(30, "Display name must be less than or equal to 30 letters");

const password = z
  .string()
  .min(6, "Password must be at least 6 characters long")
  .max(50, "Password must be less than or equal to 50 characters");

const identifier = email.or(username);
const otp = z.coerce
  .string()
  .trim()
  .length(6, "Otp must be combination of 6 numbers");

const purpose = z.enum(["verify-email", "set-password"]);

const registerSchema = z.object({
  body: z.object({
    email,
    username,
    displayName,
    password: password,
  }),
});

const loginSchema = z.object({
  body: z.object({
    identifier,
    password,
  }),
});

const suggestUsernameSchema = z.object({
  body: z.object({
    identifier: displayName.or(email),
    n: z.coerce.number(),
  }),
});
const setPasswordSchema = z.object({
  body: z.object({
    identifier,
    password,
    otp,
  }),
});

const sendOtpSchema = z.object({
  body: z.object({
    email,
  }),
  query: z.object({
    purpose,
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email,
    otp,
  }),
});

const usernameSchema = z.object({
  username: username,
});

type RegisterRequest = z.infer<typeof registerSchema>["body"];
type LoginRequest = z.infer<typeof loginSchema>["body"];
type SuggestUsernameRequest = z.infer<typeof suggestUsernameSchema>["body"];
type SetPasswordRequest = z.infer<typeof setPasswordSchema>["body"];
type SendOtpRequest = {
  body: z.infer<typeof sendOtpSchema>["body"];
  query: z.infer<typeof sendOtpSchema>["query"];
};
type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>["body"];

export {
  registerSchema,
  loginSchema,
  suggestUsernameSchema,
  setPasswordSchema,
  verifyEmailSchema,
  sendOtpSchema,
  RegisterRequest,
  LoginRequest,
  SuggestUsernameRequest,
  SetPasswordRequest,
  SendOtpRequest,
  VerifyEmailRequest,
  usernameSchema,
};
