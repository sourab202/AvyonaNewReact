import fs from "fs";
import path from "path";
import { defineConfig } from "vite";

const appRoutePatterns = [
  /^\/login\/?$/,
  /^\/dashboard(?:\/.*)?$/
];

function shouldServeDashboard(url = "") {
  const pathname = String(url || "").split("?")[0].split("#")[0];
  if (!pathname) return false;
  if (/\.[a-z0-9]+$/i.test(pathname)) return false;
  return appRoutePatterns.some((pattern) => pattern.test(pathname));
}

function dashboardRouteFallbackPlugin() {
  const indexHtmlPath = path.resolve(process.cwd(), "index.html");

  return {
    name: "dashboard-route-fallback",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = request.url || "/";
        if ((request.method || "GET") !== "GET" || !shouldServeDashboard(url)) {
          next();
          return;
        }

        const html = fs.readFileSync(indexHtmlPath, "utf-8");
        const transformedHtml = await server.transformIndexHtml(url, html);
        response.setHeader("Content-Type", "text/html");
        response.end(transformedHtml);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url || "/";
        if ((request.method || "GET") !== "GET" || !shouldServeDashboard(url)) {
          next();
          return;
        }

        const html = fs.readFileSync(indexHtmlPath, "utf-8");
        response.setHeader("Content-Type", "text/html");
        response.end(html);
      });
    }
  };
}

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/dashboard/" : "/",
  plugins: [dashboardRouteFallbackPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000"
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    strictPort: true
  }
}));
