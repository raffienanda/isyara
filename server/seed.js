// Demo data for the judges' walkthrough and the one-click demo login.
// The class is rebuilt once per day (after 07.00 WIB) so the dashboards always show the last seven days,
// and whatever a visitor changed on the shared demo accounts is put back.
// Usage: node server/seed.js   (rebuilds now; password comes from DEMO_PASSWORD, default below)
import { pathToFileURL } from "node:url";
import { all, one, run, transaction, hashPassword } from "./db.js";

const PASSWORD = process.env.DEMO_PASSWORD || "isyara-demo";
const DAY = 86400000, HOUR = 3600000, MIN = 60000;
// Same day boundaries as server/stats.js (Western Indonesia Time).
const WIB = 7 * HOUR;
const dayKey = ms => Math.floor((ms + WIB) / DAY);
const dayStart = key => key * DAY - WIB;
const REBUILD_HOUR = 7;

// Demo usernames start with "demo." and that prefix is blocked for normal sign-up,
// so the one-click login can never open a real person's account.
export const DEMO = { pendamping: "demo.rina", pelajar: "demo.budi" };
export const isDemo = username => typeof username === "string" && username.startsWith("demo.");

const L1 = "CEILORUV", L2 = "ABDFGH";
// days: day offsets with practice (0 = today), minutes: rough minutes per session,
// levels: {level: day offset it was finished}, words: finished words in order, gerak: word signs practised.
const STUDENTS = [
  { username: "demo.budi", name: "Budi", goal: 10, hour: 16, mastered: "CEILOUV", weak: "R", days: [1, 2, 4, 5], minutes: 10,
    words: ["LUCU", "CUCI", "OLI", "LELE", "CUCU", "LILI"], gerak: ["saya", "makan"] },
  { username: "demo.sari", name: "Sari", goal: 15, hour: 15, mastered: L1 + L2 + "KMS", weak: "NQ", days: [0, 1, 2, 3, 4, 6, 9, 11, 13], minutes: 17, levels: { 1: 11, 2: 3 },
    words: ["LUCU", "CUCI", "OLI", "REL", "LELE", "CUCU", "ULIR", "LIUR", "CURI", "CIRI", "IRI", "CERI", "ABU", "BACA", "BOLA", "DUA", "HARI", "GULA", "BIRU", "IBU", "AIR", "GURU", "MAKAN", "KAMU", "SUSU"],
    gerak: ["saya", "teman", "terima kasih", "maaf"] },
  { username: "demo.ayu", name: "Ayu", goal: 10, hour: 18, mastered: L1 + "AB", weak: "D", days: [0, 1, 2, 3, 4, 5, 6], minutes: 10, levels: { 1: 3 },
    words: ["LUCU", "CUCI", "OLI", "REL", "LELE", "CUCU", "ULIR", "IRI", "CERI", "ROL", "ABU", "BACA", "IBU"], gerak: ["terima kasih"] },
  { username: "demo.dimas", name: "Dimas", goal: 5, hour: 17, mastered: "CIL", weak: "OU", days: [8, 11], minutes: 6, words: [] },
  { username: "demo.nadia", name: "Nadia", goal: 10, hour: 19, mastered: L1 + "ABDH", weak: "FG", days: [0, 2, 3, 5, 8], minutes: 12, levels: { 1: 5 },
    words: ["LUCU", "CUCI", "OLI", "LELE", "CUCU", "LIUR", "CURI", "LORI", "DUA", "HARI", "BAHU"], gerak: ["belajar", "teman"] },
  { username: "demo.fajar", name: "Fajar", goal: 5, hour: 20, mastered: "CEIL", weak: "RO", days: [0, 1, 3], minutes: 6, words: ["LELE", "LILI"] },
  { username: "demo.rizki", name: "Rizki", goal: 15, hour: 16, mastered: L1 + L2 + "KMNPS", weak: "Q", days: [1, 2, 3, 5, 6, 8, 10, 12], minutes: 15, levels: { 1: 10, 2: 3 },
    words: ["LUCU", "CUCI", "OLI", "REL", "LELE", "CUCU", "ULIR", "LIUR", "CURI", "CIRI", "IRI", "CERI", "ECER", "LORI", "ABU", "BACA", "BOLA", "DUA", "HARI", "GULA", "BIRU", "DARI", "IBU", "AIR", "GIGI", "GURU", "MAKAN", "NASI", "MINUM", "SAPU"],
    gerak: ["saya", "belajar", "hari", "apa"] },
  { username: "demo.lala", name: "Lala", goal: 5, hour: 17, mastered: "CEIU", weak: "", days: [0, 2], minutes: 5, words: ["CUCI"] },
];
const NOTES = {
  "demo.budi": [2, "Hebat, Budi! Huruf R kita latih bareng hari Jumat, ya."],
  "demo.sari": [1, "Sari sudah masuk Level 3. Mau bantu teman yang masih di Level 1?"],
  "demo.dimas": [1, "Dimas, Bu Rina tunggu latihannya. Lima menit sehari sudah cukup."],
};

