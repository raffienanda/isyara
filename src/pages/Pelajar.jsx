import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { warmUpCamera } from "../lib/media";
import { gsap, reduced, useSwap } from "../anim";
import { api } from "../api";
import { LEVELS, unlockedLevel } from "../../shared/levels.js";
import { ArrowRight, Back, Brand, Check, LetterMap, Loading, Lock, Spark, gerakVideo, go, handImg, relTime, useAuth, useLoad } from "../ui";
import { Bars, Meter, Stat } from "../charts";

export function Kenalan() {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(0);
  const [about, setAbout] = useState(user.about || "keluarga");
  const [goal, setGoal] = useState(user.goal || 10);
  const stepRef = useRef(null);
  useSwap(stepRef, step, { x: 80, opacity: 0 });
  const name = (user.name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
  async function finish() {
    const { user: next } = await api("/saya", { method: "PATCH", body: { about, goal } }).catch(() => ({ user }));
    setUser(next);
    go("beranda");
  }
  const options = [["tuli", "Saya Tuli", "Mau melatih ejaan jari dan menambah kosakata BISINDO."],
    ["keluarga", "Saya keluarga atau teman orang Tuli", "Mau bisa ngobrol dengan anak, saudara, atau teman."],
    ["umum", "Saya ingin belajar saja", "Penasaran dengan bahasa isyarat dan mau mulai dari dasar."]];
  return (
    <div className="screen bg-krem">
      <header className="topbar">
        <button className="back" onClick={() => setStep(Math.max(0, step - 1))} disabled={!step}>Kembali</button>
        <div className="row" aria-label={`Langkah ${step + 1} dari 3`} style={{ "--gap": "8px" }}>
          {[0, 1, 2].map(i => <span key={i} style={{ height: 12, width: i === step ? 36 : 12, borderRadius: 99, background: i <= step ? "var(--hijau)" : "var(--garis-input)" }} />)}
        </div>
        <a href="#/beranda" style={{ fontWeight: 700 }}>Lewati</a>
      </header>
      <main id="isi" ref={stepRef} className="stack center grow" style={{ "--gap": "28px", padding: "0 24px 64px" }}>
        {step === 0 && <>
          <h1 className="display h-1 green">Kenalan dulu, yuk.</h1>
          <p className="muted">Jawabanmu dipakai untuk menyusun latihan yang pas.</p>
          <div className="stack" style={{ width: "100%", maxWidth: 640, "--gap": "12px" }}>
            {options.map(([key, title, desc]) => (
              <button key={key} className="choice" aria-pressed={about === key} onClick={() => setAbout(key)} style={{ alignItems: "flex-start", textAlign: "left", padding: "20px 28px", borderRadius: 32 }}>
                <strong className="display" style={{ fontSize: "1.35rem" }}>{title}</strong><span className="muted">{desc}</span>
              </button>
            ))}
          </div>
        </>}
        {step === 1 && <>
          <h1 className="display h-1 green">Halo, {user.name}!</h1>
          <p className="muted" style={{ maxWidth: 560 }}>Kamu bisa mulai dari huruf namamu sendiri di menu Eja namaku.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            {Array.from(name || "ISYARA").map((ch, i) => (
              <span key={i} className="card stack center" style={{ width: 110, padding: 12, "--gap": "4px", borderRadius: 28 }}>
                <img src={handImg(ch)} alt={"Huruf " + ch} width="80" height="80" style={{ objectFit: "contain" }} />
                <strong className="display" style={{ fontSize: "1.3rem" }}>{ch}</strong>
              </span>
            ))}
          </div>
        </>}
        {step === 2 && <>
          <h1 className="display h-1 green">Berapa lama tiap hari?</h1>
          <p className="muted">Sedikit tapi rutin lebih baik. Bisa diubah kapan saja di Profil.</p>
          <div className="row" style={{ justifyContent: "center" }}>
            {[[5, "Santai"], [10, "Rutin"], [15, "Serius"]].map(([m, d]) => (
              <button key={m} className="choice" aria-pressed={goal === m} onClick={() => setGoal(m)} style={{ width: 190, padding: "26px 14px", borderRadius: 36 }}>
                <strong className="display" style={{ fontSize: "3.2rem", lineHeight: 1 }}>{m}</strong><span style={{ fontWeight: 700 }}>menit</span><span className="small muted">{d}</span>
              </button>
            ))}
          </div>
        </>}
        <button className="btn btn-primary btn-lg" onClick={() => (step < 2 ? setStep(step + 1) : finish())}>{step < 2 ? "Lanjut" : "Mulai belajar"} <ArrowRight /></button>
      </main>
    </div>
  );
}

function GoalRing({ minutes, goal }) {
  const arc = useRef(null);
  useLayoutEffect(() => {
    if (!arc.current || reduced()) return;
    const t = gsap.from(arc.current, { strokeDasharray: `0 ${2 * Math.PI * 34}`, duration: 1.4, ease: "power3.out", delay: 0.3 });
    return () => t.kill();
  }, [minutes, goal]);
  const r = 34, full = 2 * Math.PI * r, part = Math.min(1, minutes / goal) * full;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Target harian ${minutes} dari ${goal} menit`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(243,246,244,.2)" strokeWidth="10" />
      <circle ref={arc} cx="42" cy="42" r={r} fill="none" stroke="var(--kuning)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${part} ${full}`} transform="rotate(-90 42 42)" />
      <text x="42" y="49" textAnchor="middle" fill="var(--krem)" fontFamily="var(--display)" fontWeight="800" fontSize="20">{minutes}/{goal}</text>
    </svg>
  );
}

