import { HttpStatus } from "../utils/HttpStatus";
import ApiError from "../utils/ApiError";
import { env } from "../config/env";
import type { StringValue } from "ms";
import User from "../models/user.model";
import type { UserI } from "../models/user.model";
import { Types } from "mongoose";
import {
  LoginRequest,
  RegisterRequest,
  SetPasswordRequest,
  VerifyEmailRequest,
} from "../schemas/user.schema";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { TokenPayload } from "../types/types";
const accessTokenExpiry = env.ACCESS_TOKEN_EXPIRY as StringValue;
const refreshTokenExpiry = env.REFRESH_TOKEN_EXPIRY as StringValue;
import { ErrorCode } from "../utils/ErrorCode";

interface LoginAndRegisterData {
  username: string;
  displayName: string;
  email: string;
  role: "user" | "admin";
  avatar: string;
  _id: Types.ObjectId;
  isEmailVerified: boolean;
}

const verifyOtp = async (otp: string, hashedOtp: string): Promise<boolean> => {
  return await bcrypt.compare(otp, hashedOtp);
};

export const getUserDetailsToSend = (user: UserI) => {
  const { authProviders, createdAt, updatedAt, ...requiredData } =
    user.toJSON();
  return requiredData as LoginAndRegisterData;
};

const generateAccessToken = (payload: TokenPayload): string => {
  const accessToken = jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: accessTokenExpiry,
  });

  if (!accessToken) {
    throw new ApiError(
      HttpStatus.InternalServerError,
      "Failed to generate access token",
    );
  }
  return accessToken;
};
const generateRefreshToken = (payload: TokenPayload): string => {
  const refreshToken = jwt.sign(payload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: refreshTokenExpiry,
  });
  if (!refreshToken) {
    throw new ApiError(
      HttpStatus.InternalServerError,
      "Failed to generate refresh token",
    );
  }
  return refreshToken;
};

const registerService = async ({
  email,
  password,
  displayName,
  username,
}: RegisterRequest): Promise<{
  accessToken: string;
  refreshToken: string;
  user: LoginAndRegisterData;
}> => {
  const existingEmailUser = await User.findOne({ email });
  if (existingEmailUser) {
    if (existingEmailUser.googleId) {
      throw new ApiError(
        HttpStatus.Conflict,
        `User with email ${email} is already registered`,
        { code: ErrorCode.GOOGLE_ACCOUNT },
      );
    }
    throw new ApiError(
      HttpStatus.Conflict,
      `User with email ${email} is already registered`,
      { code: ErrorCode.EMAIL_EXISTS },
    );
  }

  const existingUsernameUser = await User.findOne({ username });
  if (existingUsernameUser) {
    throw new ApiError(
      HttpStatus.Conflict,
      `Username ${username} is already taken`,
    );
  }
  const createdUser: UserI = await User.create({
    email,
    username,
    displayName,
    password,
  });

  if (!createdUser) {
    throw new ApiError(
      HttpStatus.InternalServerError,
      "Error while registering user",
    );
  }
  //*Method-1
  // const createdUser: User | null = await User.findById(user._id)
  //   .select("-password -refreshToken")
  //   .lean();
  // better approach
  //*Method-2
  // const createdUser = user.toObject();
  // delete createdUser.password;
  // delete createdUser.refreshToken;
  //*Method-3 -> Automated removal of these two fields inside the schema of user itself

  //*Real example of iife(immediately invoked function expression)
  const userDetailsToSend = getUserDetailsToSend(createdUser);

  const { accessToken, refreshToken } = await createdUser.generateAuthTokens();
  return {
    accessToken,
    refreshToken,
    user: userDetailsToSend,
  };
};
const loginService = async ({
  identifier,
  password,
}: LoginRequest): Promise<{
  accessToken: string;
  refreshToken: string;
  user: LoginAndRegisterData;
}> => {
  const user: UserI | null = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });

  if (!user) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "Invalid email/username or password",
    );
  }

  if (!user.authProviders!.includes("local") && user.password == undefined) {
    throw new ApiError(
      HttpStatus.Forbidden,
      `This account was registered with google. Please log in using google or set a password to enable password login.`,
      { code: ErrorCode.GOOGLE_ACCOUNT },
    );
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(
      HttpStatus.Unauthorized,
      "Invalid email/username or password",
    );
  }
  //*Real example of iife(immediately invoked function expression)
  const userDetailsToSend = getUserDetailsToSend(user);

  const { accessToken, refreshToken } = await user.generateAuthTokens();
  return {
    accessToken,
    refreshToken,
    user: userDetailsToSend,
  };
};

const setPasswordService = async ({
  identifier,
  password,
  otp,
}: SetPasswordRequest): Promise<{
  accessToken: string;
  refreshToken: string;
  user: UserI;
}> => {
  const user = await User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  });
  if (!user) {
    throw new ApiError(
      HttpStatus.NotFound,
      `User ${identifier} is not registered`,
    );
  }
  if (user.password) {
    throw new ApiError(HttpStatus.Conflict, "Password already set");
  }
  if (!user.otp || !user.otpExpiry) {
    throw new ApiError(
      HttpStatus.BadRequest,
      "No OTP found. Please request a new one.",
    );
  }
  if (user.otpExpiry < new Date()) {
    throw new ApiError(HttpStatus.BadRequest, "OTP expired.Please Try again.");
  }
  const isVerified = await verifyOtp(otp, user.otp);
  if (!isVerified) {
    throw new ApiError(HttpStatus.BadRequest, "Invalid Otp. Please Try again.");
  }
  user.password = password;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.authProviders?.push("local");
  await user.save();
  const { refreshToken, accessToken } = await user.generateAuthTokens();
  return { accessToken, refreshToken, user };
};

const verifyEmailService = async ({
  otp,
  email,
}: VerifyEmailRequest): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(
      HttpStatus.NotFound,
      `User with email ${email} is not registered`,
    );
  }
  if (!user.otp || !user.otpExpiry) {
    throw new ApiError(
      HttpStatus.BadRequest,
      "No OTP found. Please request a new one.",
    );
  }
  if (user.otpExpiry && user.otpExpiry < new Date()) {
    throw new ApiError(HttpStatus.BadRequest, "OTP expired.Please Try again.");
  }
  const isVerified = await verifyOtp(otp, user.otp);
  if (!isVerified) {
    throw new ApiError(HttpStatus.BadRequest, "Invalid Otp. Please Try again.");
  }
  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();
};

const refreshAccessTokenService = async (
  refreshToken: string,
): Promise<{
  accessToken: string;
  newRefreshToken: string;
}> => {
  if (!refreshToken) {
    throw new ApiError(HttpStatus.Unauthorized, "Refresh token is required");
  }
  const decoded = jwt.verify(
    refreshToken,
    env.REFRESH_TOKEN_SECRET,
  ) as JwtPayload;
  const user = await User.findById(decoded._id);
  if (!user) {
    throw new ApiError(HttpStatus.Unauthorized, "Invalid token");
  }
  if (user.refreshToken !== refreshToken) {
    throw new ApiError(HttpStatus.Unauthorized, "Token has been revoked");
  }
  const { accessToken, refreshToken: newRefreshToken } =
    await user.generateAuthTokens();
  return { accessToken, newRefreshToken };
};

export {
  generateRefreshToken,
  generateAccessToken,
  registerService,
  loginService,
  setPasswordService,
  verifyEmailService,
  refreshAccessTokenService,
};