// Small seeded generator, so one day's demo looks the same after every restart.
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureUsers(now) {
  const pass = hashPassword(PASSWORD);
  for (const p of [{ username: DEMO.pendamping, name: "Bu Rina", role: "pendamping", goal: 10 }, ...STUDENTS.map(s => ({ ...s, role: "pelajar" }))]) {
    if (one("SELECT 1 FROM users WHERE username = ?", p.username)) {
      run("UPDATE users SET name = ?, role = ?, pass = ?, hand = 'kanan', goal = ?, about = NULL, must_change = 0 WHERE username = ?", p.name, p.role, pass, p.goal, p.username);
    } else {
      run("INSERT INTO users (username, name, role, pass, goal, created_at) VALUES (?, ?, ?, ?, ?, ?)", p.username, p.name, p.role, pass, p.goal, now - 20 * DAY);
    }
  }
}

function ensureClass(rina, now) {
  // Extra classes made on the shared demo account are removed, unless a real account has joined them.
  for (const g of all("SELECT id FROM kelompok WHERE owner_id = ? AND name <> 'Kelas 4A'", rina)) {
    const outsider = one("SELECT 1 FROM anggota a JOIN users u ON u.id = a.user_id WHERE a.kelompok_id = ? AND u.username NOT LIKE 'demo.%'", g.id);
    if (!outsider) run("DELETE FROM kelompok WHERE id = ?", g.id);
  }
  let group = one("SELECT id, code FROM kelompok WHERE owner_id = ? AND name = 'Kelas 4A'", rina);
  if (!group) {
    const code = one("SELECT 1 FROM kelompok WHERE code = '4A27'") ? "4A28" : "4A27";
    const { lastInsertRowid } = run("INSERT INTO kelompok (name, kind, code, owner_id, created_at) VALUES ('Kelas 4A', 'sekolah', ?, ?, ?)", code, rina, now - 20 * DAY);
    group = { id: Number(lastInsertRowid), code };
  }
  run("INSERT OR IGNORE INTO pengurus (kelompok_id, user_id) VALUES (?, ?)", group.id, rina);
  return group;
}

// One learner's week: practice sessions made of letter attempts, finished words, word signs and levels.
function buildHistory(s, id, today, now, rand) {
  const pool = [...s.mastered, ...s.weak];
  const letters = Object.fromEntries(pool.map(l => [l, { tries: 0, skips: 0, best: 0, at: 0 }]));
  const days = [...s.days].sort((a, b) => b - a); // oldest first
  const words = [...s.words], gerak = [...(s.gerak || [])];
  const levelDay = Object.entries(s.levels || {});
  days.forEach((d, di) => {
    let t = dayStart(today - d) + (s.hour + rand() * 2) * HOUR;
    // Today's practice happened in the last few hours.
    if (d === 0) t = Math.max(dayStart(today) + 5 * HOUR, Math.min(t, now - (40 + rand() * 120) * MIN));
    const end = t + s.minutes * (0.7 + rand() * 0.6) * MIN;
    const share = Math.ceil((words.length) / (days.length - di));
    const dayWords = words.splice(0, share);
    while (t < end && t < now - MIN) {
      const l = pool[Math.floor(rand() * pool.length)];
      const weak = s.weak.includes(l);
      const ok = weak ? rand() < 0.35 : rand() < 0.92;
      const seconds = Math.round(20 + rand() * 40);
      t += seconds * 1000;
      if (t >= now) break;
      run("INSERT INTO aktivitas (user_id, kind, value, seconds, created_at) VALUES (?, 'huruf', ?, ?, ?)", id, l + ":" + (ok ? "kuasai" : "lewati"), seconds, t);
      const row = letters[l];
      row.tries++; if (!ok) row.skips++;
      row.best = Math.max(row.best, ok ? 72 + Math.floor(rand() * 24) : 35 + Math.floor(rand() * 25));
      row.at = t;
      if (dayWords.length && rand() < 0.35) {
        const w = dayWords.shift();
        run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'kata', ?, 0, ?, ?)", id, w, w.length * 10, t + 1000);
      }
    }
    const last = Math.min(t, now - MIN);
    for (const w of dayWords) run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'kata', ?, 0, ?, ?)", id, w, w.length * 10, last);
    if (gerak.length && (di % 2 === 1 || d === 0)) {
      const w = gerak.shift();
      run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'gerak', ?, ?, 20, ?)", id, w, 45, last + 2000);
    }
    for (const [n, ld] of levelDay) if (ld === d) run("INSERT INTO aktivitas (user_id, kind, value, created_at) VALUES (?, 'level', ?, ?)", id, n, last + 3000);
  });
  for (const [l, r] of Object.entries(letters)) {
    const mastered = s.mastered.includes(l);
    const tries = Math.max(r.tries, mastered ? 3 : 4);
    const skips = mastered ? 0 : Math.max(r.skips, 2);
    run("INSERT INTO huruf (user_id, letter, status, best, tries, skips, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id, l, mastered ? "kuasai" : "lewati", Math.max(r.best, mastered ? 75 : 40), tries, skips, r.at || dayStart(today - days.at(-1)) + s.hour * HOUR);
  }
}

