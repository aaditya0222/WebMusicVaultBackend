import crypto from "crypto";
import User from "../models/user.model";
import { HttpStatus } from "../utils/HttpStatus";
import ApiError from "../utils/ApiError";
import { generateOtpEmail } from "./email.services";
import { sendEmail } from "./email.services";
import bcrypt from "bcryptjs";
const generateOtp = (): string => {
  let otp = crypto.randomInt(100000, 1000000).toString();
  return otp;
};

type sendOtp = {
  identifier: string;
  purpose: "verify-email" | "set-password" | "edit-password";
};

const sendOtpService = async ({
  identifier,
  purpose,
}: sendOtp): Promise<void> => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });
  if (!user) {
    throw new ApiError(
      HttpStatus.NotFound,
      `User with this credentials doesn't exist`,
    );
  }
  if (purpose === "set-password" && user.password) {
    throw new ApiError(HttpStatus.Conflict, "Password already set");
  }
  if (purpose === "verify-email" && user.isEmailVerified) {
    throw new ApiError(HttpStatus.Conflict, "Email already verified");
  }
  if (purpose === "edit-password") {
    //TODO: need to write logic maybe later
    return;
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
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  user.otp = hashedOtp;
  user.otpExpiry = otpExpiry;
  await user.save();

  const { subject, html } = generateOtpEmail(otp);
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    throw new ApiError(
      HttpStatus.InternalServerError,
      "Failed to send OTP email",
    );
  }
  if (process.env.NODE_ENV === "development") {
    console.log(`OTP for ${identifier}: ${otp}`);
  }
};

export { sendOtpService };
