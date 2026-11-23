import crypto from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { all, one, run, transaction, hashPassword, checkPassword, newCode, publicUser } from "./db.js";
import { studentSummary, notesFor, groupsOfStudent, canManageStudent } from "./stats.js";
import { summarize, smartPractice } from "./ai.js";
import { ALPHABET, LEVELS, GERAK, WORD_POINTS } from "../shared/levels.js";
import { DEMO, isDemo, keepDemoFresh, seedDemo } from "./seed.js";

// One-click demo login is on by default for the competition. Set DEMO_LOGIN=0 to turn it off.
const demoEnabled = process.env.DEMO_LOGIN !== "0";
if (demoEnabled) keepDemoFresh();
// The demo accounts are shared by every visitor, so their passwords stay as written in the proposal.
const DEMO_PASSWORD_LOCKED = "Kata sandi akun demo tidak bisa diganti, supaya pengunjung lain tetap bisa masuk.";

const COOKIE = "isyara_sesi";
const SESSION_DAYS = 30;
const secureCookie = process.env.COOKIE_SECURE === "1";

export const api = new Hono();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

api.onError((error, c) => {
  if (error instanceof HttpError) return c.json({ error: error.message }, error.status);
  console.error(error);
  return c.json({ error: "Terjadi kesalahan di server. Coba lagi." }, 500);
});

async function body(c) {
  try {
    const data = await c.req.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    fail(400, "Data tidak terbaca.");
  }
}
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Small in-memory limiter. It resets on restart, which is acceptable for a single home server.
const attempts = new Map();
function limit(c, key, max, windowMs) {
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0] || "lokal";
  const id = key + ":" + ip;
  const now = Date.now();
  const entry = attempts.get(id);
  if (!entry || entry.reset < now) attempts.set(id, { count: 1, reset: now + windowMs });
  else if (++entry.count > max) fail(429, "Terlalu banyak percobaan. Tunggu beberapa menit.");
}

function startSession(c, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  run("DELETE FROM sessions WHERE expires < ?", Date.now());
  run("INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)", token, userId, Date.now() + SESSION_DAYS * 86400000);
  setCookie(c, COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: secureCookie, path: "/", maxAge: SESSION_DAYS * 86400 });
}

