import React, { useEffect, useId, useState } from "react";
import { scopedKey } from "./data";
const key = "isyara-room";
const practiceKey = "isyara-practice-room";
// Queue each word separately so simultaneous saves cannot overwrite one another.
// The room token scopes retries to the original 24-hour learning session.
function pendingKey(room, word) {
  return scopedKey("isyara-pending/" + room + "/" + word);
}
async function flushPractice(room) {
  const prefix = pendingKey(room,"");
  const entries = Object.keys(sessionStorage).filter(key => key.startsWith(prefix));
  for (const key of entries) {
    if (sessionStorage.getItem(scopedKey(practiceKey)) !== room) return;
    await api("practice", {room,word:key.slice(prefix.length)});
    sessionStorage.removeItem(key);
  }
}
export async function recordPractice(word) {
  const room = sessionStorage.getItem(scopedKey(practiceKey));
  if (!room) return false;
  sessionStorage.setItem(pendingKey(room,word),"1");
  await flushPractice(room);
  window.dispatchEvent(new Event("practice-recorded"));
  return true;
}
async function api(action, payload) {
  const res = await fetch("./room.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
    cache: "no-store",
  });
  if (!res.ok)
    throw Error(
      "Ruang tidak dapat diakses. Periksa kode atau buat ruang baru.",
    );
  let data;
  try {
    data = await res.json();
  } catch {
    throw Error(
      "Ruang bersama memerlukan hosting PHP. Mode satu perangkat tetap tersedia.",
    );
  }
  return data;
}
export function Room({ message, progressOnly = false, proposals, standalone = false, triggerLabel }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const storageKey = scopedKey(proposals ? "isyara-review-room" : progressOnly ? practiceKey : key);
  const readAction = proposals ? "candidates" : progressOnly ? "progress" : "read";
  const [room, join] = useState(()=>sessionStorage.getItem(storageKey) || ""),
    [code, type] = useState(""),
    [rows, put] = useState([]),
    [msg, say] = useState(""),
    [busy, wait] = useState(false);
  useEffect(() => {
    if (!room) return;
    let live = true;
    let polling = false;
    async function poll() {
      if (polling) return;
      polling = true;
      try {
        if (progressOnly) await flushPractice(room);
        const data = await api(readAction, { room });
        if (live) { put(data.rows); if (progressOnly && data.rows.length) say("Progres ruang sudah diperbarui."); }
      } catch (e) {
        if (live) say(e.message);
      } finally { polling = false; }
    }
    poll();
    window.addEventListener("online",poll);
    window.addEventListener("practice-recorded",poll);
    const t = setInterval(poll, 4000);
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener("online",poll);
      window.removeEventListener("practice-recorded",poll);
    };
  }, [room, readAction]);
  async function revise(action, fields) {
    wait(true);
    try {
      put((await api(action, {room, ...fields})).rows);
      say(action === "review" ? "Tinjauan tersimpan di ruang." : "Usulan dibagikan ke ruang.");
    } catch {say("Perubahan belum tersimpan. Periksa koneksi dan versi tinjauan terbaru.");}
    finally {wait(false);}
  }
  async function enter(create) {
    wait(true);
    try {
      const data = await api(
        create ? "create" : readAction,
        create ? {} : { room: code.trim() },
      );
      let r = create ? data.room : code.trim();
      sessionStorage.setItem(storageKey, r);
      join(r);
      say("Ruang tersambung.");
    } catch (e) {
      say(e.message);
    } finally {
      wait(false);
    }
  }
  return (
    <>
    {!standalone && <button aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(!open)}>{triggerLabel}</button>}
    <section id={panelId} hidden={!standalone && !open} className={standalone ? "sheet" : "toolSection"}>
      <h2>{proposals ? "Kurasi antarperangkat" : progressOnly ? "Progres latihan antarperangkat" : "Ruang kelas antarperangkat"}</h2>
      <p>
        {proposals ? "Anggota dengan kode dapat membagikan dan meninjau usulan selama 24 jam. Bagikan kode hanya dengan kelompok peninjau." : progressOnly ? "Gunakan satu ruang untuk satu siswa. Bagikan kode kepada pendamping agar kata yang dicatat di sesi ini terlihat di dasbornya. Ruang berlaku 24 jam." : "Bagikan kode hanya kepada peserta kelas. Pesan yang dikirim ke ruang disimpan pada server hingga 24 jam."}
      </p>
      {room ? (
        <>
          <label>
            Kode ruang
            <input readOnly value={room} onFocus={(e) => e.target.select()} />
          </label>
          <div className="controls">
            {!proposals && !progressOnly && <button
              disabled={!message?.trim() || busy}
              onClick={async () => {
                wait(true);
                try {
                  const data = await api("send", { room, text: message });
                  put(data.rows);
                  say("Pesan terkirim.");
                } catch (e) {
                  say(e.message);
                } finally {
                  wait(false);
                }
              }}
            >
              Kirim teks ke ruang
            </button>}
            <button
              onClick={() => {
                if (progressOnly) Object.keys(sessionStorage).filter(key=>key.startsWith(pendingKey(room,""))).forEach(key=>sessionStorage.removeItem(key));
                sessionStorage.removeItem(storageKey);
                join("");
                put([]);
                say("Keluar dari ruang.");
              }}
            >
              Keluar
            </button>
          </div>
          <div role="log">
            {progressOnly && !rows.length && <p>Belum ada latihan kata dalam ruang ini.</p>}
            {proposals && proposals.map((p,i)=><button key={i} disabled={busy} onClick={()=>revise("propose",{name:p.name,dialect:p.dialect,desc:p.desc})}>Bagikan usulan {p.name} · {p.dialect}</button>)}
            {proposals && rows.map(p=><article key={p.id}><strong>{p.name} · {p.dialect}</strong><p>{p.description}</p>
              <label>Status tinjauan ruang<select disabled={busy} value={p.status} onChange={e=>revise("review",{id:p.id,revision:p.revision,status:e.target.value})}>
                {["Menunggu tinjauan","Perlu revisi","Ditinjau bersama pengajar"].map(s=><option key={s}>{s}</option>)}
              </select></label></article>)}
            {!proposals && rows.map((x) => (
              <p key={x.id}>{progressOnly ? "Sudah dilatih · " + x.word : x.text}</p>
            ))}
          </div>
        </>
      ) : (
        <>
          <label>
            Kode dari pendamping
            <input
              value={code}
              onChange={(e) => type(e.target.value)}
              maxLength={48}
            />
          </label>
          <div className="controls">
            <button
              disabled={busy || !code.trim()}
              onClick={() => enter(false)}
            >
              Gabung
            </button>
            <button disabled={busy} onClick={() => enter(true)}>
              Buat ruang
            </button>
          </div>
        </>
      )}
      <p role="status">{msg}</p>
    </section>
    </>
  );
}
