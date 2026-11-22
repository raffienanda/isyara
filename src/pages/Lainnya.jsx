import React, { useMemo, useRef, useState } from "react";
import { CameraLab } from "../lib/media";
import { api, getPrefs, recordProgress, setPrefs } from "../api";
import { ALPHABET, GERAK, TWO_HANDED } from "../../shared/levels.js";
import { Back, LetterMap, Loading, gerakVideo, handImg, tipFor, useAuth, useLoad } from "../ui";

function Banner({ back, backLabel, title, accent, children }) {
  return (
    <header className="bg-banner on-dark banner">
      <div className="container">
        <Back to={back}>{backLabel}</Back>
        <h1 className="display h-1">{title} {accent && <span className="accent">{accent}</span>}</h1>
        {children}
      </div>
    </header>
  );
}

export function Kamus() {
  const { user } = useAuth();
  const progress = useLoad(user?.role === "pelajar" ? "/progres" : "/saya");
  const [picked, setPicked] = useState("A");
  const [mirror, setMirror] = useState(user?.hand === "kiri");
  const mastered = progress.data?.stats?.mastered || [];
  const home = user?.role === "pendamping" ? "kelas" : "beranda";
  return (
    <div className="bg-soft" style={{ minHeight: "100vh", paddingBottom: 56 }}>
      <Banner back={home} backLabel="Kembali" title="Kamus" accent="A–Z">
        <p className="muted" style={{ maxWidth: 560 }}>Pilih huruf untuk melihat bentuk tangannya.{user?.role === "pelajar" ? " Huruf hijau sudah kamu kuasai." : ""}</p>
      </Banner>
      <main id="isi" className="container row" style={{ paddingTop: 32, alignItems: "flex-start", "--gap": "28px" }}>
        <div role="group" aria-label="Daftar huruf" className="grid" style={{ flex: "999 1 560px", "--min": "100px", "--gap": "12px" }}>
          {ALPHABET.map(ch => {
            const on = ch === picked, done = mastered.includes(ch);
            return (
              <button key={ch} onClick={() => setPicked(ch)} aria-pressed={on} aria-label={"Huruf " + ch + (done ? ", sudah dikuasai" : "")} className="stack center"
                style={{ "--gap": "4px", padding: "12px 6px", borderRadius: 24, border: "3px solid " + (on ? "var(--oranye)" : done ? "var(--hijau)" : "var(--garis)"), background: done && !on ? "var(--hijau)" : "var(--putih)", color: done && !on ? "var(--krem)" : "var(--teks)" }}>
                <img src={handImg(ch)} alt="" width="64" height="64" style={{ objectFit: "contain" }} loading="lazy" />
                <span className="display" style={{ fontSize: "1.6rem" }}>{ch}</span>
              </button>
            );
          })}
        </div>
        <aside aria-live="polite" className="card stack" style={{ flex: "1 1 360px", borderRadius: 40, position: "sticky", top: 16 }}>
          <div className="row between">
            <span className="display green" style={{ fontSize: "6rem" }}>{picked}</span>
            <span className="chip chip-mint">{TWO_HANDED.has(picked) ? "Dua tangan" : "Satu tangan"}</span>
          </div>
          <div style={{ height: 300, borderRadius: 32, background: "var(--mint)", display: "grid", placeItems: "center" }}>
            <img src={handImg(picked)} alt={"Tangan 3D membentuk huruf " + picked + " dalam BISINDO"} width="270" height="270" style={{ objectFit: "contain", transform: mirror ? "scaleX(-1)" : undefined }} />
          </div>
          <p className="muted">{tipFor(picked)}</p>
          <div className="row">
            {user?.role === "pelajar" && <a className="btn btn-primary" href="#/level">Latih di level</a>}
            <button className="btn btn-outline" aria-pressed={mirror} onClick={() => setMirror(!mirror)}>Cerminkan</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

export function Kosakata() {
  const { user } = useAuth();
  const [picked, setPicked] = useState("terima kasih");
  const [take, setTake] = useState(1);
  const [slow, setSlow] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [camera, setCamera] = useState(false);
  const [notice, setNotice] = useState("");
  const done = useRef(new Set());
  const video = useRef(null);
  const item = GERAK.find(g => g.word === picked);
  const prefs = useMemo(getPrefs, []);
  function matched(word) {
    if (done.current.has(word)) return;
    done.current.add(word);
    if (user?.role === "pelajar") recordProgress({ type: "gerak", word, seconds: 30 });
    setNotice(`Gerakan "${word}" terbaca mirip contoh. Tersimpan di progresmu.`);
  }
  return (
    <div className="bg-soft" style={{ minHeight: "100vh", paddingBottom: 56 }}>
      <Banner back={user?.role === "pendamping" ? "kelas" : "beranda"} backLabel="Kembali" title="Kosakata" accent="gerak">
        <p className="muted" style={{ maxWidth: 620 }}>Sepuluh kata BISINDO sehari-hari dengan animasi tangan 3D. Tonton, perlambat, lalu tirukan di depan kamera.</p>
      </Banner>
      <main id="isi" className="container row" style={{ paddingTop: 32, alignItems: "flex-start", "--gap": "28px" }}>
        <div role="group" aria-label="Daftar kata" className="grid" style={{ flex: "1 1 340px", "--min": "150px", "--gap": "10px" }}>
          {GERAK.map(g => (
            <button key={g.word} onClick={() => { setPicked(g.word); setTake(1); setNotice(""); }} aria-pressed={g.word === picked}
              className="display" style={{ minHeight: 62, borderRadius: 999, fontSize: "1.2rem", textTransform: "uppercase", border: "3px solid " + (g.word === picked ? "var(--hijau)" : "var(--garis)"), background: g.word === picked ? "var(--hijau)" : "var(--putih)", color: g.word === picked ? "var(--krem)" : "var(--teks)" }}>
              {g.word}
            </button>
          ))}
        </div>
        <section className="card row" aria-live="polite" style={{ flex: "999 1 620px", borderRadius: 40, alignItems: "flex-start", "--gap": "26px" }}>
          <div className="stack" style={{ flex: "1 1 300px", "--gap": "12px" }}>
            {camera ? (
              <div className={prefs.mirror ? "mirror-cam" : ""} style={{ position: "relative", aspectRatio: "1", borderRadius: 32, overflow: "hidden" }}>
                <CameraLab key={picked} className="camera-word" targetWord={picked} guided autoStart onMatch={matched} />
              </div>
            ) : (
              <video ref={video} key={picked + take} src={gerakVideo(picked, take)} muted loop autoPlay playsInline aria-label={"Animasi tangan 3D untuk kata " + picked}
                onLoadedMetadata={e => { e.currentTarget.playbackRate = slow ? 0.5 : 1; }}
                style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 32, background: "var(--mint)", transform: mirror ? "scaleX(-1)" : undefined }} />
            )}
            {!camera && <div className="row" style={{ "--gap": "8px" }}>
              <button className="btn btn-outline btn-sm" aria-pressed={slow} onClick={() => { setSlow(!slow); if (video.current) video.current.playbackRate = slow ? 1 : 0.5; }}>Perlambat 0,5×</button>
              <button className="btn btn-outline btn-sm" aria-pressed={mirror} onClick={() => setMirror(!mirror)}>Cerminkan</button>
              {[1, 2, 3].map(n => <button key={n} className="btn btn-outline btn-sm" aria-pressed={take === n} onClick={() => setTake(n)}>Penutur {n}</button>)}
            </div>}
          </div>
          <div className="stack" style={{ flex: "1 1 260px", "--gap": "14px" }}>
            <span className="eyebrow">{item.group}</span>
            <h2 className="display green" style={{ fontSize: "3.4rem", textTransform: "uppercase" }}>{item.word}</h2>
            <p className="muted">{item.meaning}</p>
            <div style={{ padding: "16px 20px", borderRadius: 24, background: "var(--krem)" }}>
              <span className="small muted" style={{ fontWeight: 700 }}>CONTOH KALIMAT</span>
              <p className="display" style={{ fontSize: "1.35rem", marginTop: 4 }}>{item.example}</p>
            </div>
            <p className="card-mint small" style={{ padding: "14px 18px", borderRadius: 24 }}>Isyarat kata juga memakai ekspresi wajah. Latih bersama teman Tuli agar maknanya pas.</p>
            <button className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} onClick={() => { setCamera(!camera); setNotice(""); }}>{camera ? "Kembali ke animasi" : "Coba dengan kamera"}</button>
            {camera && <p className="small muted">Peragakan kata selama dua detik dengan wajah dan kedua tangan di dalam bingkai.</p>}
            {notice && <p className="alert alert-ok" role="status">{notice}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

export function Profil({ query }) {
  const { user, setUser, logout } = useAuth();
  const progress = useLoad("/progres");
  const [prefs, update] = useState(getPrefs);
  const [msg, setMsg] = useState({});
  const [pack, setPack] = useState("");
  const say = (key, text, ok = true) => setMsg(m => ({ ...m, [key]: { text, ok } }));

  async function patch(body, key, okText) {
    try { const { user: next } = await api("/saya", { method: "PATCH", body }); setUser(next); say(key, okText); }
    catch (e) { say(key, e.message, false); }
  }
  async function join(e) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get("code");
    try { const { group } = await api("/gabung", { method: "POST", body: { code } }); say("kelas", "Bergabung ke " + group.name + "."); e.currentTarget?.reset?.(); progress.reload(); }
    catch (err) { say("kelas", err.message, false); }
  }
  function toggle(key) { const next = { ...prefs, [key]: !prefs[key] }; update(next); setPrefs(next); }
  async function downloadPack() {
    setPack("Mengunduh…");
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg?.active) throw Error("Paket luring hanya tersedia di versi yang sudah dipasang (HTTPS).");
      const result = await new Promise((resolve, reject) => {
        const ch = new MessageChannel();
        const t = setTimeout(() => reject(Error("Unduhan belum selesai. Coba lagi.")), 180000);
        ch.port1.onmessage = e => { clearTimeout(t); resolve(e.data); };
        reg.active.postMessage("download", [ch.port2]);
      });
      setPack(result === "Siap luring" ? "Paket siap. Latihan bisa dibuka tanpa internet di perangkat ini." : result);
    } catch (e) { setPack(e.message); }
  }

  const stats = progress.data?.stats;
  const Msg = ({ k }) => msg[k] ? <p className={"alert " + (msg[k].ok ? "alert-ok" : "alert-error")} role="status">{msg[k].text}</p> : null;
  const toggles = [["large", "Teks besar", "Perbesar semua tulisan"], ["contrast", "Kontras tinggi", "Warna lebih tegas dan mudah dibedakan"],
    ["reduceMotion", "Kurangi animasi", "Hentikan gerakan dekorasi"], ["mirror", "Cerminkan kamera", "Kamera tampil seperti cermin"]];
  return (
    <div className="bg-soft" style={{ minHeight: "100vh", paddingBottom: 56 }}>
      <header className="bg-banner on-dark banner">
        <div className="container">
          <Back to={user.role === "pelajar" ? "beranda" : "kelas"}>Kembali</Back>
          <div className="row" style={{ "--gap": "22px" }}>
            <span className="display" style={{ display: "grid", placeItems: "center", width: 104, height: 104, borderRadius: "50%", background: "var(--krem)", color: "var(--hijau)", fontSize: "3rem" }}>{user.name[0]}</span>
            <div className="grow"><h1 className="display h-1">{user.name}</h1><span className="muted">@{user.username} · {user.role === "pelajar" ? "Pelajar" : "Pendamping"}</span></div>
            {stats && <div className="row">{[[stats.points, "poin"], [stats.mastered.length, "huruf"], [stats.streak, "hari beruntun"]].map(([v, l]) => (
              <span key={l} className="stack center" style={{ padding: "12px 18px", borderRadius: 24, background: "rgba(21,56,42,.55)", "--gap": "0" }}><strong className="display accent" style={{ fontSize: "1.9rem" }}>{v}</strong><span className="small">{l}</span></span>))}</div>}
          </div>
        </div>
      </header>
      <main id="isi" className="container grid" style={{ paddingTop: 32, "--min": "340px", "--gap": "22px" }}>
        {(user.mustChange || query.get("sandi")) && (
          <section className="card-peach stack" style={{ gridColumn: "1 / -1" }}>
            <h2 className="display h-3">Buat kata sandi baru</h2>
            <p>Kamu masuk dengan kata sandi sementara dari pendamping. Buat kata sandimu sendiri sekarang.</p>
            <form className="row" onSubmit={e => { e.preventDefault(); patch({ password: new FormData(e.currentTarget).get("password") }, "sandi", "Kata sandi baru tersimpan."); }}>
              <input className="input" name="password" type="password" minLength={6} required autoComplete="new-password" style={{ maxWidth: 320 }} aria-label="Kata sandi baru" />
              <button className="btn btn-primary">Simpan</button>
            </form>
            <Msg k="sandi" />
          </section>
        )}
        {user.role === "pelajar" && (
          <section className="card stack" aria-labelledby="kelas-h">
            <h2 id="kelas-h" className="display h-3">Kelas</h2>
            {(progress.data?.groups || []).map(g => <p key={g.id} className="card-mint" style={{ padding: "14px 18px", borderRadius: 22 }}><strong>{g.name}</strong> · pendamping {g.owner}</p>)}
            <form onSubmit={join} className="field">Gabung kelas
              <span className="row" style={{ flexWrap: "nowrap", "--gap": "8px" }}>
                <input className="input" name="code" required maxLength={12} placeholder="4A27" style={{ letterSpacing: 3, textTransform: "uppercase" }} />
                <button className="btn btn-primary">Gabung</button>
              </span>
            </form>
            <Msg k="kelas" />
          </section>
        )}
        {user.role === "pelajar" && (
          <section className="card stack" aria-labelledby="tangan-h">
            <h2 id="tangan-h" className="display h-3">Tangan utama & target</h2>
            <div className="seg" role="group" aria-label="Tangan utama">
              {["kiri", "kanan"].map(h => <button key={h} aria-pressed={user.hand === h} onClick={() => patch({ hand: h }, "tangan", "Tersimpan.")}>Tangan {h}</button>)}
            </div>
            <div className="seg" role="group" aria-label="Target harian">
              {[5, 10, 15].map(g => <button key={g} aria-pressed={user.goal === g} onClick={() => patch({ goal: g }, "tangan", "Target harian diperbarui.")}>{g} menit</button>)}
            </div>
            <Msg k="tangan" />
          </section>
        )}
        <section className="card stack" aria-labelledby="akses-h" style={{ "--gap": "4px" }}>
          <h2 id="akses-h" className="display h-3" style={{ marginBottom: 8 }}>Aksesibilitas</h2>
          {toggles.map(([k, t, d]) => (
            <button key={k} role="switch" aria-checked={Boolean(prefs[k])} onClick={() => toggle(k)} className="row between"
              style={{ flexWrap: "nowrap", padding: "14px 4px", border: 0, borderBottom: "2px solid var(--pasir)", background: "transparent", textAlign: "left" }}>
              <span><strong>{t}</strong><br /><span className="small muted">{d}</span></span>
              <span aria-hidden="true" style={{ flex: "none", position: "relative", width: 60, height: 34, borderRadius: 99, background: prefs[k] ? "var(--hijau)" : "var(--garis-input)" }}>
                <span style={{ position: "absolute", top: 4, left: prefs[k] ? 30 : 4, width: 26, height: 26, borderRadius: "50%", background: "#fff" }} />
              </span>
            </button>
          ))}
        </section>
        <section className="card-tua stack" aria-labelledby="luring-h">
          <h2 id="luring-h" className="display h-3">Latihan tanpa internet</h2>
          <p className="muted">Simpan model kamera, gambar tangan 3D, dan animasi kata di perangkat ini. Progres dikirim ke pendamping saat tersambung lagi.</p>
          <button className="btn btn-kuning" style={{ alignSelf: "flex-start" }} onClick={downloadPack} disabled={pack === "Mengunduh…"}>Unduh paket luring</button>
          {pack && <p role="status">{pack}</p>}
        </section>
        {stats && user.role === "pelajar" && (
          <section className="card stack" style={{ gridColumn: "1 / -1" }} aria-labelledby="peta-h">
            <h2 id="peta-h" className="display h-3">Peta hurufku</h2>
            <LetterMap mastered={stats.mastered} skipped={stats.skipped} />
          </section>
        )}
        <div className="row" style={{ gridColumn: "1 / -1" }}>
          <button className="btn btn-primary" onClick={logout} style={{ background: "var(--tua)" }}>Keluar dari akun</button>
        </div>
      </main>
    </div>
  );
}
