// Rebuilds public/gerak/*.mp4 and the start/end stills from public/kosakata-gerak.json.
// Needs Chrome, ffmpeg and puppeteer-core (npm i --no-save puppeteer-core):
//   node scripts/gerak/render.mjs public/kosakata-gerak.json public/gerak
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [src, outDir, only] = process.argv.slice(2);
const bank = JSON.parse(fs.readFileSync(src, "utf8"));
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--disable-gpu"] });
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 720 });
await page.goto("file:///" + path.resolve(new URL("./render.html", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")).replaceAll("\\", "/"));

const png = url => Buffer.from(url.split(",")[1], "base64");
function encode(file, frames) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", "30", "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-preset", "slow", "-movflags", "+faststart", "-an", file]);
    ff.on("error", reject);
    ff.on("close", code => code ? reject(Error("ffmpeg " + code)) : resolve());
    (async () => { for (const f of frames) if (!ff.stdin.write(f)) await new Promise(r => ff.stdin.once("drain", r)); ff.stdin.end(); })();
  });
}
function still(file, buf) {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "png_pipe", "-i", "-", "-c:v", "libwebp", "-quality", "82", file]);
    ff.on("close", code => code ? reject(Error("ffmpeg " + code)) : resolve());
    ff.stdin.end(buf);
  });
}

for (const [word, samples] of Object.entries(bank)) {
  if (only && word !== only) continue;
  let take = 0;
  for (let s = 0; s < samples.length; s++) {
    const info = await page.evaluate(x => window.plan(x), samples[s]);
    if (!info.usable) { console.log(word, "contoh", s + 1, "dilewati (data tangan kurang)"); continue; }
    take++;
    const frames = [];
    for (let i = 0; i < info.frames; i++) frames.push(png(await page.evaluate(n => window.renderFrame(n), i)));
    const base = path.join(outDir, `${word.replaceAll(" ", "_")}-${take}`);
    await encode(base + ".mp4", frames);
    await still(base + "-awal.webp", png(await page.evaluate(() => window.renderStill("awal"))));
    await still(base + "-akhir.webp", png(await page.evaluate(() => window.renderStill("akhir"))));
    console.log(word, "penutur", take, "dari contoh", s + 1, `${info.hands} tangan`, info.seconds.toFixed(1) + "s", Math.round(fs.statSync(base + ".mp4").size / 1024) + "KB");
  }
}
await browser.close();
