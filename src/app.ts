import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import errorMiddleware from "./middlewares/error.middleware";
import invalidRouteMiddleware from "./middlewares/invalidRoute.middleware";
import indexRouter from "./routes/index.route";
import { env } from "./config/env";
import rateLimit from "express-rate-limit";
import maintenanceMiddleware from "./middlewares/maintenance.middleware";
import { HttpStatus } from "./utils/HttpStatus";
import { ErrorCode } from "./utils/ErrorCode";

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

// Rate-limit responses use the same JSON shape as ApiError so the frontend can
// detect them reliably (plain-text responses used to be unparseable / unstyled).
const rateLimitResponse = (message: string) => ({
  status: HttpStatus.TooManyRequests,
  message,
  code: ErrorCode.RATE_LIMITED,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: rateLimitResponse(
    "Too many requests from this IP, please try again after 15 minutes",
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 20 : 1000,
  message: rateLimitResponse(
    "Too many authentication attempts, please try again after 15 minutes",
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

// Dedicated, less aggressive limiter for the song API (list/search/pagination).
// The strict auth limiter is NOT suitable here — debounced search + infinite
// scroll easily exceed 20 requests per 15 minutes for a normal user.
const songLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "production" ? 200 : 2000,
  message: rateLimitResponse(
    "Too many requests, please slow down and try again in a few minutes",
  ),
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
app.use(maintenanceMiddleware);
app.use(helmet());
app.use(limiter);
app.use("/api/v1/auth", strictLimiter);
app.use("/api/v1/song", songLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/", indexRouter);

//*Global error handler
app.use(errorMiddleware);
app.use(invalidRouteMiddleware);
export default app;
