import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import User from "../models/user.model";
import { generateVerifiedUsername } from "../services/username.services";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3001/api/v1/auth/google/callback",
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
          const email = profile.emails?.[0].value as string;
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
