import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const dir = process.env.DATA_DIR || path.resolve("data");
fs.mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(path.join(dir, "isyara.sqlite"));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('pelajar', 'pendamping')),
  pass TEXT NOT NULL,
  hand TEXT NOT NULL DEFAULT 'kanan',
  goal INTEGER NOT NULL DEFAULT 10,
  about TEXT,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kelompok (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('sekolah', 'keluarga')),
  code TEXT NOT NULL UNIQUE,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS anggota (
  kelompok_id INTEGER NOT NULL REFERENCES kelompok(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (kelompok_id, user_id)
);
CREATE TABLE IF NOT EXISTS pengurus (
  kelompok_id INTEGER NOT NULL REFERENCES kelompok(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (kelompok_id, user_id)
);
CREATE TABLE IF NOT EXISTS huruf (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  letter TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('kuasai', 'lewati')),
  best INTEGER NOT NULL DEFAULT 0,
  tries INTEGER NOT NULL DEFAULT 0,
  skips INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, letter)
);
CREATE TABLE IF NOT EXISTS aktivitas (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS aktivitas_user ON aktivitas(user_id, created_at);
CREATE TABLE IF NOT EXISTS catatan (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ringkasan (
  student_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  tips TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lupa_sandi (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
`);

export const one = (sql, ...args) => db.prepare(sql).get(...args);
export const all = (sql, ...args) => db.prepare(sql).all(...args);
export const run = (sql, ...args) => db.prepare(sql).run(...args);

export function transaction(fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(salt, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// Codes avoid look-alike characters (0/O, 1/I) so they are easy to read aloud or from a projector.
const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newCode() {
  for (;;) {
    const code = Array.from(crypto.randomBytes(4), b => CODE_CHARS[b % CODE_CHARS.length]).join("");
    if (!one("SELECT 1 FROM kelompok WHERE code = ?", code)) return code;
  }
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, username: user.username, name: user.name, role: user.role,
    hand: user.hand, goal: user.goal, about: user.about, mustChange: Boolean(user.must_change),
  };
}
