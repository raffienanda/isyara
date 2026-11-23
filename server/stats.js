import { all, one } from "./db.js";
import { LEVELS } from "../shared/levels.js";

const DAY = 86400000;
// Day boundaries follow Western Indonesia Time, where the pilot classes are.
const OFFSET = 7 * 3600000;
const dayKey = ms => Math.floor((ms + OFFSET) / DAY);

export function studentSummary(studentId, now = Date.now()) {
  const letters = all("SELECT letter, status, best, tries, skips, updated_at FROM huruf WHERE user_id = ? ORDER BY letter", studentId);
  const activity = all("SELECT kind, value, seconds, points, created_at FROM aktivitas WHERE user_id = ? ORDER BY created_at", studentId);

  const today = dayKey(now);
  const week = Array.from({ length: 7 }, (_, i) => ({ day: today - 6 + i, seconds: 0 }));
  const activeDays = new Set();
  let points = 0;
  const levels = new Set();
  const words = new Set();
  const gerak = new Set();
  let right = 0, skipped7 = 0, wordsWeek = 0;
  for (const a of activity) {
    const d = dayKey(a.created_at);
    activeDays.add(d);
    points += a.points;
    const slot = week.find(w => w.day === d);
    if (slot) slot.seconds += a.seconds;
    if (a.kind === "level") levels.add(Number(a.value));
    if (a.kind === "kata") words.add(a.value);
    if (a.kind === "gerak") gerak.add(a.value);
    if (d > today - 7) {
      if (a.kind === "huruf") a.value.endsWith(":kuasai") ? right++ : skipped7++;
      if (a.kind === "kata") wordsWeek++;
    }
  }
  let streak = 0;
  for (let d = activeDays.has(today) ? today : today - 1; activeDays.has(d); d--) streak++;
  const last = activity.at(-1)?.created_at ?? null;

  return {
    letters,
    mastered: letters.filter(l => l.status === "kuasai").map(l => l.letter),
    skipped: letters.filter(l => l.status === "lewati").map(l => l.letter),
    points,
    streak,
    levelsDone: [...levels].sort(),
    words: [...words],
    gerak: [...gerak],
    week: week.map((w, i) => ({ offset: i - 6, minutes: Math.round(w.seconds / 60) })),
    weekMinutes: Math.round(week.reduce((s, w) => s + w.seconds, 0) / 60),
    todayMinutes: Math.round(week[6].seconds / 60),
    activeDaysThisWeek: week.filter(w => activeDays.has(w.day)).length,
    lastActivity: last,
    daysSinceActive: last === null ? null : today - dayKey(last),
    // Share of letter attempts in the last 7 days that ended correct rather than skipped.
    accuracy: right + skipped7 ? Math.round((100 * right) / (right + skipped7)) : null,
    attempts: right + skipped7,
    wordsWeek,
    levelProgress: LEVELS.map(l => ({ n: l.n, name: l.name, done: l.words.filter(w => words.has(w)).length, total: l.words.length, finished: levels.has(l.n) })),
    // Letters the learner skips most, to practise next.
    hardest: letters.filter(l => l.skips > 0).sort((a, b) => b.skips - a.skips || a.letter.localeCompare(b.letter)).slice(0, 5).map(l => ({ letter: l.letter, skips: l.skips, tries: l.tries, status: l.status })),
    recent: activity.filter(a => a.kind !== "huruf").slice(-6).reverse().map(a => ({ kind: a.kind, value: a.value, at: a.created_at, points: a.points })),
  };
}

export function notesFor(studentId, limit = 20) {
  return all(`SELECT c.id, c.text, c.created_at, u.name AS author FROM catatan c
    JOIN users u ON u.id = c.author_id WHERE c.student_id = ? ORDER BY c.id DESC LIMIT ?`, studentId, limit);
}

export function groupsOfStudent(studentId) {
  return all(`SELECT k.id, k.name, k.kind, (SELECT name FROM users WHERE id = k.owner_id) AS owner
    FROM anggota a JOIN kelompok k ON k.id = a.kelompok_id WHERE a.user_id = ? ORDER BY k.name`, studentId);
}

export function canManageStudent(pendampingId, studentId) {
  return Boolean(one(`SELECT 1 FROM anggota a JOIN pengurus p ON p.kelompok_id = a.kelompok_id
    WHERE a.user_id = ? AND p.user_id = ?`, studentId, pendampingId));
}
