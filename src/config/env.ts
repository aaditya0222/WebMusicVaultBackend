import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number(),
  MONGODB_URI: z.url(),
  NODE_ENV: z.enum(["development", "production"]),
  ACCESS_TOKEN_SECRET: z.string().min(1, "Access token secret is required"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "Refresh token secret is required"),
  ACCESS_TOKEN_EXPIRY: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      "Must be a valid time string (e.g., '15m', '1h', '7d')",
    ),
  REFRESH_TOKEN_EXPIRY: z
    .string()
    .regex(
      /^\d+[smhd]$/,
      "Must be a valid time string (e.g., '15m', '1h', '7d')",
    ),

  CLOUDINARY_CLOUD_NAME: z.string().min(1, "Cloud name is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "Cloudinary API key is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "Cloudinary API secret is required"),
  FRONTEND_URL: z.url("Frontend URL must be a valid URL"),
  BACKEND_URL: z.url("Backend URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "Google Client Id is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "Google Client Secret is required"),
  RESEND_EMAIL_API_KEY: z.string().min(1, "Resend Email API Key is required"),
  MAX_MUSIC_FILE_SIZE: z
    .string()
    .min(1, "Max song file size must be a valid number in string format")
    .transform((n) => parseInt(n, 10))
    .refine((n) => !isNaN(n), {
      message: "Music file size must be a positive integer",
    }),
  MAX_COVER_IMAGE_FILE_SIZE: z
    .string()
    .min(1, "Max cover image file size must be a valid number in string format")
    .transform((n) => parseInt(n, 10))
    .refine((n) => !isNaN(n), {
      message: "Cover image file size must be a positive integer",
    }),
  GMAIL_USER: z.string().min(1, "Email is required"),
  GMAIL_APP_PASSWORD: z.string().min(1, "Gmail app password Key is required"),
  OWNER_MONGOOSE_ID: z
    .string()
    .length(
      24,
      "Owner id is required for returning owner's picked songs playlist",
    ),
  MAINTENANCE_MODE: z
    .enum(["true", "false"])
    .transform((val) => val === "true"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    z.treeifyError(parsedEnv.error),
  );
  process.exit(1);
}

export const env: z.infer<typeof envSchema> = parsedEnv.data;
