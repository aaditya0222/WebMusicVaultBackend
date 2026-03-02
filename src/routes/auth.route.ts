import { Router } from "express";
import {
  register,
  login,
  logout,
  suggestUsername,
  verifyUsername,
  setPassword,
  refreshAccessToken,
  oauthLogin,
  sendOtp,
  verifyEmail,
} from "../controllers/auth.controller";
import {
  registerSchema,
  loginSchema,
  suggestUsernameSchema,
  setPasswordSchema,
  sendOtpSchema,
  verifyEmailSchema,
} from "../schemas/user.schema";
import { validate } from "../middlewares/validate.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import passport from "passport";

const router = Router();

//Register
router.post("/signup", validate(registerSchema), register);
router.post(
  "/username-suggestions",
  validate(suggestUsernameSchema),
  suggestUsername,
);
router.post("/verify-username", verifyUsername);
router.post("/set-password", validate(setPasswordSchema), setPassword);
//Login
router.post("/login", validate(loginSchema), login);

//Oauth login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  oauthLogin,
);

//Email verification
router.post("/request-otp", validate(sendOtpSchema), sendOtp);
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);
router.post("/resend-otp", validate(sendOtpSchema), sendOtp);

//Refresh token
router.get("/refresh-token", refreshAccessToken);

//logout
router.get("/logout", authMiddleware, logout);

export default router;
