// Runs the API server (with auto-restart) and the Vite dev server together.
import { spawn } from "node:child_process";

const run = (cmd, args) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
const children = [
  run("node", ["--env-file-if-exists=.env", "--watch", "server/index.js"]),
  run("npx", ["vite"]),
];
const stop = () => { for (const c of children) c.kill(); process.exit(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const c of children) c.on("exit", code => { if (code) stop(); });