function currentUser(c) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  return one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?`, token, Date.now()) || null;
}
function need(c, role) {
  const user = currentUser(c);
  if (!user) fail(401, "Masuk dulu untuk melanjutkan.");
  if (role && user.role !== role) fail(403, "Halaman ini bukan untuk peran akunmu.");
  return user;
}

function joinByCode(userId, code) {
  const group = one("SELECT id, name FROM kelompok WHERE code = ?", text(code, 12).toUpperCase().replace(/^ISY-/, ""));
  if (!group) fail(404, "Kode kelas tidak ditemukan. Periksa lagi hurufnya.");
  run("INSERT OR IGNORE INTO anggota (kelompok_id, user_id, joined_at) VALUES (?, ?, ?)", group.id, userId, Date.now());
  return group;
}

/* ---------- Akun ---------- */

api.post("/daftar", async c => {
  limit(c, "daftar", 10, 600000);
  const d = await body(c);
  const name = text(d.name, 40);
  const username = text(d.username, 30).toLowerCase();
  const password = typeof d.password === "string" ? d.password : "";
  const role = d.role === "pendamping" ? "pendamping" : "pelajar";
  if (!name) fail(400, "Isi nama panggilan.");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail(400, "Nama pengguna 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.");
  if (username.startsWith("demo.")) fail(400, "Nama pengguna yang diawali \"demo.\" khusus untuk akun demo. Pilih nama lain.");
  if (password.length < 6 || password.length > 128) fail(400, "Kata sandi minimal 6 karakter.");
  if (one("SELECT 1 FROM users WHERE username = ?", username)) fail(409, "Nama pengguna sudah dipakai. Coba yang lain.");
  const user = transaction(() => {
    const { lastInsertRowid } = run("INSERT INTO users (username, name, role, pass, created_at) VALUES (?, ?, ?, ?, ?)",
      username, name, role, hashPassword(password), Date.now());
    if (role === "pelajar" && text(d.code, 12)) joinByCode(Number(lastInsertRowid), d.code);
    return one("SELECT * FROM users WHERE id = ?", lastInsertRowid);
  });
  startSession(c, user.id);
  return c.json({ user: publicUser(user) });
});

api.post("/masuk", async c => {
  limit(c, "masuk", 12, 600000);
  const d = await body(c);
  const user = one("SELECT * FROM users WHERE username = ?", text(d.username, 30).toLowerCase());
  if (!user || typeof d.password !== "string" || !checkPassword(d.password, user.pass)) fail(401, "Nama pengguna atau kata sandi tidak cocok.");
  startSession(c, user.id);
  return c.json({ user: publicUser(user) });
});

api.get("/demo", c => c.json({ enabled: demoEnabled }));

api.post("/demo", async c => {
  if (!demoEnabled) fail(404, "Mode demo tidak aktif.");
  limit(c, "demo", 40, 600000);
  const as = (await body(c)).as === "pendamping" ? "pendamping" : "pelajar";
  seedDemo();
  const user = one("SELECT * FROM users WHERE username = ?", DEMO[as]);
  startSession(c, user.id);
  return c.json({ user: publicUser(user) });
});

api.post("/keluar", c => {
  const token = getCookie(c, COOKIE);
  if (token) run("DELETE FROM sessions WHERE token = ?", token);
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

api.get("/saya", c => c.json({ user: publicUser(currentUser(c)) }));

api.patch("/saya", async c => {
  const user = need(c);
  const d = await body(c);
  if (d.name !== undefined) {
    const name = text(d.name, 40);
    if (!name) fail(400, "Nama tidak boleh kosong.");
    run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  }
  if (d.hand === "kiri" || d.hand === "kanan") run("UPDATE users SET hand = ? WHERE id = ?", d.hand, user.id);
  if ([5, 10, 15].includes(d.goal)) run("UPDATE users SET goal = ? WHERE id = ?", d.goal, user.id);
  if (d.about !== undefined) run("UPDATE users SET about = ? WHERE id = ?", text(d.about, 40) || null, user.id);
  if (d.password !== undefined) {
    if (isDemo(user.username)) fail(403, DEMO_PASSWORD_LOCKED);
    if (typeof d.password !== "string" || d.password.length < 6) fail(400, "Kata sandi baru minimal 6 karakter.");
    if (!user.must_change && (typeof d.oldPassword !== "string" || !checkPassword(d.oldPassword, user.pass))) fail(400, "Kata sandi lama tidak cocok.");
    run("UPDATE users SET pass = ?, must_change = 0 WHERE id = ?", hashPassword(d.password), user.id);
  }
  return c.json({ user: publicUser(one("SELECT * FROM users WHERE id = ?", user.id)) });
});

// Students cannot reset their own password. The request appears for their companions.
api.post("/lupa", async c => {
  limit(c, "lupa", 5, 600000);
  const d = await body(c);
  const user = one("SELECT id, role FROM users WHERE username = ?", text(d.username, 30).toLowerCase());
  if (user?.role === "pelajar") run("INSERT OR REPLACE INTO lupa_sandi (user_id, created_at) VALUES (?, ?)", user.id, Date.now());
  return c.json({ ok: true });
});

/* ---------- Pelajar ---------- */

api.post("/gabung", async c => {
  const user = need(c, "pelajar");
  const group = joinByCode(user.id, (await body(c)).code);
  return c.json({ group: { id: group.id, name: group.name } });
});

api.get("/progres", c => {
  const user = need(c, "pelajar");
  return c.json({ stats: studentSummary(user.id), notes: notesFor(user.id, 5), groups: groupsOfStudent(user.id) });
});

const KNOWN_WORDS = new Set(LEVELS.flatMap(l => l.words));
const KNOWN_GERAK = new Set(GERAK.map(g => g.word));

api.post("/progres", async c => {
  const user = need(c, "pelajar");
  const events = (await body(c)).events;
  if (!Array.isArray(events) || events.length > 200) fail(400, "Data progres tidak valid.");
  const now = Date.now();
  transaction(() => {
    for (const e of events) {
      // Offline events keep their own time, but never in the future or older than a week.
      const at = Math.min(now, Math.max(now - 7 * 86400000, Number(e?.at) || now));
      const seconds = Math.max(0, Math.min(600, Math.round(Number(e?.seconds) || 0)));
      if (e?.type === "huruf" && ALPHABET.includes(e.letter) && ["kuasai", "lewati"].includes(e.status)) {
        const match = Math.max(0, Math.min(100, Math.round(Number(e.match) || 0)));
        const row = one("SELECT status FROM huruf WHERE user_id = ? AND letter = ?", user.id, e.letter);
        const status = row?.status === "kuasai" ? "kuasai" : e.status;
        run(`INSERT INTO huruf (user_id, letter, status, best, tries, skips, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT (user_id, letter) DO UPDATE SET status = ?, best = max(best, excluded.best),
          tries = tries + 1, skips = skips + excluded.skips, updated_at = excluded.updated_at`,
          user.id, e.letter, status, match, e.status === "lewati" ? 1 : 0, at, status);
        run("INSERT INTO aktivitas (user_id, kind, value, seconds, created_at) VALUES (?, 'huruf', ?, ?, ?)", user.id, e.letter + ":" + e.status, seconds, at);
      } else if (e?.type === "kata" && (KNOWN_WORDS.has(e.word) || /^[A-Z]{1,12}$/.test(e.word || ""))) {
        run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'kata', ?, ?, ?, ?)",
          user.id, e.word, seconds, e.word.length * WORD_POINTS, at);
      } else if (e?.type === "level" && LEVELS.some(l => l.n === e.level)) {
        run("INSERT INTO aktivitas (user_id, kind, value, created_at) VALUES (?, 'level', ?, ?)", user.id, String(e.level), at);
      } else if (e?.type === "gerak" && KNOWN_GERAK.has(e.word)) {
        run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'gerak', ?, ?, 20, ?)", user.id, e.word, seconds, at);
      }
    }
  });
  return c.json({ stats: studentSummary(user.id) });
});

api.get("/latihan-pintar", async c => {
  const user = need(c, "pelajar");
  return c.json(await smartPractice(studentSummary(user.id)));
});

/* ---------- Pendamping ---------- */

function ownGroup(c, user) {
  const id = Number(c.req.param("id"));
  const group = one(`SELECT k.* FROM kelompok k JOIN pengurus p ON p.kelompok_id = k.id WHERE k.id = ? AND p.user_id = ?`, id, user.id);
  if (!group) fail(404, "Kelompok tidak ditemukan.");
  return group;
}
function ownStudent(c, user) {
  const id = Number(c.req.param("id"));
  if (!canManageStudent(user.id, id)) fail(404, "Pelajar tidak ditemukan di kelompokmu.");
  return one("SELECT * FROM users WHERE id = ? AND role = 'pelajar'", id);
}
function memberRow(m) {
  const s = studentSummary(m.id);
  return {
    id: m.id, name: m.name, username: m.username, joinedAt: m.joined_at,
    mastered: s.mastered, skipped: s.skipped, points: s.points, weekMinutes: s.weekMinutes,
    lastActivity: s.lastActivity, daysSinceActive: s.daysSinceActive, levelsDone: s.levelsDone,
    resetRequested: Boolean(m.reset_at),
    week: s.week.map(w => w.minutes), streak: s.streak, accuracy: s.accuracy, words: s.words.length,
    activeDays: s.activeDaysThisWeek, letters: s.letters.map(l => ({ letter: l.letter, status: l.status, skips: l.skips })),
  };
}

// Class view: totals per day, how many learners are active, and how the class does on each letter.
function classAnalytics(members) {
  const n = members.length;
  const week = Array.from({ length: 7 }, (_, i) => members.reduce((s, m) => s + (m.week[i] || 0), 0));
  const letters = ALPHABET.map(letter => {
    let mastered = 0, skips = 0;
    for (const m of members) for (const l of m.letters) if (l.letter === letter) { if (l.status === "kuasai") mastered++; skips += l.skips; }
    return { letter, mastered, skips };
  });
  const withAccuracy = members.filter(m => m.accuracy !== null);
  return {
    students: n,
    activeWeek: members.filter(m => m.daysSinceActive !== null && m.daysSinceActive < 7).length,
    weekMinutes: week.reduce((a, b) => a + b, 0),
    week,
    avgMastered: n ? Math.round(members.reduce((s, m) => s + m.mastered.length, 0) / n) : 0,
    accuracy: withAccuracy.length ? Math.round(withAccuracy.reduce((s, m) => s + m.accuracy, 0) / withAccuracy.length) : null,
    letters,
    hardest: letters.filter(l => l.skips > 0).sort((a, b) => b.skips - a.skips).slice(0, 5),
    levels: LEVELS.map(l => ({ n: l.n, name: l.name, finished: members.filter(m => m.levelsDone.includes(l.n)).length })),
  };
}

api.get("/kelompok", c => {
  const user = need(c, "pendamping");
  const groups = all(`SELECT k.* FROM kelompok k JOIN pengurus p ON p.kelompok_id = k.id WHERE p.user_id = ? ORDER BY k.created_at`, user.id);
  return c.json({
    groups: groups.map(g => {
      const members = all("SELECT u.id, u.name, u.username, a.joined_at FROM anggota a JOIN users u ON u.id = a.user_id WHERE a.kelompok_id = ?", g.id).map(memberRow);
      return {
        id: g.id, name: g.name, kind: g.kind, code: g.code, members: members.length,
        avgMastered: members.length ? Math.round(members.reduce((s, m) => s + m.mastered.length, 0) / members.length) : 0,
        activeWeek: members.filter(m => m.daysSinceActive !== null && m.daysSinceActive < 7).length,
        week: Array.from({ length: 7 }, (_, i) => members.reduce((s, m) => s + (m.week[i] || 0), 0)),
        needsAttention: members.filter(m => m.daysSinceActive === null || m.daysSinceActive >= 3).map(m => m.name),
      };
    }),
  });
});

api.post("/kelompok", async c => {
  const user = need(c, "pendamping");
  const d = await body(c);
  const name = text(d.name, 40);
  if (!name) fail(400, "Isi nama kelompok.");
  const kind = d.kind === "keluarga" ? "keluarga" : "sekolah";
  const id = transaction(() => {
    const { lastInsertRowid } = run("INSERT INTO kelompok (name, kind, code, owner_id, created_at) VALUES (?, ?, ?, ?, ?)", name, kind, newCode(), user.id, Date.now());
    run("INSERT INTO pengurus (kelompok_id, user_id) VALUES (?, ?)", lastInsertRowid, user.id);
    return Number(lastInsertRowid);
  });
  return c.json({ group: one("SELECT id, name, kind, code FROM kelompok WHERE id = ?", id) });
});

api.get("/kelompok/:id", c => {
  const user = need(c, "pendamping");
  const g = ownGroup(c, user);
  const members = all(`SELECT u.id, u.name, u.username, a.joined_at, l.created_at AS reset_at FROM anggota a
    JOIN users u ON u.id = a.user_id LEFT JOIN lupa_sandi l ON l.user_id = u.id WHERE a.kelompok_id = ? ORDER BY u.name`, g.id).map(memberRow);
  const feed = all(`SELECT u.name, a.kind, a.value, a.created_at FROM aktivitas a JOIN anggota m ON m.user_id = a.user_id
    JOIN users u ON u.id = a.user_id WHERE m.kelompok_id = ? AND a.kind IN ('kata', 'level', 'gerak') ORDER BY a.created_at DESC LIMIT 8`, g.id);
  const companions = all("SELECT u.name FROM pengurus p JOIN users u ON u.id = p.user_id WHERE p.kelompok_id = ?", g.id).map(r => r.name);
  return c.json({ group: { id: g.id, name: g.name, kind: g.kind, code: g.code, companions }, members, feed, analytics: classAnalytics(members) });
});

api.patch("/kelompok/:id", async c => {
  const user = need(c, "pendamping");
  const g = ownGroup(c, user);
  const name = text((await body(c)).name, 40);
  if (!name) fail(400, "Isi nama kelompok.");
  run("UPDATE kelompok SET name = ? WHERE id = ?", name, g.id);
  return c.json({ ok: true });
});

api.post("/kelompok/:id/kode", c => {
  const user = need(c, "pendamping");
  const g = ownGroup(c, user);
  const code = newCode();
  run("UPDATE kelompok SET code = ? WHERE id = ?", code, g.id);
  return c.json({ code });
});

api.delete("/kelompok/:id/anggota/:uid", c => {
  const user = need(c, "pendamping");
  const g = ownGroup(c, user);
  run("DELETE FROM anggota WHERE kelompok_id = ? AND user_id = ?", g.id, Number(c.req.param("uid")));
  return c.json({ ok: true });
});

api.get("/pelajar/:id", c => {
  const user = need(c, "pendamping");
  const s = ownStudent(c, user);
  const summary = one("SELECT text, tips, source, created_at FROM ringkasan WHERE student_id = ?", s.id);
  return c.json({
    student: { id: s.id, name: s.name, username: s.username },
    stats: studentSummary(s.id), notes: notesFor(s.id),
    summary: summary && { ...summary, tips: JSON.parse(summary.tips) },
  });
});

api.post("/pelajar/:id/catatan", async c => {
  const user = need(c, "pendamping");
  const s = ownStudent(c, user);
  const note = text((await body(c)).text, 1000);
  if (!note) fail(400, "Catatan masih kosong.");
  run("INSERT INTO catatan (student_id, author_id, text, created_at) VALUES (?, ?, ?, ?)", s.id, user.id, note, Date.now());
  return c.json({ notes: notesFor(s.id) });
});

api.post("/pelajar/:id/sandi", c => {
  const user = need(c, "pendamping");
  const s = ownStudent(c, user);
  if (isDemo(s.username)) fail(403, DEMO_PASSWORD_LOCKED);
  const words = ["KUCING", "PELANGI", "MANGGA", "BINTANG", "SEPEDA", "KELINCI", "PISANG", "AWAN"];
  const temp = words[crypto.randomInt(words.length)] + "-" + crypto.randomInt(10, 100);
  run("UPDATE users SET pass = ?, must_change = 1 WHERE id = ?", hashPassword(temp), s.id);
  run("DELETE FROM sessions WHERE user_id = ?", s.id);
  run("DELETE FROM lupa_sandi WHERE user_id = ?", s.id);
  return c.json({ temp });
});

api.post("/pelajar/:id/ringkasan", async c => {
  const user = need(c, "pendamping");
  const s = ownStudent(c, user);
  limit(c, "ringkasan:" + user.id, 20, 3600000);
  const result = await summarize(studentSummary(s.id), s.name);
  run("INSERT OR REPLACE INTO ringkasan (student_id, text, tips, source, created_at) VALUES (?, ?, ?, ?, ?)",
    s.id, result.text, JSON.stringify(result.tips), result.source, Date.now());
  return c.json({ summary: { ...result, created_at: Date.now() } });
});
