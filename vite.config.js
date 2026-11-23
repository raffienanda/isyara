import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const mediapipe = JSON.parse(fs.readFileSync("node_modules/@mediapipe/tasks-vision/package.json", "utf8"));

export default defineConfig({
  base: "./",
  // Pins the CDN copy of the MediaPipe runtime to the exact installed version.
  define: { __MEDIAPIPE_VERSION__: JSON.stringify(mediapipe.version) },
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
          .filter(
            (x) =>
              fs.statSync(path.join("dist", x)).isFile() &&
              x !== "sw.js" && !x.endsWith(".php"),
          );
        const stamp = crypto
          .createHash("sha256")
          .update(files.join("|") + Date.now())
          .digest("hex")
          .slice(0, 10);
        const shell = files.filter(
          (x) =>
            !x.startsWith("wasm/") &&
            !x.startsWith("models/") &&
            !x.startsWith("ocr/") &&
            !x.startsWith("asr/") &&
            !x.includes("pdf.worker"),
        );
        fs.writeFileSync(
          "dist/sw.js",
          `const name='isyara-${stamp}';const files=${JSON.stringify(shell.map((x) => "./" + x))}; self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('isyara-')&&k!==name).map(k=>caches.delete(k)))).then(()=>clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api'))return;e.respondWith(caches.open(name).then(async c=>{const hit=await c.match(e.request.mode==='navigate'?'./index.html':e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r}))});self.addEventListener('message',e=>{if(e.data==='download')e.waitUntil(caches.open(name).then(c=>c.addAll(${JSON.stringify(files.filter((x) => !shell.includes(x)).map((x) => "./" + x))})).then(()=>e.ports[0].postMessage('Siap luring')).catch(()=>e.ports[0].postMessage('Unduhan gagal. Periksa koneksi dan ruang perangkat.')))})`,
        );
      },
    },
  ],
});