const RECENT = { kata: "Kata", level: "Level selesai", gerak: "Isyarat kata" };

// Learner dashboard: this week's numbers, daily minutes, level progress, letters to practise.
function Progresku({ stats, goal, level }) {
  const pool = LEVELS.filter(l => l.n <= level).flatMap(l => l.words);
  const practice = ch => pool.filter(w => w.includes(ch)).sort((a, b) => a.length - b.length).slice(0, 3);
  return (
    <section className="stack" aria-labelledby="progres-h" style={{ "--gap": "16px" }}>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <h2 id="progres-h" className="display h-2">Progresku</h2>
        <span className="muted small">7 hari terakhir</span>
      </div>
      <div className="grid" style={{ "--min": "190px", "--gap": "12px" }}>
        <Stat value={stats.mastered.length} unit="/26" label="Huruf dikuasai" note={stats.skipped.length ? `${stats.skipped.length} huruf masih sering dilewati` : "Belum ada huruf yang dilewati"} />
        <Stat value={stats.wordsWeek} label="Kata selesai" note={`${stats.words.length} kata berbeda sejak awal`} />
        <Stat value={stats.weekMinutes} unit=" menit" label="Waktu latihan" note={`Aktif ${stats.activeDaysThisWeek} dari 7 hari`} />
        <Stat value={stats.accuracy ?? "–"} unit={stats.accuracy === null ? "" : "%"} label="Huruf tepat" note={stats.attempts ? `dari ${stats.attempts} percobaan huruf` : "Belum ada percobaan minggu ini"} />
      </div>
      <div className="grid" style={{ "--min": "340px", "--gap": "16px" }}>
        <section className="card stack" style={{ "--gap": "14px" }}>
          <h3 className="display h-3">Menit latihan per hari</h3>
          <Bars values={stats.week.map(w => w.minutes)} target={goal} label="Menit latihan 7 hari terakhir" />
        </section>
        <section className="card stack" style={{ "--gap": "14px" }}>
          <h3 className="display h-3">Kemajuan level</h3>
          {stats.levelProgress.map(l => (
            <Meter key={l.n} label={`Level ${l.n}: ${l.name}`} value={l.done} max={l.total} locked={l.n > level} />
          ))}
          <span className="small muted">Angka menunjukkan kata berbeda yang pernah selesai dari seluruh bank kata level itu.</span>
        </section>
      </div>
      <div className="grid" style={{ "--min": "340px", "--gap": "16px" }}>
        <section className="card stack" style={{ "--gap": "14px" }}>
          <h3 className="display h-3">Peta huruf A–Z</h3>
          <div className="on-light" style={{ padding: 14, borderRadius: 18, background: "rgba(243, 246, 244, .96)" }}>
            <LetterMap mastered={stats.mastered} skipped={stats.skipped} />
          </div>
          <h3 className="display h-3" style={{ marginTop: 6 }}>Aktivitas terakhir</h3>
          {stats.recent.length ? stats.recent.map((r, i) => (
            <p key={i} className="row between small"><span><strong>{RECENT[r.kind]}</strong> {r.kind === "level" ? r.value : r.value.toUpperCase()}{r.points ? `, +${r.points} poin` : ""}</span><span className="muted">{relTime(r.at)}</span></p>
          )) : <p className="muted small">Belum ada aktivitas.</p>}
        </section>
        <section className="card stack" style={{ "--gap": "12px" }}>
          <h3 className="display h-3">Perlu dilatih</h3>
          {stats.hardest.length ? stats.hardest.map(h => {
            const words = practice(h.letter);
            return (
              <div key={h.letter} className="row" style={{ flexWrap: "nowrap", "--gap": "12px" }}>
                <img src={handImg(h.letter)} alt="" width="44" height="44" style={{ flex: "none", objectFit: "contain" }} />
                <span className="grow"><strong className="display" style={{ fontSize: "1.3rem" }}>{h.letter}</strong> <span className="small muted">dilewati {h.skips} dari {h.tries} percobaan</span></span>
                {words.length > 0 && <a className="btn btn-sm btn-neon" href={"#/main/pintar?kata=" + words.join(",")}>Latih</a>}
              </div>
            );
          }) : <p className="muted">Belum ada huruf yang sering dilewati. Lanjutkan levelmu.</p>}
          <span className="small muted">Tombol Latih membuka 3 kata pendek yang memakai huruf itu.</span>
        </section>
      </div>
    </section>
  );
}

