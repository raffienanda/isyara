export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method,
      credentials: "same-origin",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Tidak tersambung ke server. Periksa internet.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Terjadi kesalahan. Coba lagi.", res.status);
  return data;
}

/* Progress is queued on the device so practice still counts while offline.
   The queue is flushed when the connection returns or the app opens. */
const QUEUE = "isyara:antrean";
const readQueue = () => { try { return JSON.parse(localStorage.getItem(QUEUE)) || []; } catch { return []; } };
const writeQueue = q => { try { localStorage.setItem(QUEUE, JSON.stringify(q.slice(-200))); } catch { /* storage full or blocked */ } };

let flushing = null;
export function flushProgress() {
  if (flushing) return flushing;
  const queued = readQueue();
  if (!queued.length) return Promise.resolve(null);
  let sent = false;
  flushing = api("/progres", { method: "POST", body: { events: queued } })
    .then(data => { writeQueue(readQueue().slice(queued.length)); sent = true; return data; })
    .catch(() => null)
    .finally(() => {
      flushing = null;
      // Events recorded while this request was in flight are sent right after it.
      if (sent && readQueue().length) flushProgress();
    });
  return flushing;
}

export function recordProgress(...events) {
  writeQueue([...readQueue(), ...events.map(e => ({ at: Date.now(), ...e }))]);
  return flushProgress();
}

if (typeof window !== "undefined") window.addEventListener("online", () => flushProgress());

/* Per-device preferences (not account data). */
const PREFS = "isyara:prefs";
export function getPrefs() {
  try { return { mirror: true, ...JSON.parse(localStorage.getItem(PREFS)) }; } catch { return { mirror: true }; }
}
export function setPrefs(prefs) {
  try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* ignore */ }
  applyPrefs(prefs);
}
export function applyPrefs(prefs = getPrefs()) {
  const root = document.documentElement;
  root.classList.toggle("besar", Boolean(prefs.large));
  root.classList.toggle("kontras", Boolean(prefs.contrast));
  root.classList.toggle("kurangi-gerak", Boolean(prefs.reduceMotion));
}
