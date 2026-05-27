import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env.js";
import { getRobotsTxt, getSitemapXml } from "./controllers/seoController.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { rateLimit } from "./middlewares/rateLimit.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import v1Routes from "./routes/v1/index.js";

const app = express();
const uploadDirectory = path.resolve(process.cwd(), "uploads");
const allowedOrigins = new Set(
  env.nodeEnv === "production"
    ? [env.frontendOrigin, env.siteUrl].filter(Boolean)
    : [
      env.frontendOrigin,
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174"
    ]
);
const apiRateLimit = rateLimit({ windowMs: 60_000, max: 900, keyPrefix: "api" });
const cacheablePublicApiPattern = /^\/api\/v1\/(products(?:\/[^/?]+)?|categories\/tree|settings\/public(?:\/.*)?|coupons|seo\/page|pages(?:\/.*)?)(?:[/?]|$)/;

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }
}));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDirectory, {
  maxAge: env.nodeEnv === "production" ? "30d" : 0,
  immutable: env.nodeEnv === "production"
}));
app.use("/api", apiRateLimit);
app.use("/api", (_request, response, next) => {
  response.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.set("Pragma", "no-cache");
  response.set("Expires", "0");
  response.set("Surrogate-Control", "no-store");
  next();
});
app.use((request, response, next) => {
  if (request.method === "GET" && cacheablePublicApiPattern.test(request.originalUrl || request.url)) {
    response.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    response.removeHeader("Pragma");
    response.removeHeader("Expires");
    response.removeHeader("Surrogate-Control");
  }
  next();
});

app.get("/", (_request, response) => {
  response.json({
    success: true,
    message: "Avyona backend API is running",
    links: {
      frontend: "http://localhost:5173",
      dashboard: "http://localhost:5174",
      health: "/api/v1/health",
      apiBase: "/api/v1"
    }
  });
});

app.get("/sitemap.xml", asyncHandler(getSitemapXml));
app.get("/robots.txt", getRobotsTxt);

app.use("/api/v1", v1Routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
