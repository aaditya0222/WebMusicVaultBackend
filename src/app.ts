import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import errorMiddleware from "./middlewares/error.middleware";
import invalidRouteMiddleware from "./middlewares/invalidRoute.middleware";
import indexRouter from "./routes/index.route";
import { env } from "./config/env";
import rateLimit from "express-rate-limit";
import maintainanceMiddleware from "./middlewares/maintainance.middleware";

const app = express();

const allowedOrigins =
  env.NODE_ENV === "production"
    ? [env.FRONTEND_URL]
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://webmusicvault.vercel.app",
        "http://localhost:3000",
      ];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 20 : 1000,
  message:
    "Too many authentication attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

// 'trust proxy' is essential when deployed behind a reverse proxy (Vercel, Render, Nginx, etc.)
// It allows the rate limiter to see the real user's IP instead of the proxy's IP.
app.set("trust proxy", 1);
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Cors blocked for origin ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(maintainanceMiddleware);
app.use(helmet());
app.use(limiter);
app.use("/api/v1/auth", strictLimiter);
app.use("/api/v1/song", strictLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/", indexRouter);

//*Global error handler
app.use(errorMiddleware);
app.use(invalidRouteMiddleware);
export default app;
