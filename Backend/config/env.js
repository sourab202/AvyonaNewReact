import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || "",
  allowedOrigins: String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  siteUrl: process.env.SITE_URL || process.env.FRONTEND_PUBLIC_URL || "http://localhost:5173",
  sitemapUrl: process.env.SITEMAP_URL || `${(process.env.SITE_URL || process.env.FRONTEND_PUBLIC_URL || "http://localhost:5173").replace(/\/+$/, "")}/sitemap.xml`,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT || 3306),
  dbName: process.env.DB_NAME || "avyona_admin",
  dbUser: process.env.DB_USER || "root",
  dbPassword: process.env.DB_PASSWORD || "",
  jwtSecret: process.env.JWT_SECRET || "AWS!@#123578&^$hdjsgwidfg526485635134!@#$%^)(*&^%?><",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  paymentSettingsEncryptionKey: process.env.PAYMENT_SETTINGS_ENCRYPTION_KEY || "",
  allowLocalDevAdmin: process.env.ALLOW_LOCAL_DEV_ADMIN === "true" || (process.env.ALLOW_LOCAL_DEV_ADMIN !== "false" && (process.env.NODE_ENV || "development") !== "production")
};
