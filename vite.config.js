import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const mediapipe = JSON.parse(fs.readFileSync("node_modules/@mediapipe/tasks-vision/package.json", "utf8"));

// Media under public/ keeps its file name when it is re-rendered, so links carry a content hash.
// A new hash means a new URL, which skips stale copies in the browser and in Cloudflare's cache.
function mediaVersion(dir) {
  const hash = crypto.createHash("sha256");
  for (const f of fs.readdirSync(dir).sort()) hash.update(f).update(fs.readFileSync(path.join(dir, f)));
  return hash.digest("hex").slice(0, 8);
}

// The service worker is written after each build.
// Pages: network first, so a deploy shows up on the next visit; the cached copy is only for offline use.
// Hashed /assets/ files: cache first (their names change when they change).
// Other files: served from cache, refreshed in the background.
function serviceWorker(name, shell, extra) {
  return `const NAME=${JSON.stringify(name)};const SHELL=${JSON.stringify(shell)};const EXTRA=${JSON.stringify(extra)};
const put=(c,req,res)=>{if(res&&res.ok&&res.type==='basic')c.put(req,res.clone()).catch(()=>{});return res};
self.addEventListener('install',e=>e.waitUntil(caches.open(NAME).then(c=>Promise.allSettled(SHELL.map(f=>c.add(f)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('isyara-')&&k!==NAME).map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api'))return;
if(e.request.mode==='navigate'){e.respondWith(caches.open(NAME).then(c=>fetch(e.request).then(r=>{put(c,'./index.html',r);return r}).catch(()=>c.match('./index.html'))));return}
e.respondWith(caches.open(NAME).then(async c=>{const hit=await c.match(e.request);
if(u.pathname.includes('/assets/')){if(hit)return hit;return put(c,e.request,await fetch(e.request))}
const net=fetch(e.request).then(r=>put(c,e.request,r));if(hit){e.waitUntil(net.catch(()=>{}));return hit}return net}))});
self.addEventListener('message',e=>{if(e.data==='download')e.waitUntil(caches.open(NAME).then(c=>Promise.all(EXTRA.map(f=>c.add(f)))).then(()=>e.ports[0].postMessage('Siap luring')).catch(()=>e.ports[0].postMessage('Unduhan gagal. Periksa koneksi dan ruang perangkat.')))});`;
}

const GERAK_VERSION = mediaVersion("public/gerak");

export default defineConfig({
  base: "./",
  define: {
    // Pins the CDN copy of the MediaPipe runtime to the exact installed version.
    __MEDIAPIPE_VERSION__: JSON.stringify(mediapipe.version),
    __GERAK_VERSION__: JSON.stringify(GERAK_VERSION),
  },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  plugins: [
    {
      name: "offline-shell",
      closeBundle() {
        const files = fs
          .readdirSync("dist", { recursive: true })
          .map((x) => x.replaceAll("\\", "/"))
          .filter((x) => fs.statSync(path.join("dist", x)).isFile() && x !== "sw.js");
        const stamp = crypto.createHash("sha256").update(files.join("|") + Date.now()).digest("hex").slice(0, 10);
        // Precache only the app itself; media and models are cached as they are used, or by the offline pack.
        const shell = files.filter((x) => x === "index.html" || x.startsWith("assets/") || /^(manifest\.webmanifest|icon.*|favicon\.png)$/.test(x));
        const extra = files.filter((x) => !shell.includes(x));
        fs.writeFileSync("dist/sw.js", serviceWorker("isyara-" + stamp, shell.map((x) => "./" + x), extra.map((x) => "./" + x + (x.startsWith("gerak/") ? "?v=" + GERAK_VERSION : ""))));
      },
    },
  ],
});
