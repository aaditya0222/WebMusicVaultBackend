import crypto from "crypto";
import User from "../models/user.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiError from "../utils/ApiError";
import { generateOtpEmail } from "./email.services";
import { sendEmail } from "./email.services";
import bcrypt from "bcryptjs";
const generateOtp = async (): Promise<string> => {
  let otp = crypto.randomInt(100000, 1000000).toString();
  return otp;
};

type sendOtp = {
  email: string;
  purpose: "verify-email" | "set-password";
};

const sendOtpService = async ({ email, purpose }: sendOtp): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(
      HttpStatus.NotFound,
      `User with email ${email} is not registered`,
    );
  }
  if (purpose === "set-password" && user.password) {
    throw new ApiError(HttpStatus.Conflict, "Password already set");
  }
  if (purpose === "verify-email" && user.isEmailVerified) {
    throw new ApiError(HttpStatus.Conflict, "Email already verified");
  }
  if (user.otpExpiry && user.otpExpiry.getTime() - 9 * 60 * 1000 > Date.now()) {
    throw new ApiError(
      HttpStatus.TooManyRequests,
      "Please wait one minute before resending Otp",
    );
  }
  if (user.otpExpiry && user.otpExpiry < new Date()) {
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();
  }

  const otp = await generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  user.otp = hashedOtp;
  user.otpExpiry = otpExpiry;
  await user.save();

  const { subject, html } = generateOtpEmail(otp);
  try {
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    throw new ApiError(
      HttpStatus.InternalServerError,
      "Failed to send OTP email",
    );
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`OTP for ${email}: ${otp}`);
  }
};

export { sendOtpService };