export function Beranda() {
  const { user } = useAuth();
  useEffect(() => warmUpCamera(), []);
  const progress = useLoad("/progres");
  const smart = useLoad("/latihan-pintar");
  if (!progress.data) return <Loading error={progress.error} onRetry={progress.reload} dark />;
  const { stats, notes, groups } = progress.data;
  const level = unlockedLevel(stats.levelsDone);
  const current = LEVELS[level - 1];
  const doneWords = current.words.filter(w => stats.words.includes(w)).length;
  const left = Math.max(0, user.goal - stats.todayMinutes);
  return (
    <div className="screen bg-hijau on-dark" style={{ paddingBottom: 56 }}>
      <header className="container row between" style={{ padding: "20px 24px" }}>
        <Brand to="beranda" light />
        <div className="row" style={{ "--gap": "10px" }}>
          <span className="chip chip-dark">{stats.streak} hari beruntun</span>
          <span className="chip chip-dark" style={{ color: "var(--kuning)" }}><span data-count={stats.points}>{stats.points}</span> poin</span>
          <a className="btn btn-outline-light btn-sm" href="#/profil">Profil</a>
        </div>
      </header>
      <main id="isi" className="container stack" style={{ "--gap": "26px" }}>
        <div className="row" style={{ "--gap": "24px" }}>
          <div className="stack grow" style={{ flex: "999 1 480px", "--gap": "8px" }}>
            <h1 className="display h-1">Halo, {user.name}!</h1>
            <p className="muted" style={{ fontSize: "1.15rem" }}>Mau latihan apa hari ini?</p>
          </div>
          <div className="row" style={{ flex: "1 1 320px", padding: "16px 22px", borderRadius: 32, background: "rgba(15,59,46,.55)", flexWrap: "nowrap" }}>
            <GoalRing minutes={stats.todayMinutes} goal={user.goal} />
            <span><strong>Target hari ini</strong><br /><span className="muted">{left ? `${left} menit lagi.` : "Target tercapai. Hebat!"}</span></span>
          </div>
        </div>

        {smart.data?.words?.length > 0 && (
          <a href={"#/main/pintar?kata=" + smart.data.words.join(",")} className="row" style={{ padding: "22px 28px", borderRadius: 32, background: "var(--tua)", color: "var(--krem)", textDecoration: "none", border: "2px solid rgba(139,232,193,.4)" }}>
            <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, borderRadius: "50%", background: "var(--neon)", color: "var(--tua)" }}><Spark size={28} /></span>
            <span style={{ flex: "1 1 300px" }}>
              <span className="small" style={{ fontWeight: 700, color: "var(--neon)" }}>Latihan pintar, {smart.data.source === "ai" ? "dipilih AI" : "dari huruf yang sering terlewat"}</span><br />
              <strong className="display" style={{ fontSize: "1.4rem" }}>{smart.data.reason}</strong><br />
              <span className="muted">{smart.data.words.join(", ")}</span>
            </span>
            <span className="btn btn-neon">Mulai</span>
          </a>
        )}

        <div className="grid" style={{ "--min": "320px" }}>
          <a className="tile-link" href="#/level">
            <img className="art" src={handImg("C")} alt="" />
            <span className="eyebrow">Level {level}, {doneWords} dari {current.words.length} kata</span>
            <strong className="display h-2">Eja jari</strong>
            <span className="muted" style={{ maxWidth: 220 }}>Tirukan huruf A–Z dan susun jadi kata.</span>
          </a>
          <a className="tile-link" href="#/main/nama">
            <img className="art" src={handImg("B")} alt="" />
            <span className="eyebrow">Personal</span>
            <strong className="display h-2">Eja namaku</strong>
            <span className="muted" style={{ maxWidth: 220 }}>Latih ejaan namamu sendiri: {user.name}.</span>
          </a>
          <a className="tile-link" href="#/kosakata">
            <video className="art" src={gerakVideo("terima kasih", 1)} muted loop autoPlay playsInline aria-hidden="true" style={{ borderRadius: 28, right: 14, bottom: 14, width: 140, height: 140, objectFit: "cover" }} />
            <span className="eyebrow">{stats.gerak.length}/10 kata</span>
            <strong className="display h-2">Kosakata gerak</strong>
            <span className="muted" style={{ maxWidth: 200 }}>Kata sehari-hari dengan animasi gerak dan penilaian kamera.</span>
          </a>
          <a className="tile-link" href="#/rangkai">
            <img className="art" src={handImg("W")} alt="" />
            <span className="eyebrow">Bebas</span>
            <strong className="display h-2">Rangkai kata</strong>
            <span className="muted" style={{ maxWidth: 220 }}>Ketik kata apa saja, lihat petunjuknya, lalu eja.</span>
          </a>
          <a className="tile-link" href="#/kamus">
            <span className="eyebrow">{stats.mastered.length}/26 dikuasai</span>
            <strong className="display h-2">Kamus A–Z</strong>
            <span className="muted" style={{ maxWidth: 220 }}>Lihat bentuk tangan setiap huruf kapan saja.</span>
            <span aria-hidden="true" className="display" style={{ position: "absolute", right: 22, bottom: 18, fontSize: "4rem", color: "var(--mint)" }}>A–Z</span>
          </a>
        </div>

        <Progresku stats={stats} goal={user.goal} level={level} />

        <div className="grid" style={{ "--min": "320px" }}>
          <section className="card stack" style={{ "--gap": "10px" }}>
            <h2 className="display h-3">Kelompokku</h2>
            {groups.length ? groups.map(g => <p key={g.id}><strong>{g.name}</strong>, pendamping {g.owner}</p>)
              : <p>Belum bergabung ke kelas. <a href="#/profil">Masukkan kode kelas</a> supaya pendamping bisa ikut menyemangati.</p>}
          </section>
          <section className="card stack" style={{ "--gap": "10px" }}>
            <h2 className="display h-3">Catatan dari pendamping</h2>
            {notes.length ? <blockquote style={{ margin: 0 }}><p style={{ fontSize: "1.1rem" }}>{notes[0].text}</p><span className="small muted">{notes[0].author}</span></blockquote>
              : <p className="muted">Belum ada catatan.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}

