import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import errorMiddleware from "./middlewares/error.middleware";
import invalidRouteMiddleware from "./middlewares/invalidRoute.middleware";
import indexRouter from "./routes/index.route";
import { env } from "./config/env";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/", indexRouter);

//*Global error handler
app.use(errorMiddleware);
app.use(invalidRouteMiddleware);
export default app;
