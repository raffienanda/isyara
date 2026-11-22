import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api";
import { gsap, reduced } from "../anim";
import { ArrowRight, Back, Brand, Lock, go, useAuth } from "../ui";

const INTRO_HANDS = [
  { ch: "A", style: { left: "2%", top: "13%", width: 250 }, rot: -14, from: -1, depth: 30 },
  { ch: "C", style: { right: "4%", top: "16%", width: 190 }, rot: 12, from: 1, depth: 18 },
  { ch: "L", style: { left: "9%", bottom: "6%", width: 180 }, rot: 10, from: -1, depth: 22 },
  { ch: "V", style: { right: "6%", bottom: "5%", width: 250 }, rot: -10, from: 1, depth: 34 },
];

export function Intro() {
  const { user } = useAuth();
  const home = user ? (user.role === "pelajar" ? "beranda" : "kelas") : "masuk";
  const root = useRef(null);
  useLayoutEffect(() => {
    if (reduced()) return;
    const ctx = gsap.context(() => {
      const hands = gsap.utils.toArray(".intro-hand");
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".intro-line", { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.12 })
        .from(".intro-fade", { y: 20, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.5")
        .from(hands, { x: i => INTRO_HANDS[i].from * 320, rotate: i => INTRO_HANDS[i].from * 60, opacity: 0, duration: 1.1, ease: "back.out(1.4)", stagger: 0.1 }, 0.1);
      hands.forEach((el, i) => gsap.to(el.firstChild, { y: -16, rotate: "+=4", duration: 2.6 + i * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.3 }));
      const movers = hands.map((el, i) => ({ x: gsap.quickTo(el, "x", { duration: 0.8 }), y: gsap.quickTo(el, "y", { duration: 0.8 }), d: INTRO_HANDS[i].depth }));
      const onMove = e => {
        const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
        movers.forEach(m => { m.x(-dx * m.d); m.y(-dy * m.d); });
      };
      window.addEventListener("pointermove", onMove);
      return () => window.removeEventListener("pointermove", onMove);
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={root} data-manual className="screen bg-intro on-dark" style={{ position: "relative", overflow: "hidden" }}>
      {INTRO_HANDS.map(h => (
        <span key={h.ch} className="intro-hand" aria-hidden="true" style={{ position: "absolute", ...h.style, zIndex: 1 }}>
          <img src={`./alfabet-3d/${h.ch}-render.webp`} alt="" style={{ width: "100%", transform: `rotate(${h.rot}deg)`, filter: "drop-shadow(0 18px 24px rgba(21,56,42,.35))" }} />
        </span>
      ))}
      <header className="topbar intro-fade" style={{ position: "relative", zIndex: 2 }}>
        <a href="#/tentang" style={{ fontWeight: 700, textDecoration: "none" }}>Tentang</a>
        <Brand light />
        <a className="btn btn-cream" href={"#/" + (user ? home : "masuk?tab=masuk")}>{user ? "Buka ISYARA" : "Masuk"}</a>
      </header>
      <main id="isi" className="stack center grow" style={{ "--gap": "26px", position: "relative", zIndex: 2, padding: "24px 24px 100px" }}>
        <span className="chip chip-glass intro-fade">BISINDO · Bahasa Isyarat Indonesia</span>
        <h1 className="display h-hero" style={{ maxWidth: 900 }}>
          <span style={{ display: "block", overflow: "hidden", paddingBottom: 6 }}><span className="intro-line" style={{ display: "inline-block" }}>Eja jari BISINDO</span></span>
          <span style={{ display: "block", overflow: "hidden", paddingBottom: 10 }}><span className="intro-line accent" style={{ display: "inline-block" }}>pakai tanganmu.</span></span>
        </h1>
        <p className="intro-fade" style={{ fontSize: "1.2rem", maxWidth: 560, color: "#E4F3E9" }}>Lihat tangan 3D, tirukan bentuknya di depan webcam, dan hurufnya langsung muncul di layar.</p>
        <div className="row intro-fade" style={{ justifyContent: "center" }}>
          <a className="btn btn-cream btn-lg" href={"#/" + home}>Ayo mulai <ArrowRight /></a>
          {!user && <a className="btn btn-outline-light btn-lg" href="#/masuk?tab=masuk">Coba demo</a>}
        </div>
        {!user && <a className="intro-fade" href="#/masuk?peran=pendamping" style={{ fontWeight: 700 }}>Saya guru atau orang tua</a>}
        <ul className="row intro-fade" aria-label="Keunggulan ISYARA" style={{ listStyle: "none", padding: 0, margin: 0, justifyContent: "center" }}>
          {["Pelatih AI per jari", "Ringkasan AI untuk pendamping", "Bisa tanpa internet", "Satu kelas belajar bersama"].map(t => <li key={t} className="chip chip-dark">{t}</li>)}
        </ul>
      </main>
      <footer className="row center intro-fade" style={{ position: "relative", zIndex: 2, padding: "0 24px 26px" }}>
        <p className="chip" style={{ background: "var(--tua)", color: "#E4F3E9", fontWeight: 400 }}><Lock /> Kamera diproses di perangkatmu. Tidak ada video yang dikirim atau disimpan.</p>
      </footer>
    </div>
  );
}

/* One click into a ready-made demo account, so a demo or the judges never type a password. */
function DemoQuick() {
  const { setUser } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api("/demo").then(d => setEnabled(d.enabled)).catch(() => {}); }, []);
  if (!enabled) return null;
  async function enter(as) {
    setBusy(as); setError("");
    try {
      const { user } = await api("/demo", { method: "POST", body: { as } });
      setUser(user);
      go(as === "pelajar" ? "beranda" : "kelas");
    } catch (e) { setError(e.message); setBusy(""); }
  }
  return (
    <section aria-labelledby="demo-h" className="stack" style={{ width: "100%", maxWidth: 520, padding: 22, borderRadius: 32, background: "var(--hijau)", color: "var(--krem)", "--gap": "14px" }}>
      <div className="row between" style={{ "--gap": "8px" }}>
        <h2 id="demo-h" className="display" style={{ fontSize: "1.5rem" }}>Coba langsung</h2>
        <span className="chip chip-kuning">Akun demo · tanpa sandi</span>
      </div>
      <div className="grid" style={{ "--min": "260px", "--gap": "10px" }}>
        <button className="btn btn-cream btn-lg" disabled={Boolean(busy)} onClick={() => enter("pelajar")} style={{ fontSize: "1.1rem" }}>
          <img src="./alfabet-3d/U-render.webp" alt="" width="34" height="34" style={{ objectFit: "contain" }} />{busy === "pelajar" ? "Masuk…" : "Pelajar (Budi)"}
        </button>
        <button className="btn btn-kuning btn-lg" disabled={Boolean(busy)} onClick={() => enter("pendamping")} style={{ fontSize: "1.1rem" }}>
          <img src="./alfabet-3d/V-render.webp" alt="" width="34" height="34" style={{ objectFit: "contain" }} />{busy === "pendamping" ? "Masuk…" : "Pendamping (Bu Rina)"}
        </button>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </section>
  );
}

export function Masuk({ query }) {
  const { setUser } = useAuth();
  const [mode, setMode] = useState(query.get("tab") === "masuk" ? "masuk" : "daftar");
  const [role, setRole] = useState(query.get("peran") === "pendamping" ? "pendamping" : "pelajar");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const daftar = mode === "daftar";

  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setError("");
    try {
      const { user } = await api(daftar ? "/daftar" : "/masuk", { method: "POST", body: daftar ? { ...f, role } : f });
      setUser(user);
      if (user.role === "pendamping") go("kelas");
      else go(daftar ? "kenalan" : user.mustChange ? "profil?sandi=1" : "beranda");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="screen bg-krem">
      <header className="topbar"><Back to="">Kembali</Back><Brand /><span style={{ width: 90 }} /></header>
      <main id="isi" className="stack center grow" style={{ padding: "8px 24px 48px", "--gap": "20px" }}>
        <DemoQuick />
        <form onSubmit={submit} className="card stack" style={{ width: "100%", maxWidth: 520, "--gap": "18px", boxShadow: "0 20px 60px rgba(21,56,42,.10)", borderRadius: 36 }}>
          <div className="seg" role="tablist" aria-label="Pilih daftar atau masuk">
            <button type="button" role="tab" aria-selected={daftar} onClick={() => { setMode("daftar"); setError(""); }}>Daftar</button>
            <button type="button" role="tab" aria-selected={!daftar} onClick={() => { setMode("masuk"); setError(""); }}>Masuk</button>
          </div>
          <h1 className="display h-2 green" style={{ textAlign: "center" }}>{daftar ? "Kamu siapa?" : "Halo lagi!"}</h1>
          {daftar && <>
            <div className="grid" style={{ "--min": "160px", "--gap": "12px" }} role="group" aria-label="Peran">
              <button type="button" className="choice" aria-pressed={role === "pelajar"} onClick={() => setRole("pelajar")}>
                <img src="./alfabet-3d/U-render.webp" alt="" width="72" height="72" style={{ objectFit: "contain" }} />
                <strong className="display" style={{ fontSize: "1.3rem" }}>Pelajar</strong><span className="small muted">Saya mau belajar</span>
              </button>
              <button type="button" className="choice" aria-pressed={role === "pendamping"} onClick={() => setRole("pendamping")}>
                <img src="./alfabet-3d/V-render.webp" alt="" width="72" height="72" style={{ objectFit: "contain" }} />
                <strong className="display" style={{ fontSize: "1.3rem" }}>Pendamping</strong><span className="small muted">Guru atau orang tua</span>
              </button>
            </div>
            <label className="field">Nama panggilan<input className="input" name="name" required maxLength={40} placeholder="Contoh: Budi" autoComplete="nickname" /></label>
          </>}
          <label className="field">Nama pengguna<input className="input" name="username" required maxLength={30} autoCapitalize="none" autoComplete="username" placeholder="budi.belajar" /></label>
          <label className="field">Kata sandi<input className="input" name="password" type="password" required minLength={daftar ? 6 : 1} maxLength={128} autoComplete={daftar ? "new-password" : "current-password"} /></label>
          {daftar && role === "pelajar" && (
            <label className="field">Kode kelas <small>Opsional, bisa diisi nanti di Profil.</small>
              <input className="input" name="code" maxLength={12} defaultValue={query.get("kode") || ""} placeholder="4A27" style={{ letterSpacing: 3, textTransform: "uppercase" }} />
            </label>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Memeriksa…" : daftar ? "Buat akun" : "Masuk"}</button>
          {!daftar && <a href="#/lupa" style={{ fontWeight: 700, textAlign: "center" }}>Lupa kata sandi?</a>}
          <p className="small muted row" style={{ "--gap": "8px", flexWrap: "nowrap", alignItems: "flex-start" }}><Lock /> Kami hanya menyimpan nama, kelas, dan progres. Gambar kamera tidak pernah disimpan.</p>
        </form>
      </main>
    </div>
  );
}

export function Lupa() {
  const [role, setRole] = useState("pelajar");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/lupa", { method: "POST", body: Object.fromEntries(new FormData(e.currentTarget)) });
      setSent(true);
    } catch (err) { setError(err.message); }
  }
  return (
    <div className="screen bg-krem">
      <header className="topbar"><Back to="masuk?tab=masuk">Kembali ke Masuk</Back></header>
      <main id="isi" className="row center grow" style={{ padding: "0 24px 64px" }}>
        <section className="card stack" style={{ maxWidth: 560, width: "100%", borderRadius: 40, "--gap": "18px" }}>
          <h1 className="display h-2 green">Lupa kata sandi?</h1>
          <p className="muted">Tidak apa-apa. Pilih siapa kamu, lalu ikuti langkahnya.</p>
          <div className="seg" role="group" aria-label="Jenis akun">
            <button aria-pressed={role === "pelajar"} onClick={() => { setRole("pelajar"); setSent(false); }}>Saya pelajar</button>
            <button aria-pressed={role === "pendamping"} onClick={() => { setRole("pendamping"); setSent(false); }}>Saya pendamping</button>
          </div>
          {role === "pelajar" ? (
            <form onSubmit={submit} className="stack">
              <div className="card-mint row" style={{ padding: 20, borderRadius: 28, flexWrap: "nowrap", alignItems: "flex-start" }}>
                <img src="./alfabet-3d/V-render.webp" alt="" width="64" height="64" style={{ objectFit: "contain", flex: "none" }} />
                <span><strong>Minta bantuan guru atau orang tuamu.</strong> Mereka bisa membuat kata sandi sementara untukmu dari halaman kelompok.</span>
              </div>
              <label className="field">Nama penggunamu<input className="input" name="username" required maxLength={30} autoCapitalize="none" /></label>
              <button className="btn btn-primary btn-lg">Kirim permintaan ke pendamping</button>
            </form>
          ) : (
            <p className="card-peach" style={{ padding: 20, borderRadius: 28 }}>Untuk sekarang, akun pendamping diatur ulang oleh pengelola server ISYARA. Hubungi tim ISYARA di sekolahmu.</p>
          )}
          {sent && <p className="alert alert-ok" role="status">Permintaan terkirim. Pendampingmu akan melihatnya di halaman kelompok.</p>}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
        </section>
      </main>
    </div>
  );
}

const AI_USES = [
  ["Membaca titik tangan", "Computer vision MediaPipe membaca 21 titik di tiap tangan dari webcam.", "Di perangkat"],
  ["Mengenali huruf", "Model machine learning yang dilatih dari dataset BISINDO, ditambah pelatih per jari.", "Di perangkat"],
  ["Ringkasan dan latihan pintar", "Gemini merangkum progres untuk pendamping dan memilih kata latihan. Yang dikirim hanya angka progres, tanpa nama dan tanpa gambar.", "Di server"],
];

export function Tentang() {
  return (
    <div className="bg-krem" style={{ backgroundSize: "100% auto", backgroundPosition: "top center", minHeight: "100vh" }}>
      <header className="topbar"><Back to="">Kembali</Back><Brand /><span style={{ width: 90 }} /></header>
      <main id="isi" className="stack" style={{ maxWidth: 780, margin: "0 auto", padding: "24px 24px 96px", "--gap": "56px", textAlign: "center" }}>
        <section className="stack center" style={{ "--gap": "18px" }}>
          <h1 className="display h-1 green">Bahasa isyarat untuk semua orang di sekitar anak Tuli.</h1>
          <p className="muted" style={{ fontSize: "1.15rem" }}>Banyak anak Tuli tumbuh di keluarga dan sekolah yang belum bisa berisyarat. ISYARA membantu orang tua, guru, dan teman sekelas mulai dari langkah paling dasar: mengeja nama dan kata dengan jari.</p>
        </section>
        <section className="stack" style={{ "--gap": "20px" }}>
          <h2 className="display h-2">Cara kerjanya</h2>
          <div className="grid" style={{ "--min": "200px", textAlign: "left" }}>
            {[["1. Lihat", "Tangan 3D menunjukkan bentuk tiap huruf BISINDO.", "./alfabet-3d/L-render.webp"],
              ["2. Tirukan", "Webcam membaca titik tanganmu langsung di browser.", "./alfabet-3d/C-render.webp"],
              ["3. Muncul", "Kalau bentuknya cocok, hurufnya terisi dan kamu dapat poin.", "./alfabet-3d/O-render.webp"]].map(([t, d, img]) => (
              <div key={t} className="card stack" style={{ "--gap": "8px" }}>
                <img src={img} alt="" width="88" height="88" style={{ objectFit: "contain" }} />
                <strong className="display h-3">{t}</strong><span className="muted">{d}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="stack" style={{ "--gap": "16px" }}>
          <h2 className="display h-2">Bagaimana AI dipakai</h2>
          {AI_USES.map(([t, d, where]) => (
            <div key={t} className="card row" style={{ textAlign: "left", padding: "20px 24px" }}>
              <strong className="display" style={{ flex: "1 1 200px", fontSize: "1.25rem" }}>{t}</strong>
              <span className="muted" style={{ flex: "2 1 260px" }}>{d}</span>
              <span className={"chip " + (where === "Di server" ? "chip-peach" : "chip-mint")}>{where}</span>
            </div>
          ))}
          <p className="card-peach" style={{ textAlign: "left", padding: "18px 22px", borderRadius: 24 }}><strong>AI tidak dipakai untuk mengajarkan bentuk isyarat.</strong> Semua contoh tangan berasal dari dataset BISINDO. AI bisa salah, jadi pendamping selalu memeriksa hasilnya.</p>
        </section>
        <section className="card-tua stack" style={{ textAlign: "left", borderRadius: 40, padding: 40, background: "var(--hijau)" }}>
          <h2 className="display h-2">Privasi dan data</h2>
          <ul style={{ margin: 0, paddingLeft: 22 }} className="stack">
            <li>Gambar kamera diproses di perangkatmu dan tidak pernah dikirim atau disimpan.</li>
            <li>Yang disimpan hanya nama panggilan, kelompok, huruf yang dikuasai, dan waktu latihan.</li>
            <li>Pendamping hanya melihat progres anak yang bergabung ke kelompoknya lewat kode.</li>
          </ul>
        </section>
        <section className="stack" style={{ "--gap": "14px" }}>
          <h2 className="display h-3">Sumber</h2>
          <p className="small muted">Referensi alfabet: Samuel Ady Sanjaya (2024), BISINDO Indonesian Sign Language: Alphabet Image Data, Mendeley Data, CC BY 4.0. Lintasan kosakata: WL-BISINDO-10class (sigawari), CC BY-NC 4.0. Pelacakan tangan: Google MediaPipe. Rincian di sumber.txt.</p>
          <a className="btn btn-primary btn-lg" href="#/masuk" style={{ alignSelf: "center" }}>Ayo mulai belajar</a>
        </section>
      </main>
    </div>
  );
}
