import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { api } from "./app.js";

const port = Number(process.env.PORT || 8787);
const dist = path.resolve(process.env.STATIC_DIR || "dist");
const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
});

// Heavy recognizer files rarely change; let browsers (and Cloudflare, with a cache rule) keep them.
const LONG = "public, max-age=31536000, immutable";
const WEEK = "public, max-age=604800, stale-while-revalidate=86400";
app.use("*", async (c, next) => {
  await next();
  const p = c.req.path;
  if (p.startsWith("/api/") || c.res.status !== 200) return;
  if (p.startsWith("/assets/")) c.header("Cache-Control", LONG);
  else if (/^\/(wasm|models|alfabet-3d|gerak|bg|logos)\//.test(p) || /\.(json|task|wasm|webp|mp4|png)$/.test(p)) c.header("Cache-Control", WEEK);
  else c.header("Cache-Control", "no-cache");
});

app.get("/api/sehat", c => c.json({ ok: true }));
app.route("/api", api);
app.all("/api/*", c => c.json({ error: "Alamat API tidak ditemukan." }, 404));

if (fs.existsSync(path.join(dist, "index.html"))) {
  // The service worker must always be fresh so new deploys reach students.
  app.use("/sw.js", async (c, next) => { await next(); c.header("Cache-Control", "no-cache"); });
  app.use("/*", serveStatic({ root: path.relative(process.cwd(), dist) || "." }));
  app.get("*", c => c.html(fs.readFileSync(path.join(dist, "index.html"), "utf8")));
}

serve({ fetch: app.fetch, port, hostname: process.env.HOST || "0.0.0.0" }, info => {
  console.log(`ISYARA berjalan di http://localhost:${info.port}`);
});
