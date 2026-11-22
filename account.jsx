import React, { createContext, useContext, useEffect, useState } from "react";
import { family, getLocal, saveLocal, setLocalOwner, units } from "./data";

export const roles = {
  student: { label: "Siswa", start: "home", pages: ["home", "science", "family", "bridge", "text", "speech", "class"] },
  parent: { label: "Orang tua", start: "family", pages: ["home", "family", "speech", "progress"] },
  teacher: { label: "Guru", start: "bridge", pages: ["home", "science", "family", "bridge", "text", "speech", "class", "progress", "curate", "school"] },
};
async function accountApi(action, data = {}, signal) {
  const res = await fetch("./account.php", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
    signal,
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !Object.keys(result).length) throw Error(result.error || "Layanan akun belum bisa diakses.");
  return result;
}

const AccountContext = createContext(null);
export const useAccount = () => useContext(AccountContext);
const offlineKey = "isyara:offline-session";
const pendingLogoutKey = "isyara:pending-logout";

function readSessionFlag(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function clearSessionFlag(key) {
  try { sessionStorage.removeItem(key); } catch { /* Storage may be blocked. */ }
}

function readOfflineSession() {
  try {
    const entry = JSON.parse(readSessionFlag(offlineKey));
    if (entry?.expires > Date.now() && roles[entry.account?.role] && Number.isInteger(entry.account.id)) return entry.account;
  } catch { /* The online session remains available without browser storage. */ }
  return null;
}

export function AccountProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  function update(next) {
    setLocalOwner(next?.id ?? null);
    setAccount(next);
  }
  useEffect(() => {
    let request;
    async function restore() {
      request?.abort();
      request = new AbortController();
      const { signal } = request;
      try {
        if (readSessionFlag(pendingLogoutKey)) {
          await accountApi("logout", {}, signal);
          if (signal.aborted) return;
          clearSessionFlag(pendingLogoutKey);
        }
        const { account } = await accountApi("session", {}, signal);
        if (signal.aborted) return;
        const saved = readOfflineSession();
        if (saved?.id !== account?.id || saved?.role !== account?.role) clearSessionFlag(offlineKey);
        setOffline(false);
        update(account);
      } catch (error) {
        if (signal.aborted) return;
        const saved = error instanceof TypeError ? readOfflineSession() : null;
        setOffline(Boolean(saved));
        update(saved);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    restore();
    window.addEventListener("online", restore);
    return () => { request?.abort(); window.removeEventListener("online", restore); };
  }, []);
  useEffect(() => {
    if (offline || account?.role !== "student" || !account.sync_allowed) return;
    const request = new AbortController();
    const keys = ["done", "practiceWords", "familyDone"];
    const sync = () => {
      const activity = Object.fromEntries(keys.map(key => [key, getLocal(key, [])]));
      accountApi("sync_activity", { accountId: account.id, activity }, request.signal).catch(() => {});
    };
    accountApi("student_detail", { accountId: account.id, student: account.id }, request.signal)
      .then(({ activity }) => {
        if (request.signal.aborted) return;
        for (const key of keys) {
          const local = getLocal(key, []);
          const merged = [...new Set([...local, ...activity.filter(entry => entry.kind === key).map(entry => entry.value)])];
          if (merged.length > local.length) saveLocal(key, merged);
        }
      })
      .catch(() => {})
      .finally(() => { if (!request.signal.aborted) sync(); });
    window.addEventListener("isyara-activity", sync);
    window.addEventListener("online", sync);
    return () => {
      request.abort();
      window.removeEventListener("isyara-activity", sync);
      window.removeEventListener("online", sync);
    };
  }, [account, offline]);

  async function login(username, password) {
    const { account } = await accountApi("login", { username, password });
    clearSessionFlag(offlineKey);
    clearSessionFlag(pendingLogoutKey);
    setOffline(false);
    update(account);
    location.hash = roles[account.role].start;
  }
  async function logout() {
    try { await accountApi("logout"); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      sessionStorage.setItem(pendingLogoutKey, "true");
    }
    clearSessionFlag(offlineKey);
    setOffline(false);
    update(null);
    location.hash = "account";
  }
  function enableOffline() {
    if (!account || offline) return;
    const { id, name, role } = account;
    sessionStorage.setItem(offlineKey, JSON.stringify({ account: { id, name, role }, expires: Date.now() + 86400000 }));
  }
  return <AccountContext.Provider value={{ account, loading, offline, login, logout, enableOffline }}>{children}</AccountContext.Provider>;
}

export function Login() {
  const { login, loading } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try { await login(fields.get("username"), fields.get("password")); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <main className="loginScreen" id="content">
    <section className="loginCard" aria-labelledby="login-title">
      <img className="loginLogo" src="./logos/isyara.webp" alt="" width="48" height="48" />
      <h1 id="login-title">Masuk ke ISYARA</h1>
      <form onSubmit={submit}>
        <label>Nama pengguna<input name="username" autoComplete="username" required maxLength={80} /></label>
        <label>Kata sandi<input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
        {error && <p className="loginError" role="alert">{error}</p>}
        <button className="primary loginSubmit" disabled={busy || loading}>{busy ? "Memeriksa…" : "Masuk"}</button>
      </form>
    </section>
  </main>;
}

export function AccountPanel() {
  const { account, logout } = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account) return <Login />;
  return <section className="sheet accountForm">
    <h1>Akun saya</h1>
    <p>{account.name} · {roles[account.role].label}</p>
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try { await logout(); } catch (error) { setError(error.message); }
      finally { setBusy(false); }
    }}>Keluar dari akun</button>
    <p role="alert">{error}</p>
  </section>;
}