export function PilihLevel() {
  useEffect(() => warmUpCamera(), []);
  const progress = useLoad("/progres");
  const [picked, setPicked] = useState(null);
  const panel = useRef(null);
  useSwap(panel, picked, { y: 30, opacity: 0, scale: 0.97 });
  if (!progress.data) return <Loading error={progress.error} onRetry={progress.reload} dark />;
  const { stats } = progress.data;
  const top = unlockedLevel(stats.levelsDone);
  const sel = LEVELS[(picked ?? top) - 1];
  const open = sel.n <= top;
  const done = sel.words.filter(w => stats.words.includes(w)).length;
  return (
    <div className="screen bg-hijau on-dark">
      <header className="topbar"><Back to="beranda">Beranda</Back><Brand to="beranda" light /><a className="btn btn-outline-light btn-sm" href="#/kamus">Kamus A–Z</a></header>
      <main id="isi" className="container row grow" style={{ "--gap": "48px", paddingBottom: 48 }}>
        <section className="stack" style={{ flex: "1 1 360px", "--gap": "14px" }}>
          <h1 className="display h-hero" style={{ marginBottom: 12 }}>Pilih<br />level</h1>
          {LEVELS.map(l => {
            const on = l.n === sel.n;
            return (
              <button key={l.n} onClick={() => setPicked(l.n)} aria-pressed={on} className="row between"
                style={{ maxWidth: 420, minHeight: 66, padding: "0 28px", borderRadius: 999, fontFamily: "var(--display)", fontWeight: 800, fontSize: "1.6rem",
                  background: on ? "var(--krem)" : "transparent", color: on ? "var(--tua)" : "var(--krem)", border: "2px solid " + (on ? "var(--krem)" : "rgba(243,246,244,.55)") }}>
                <span>Level {l.n}</span>
                <span style={{ fontFamily: "var(--body)", fontSize: ".9rem", display: "inline-flex", gap: 6, alignItems: "center" }}>
                  {l.n > top ? <><Lock size={16} />Terkunci</> : stats.levelsDone.includes(l.n) ? <><Check size={16} />Selesai</> : "Terbuka"}
                </span>
              </button>
            );
          })}
        </section>
        <section ref={panel} className="stack on-light" aria-live="polite" style={{ flex: "999 1 520px", padding: 40, borderRadius: 28, background: "rgba(243, 246, 244, .96)", border: "1px solid var(--kaca-tepi)", boxShadow: "var(--bayang)", color: "var(--teks)", "--gap": "20px" }}>
          <span className="eyebrow">Level {sel.n}: {sel.name}</span>
          <p className="display green" style={{ fontSize: "3.2rem", letterSpacing: 10 }}>{sel.letters}</p>
          <div className="row" style={{ "--gap": "12px", flexWrap: "nowrap" }}>
            {Array.from(sel.letters).slice(0, 3).map(ch => (
              <span key={ch} style={{ flex: 1, height: 150, borderRadius: 24, background: "var(--mint)", display: "grid", placeItems: "center" }}>
                <img src={handImg(ch)} alt={"Contoh huruf " + ch} width="130" height="130" style={{ objectFit: "contain" }} />
              </span>
            ))}
          </div>
          <p className="muted">{sel.desc} {sel.words.length} kata latihan, 8 kata per putaran. Contoh: {sel.words.slice(0, 6).join(", ")}.</p>
          {open ? <>
            <div className="stack" style={{ "--gap": "6px" }}>
              <span className="small" style={{ fontWeight: 700 }}>{done}/{sel.words.length} kata pernah selesai</span>
              <div className="progress"><span style={{ width: (done / sel.words.length) * 100 + "%" }} /></div>
            </div>
            <a className="btn btn-primary btn-lg" style={{ alignSelf: "flex-start" }} href={"#/tangan/" + sel.n}>{done ? "Lanjut" : "Mulai"} Level {sel.n} <ArrowRight /></a>
          </> : <p className="chip" style={{ background: "var(--pasir)", alignSelf: "flex-start", padding: "14px 22px" }}><Lock /> Selesaikan Level {sel.n - 1} dulu untuk membuka level ini.</p>}
        </section>
      </main>
    </div>
  );
}

