import React, { useRef, useState } from "react";
import { useSwap } from "../anim";
import { api } from "../api";
import { Brand, LetterMap, Loading, Spark, go, relTime, useAuth, useLoad } from "../ui";

function TopNav({ children }) {
  const { logout } = useAuth();
  return (
    <div className="row between no-print">
      <span className="row" style={{ "--gap": "10px" }}><Brand to="kelas" light /><span className="chip chip-kuning">Pendamping</span></span>
      <nav className="row" aria-label="Menu pendamping" style={{ "--gap": "8px" }}>
        {children}
        <a className="btn btn-outline-light btn-sm" href="#/kamus">Kamus A–Z</a>
        <a className="btn btn-outline-light btn-sm" href="#/kosakata">Belajar juga</a>
        <a className="btn btn-outline-light btn-sm" href="#/profil">Profil</a>
        <button className="btn btn-cream btn-sm" onClick={logout}>Keluar</button>
      </nav>
    </div>
  );
}

function CreateGroup({ onCreated, first }) {
  const [kind, setKind] = useState("sekolah");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const { group } = await api("/kelompok", { method: "POST", body: { name: new FormData(e.currentTarget).get("name"), kind } });
      onCreated(group);
    } catch (err) { setError(err.message); }
  }
  return (
    <form onSubmit={submit} className="stack" style={{ "--gap": "14px" }}>
      <strong className="display" style={{ fontSize: first ? "2rem" : "1.4rem" }}>{first ? "Buat kelompok pertamamu" : "Kelompok baru"}</strong>
      {first && <p className="muted">Pelajar bergabung ke kelompok dengan kode. Pilih sekolah untuk kelas, atau keluarga untuk belajar di rumah.</p>}
      <div className="seg" role="group" aria-label="Jenis kelompok">
        <button type="button" aria-pressed={kind === "sekolah"} onClick={() => setKind("sekolah")}>Sekolah</button>
        <button type="button" aria-pressed={kind === "keluarga"} onClick={() => setKind("keluarga")}>Keluarga</button>
      </div>
      <label className="field">{kind === "sekolah" ? "Nama kelas" : "Nama kelompok keluarga"}
        <input className="input" name="name" required maxLength={40} placeholder={kind === "sekolah" ? "Kelas 4A" : "Rumah Budi"} />
      </label>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <button className="btn btn-primary">Buat dan dapatkan kode</button>
    </form>
  );
}

export function Kelas() {
  const { user } = useAuth();
  const list = useLoad("/kelompok");
  const [creating, setCreating] = useState(false);
  if (!list.data) return <Loading error={list.error} onRetry={list.reload} />;
  const { groups } = list.data;
  const created = g => { setCreating(false); go("kelas/" + g.id + "?baru=1"); };
  const attention = groups.flatMap(g => g.needsAttention.map(n => n + " (" + g.name + ")"));
  return (
    <div className="bg-soft" style={{ minHeight: "100vh", paddingBottom: 56 }}>
      <header className="bg-banner on-dark banner">
        <div className="container" style={{ gap: 26 }}>
          <TopNav />
          <div><h1 className="display h-1">Halo, {user.name}</h1>
            <p className="muted" style={{ marginTop: 8 }}>{groups.length} kelompok, {groups.reduce((s, g) => s + g.members, 0)} pelajar{attention.length ? `. ${attention.length} pelajar perlu disapa.` : "."}</p></div>
        </div>
      </header>
      <main id="isi" className="container stack" style={{ paddingTop: 32, "--gap": "26px" }}>
        {!groups.length ? (
          <section className="card" style={{ maxWidth: 620, borderRadius: 40 }}><CreateGroup first onCreated={created} /></section>
        ) : <>
          {attention.length > 0 && <p className="alert alert-error">Belum latihan 3 hari atau lebih: {attention.join(", ")}</p>}
          <h2 className="display h-2">Kelompok saya</h2>
          <div className="grid" style={{ "--min": "320px" }}>
            {groups.map(g => (
              <a key={g.id} href={"#/kelas/" + g.id} className="card stack" style={{ textDecoration: "none", color: "var(--teks)", borderRadius: 36, "--gap": "12px" }}>
                <div className="row between"><span className={"chip " + (g.kind === "sekolah" ? "chip-mint" : "chip-peach")}>{g.kind === "sekolah" ? "Sekolah" : "Keluarga"}</span><span className="display muted" style={{ letterSpacing: 2 }}>{g.code}</span></div>
                <strong className="display h-2">{g.name}</strong>
                <span className="muted">{g.members} pelajar, rata-rata {g.avgMastered} huruf dikuasai</span>
                <div className="progress"><span style={{ width: (g.avgMastered / 26) * 100 + "%" }} /></div>
              </a>
            ))}
            <div className="card stack" style={{ border: "3px dashed var(--garis-input)", background: "transparent", borderRadius: 36, justifyContent: "center" }}>
              {creating ? <CreateGroup onCreated={created} /> : (
                <button onClick={() => setCreating(true)} className="stack center" style={{ border: 0, background: "transparent", color: "var(--hijau)", padding: 20, "--gap": "10px" }}>
                  <span className="display" style={{ display: "grid", placeItems: "center", width: 64, height: 64, borderRadius: "50%", background: "var(--hijau)", color: "var(--krem)", fontSize: "2rem" }}>+</span>
                  <strong className="display h-3">Buat kelompok baru</strong>
                </button>
              )}
            </div>
          </div>
        </>}
      </main>
    </div>
  );
}