export function AccountProgress({ download }) {
  const { account } = useAccount();
  const [students, setStudents] = useState(null);
  const [student, select] = useState("");
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    accountApi("students", { accountId: account.id }, request.signal).then(({ students }) => {
      setStudents(students);
      if (students.length === 1) select(String(students[0].id));
    }).catch(error => { if (!request.signal.aborted) setError(error.message); });
    return () => request.abort();
  }, [account.id]);
  useEffect(() => {
    if (!student) return;
    const request = new AbortController();
    accountApi("student_detail", { accountId: account.id, student }, request.signal)
      .then(next => { if (!request.signal.aborted) setDetail(next); })
      .catch(error => { if (!request.signal.aborted) setError(error.message); });
    return () => request.abort();
  }, [account.id, student]);
  async function saveNote(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setDetail(await accountApi("save_note", { accountId: account.id, student, text: draft }));
      setDraft("");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  const completed = detail?.activity.filter(entry => entry.kind === "done").map(entry => entry.value) || [];
  const words = detail?.activity.filter(entry => entry.kind === "practiceWords").map(entry => entry.value) || [];
  const familyCount = detail?.activity.filter(entry => entry.kind === "familyDone").length ?? 0;
  return <section className="sheet">
    <h2>Progres siswa</h2>
    <p role="alert">{error}</p>
    {students === null ? <p>Memuat daftar siswa…</p> : students.length === 0 ? <p>Belum ada siswa yang terhubung dengan akun ini.</p> :
      <label>Pilih siswa<select value={student} disabled={busy} onChange={event => {
        setDetail(null);
        setDraft("");
        setError("");
        select(event.target.value);
      }}>
        <option value="">Pilih nama siswa</option>
        {students.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>}
    {student && !detail && !error && <p role="status">Memuat progres…</p>}
    {detail && <>
      <h3>Unit sains selesai</h3>
      <label>{completed.length} dari {units.length} unit<progress max={units.length} value={completed.length} /></label>
      <p>{units.filter(unit => completed.includes(unit.id)).map(unit => unit.title).join(", ") || "Belum ada."}</p>
      <h3>Kata yang dilatih</h3>
      <p>{words.join(", ") || "Belum ada."}</p>
      <p>Latihan keluarga selesai: {familyCount}.</p>
      <div aria-label="Progres per level BISINDO Keluarga">
        {family.map(([title], index) => {
          const finished = detail.activity.filter(entry => entry.kind === "familyDone" && entry.value.startsWith(`${index}-`)).length;
          return <label key={title}>{title} · {finished}/4<progress max={4} value={finished} /></label>;
        })}
      </div>
      <h3>Catatan pendamping</h3>
      <form onSubmit={saveNote}>
        <label>Catatan untuk siswa<textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={1500} required /></label>
        <button className="primary" disabled={busy || !draft.trim()}>Simpan catatan</button>
      </form>
      {detail.notes.map(note => <blockquote key={note.id}>
        <small>{note.name}{roles[note.role] ? ` · ${roles[note.role].label}` : ""}</small>
        <p>{note.text}</p>
      </blockquote>)}
      <div className="controls">
        <button onClick={() => window.print()}>Cetak laporan</button>
        <button onClick={() => download("laporan-isyara.txt", [
          "Laporan belajar ISYARA",
          students.find(row => String(row.id) === student)?.name,
          "Unit selesai: " + completed.join(", "),
          "Kata yang dilatih: " + words.join(", "),
          "Latihan keluarga selesai: " + familyCount,
          ...detail.notes.map(note => note.created_at + " · " + note.name + " · " + note.text),
        ].join("\n"))}>Unduh laporan</button>
      </div>
    </>}
  </section>;
}

export function SchoolRoster() {
  const { account } = useAccount();
  const [rows, setRows] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    const request = new AbortController();
    accountApi("school", { accountId: account.id }, request.signal)
      .then(({ roster }) => setRows(roster))
      .catch(error => { if (!request.signal.aborted) setError(error.message); });
    return () => request.abort();
  }, [account.id]);
  return <section className="sheet">
    <h1>Daftar kelas</h1>
    {error ? <p role="alert">{error}</p> : rows === null ? <p>Memuat daftar kelas…</p> : rows.length === 0 ? <p>Belum ada siswa yang terdaftar.</p> :
      <ul>{rows.map(row => <li key={row.classroom + row.student}><strong>{row.classroom}</strong> · {row.student}</li>)}</ul>}
  </section>;
}