export function Tangan({ level }) {
  useEffect(() => warmUpCamera(), []);
  const { user, setUser } = useAuth();
  async function pick(hand) {
    if (hand !== user.hand) {
      const res = await api("/saya", { method: "PATCH", body: { hand } }).catch(() => null);
      if (res) setUser(res.user);
    }
    go("kamera/" + level);
  }
  return (
    <div className="screen bg-krem">
      <header className="topbar"><Back to="level">Pilih level</Back><span className="muted" style={{ fontWeight: 700 }}>Langkah 1 dari 2</span></header>
      <main id="isi" className="stack center grow" style={{ "--gap": "36px", padding: "0 24px 64px" }}>
        <div className="stack center" style={{ "--gap": "12px" }}>
          <h1 className="display h-1 green">Kamu kidal atau tidak?</h1>
          <p className="muted" style={{ maxWidth: 560 }}>Pilih tangan yang paling sering kamu pakai. Contoh tangan 3D akan dicerminkan supaya sama denganmu.</p>
        </div>
        <div className="row" style={{ "--gap": "28px", justifyContent: "center" }}>
          {[["kiri", "Tangan kiri", "var(--peach)", true], ["kanan", "Tangan kanan", "var(--mint)", false]].map(([key, label, bg, flip]) => (
            <button key={key} onClick={() => pick(key)} className="card stack center" style={{ width: 310, borderRadius: 40, border: "3px solid " + (user.hand === key ? "var(--hijau)" : "var(--garis)"), "--gap": "18px" }}>
              <span style={{ width: 210, height: 210, borderRadius: "50%", background: bg, display: "grid", placeItems: "center" }}>
                <img src={handImg("L")} alt="" width="180" height="180" style={{ objectFit: "contain", transform: flip ? "scaleX(-1)" : undefined }} />
              </span>
              <span className={"btn btn-lg " + (user.hand === key ? "btn-primary" : "btn-outline")} style={{ width: "100%" }}>{label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

export function SiapKamera({ level }) {
  useEffect(() => warmUpCamera(), []);
  const steps = [["Izinkan kamera", "Pilih Izinkan saat browser bertanya."],
    ["Cahaya cukup terang", "Jangan membelakangi jendela atau lampu."],
    ["Tunjukkan telapak tanganmu", "Angkat tangan di depan dada, semua jari terlihat."],
    ["Mundur sedikit", "Sampai kedua tangan muat di dalam bingkai."]];
  return (
    <div className="screen fit">
      <div className="split">
        <section className="half bg-kamera on-dark stack" style={{ padding: "clamp(16px, 3.4vh, 32px) 48px clamp(20px, 4vh, 48px)", "--gap": "clamp(12px, 2.6vh, 26px)" }}>
          <div className="row between"><Back to={"tangan/" + level}>Kembali</Back><span className="muted" style={{ fontWeight: 700 }}>Langkah 2 dari 2</span></div>
          <h1 className="display h-1">Siapkan<br />kameramu</h1>
          <ol className="stack" style={{ margin: 0, padding: 0, listStyle: "none", "--gap": "12px" }}>
            {steps.map(([t, d], i) => (
              <li key={t} className="row" style={{ flexWrap: "nowrap", padding: "14px 20px", borderRadius: 24, background: "rgba(243,246,244,.10)" }}>
                <span style={{ flex: "none", display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--kuning)", color: "var(--tua)", fontFamily: "var(--display)", fontWeight: 800 }}>{i + 1}</span>
                <span><strong>{t}</strong><br /><span className="muted small">{d}</span></span>
              </li>
            ))}
          </ol>
          <a className="btn btn-cream btn-lg" style={{ alignSelf: "flex-start" }} href={"#/main/" + level}>Mulai main <ArrowRight /></a>
          <a href="#/kamera-masalah" style={{ fontWeight: 700 }}>Kamera tidak muncul atau bermasalah?</a>
        </section>
        <section className="half" style={{ background: "var(--gelap)", display: "grid", placeItems: "center", padding: 32 }}>
          <div className="stack center" style={{ "--gap": "16px", color: "var(--krem)", maxWidth: 420 }}>
            <img src={handImg("C")} alt="Contoh tangan 3D huruf C" width="260" height="260" style={{ objectFit: "contain" }} />
            <p className="muted">Kamera menyala saat permainan dimulai. Semua pengenalan berjalan di perangkatmu, tidak ada gambar yang dikirim.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function KameraMasalah() {
  const items = [
    ["Izin kamera ditolak", "Browser butuh izinmu untuk memakai kamera. Gambar tetap diproses di perangkat ini.", ["Klik ikon gembok atau kamera di sebelah alamat web.", "Pilih Izinkan untuk Kamera.", "Muat ulang halaman ini."]],
    ["Tangan tidak terdeteksi", "Kamera butuh cahaya cukup dan seluruh jari terlihat di dalam bingkai.", ["Pindah ke tempat yang lebih terang.", "Mundur sedikit sampai kedua tangan masuk bingkai.", "Pakai latar polos kalau bisa."]],
    ["Model gagal dimuat", "ISYARA mengunduh model pengenal tangan sekali saja. Unduhan bisa gagal kalau sinyal lemah.", ["Periksa koneksi internet, lalu coba lagi.", "Setelah berhasil, unduh paket luring di Profil."]],
    ["Sedang tidak ada internet", "Kalau paket luring sudah diunduh, latihan tetap jalan. Progres dikirim saat tersambung lagi.", ["Pastikan paket luring sudah diunduh di Profil.", "Latihan seperti biasa.", "Sambungkan internet nanti untuk mengirim progres."]],
  ];
  const [i, setI] = useState(0);
  const [title, why, steps] = items[i];
  return (
    <div className="screen">
      <div className="split">
        <aside className="half bg-kamera on-dark stack" style={{ flex: "1 1 420px", padding: "32px 40px", "--gap": "18px" }}>
          <Back to="level">Pilih level</Back>
          <h1 className="display h-1">Ada kendala kamera?</h1>
          <div className="stack" role="group" aria-label="Jenis kendala" style={{ "--gap": "10px" }}>
            {items.map(([t], j) => (
              <button key={t} aria-pressed={i === j} onClick={() => setI(j)} style={{ textAlign: "left", padding: "16px 22px", borderRadius: 999, fontWeight: 700,
                background: i === j ? "var(--krem)" : "rgba(15,59,46,.45)", color: i === j ? "var(--tua)" : "var(--krem)", border: "2px solid " + (i === j ? "var(--krem)" : "rgba(243,246,244,.35)") }}>{t}</button>
            ))}
          </div>
        </aside>
        <section className="half bg-krem stack" aria-live="polite" style={{ flex: "999 1 600px", padding: 48, justifyContent: "center", "--gap": "20px" }}>
          <h2 className="display h-1 green">{title}</h2>
          <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 620 }}>{why}</p>
          <ol className="stack" style={{ margin: 0, padding: 0, listStyle: "none", maxWidth: 620, "--gap": "10px" }}>
            {steps.map((s, k) => <li key={s} className="card row" style={{ padding: "14px 20px", borderRadius: 24, flexWrap: "nowrap" }}><strong className="display">{k + 1}</strong>{s}</li>)}
          </ol>
          <div className="row"><a className="btn btn-primary btn-lg" href="#/level">Coba lagi</a><a className="btn btn-outline" href="#/kamus">Belajar tanpa kamera dulu</a></div>
        </section>
      </div>
    </div>
  );
}
