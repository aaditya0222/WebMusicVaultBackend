import asyncHandler from "express-async-handler";
import ApiResponse from "../utils/ApiResponse";
import { Request, Response } from "express";
import { HttpStatus } from "../utils/HttpStatus";
import ApiError from "../utils/ApiError";
import { env } from "../config/env";
import { sendOtpService } from "../services/otp.services";
import { getUsernameSuggestions } from "../services/username.services";
import {
  LoginRequest,
  SendOtpRequest,
  SetPasswordRequest,
  usernameSchema,
  VerifyEmailRequest,
} from "../schemas/user.schema";
import { CookieOptions } from "express";
import { RegisterRequest } from "../schemas/user.schema";
import {
  registerService,
  loginService,
  setPasswordService,
  verifyEmailService,
  refreshAccessTokenService,
} from "../services/auth.services";
import type { UserI } from "../models/user.model";
import User from "../models/user.model";

const options: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
};

const oauthLogin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as UserI;

    if (!user) {
      throw new ApiError(500, "User not found after OAuth login");
    }

    const { accessToken, refreshToken } = await user.generateAuthTokens();
    // res
    //   .status(HttpStatus.OK)
    //   .cookie("refreshToken", refreshToken, options)
    //   .json(
    //     new ApiResponse(HttpStatus.OK, "Successfully logged in", {
    //       user,
    //       accessToken,
    //     }),
    //   );
    res
      .cookie("refreshToken", refreshToken, options)
      .redirect("http://localhost:3000");
  },
);

const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as RegisterRequest;
    const { refreshToken, accessToken, user } = await registerService(data);
    res
      .status(HttpStatus.Created)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          HttpStatus.Created,
          "Successfully registered the user",
          {
            user,
            accessToken,
          },
        ),
      );
  },
);

const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as LoginRequest;
    const { accessToken, refreshToken, user } = await loginService(data);
    res
      .status(HttpStatus.OK)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(HttpStatus.OK, "Successfully logged in", {
          user,
          accessToken,
        }),
      );
  },
);

const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as UserI;
    if (!user.refreshToken) {
      throw new ApiError(HttpStatus.BadRequest, "User is not logged in");
    }
    user.refreshToken = undefined;
    await user.save();
    res
      .clearCookie("refreshToken", options)
      .status(HttpStatus.OK)
      .json(
        new ApiResponse(HttpStatus.OK, "User logged out successfully", null),
      );
  },
);

const suggestUsername = (req: Request, res: Response): void => {
  const data: { identifier: string; n: number } = req.body;
  const usernames = getUsernameSuggestions(data);
  res
    .status(HttpStatus.OK)
    .json(
      new ApiResponse(
        HttpStatus.OK,
        "Successfully sent list of suggested usernames",
        usernames,
      ),
    );
};

const verifyUsername = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { username } = usernameSchema.parse(req.body);
    const isVerified = !!(await User.exists({ username }));
    res
      .status(HttpStatus.OK)
      .json(
        new ApiResponse(
          HttpStatus.OK,
          isVerified ? "Username is already taken" : "Username is available",
          !isVerified,
        ),
      );
  },
);

//route for people who signed up with the oauth and now they are trying to login with normal local auth.So, they are asked to give otp send to their email and then set the password for their  id.
const setPassword = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as SetPasswordRequest;
  const { refreshToken, accessToken, user } = await setPasswordService(data);

  res
    .status(HttpStatus.OK)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(HttpStatus.OK, "Successfully set password", {
        user,
        accessToken,
      }),
    );
});

//Otp Controllers
const sendOtp = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as SendOtpRequest["body"];
    const { purpose } = req.query as SendOtpRequest["query"];
    await sendOtpService({ email, purpose });
    res
      .status(HttpStatus.OK)
      .json(
        new ApiResponse(
          HttpStatus.OK,
          "Successfully send the otp to your email",
          null,
        ),
      );
  },
);
const verifyEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as VerifyEmailRequest;
    await verifyEmailService(data);

    res
      .status(HttpStatus.OK)
      .json(
        new ApiResponse(HttpStatus.OK, "Successfully verified email", null),
      );
  },
);

const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const refreshToken: string = req.cookies.refreshToken;
    const { accessToken, newRefreshToken } =
      await refreshAccessTokenService(refreshToken);

    res
      .status(HttpStatus.OK)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          HttpStatus.OK,
          "Successfully send the accessToken",
          accessToken,
        ),
      );
  },
);

export {
  register,
  suggestUsername,
  verifyUsername,
  setPassword,
  login,
  logout,
  refreshAccessToken,
  oauthLogin,
  sendOtp,
  verifyEmail,
};
