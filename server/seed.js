// Demo data for the judges' walkthrough and the one-click demo login.
// Usage: node server/seed.js   (password comes from DEMO_PASSWORD, default below)
import { pathToFileURL } from "node:url";
import { one, run, transaction, hashPassword } from "./db.js";

const PASSWORD = process.env.DEMO_PASSWORD || "isyara-demo";
const DAY = 86400000;

// Demo usernames start with "demo." and that prefix is blocked for normal sign-up,
// so the one-click login can never open a real person's account.
export const DEMO = { pendamping: "demo.rina", pelajar: "demo.budi" };

const people = [
  { username: "demo.rina", name: "Bu Rina", role: "pendamping" },
  { username: "demo.budi", name: "Budi", role: "pelajar", mastered: "CEILOUV", skipped: "R", days: [0, 1, 3, 5], words: ["LUCU", "CUCI", "OLI"] },
  { username: "demo.sari", name: "Sari", role: "pelajar", mastered: "CEILORUVABD", skipped: "F", days: [1, 2, 3, 4, 6], words: ["LUCU", "CUCI", "OLI", "REL", "LELE", "CUCU", "ULIR", "LIUR", "ABU"], level: 1 },
  { username: "demo.ayu", name: "Ayu", role: "pelajar", mastered: "CILOU", skipped: "", days: [0, 1, 2, 3, 4, 5, 6], words: ["LUCU", "CUCI"] },
  { username: "demo.dimas", name: "Dimas", role: "pelajar", mastered: "CIL", skipped: "OU", days: [6], words: [] },
];

export function seedDemo() {
  const now = Date.now();
  return transaction(() => {
    for (const p of people) {
      if (one("SELECT 1 FROM users WHERE username = ?", p.username)) continue;
      run("INSERT INTO users (username, name, role, pass, created_at) VALUES (?, ?, ?, ?, ?)", p.username, p.name, p.role, hashPassword(PASSWORD), now - 20 * DAY);
    }
    const rina = one("SELECT id FROM users WHERE username = 'demo.rina'");
    let group = one("SELECT id, code FROM kelompok WHERE owner_id = ? AND name = 'Kelas 4A'", rina.id);
    if (!group) {
      const code = one("SELECT 1 FROM kelompok WHERE code = '4A27'") ? "4A28" : "4A27";
      const { lastInsertRowid } = run("INSERT INTO kelompok (name, kind, code, owner_id, created_at) VALUES ('Kelas 4A', 'sekolah', ?, ?, ?)", code, rina.id, now - 20 * DAY);
      run("INSERT INTO pengurus (kelompok_id, user_id) VALUES (?, ?)", lastInsertRowid, rina.id);
      group = { id: Number(lastInsertRowid), code };
    }
    for (const p of people.filter(p => p.role === "pelajar")) {
      const u = one("SELECT id FROM users WHERE username = ?", p.username);
      run("INSERT OR IGNORE INTO anggota (kelompok_id, user_id, joined_at) VALUES (?, ?, ?)", group.id, u.id, now - 19 * DAY);
      if (one("SELECT 1 FROM aktivitas WHERE user_id = ?", u.id)) continue;
      const at = i => now - p.days[i % p.days.length] * DAY - 3600000;
      [...p.mastered].forEach((l, i) => run("INSERT INTO huruf (user_id, letter, status, best, tries, skips, updated_at) VALUES (?, ?, 'kuasai', ?, 3, 0, ?)", u.id, l, 75 + (i * 7) % 20, at(i)));
      [...p.skipped].forEach(l => run("INSERT INTO huruf (user_id, letter, status, best, tries, skips, updated_at) VALUES (?, ?, 'lewati', 40, 4, 3, ?)", u.id, l, at(0)));
      p.days.forEach((d, i) => run("INSERT INTO aktivitas (user_id, kind, value, seconds, created_at) VALUES (?, 'huruf', 'C:kuasai', ?, ?)", u.id, 420 + i * 60, now - d * DAY - 7200000));
      p.words.forEach((w, i) => run("INSERT INTO aktivitas (user_id, kind, value, seconds, points, created_at) VALUES (?, 'kata', ?, 60, ?, ?)", u.id, w, w.length * 10, at(i)));
      if (p.level) run("INSERT INTO aktivitas (user_id, kind, value, created_at) VALUES (?, 'level', ?, ?)", u.id, String(p.level), now - DAY);
    }
    const budi = one("SELECT id FROM users WHERE username = 'demo.budi'");
    if (!one("SELECT 1 FROM catatan WHERE student_id = ?", budi.id)) {
      run("INSERT INTO catatan (student_id, author_id, text, created_at) VALUES (?, ?, ?, ?)", budi.id, rina.id, "Hebat, Budi! Jumat kita main tantangan kelas, ya.", now - DAY);
    }
    return group.code;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = seedDemo();
  console.log(`Data demo siap. Kode Kelas 4A: ${code}.`);
  console.log("Akun: demo.rina (pendamping), demo.budi, demo.sari, demo.ayu, demo.dimas (pelajar).");
  console.log("Kata sandi dari DEMO_PASSWORD atau nilai bawaan di server/seed.js. Tombol demo di halaman Masuk tidak butuh sandi.");
}
