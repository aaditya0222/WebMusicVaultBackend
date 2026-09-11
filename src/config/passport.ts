import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import ApiError from "../utils/ApiError";
import { HttpStatus } from "../utils/HttpStatus";
import User from "../models/user.model";
import { generateVerifiedUsername } from "../services/username.services";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${env.BACKEND_URL}/api/v1/auth/google/callback`,
    },
    async (
      _accessToken,
      _refreshToken,
      profile,
      cb /* can also use don or any other keyword instead of cb*/,
    ) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          // Only trust Google-CERTIFIED emails. A profile email flagged
          // `verified: false` must never auto-link to an existing local
          // account (or flip isEmailVerified) — otherwise anyone with an
          // unverified Google account using a victim's email address takes
          // over that account. Known OAuth account-takeover vector.
          const googleEmail = profile.emails?.[0];
          if (!googleEmail?.verified) {
            return cb(
              new ApiError(
                HttpStatus.Forbidden,
                "Google account email is not verified",
              ),
            );
          }
          const email = googleEmail.value as string;
          const avatar = profile.photos?.[0].value as string;
          const displayName = profile.displayName as string;
          const googleId = profile.id as string;
          const username = await generateVerifiedUsername(email);
          user = await User.findOne({ email });

          if (user) {
            if (!user.authProviders?.includes("google")) {
              user.authProviders?.push("google");
              user.googleId = googleId;
              if (!user.isEmailVerified) {
                user.avatar = avatar;
                user.displayName = displayName;
                user.username = username;
                user.isEmailVerified = true;
              }
              await user.save();
            }
          } else {
            user = await User.create({
              username,
              email,
              displayName,
              avatar,
              googleId,
              authProviders: ["google"],
              isEmailVerified: true,
            });
          }
        }
        return cb(null, user);
      } catch (err) {
        cb(err, undefined);
      }
    },
  ),
);
