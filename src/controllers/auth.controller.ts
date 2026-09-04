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

const oauthCodes = new Map<string, string>();

const oauthLogin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as UserI;

    if (!user) {
      throw new ApiError(500, "User not found after OAuth login");
    }

    const { refreshToken } = await user.generateAuthTokens();

    const code = crypto.randomUUID();
    oauthCodes.set(code, refreshToken);
    setTimeout(() => oauthCodes.delete(code), 60_000);// js supports _ as commas of real life numbers.

    res.redirect(`${env.FRONTEND_URL}?auth=success&code=${code}`);
  },
);

const exchangeOauthCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query as { code: string };

    if (!code) {
      throw new ApiError(HttpStatus.BadRequest, "Code is required");
    }

    const refreshToken = oauthCodes.get(code);
    if (!refreshToken) {
      throw new ApiError(HttpStatus.BadRequest, "Invalid or expired code");
    }

    oauthCodes.delete(code); 

    res
      .status(HttpStatus.OK)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(HttpStatus.OK, "Token exchanged successfully", null));
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

const sendOtp = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { identifier } = req.body as SendOtpRequest["body"];
    const { purpose } = req.query as SendOtpRequest["query"];
    await sendOtpService({ identifier, purpose });
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
    try {
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
    } catch (err) {
      // The refresh (and hence the session) is dead: expired, invalid, or
      // revoked because the user signed in elsewhere (token rotation). Clear
      // the stale cookie so the client stops re-triggering the same
      // "logged in on another device" / session-expired flow on every reload.
      if (err instanceof ApiError && err.status === HttpStatus.Unauthorized) {
        res.clearCookie("refreshToken", options);
      }
      throw err;
    }
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
  exchangeOauthCode,
  sendOtp,
  verifyEmail,
};