function rebuild(now) {
  const today = dayKey(now);
  return transaction(() => {
    ensureUsers(now);
    const rina = one("SELECT id FROM users WHERE username = ?", DEMO.pendamping).id;
    const group = ensureClass(rina, now);
    const ids = all("SELECT id FROM users WHERE username LIKE 'demo.%' AND role = 'pelajar'").map(r => r.id);
    for (const table of ["huruf", "aktivitas", "lupa_sandi"]) run(`DELETE FROM ${table} WHERE user_id IN (${ids.join(",")})`);
    for (const table of ["catatan", "ringkasan"]) run(`DELETE FROM ${table} WHERE student_id IN (${ids.join(",")})`);
    STUDENTS.forEach((s, i) => {
      const id = one("SELECT id FROM users WHERE username = ?", s.username).id;
      run("INSERT OR IGNORE INTO anggota (kelompok_id, user_id, joined_at) VALUES (?, ?, ?)", group.id, id, now - 19 * DAY);
      buildHistory(s, id, today, now, random(today * 31 + i));
      if (NOTES[s.username]) run("INSERT INTO catatan (student_id, author_id, text, created_at) VALUES (?, ?, ?, ?)", id, rina, NOTES[s.username][1], now - NOTES[s.username][0] * DAY);
    });
    run("INSERT INTO meta (key, value) VALUES ('demo_day', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", String(today));
    return group.code;
  });
}

// Rebuilds when the demo was made on an earlier day: from 07.00 WIB, or at any hour when it is two or more days old.
export function seedDemo({ force = false } = {}) {
  const now = Date.now(), today = dayKey(now);
  const made = Number(one("SELECT value FROM meta WHERE key = 'demo_day'")?.value || 0);
  const hour = Math.floor((now - dayStart(today)) / HOUR);
  const users = one("SELECT COUNT(*) AS n FROM users WHERE username LIKE 'demo.%'").n;
  if (force || users < STUDENTS.length + 1 || today - made >= 2 || (today > made && hour >= REBUILD_HOUR)) return rebuild(now);
  return one("SELECT code FROM kelompok WHERE name = 'Kelas 4A' AND owner_id = (SELECT id FROM users WHERE username = ?)", DEMO.pendamping)?.code;
}

// Checked every half hour while the server runs.
export function keepDemoFresh() {
  seedDemo();
  setInterval(() => { try { seedDemo(); } catch (error) { console.error("Data demo gagal diperbarui:", error); } }, 30 * MIN).unref();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = seedDemo({ force: true });
  console.log(`Data demo siap. Kode Kelas 4A: ${code}.`);
  console.log(`Akun: ${DEMO.pendamping} (pendamping), ${STUDENTS.map(s => s.username).join(", ")} (pelajar).`);
  console.log("Kata sandi dari DEMO_PASSWORD atau nilai bawaan di server/seed.js. Tombol demo di halaman Masuk tidak butuh sandi.");
}
