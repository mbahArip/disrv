import { serve } from "@hono/node-server";
import dontenv from "dotenv";
import { readFile, readdir } from "fs/promises";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { prettyJSON } from "hono/pretty-json";
import path from "path";
import CONF_APP from "./configs/app.config";

// import testing from "./routes/testing";

export const app = new Hono<{ Variables: Record<string, string> }>({
  strict: false,
});
dontenv.config();

export const authMiddleware = bearerAuth({
  token: process.env.BEARER_AUTH as string,
});

// Default middlewares
app.use(
  "*",
  compress({
    encoding: "gzip",
  }),
  cors({
    origin: CONF_APP.app_allowed_origins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Content-Type", "Date", "X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  }),
  poweredBy(),
  prettyJSON()
);
// Caching
app.use("*", async (c, next) => {
  if (c.req.method === "GET") {
    c.res.headers.set(
      "Cache-Control",
      `public, max-age=${CONF_APP.app_cache_duration}`
    );
  } else {
    c.res.headers.set("Cache-Control", "no-store");
  }
  return next();
});
// Logger middleware
if (process.env.NODE_ENV === "production") {
  app.use("*", logger());
}
// NonPublic
if (!CONF_APP.isPublic) {
  app.use("*", authMiddleware);
}

// Error
app.onError((err: any, c) => {
  console.error(err);
  const isNotFound =
    err.name === "NotFoundError" || err.message.includes("not found");
  c.status(err.status || (isNotFound ? 404 : 500));
  return c.json({
    code: err.status || (isNotFound ? 404 : 500),
    message: err.meta.cause || err.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
});

/**
 * Routes start here
 */
app.get("/", async (c) => {
  const readmePath = path.resolve(process.cwd(), "README.md");
  const readme = await readFile(readmePath, "utf-8");
  return c.text(readme.toString());
});

const routesPath = path.resolve(__dirname, "routes");
readdir(routesPath).then((files) => {
  files.forEach((file) => {
    const route = require(path.resolve(routesPath, file)).default;
    const { path: routePath, handler } = route;
    app.route(routePath, handler);
  });
});

serve(app);
console.log("Server started at http://localhost:3000");