function Week({ week }) {
  const max = Math.max(10, ...week.map(w => w.minutes));
  const names = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  return (
    <div role="img" aria-label={"Menit latihan 7 hari terakhir: " + week.map(w => w.minutes).join(", ")} className="row" style={{ alignItems: "flex-end", height: 150, flexWrap: "nowrap", "--gap": "10px" }}>
      {week.map((w, i) => (
        <div key={i} className="stack center grow" style={{ "--gap": "4px", height: "100%", justifyContent: "flex-end" }}>
          <span className="small" style={{ fontWeight: 700 }}>{w.minutes}</span>
          <span style={{ width: "100%", maxWidth: 40, height: Math.max(6, (w.minutes / max) * 100), borderRadius: "12px 12px 5px 5px", background: w.minutes >= 10 ? "var(--hijau)" : w.minutes ? "#70D6A8" : "var(--pasir)" }} />
          <span className="small muted">{names[new Date(Date.now() + w.offset * 86400000).getDay()]}</span>
        </div>
      ))}
    </div>
  );
}

function StudentPanel({ id, groupId, onChanged }) {
  const detail = useLoad("/pelajar/" + id, [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const summaryRef = useRef(null);
  useSwap(summaryRef, detail.data?.summary?.created_at ?? "kosong", { y: 18, opacity: 0, scale: 0.98 });
  if (!detail.data) return <section className="card" style={{ flex: "999 1 600px" }}>{detail.error ? <p className="alert alert-error">{detail.error}</p> : <p className="muted">Memuat…</p>}</section>;
  const { student, stats, notes, summary } = detail.data;
  async function makeSummary() {
    setBusy(true); setError("");
    try { const { summary: s } = await api(`/pelajar/${id}/ringkasan`, { method: "POST" }); detail.setData({ ...detail.data, summary: s }); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function addNote(e) {
    e.preventDefault();
    try { const { notes: n } = await api(`/pelajar/${id}/catatan`, { method: "POST", body: { text: note } }); detail.setData({ ...detail.data, notes: n }); setNote(""); }
    catch (err) { setError(err.message); }
  }
  async function remove() {
    if (!window.confirm(`Keluarkan ${student.name} dari kelompok ini? Progresnya tetap tersimpan di akunnya.`)) return;
    await api(`/kelompok/${groupId}/anggota/${id}`, { method: "DELETE" }).catch(e => setError(e.message));
    onChanged(true);
  }
  return (
    <section className="card stack" aria-labelledby="detail-h" style={{ flex: "999 1 600px", borderRadius: 36, "--gap": "22px" }}>
      <div className="row between">
        <h2 id="detail-h" className="display h-1 green">{student.name}</h2>
        {stats.daysSinceActive === null ? <span className="chip chip-peach">Belum pernah latihan</span>
          : stats.daysSinceActive >= 3 && <span className="chip chip-peach">Belum latihan {stats.daysSinceActive} hari</span>}
      </div>

      <div ref={summaryRef} className="card-tua stack" style={{ "--gap": "14px", borderRadius: 28 }}>
        <div className="row between">
          <span className="row" style={{ "--gap": "8px", color: "var(--neon)", fontWeight: 700 }}><Spark size={20} />Ringkasan AI minggu ini</span>
          <button className="btn btn-neon btn-sm no-print" onClick={makeSummary} disabled={busy}>{busy ? "Membuat ringkasan…" : summary ? "Perbarui ringkasan" : "Buat ringkasan AI"}</button>
        </div>
        {summary ? <>
          <p style={{ fontSize: "1.15rem" }}>{summary.text}</p>
          <div className="stack" style={{ "--gap": "6px" }}>
            <span className="small" style={{ fontWeight: 700, color: "var(--kuning)" }}>Saran kegiatan</span>
            {summary.tips.map(t => <span key={t} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", "--gap": "10px" }}><span style={{ flex: "none", width: 8, height: 8, marginTop: 10, borderRadius: "50%", background: "var(--kuning)" }} />{t}</span>)}
          </div>
          <span className="small muted">{summary.source === "ai" ? "Dibuat Gemini" : "Dibuat dari templat (AI belum tersedia)"} dari data progres saja, tanpa nama dan gambar kamera · {relTime(summary.created_at)}. Periksa sebelum dibagikan.</span>
        </> : <p className="muted">Tekan tombol untuk membuat ringkasan dan saran kegiatan dari data latihan {student.name}.</p>}
      </div>

      <div className="grid" style={{ "--min": "150px", "--gap": "12px" }}>
        {[[stats.mastered.length + "/26", "huruf dikuasai"], [stats.weekMinutes, "menit minggu ini"], [stats.points, "poin"], [relTime(stats.lastActivity), "terakhir latihan"]].map(([v, l]) => (
          <div key={l} style={{ padding: 16, borderRadius: 22, background: "var(--krem)" }}><strong className="display" style={{ display: "block", fontSize: "1.7rem" }}>{v}</strong><span className="small muted">{l}</span></div>
        ))}
      </div>
      <div className="stack" style={{ "--gap": "10px" }}><h3 className="display h-3">Peta huruf</h3><LetterMap mastered={stats.mastered} skipped={stats.skipped} /></div>
      <div className="stack" style={{ "--gap": "10px" }}><h3 className="display h-3">Menit latihan 7 hari</h3><Week week={stats.week} /></div>

      <form onSubmit={addNote} className="field no-print">Catatan untuk {student.name}
        <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} required placeholder="Contoh: Latihan huruf R lagi bersama di rumah." />
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Simpan catatan</button>
      </form>
      {notes.length > 0 && <div className="stack" style={{ "--gap": "8px" }}>
        {notes.map(n => <blockquote key={n.id} style={{ margin: 0, padding: "14px 18px", borderRadius: 22, background: "var(--krem)" }}><p>{n.text}</p><span className="small muted">{n.author} · {relTime(n.created_at)}</span></blockquote>)}
      </div>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="row no-print">
        <button className="btn btn-outline" onClick={() => window.print()}>Cetak laporan</button>
        <button className="btn btn-danger" onClick={remove}>Keluarkan dari kelompok</button>
      </div>
    </section>
  );
}

export function KelasDetail({ id, query }) {
  const group = useLoad("/kelompok/" + id, [id]);
  const [picked, setPicked] = useState(null);
  const [temp, setTemp] = useState(null);
  const [copied, setCopied] = useState("");
  if (!group.data) return <Loading error={group.error} onRetry={group.reload} />;
  const { group: g, members, feed } = group.data;
  const current = picked ?? members[0]?.id;
  const link = `${location.origin}/#/masuk?kode=${g.code}`;
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(""); } };
  async function resetPassword(m) {
    const { temp: t } = await api(`/pelajar/${m.id}/sandi`, { method: "POST" });
    setTemp({ name: m.name, value: t });
    group.reload();
  }
  async function newCode() {
    if (!window.confirm("Buat kode baru? Kode lama tidak bisa dipakai lagi untuk bergabung.")) return;
    await api(`/kelompok/${g.id}/kode`, { method: "POST" });
    group.reload();
  }
  const requests = members.filter(m => m.resetRequested);
  const feedText = f => f.kind === "kata" ? `menyelesaikan kata ${f.value}` : f.kind === "level" ? `menyelesaikan Level ${f.value}` : `berlatih kata gerak "${f.value}"`;
  return (
    <div className="bg-soft" style={{ minHeight: "100vh", paddingBottom: 56 }}>
      <header className="bg-banner on-dark banner no-print">
        <div className="container" style={{ gap: 24 }}>
          <TopNav><a className="btn btn-outline-light btn-sm" href="#/kelas">Semua kelompok</a></TopNav>
          <div className="row between" style={{ alignItems: "flex-end" }}>
            <div><span className="eyebrow">{g.kind === "sekolah" ? "Kelas" : "Kelompok keluarga"}</span><h1 className="display h-1">{g.name}</h1>
              <span className="muted">{members.length} pelajar. Pendamping: {g.companions.join(", ")}</span></div>
            <div className="row on-light" style={{ padding: "12px 12px 12px 22px", borderRadius: 999, background: "var(--krem)", "--gap": "12px" }}>
              <span className="stack" style={{ "--gap": "0" }}><span className="small muted" style={{ fontWeight: 700 }}>Kode kelas</span><strong className="display" style={{ fontSize: "1.8rem", letterSpacing: 4 }}>{g.code}</strong></span>
              <button className="btn btn-primary btn-sm" onClick={() => copy(link, "tautan")}>{copied === "tautan" ? "Tautan disalin" : "Salin tautan undangan"}</button>
            </div>
          </div>
        </div>
      </header>
      <main id="isi" className="container stack" style={{ paddingTop: 28, "--gap": "22px" }}>
        {query.get("baru") && <p className="alert alert-ok no-print">Kelompok siap! Bagikan kode <strong>{g.code}</strong> atau tautan undangan ke pelajar. Mereka memasukkannya saat daftar atau di Profil.</p>}
        {temp && <p className="alert" style={{ background: "var(--kuning)" }} role="status">Sandi sementara untuk {temp.name}: <strong className="display" style={{ fontSize: "1.3rem", letterSpacing: 2 }}>{temp.value}</strong>. Tunjukkan ke {temp.name}. Ia akan diminta membuat sandi sendiri saat masuk.</p>}
        {requests.map(m => (
          <div key={m.id} className="row between no-print" style={{ padding: "18px 24px", borderRadius: 28, background: "var(--kuning)" }}>
            <span><strong className="display" style={{ fontSize: "1.2rem" }}>{m.name} lupa kata sandi</strong><br />Buat sandi sementara untuknya.</span>
            <button className="btn btn-primary" style={{ background: "var(--tua)" }} onClick={() => resetPassword(m)}>Buat sandi sementara</button>
          </div>
        ))}
        {!members.length ? (
          <section className="card stack center" style={{ borderRadius: 40, padding: 48 }}>
            <h2 className="display h-2">Belum ada pelajar</h2>
            <p className="muted" style={{ maxWidth: 520 }}>Bagikan kode <strong>{g.code}</strong> atau tautan undangan. Pelajar langsung muncul di sini setelah bergabung.</p>
            <p className="display green" style={{ fontSize: "5rem", letterSpacing: 10 }}>{g.code}</p>
            <button className="btn btn-primary" onClick={() => copy(link, "tautan2")}>{copied === "tautan2" ? "Tautan disalin" : "Salin tautan undangan"}</button>
          </section>
        ) : (
          <div className="row" style={{ alignItems: "flex-start", "--gap": "22px" }}>
            <aside className="stack no-print" style={{ flex: "1 1 340px", "--gap": "18px" }}>
              <section className="card stack" aria-labelledby="list-h" style={{ borderRadius: 32, "--gap": "10px" }}>
                <h2 id="list-h" className="display h-3">Pelajar</h2>
                {members.map(m => {
                  const on = m.id === current, alert = m.daysSinceActive === null || m.daysSinceActive >= 3;
                  return (
                    <button key={m.id} onClick={() => setPicked(m.id)} aria-pressed={on} className="row" style={{ flexWrap: "nowrap", padding: 12, borderRadius: 22, textAlign: "left", border: "3px solid " + (on ? "var(--hijau)" : "transparent"), background: on ? "var(--mint)" : "var(--krem)" }}>
                      <span className="display" style={{ flex: "none", display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: "50%", background: alert ? "var(--peach)" : "var(--hijau)", color: alert ? "#7A3410" : "var(--krem)", fontSize: "1.3rem" }}>{m.name[0]}</span>
                      <span className="stack grow" style={{ "--gap": "4px" }}>
                        <span className="row between"><strong>{m.name}</strong><span className="small muted">{relTime(m.lastActivity)}</span></span>
                        <span className="progress" style={{ height: 10 }}><span style={{ width: (m.mastered.length / 26) * 100 + "%", background: alert ? "var(--oranye)" : "var(--hijau)" }} /></span>
                        <span className="small muted">{m.mastered.length}/26 huruf, {m.weekMinutes} menit minggu ini</span>
                      </span>
                    </button>
                  );
                })}
              </section>
              <section className="card stack" style={{ borderRadius: 32, "--gap": "10px" }}>
                <h2 className="display h-3">Kabar terbaru</h2>
                {feed.length ? feed.map((f, i) => <p key={i} className="small"><strong>{f.name}</strong> {feedText(f)} · {relTime(f.created_at)}</p>) : <p className="muted small">Belum ada kabar.</p>}
              </section>
              <section className="card stack" style={{ borderRadius: 32, "--gap": "10px" }}>
                <h2 className="display h-3">Kelola</h2>
                <p className="small muted">Kode hanya untuk kelompok ini. Buat kode baru kalau kode tersebar ke orang lain.</p>
                <div className="row" style={{ "--gap": "8px" }}>
                  <button className="btn btn-outline btn-sm" onClick={newCode}>Buat kode baru</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { const m = members.find(x => x.id === current); if (m && window.confirm(`Buat sandi sementara untuk ${m.name}?`)) resetPassword(m); }}>Reset sandi pelajar terpilih</button>
                </div>
              </section>
            </aside>
            <StudentPanel key={current} id={current} groupId={g.id} onChanged={() => { setPicked(null); group.reload(); }} />
          </div>
        )}
      </main>
    </div>
  );
}
