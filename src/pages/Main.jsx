import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { burst, countUp, gsap, rain, reduced, useSwap } from "../anim";
import { CameraLab } from "../lib/media";
import { describeHands, fingerFeedback } from "../lib/shape";
import { api, getPrefs, recordProgress, setPrefs } from "../api";
import { canSpeak, speakLetter, speakWord, stopSpeaking } from "../lib/voice";
import { Volume2, VolumeX } from "lucide-react";
import { LEVELS, SESSION_WORDS, TWO_HANDED, WORD_POINTS } from "../../shared/levels.js";
import { ArrowLeft, ArrowRight, Check, Loading, Spark, go, handImg, tipFor, useAuth } from "../ui";

const HOLD_FRAMES = 4;
const HOLD_MS = 500;

function wordsFor(id, query, user) {
  if (id === "nama") {
    const name = (user.name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
    return name.length ? [name] : ["ISYARA"];
  }
  if (id === "pintar" || id === "rangkai") {
    const list = (query.get("kata") || "").toUpperCase().split(",").map(w => w.replace(/[^A-Z]/g, "").slice(0, 12)).filter(Boolean);
    return list.length ? list.slice(0, 6) : LEVELS[0].words.slice(0, 3);
  }
  return null;
}

const shuffle = list => list.map(w => [Math.random(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
// A round takes words the learner has not finished yet first, then fills up with ones to review.
// Shorter words come first so each round starts easy.
function pickSession(pool, done) {
  const fresh = shuffle(pool.filter(w => !done.has(w)));
  const review = shuffle(pool.filter(w => done.has(w)));
  return [...fresh, ...review].slice(0, SESSION_WORDS).sort((a, b) => a.length - b.length);
}

export function Main({ id, query }) {
  const { user } = useAuth();
  const level = LEVELS.find(l => String(l.n) === id);
  const [words, setWords] = useState(() => level ? null : wordsFor(id, query, user));
  useEffect(() => {
    if (!level) return;
    let live = true;
    api("/progres").then(d => new Set(d.stats.words)).catch(() => new Set())
      .then(done => { if (live) setWords(pickSession(level.words, done)); });
    return () => { live = false; };
  }, [level]);
  if (!words) return <div className="screen bg-panel"><Loading /></div>;
  return <Game id={id} level={level} words={words} />;
}

const clock = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

function Game({ id, level, words }) {
  const { user } = useAuth();
  const title = level ? `Level ${level.n}, ${level.name}` : id === "nama" ? "Eja namaku" : id === "rangkai" ? "Rangkai kata" : "Latihan pintar";
  const exit = level ? "level" : id === "rangkai" ? "rangkai" : "beranda";
  const [voice, setVoice] = useState(() => canSpeak() && getPrefs().voice !== false);
  function toggleVoice() {
    const next = !voice;
    setVoice(next);
    setPrefs({ ...getPrefs(), voice: next });
    if (!next) stopSpeaking();
  }
  useEffect(() => stopSpeaking, []);

  const [wi, setWi] = useState(0);
  const [li, setLi] = useState(0);
  const [phase, setPhase] = useState("main");
  const [points, setPoints] = useState(0);
  const [hold, setHold] = useState(0);
  const [hint, setHint] = useState("Aktifkan kamera, lalu tirukan bentuk tangan pada contoh.");
  const [fingers, setFingers] = useState(null);
  const [handCount, setHandCount] = useState(0);
  const [result, setResult] = useState({ mastered: new Set(), skipped: new Set() });
  const [elapsed, setElapsed] = useState(0);

  const hold$ = useRef({ since: null, frames: 0, release: false, misses: 0, gap: false, lastMatch: 0 });
  const bank = useRef(null);
  const frame = useRef(0);
  const started = useRef(Date.now());
  const letterStart = useRef(Date.now());
  const marks = useRef([]);

  useEffect(() => { fetch("./alphabet.json").then(r => r.json()).then(b => { bank.current = b; }).catch(() => {}); }, []);
  useEffect(() => {
    if (phase === "selesai") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const word = words[wi];
  const letter = word?.[li];
  const nextWord = words[wi + 1];

  const handWrap = useRef(null);
  const row = useRef(null);
  const flashRef = useRef(null);
  const dialogRef = useRef(null);
  const finishRef = useRef(null);
  const [flash, setFlash] = useState(null);
  useSwap(handWrap, wi + ":" + li);
  useLayoutEffect(() => {
    const done = row.current?.children[li - 1];
    if (!done || reduced()) return;
    gsap.fromTo(done, { scale: 1.7, y: -14 }, { scale: 1, y: 0, duration: 0.55, ease: "back.out(3)" });
  }, [li]);
  useLayoutEffect(() => {
    if (!flash || !flashRef.current || reduced()) return;
    const tl = gsap.timeline()
      .fromTo(flashRef.current, { scale: 0.3, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.35, ease: "back.out(2.2)" })
      .to(flashRef.current, { scale: 1.15, opacity: 0, duration: 0.35, delay: 0.35 });
    return () => tl.kill();
  }, [flash]);
  useLayoutEffect(() => {
    if (phase !== "kata" || !dialogRef.current || reduced()) return;
    const q = gsap.utils.selector(dialogRef);
    const tl = gsap.timeline({ defaults: { ease: "back.out(1.8)" } })
      .from(dialogRef.current, { opacity: 0, duration: 0.25, ease: "power1.out" })
      .from(q(".k-check"), { scale: 0, rotate: -120, duration: 0.5 })
      .from(q(".k-title"), { y: 30, opacity: 0, duration: 0.4 }, "-=0.2")
      .from(q(".k-next span"), { y: 80, opacity: 0, rotate: () => gsap.utils.random(-25, 25), duration: 0.5, stagger: 0.07 }, "-=0.1")
      .from(q(".k-tile"), { scale: 0, duration: 0.4, stagger: 0.06 }, "-=0.3")
      .from(q(".k-rest"), { y: 16, opacity: 0, duration: 0.3, stagger: 0.06 }, "-=0.2");
    burst(q(".k-check")[0], 26);
    return () => tl.kill();
  }, [phase]);
  useEffect(() => {
    if (phase !== "selesai") return;
    const stop = rain();
    countUp(finishRef.current, points, 1.6);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function advance(status) {
    const seconds = Math.round((Date.now() - letterStart.current) / 1000);
    const okFingers = fingers?.filter(f => f.ok).length ?? 4;
    recordProgress({ type: "huruf", letter, status, seconds, match: status === "kuasai" ? 60 + okFingers * 8 : 0 });
    marks.current[li] = status;
    setResult(r => {
      const mastered = new Set(r.mastered), skipped = new Set(r.skipped);
      if (status === "kuasai") { mastered.add(letter); skipped.delete(letter); } else if (!mastered.has(letter)) skipped.add(letter);
      return { mastered, skipped };
    });
    letterStart.current = Date.now();
    hold$.current = { since: null, frames: 0, release: word[li + 1] === letter, misses: 0, gap: false, lastMatch: 0 };
    setHold(0);
    setFingers(null);
    if (status === "kuasai") speakLetter(letter);
    if (li + 1 < word.length) {
      setLi(li + 1);
      setHint(status === "kuasai" ? `${letter} cocok! Lanjut ke ${word[li + 1]}.` : `Huruf ${letter} dilewati.`);
      return;
    }
    speakWord(word);
    const gained = word.length * WORD_POINTS;
    setPoints(p => p + gained);
    recordProgress({ type: "kata", word });
    if (wi + 1 < words.length) setPhase("kata");
    else {
      if (level) recordProgress({ type: "level", level: level.n });
      setPhase("selesai");
    }
  }

  function observe(candidate, hands, now, contactNeeded, detection) {
    if (phase !== "main" || !letter) return;
    if (hands !== handCount) setHandCount(hands);
    if (hands && bank.current && ++frame.current % 3 === 0) setFingers(fingerFeedback(describeHands(detection), bank.current, letter));
    const s = hold$.current;
    if (s.release) {
      s.misses = candidate === letter ? 0 : s.misses + 1;
      if (s.misses >= 3) s.release = false;
      setHint("Lepaskan pose sebentar, lalu peragakan lagi untuk huruf yang berulang.");
      return;
    }
    if (candidate !== letter) {
      // Keep a nearly finished hold through one momentary tracking dropout.
      if (!candidate && hands > 0 && !contactNeeded && s.frames >= 2 && !s.gap && now - s.lastMatch < 240) { s.gap = true; return; }
      s.since = null; s.frames = 0; s.gap = false;
      setHold(0);
      setHint(!hands ? "Posisikan tangan di dalam bingkai."
        : TWO_HANDED.has(letter) && hands < 2 ? "Baru satu tangan terbaca. Perlihatkan kedua tangan dan pergelangannya."
        : letter === "A" && contactNeeded ? "Satukan ujung kedua telunjuk dan kedua ibu jari."
        : candidate ? `Terbaca ${candidate}. Coba bentuk ${letter} seperti contoh.`
        : "Bentuk huruf belum terbaca. Pastikan semua jari terlihat.");
      return;
    }
    s.since ??= now;
    s.frames++;
    s.lastMatch = now;
    setHold(Math.round(Math.min(1, s.frames / HOLD_FRAMES, (now - s.since) / HOLD_MS) * 100));
    setHint("Hampir! Tahan sebentar…");
    if (s.frames >= HOLD_FRAMES && now - s.since >= HOLD_MS) {
      burst(handWrap.current);
      setFlash({ letter, n: Date.now() });
      advance("kuasai");
    }
  }

  function nextWordStart() {
    marks.current = [];
    setWi(wi + 1); setLi(0); setPhase("main"); letterStart.current = Date.now();
    hold$.current = { since: null, frames: 0, release: false, misses: 0, gap: false, lastMatch: 0 };
    setHint("Tirukan huruf pertama.");
  }
  function restart() {
    marks.current = [];
    setWi(0); setLi(0); setPoints(0); setPhase("main"); setResult({ mastered: new Set(), skipped: new Set() });
    started.current = Date.now(); letterStart.current = Date.now(); setElapsed(0);
  }

  if (phase === "selesai") {
    const nextLevel = level && LEVELS[level.n];
    return (
      <div className="screen bg-selesai on-dark stack center" style={{ "--gap": "26px", padding: "48px 24px" }}>
        <span className="eyebrow">{title}</span>
        <h1 className="display accent" style={{ fontSize: "clamp(4rem, 12vw, 9rem)" }}>Hebat!</h1>
        <p className="display" style={{ fontSize: "2.6rem" }}>+<span ref={finishRef}>{points}</span> poin</p>
        <p className="muted" style={{ fontSize: "1.15rem", maxWidth: 540 }}>{words.length} kata selesai dalam {clock(elapsed)}.{nextLevel ? ` Level ${nextLevel.n} sekarang terbuka.` : ""}</p>
        {result.mastered.size > 0 && <div className="stack center" style={{ "--gap": "10px" }}>
          <strong>Huruf yang kamu kuasai</strong>
          <div className="row" style={{ justifyContent: "center", "--gap": "8px" }}>
            {[...result.mastered].sort().map(ch => <span key={ch} className="letter" style={{ width: 56, height: 60, background: "var(--krem)", color: "var(--hijau)" }}>{ch}</span>)}
            {[...result.skipped].sort().map(ch => <span key={ch} className="letter" aria-label={ch + ", sempat dilewati"} style={{ width: 56, height: 60, background: "transparent", color: "var(--kuning)", border: "3px dashed var(--oranye)" }}>{ch}</span>)}
          </div>
          {result.skipped.size > 0 && <span className="small muted">Garis putus-putus = sempat dilewati. Coba lagi nanti.</span>}
        </div>}
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn btn-outline-light btn-lg" onClick={restart}>Main lagi</button>
          {nextLevel ? <a className="btn btn-kuning btn-lg" href={"#/tangan/" + nextLevel.n}>Level {nextLevel.n} <ArrowRight /></a>
            : id === "rangkai" ? <a className="btn btn-kuning btn-lg" href="#/rangkai">Eja kata lain <ArrowRight /></a>
            : <a className="btn btn-kuning btn-lg" href="#/beranda">Ke beranda <ArrowRight /></a>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen fit">
      <div className="split">
        <section className="half bg-panel stack" aria-label="Contoh huruf" style={{ overflow: "hidden" }}>
          <div className="topbar" style={{ position: "relative", zIndex: 2 }}>
            <a className="back" href={"#/" + exit}><ArrowLeft />Keluar</a>
            <span className="muted" style={{ fontWeight: 700 }}>{title}. Kata {wi + 1} dari {words.length}</span>
          </div>
          <div className="grow" style={{ position: "relative", display: "grid", placeItems: "center", minHeight: 220 }}>
            <span className="big-letter" aria-hidden="true">{letter}</span>
            <span ref={handWrap} style={{ position: "relative", display: "grid", placeItems: "center", width: "min(420px, 80%, 44vh)" }}>
              <img className={"hand-img" + (user.hand === "kiri" ? " flip" : "")} style={{ width: "100%" }} src={handImg(letter)} alt={"Contoh tangan 3D untuk huruf " + letter} />
            </span>
            <span className="display" style={{ position: "absolute", left: 32, top: 8, display: "grid", placeItems: "center", width: 92, height: 92, borderRadius: 28, background: "var(--hijau)", color: "var(--krem)", fontSize: "3.6rem" }}>{letter}</span>
            {TWO_HANDED.has(letter) && <span className="chip chip-peach" style={{ position: "absolute", left: 32, top: 112 }}>Dua tangan</span>}
          </div>
          <p className="muted" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto", padding: "0 24px", position: "relative" }}>{tipFor(letter)}</p>
          <div className="stack center" style={{ padding: "clamp(12px, 2.2vh, 22px) 24px clamp(16px, 3vh, 30px)", "--gap": "clamp(10px, 1.8vh, 16px)", position: "relative" }}>
            <div ref={row} className="word-row" aria-label={`Kata ${word}, huruf ${li + 1} dari ${word.length}`}>
              {Array.from(word).map((ch, i) => <span key={i} className={"ch" + (i < li ? " done" : i === li ? " now" : "")}>{ch}<i /></span>)}
            </div>
            <button className="btn btn-outline" onClick={() => advance("lewati")}>Lewati huruf</button>
          </div>
        </section>

        <section className="half" aria-label="Kamera" style={{ minHeight: 520 }}>
          <CameraLab alphabet autoStart expectedLetter={letter} onLetterFrame={observe} />
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", transition: "box-shadow .15s ease", boxShadow: `inset 0 0 0 ${Math.round(hold / 100 * 10)}px rgba(139,232,193,${(hold / 100).toFixed(2)})` }} />
          {flash && (
            <div key={flash.n} ref={flashRef} aria-hidden="true" style={{ position: "absolute", left: "50%", top: "42%", zIndex: 4, marginLeft: -90, marginTop: -90, width: 180, height: 180, borderRadius: "50%", background: "var(--neon)", color: "var(--tua)", display: "grid", placeItems: "center", opacity: 0, pointerEvents: "none" }}>
              <span className="display" style={{ fontSize: "4.4rem", display: "flex", alignItems: "center", gap: 6 }}>{flash.letter}<Check size={54} /></span>
            </div>
          )}
          <div className="overlay-top on-dark">
            <span className="row" style={{ "--gap": "8px" }}>
              <span className="chip chip-glass">{clock(elapsed)}</span>
              {canSpeak() && <button className="chip chip-glass" aria-pressed={voice} onClick={toggleVoice} title="Sebut huruf dan kata dengan suara" style={{ cursor: "pointer" }}>
                {voice ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}{voice ? "Suara nyala" : "Suara mati"}
              </button>}
            </span>
            <span className="display" style={{ fontSize: "1.6rem", color: "var(--kuning)" }}>{points} poin</span>
            <span className="chip chip-glass small">Diproses di perangkat</span>
          </div>
          <div className="overlay-bottom">
            <div className="row between" style={{ padding: "14px 20px", borderRadius: 24, background: "var(--krem)", flexWrap: "nowrap" }}>
              <span role="status" style={{ fontWeight: 700 }}>{hint}</span>
              <span className="display" style={{ fontSize: "1.6rem", color: "var(--hijau)" }}>{hold}%</span>
            </div>
            <div className="progress" style={{ background: "rgba(243,246,244,.2)" }} aria-hidden="true"><span style={{ width: hold + "%", background: hold > 60 ? "var(--neon)" : "var(--kuning)" }} /></div>
            {fingers && handCount > 0 && <>
              <span className="chip" style={{ alignSelf: "flex-start", background: "var(--neon)", color: "var(--tua)" }}><Spark size={16} />Pelatih AI · posisi tiap jari (perkiraan)</span>
              <div className="fingers">
                {fingers.map(f => <span key={f.name} className={f.ok ? "" : "fix"}>{f.name}<small>{f.ok ? "Pas" : "Betulkan"}</small></span>)}
              </div>
            </>}
          </div>
        </section>
      </div>

      {phase === "kata" && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="kata-selesai" className="bg-hijau on-dark stack center" style={{ position: "fixed", inset: 0, zIndex: 20, "--gap": "clamp(12px, 2.4vh, 22px)", padding: 24, overflowY: "auto" }}>
          <span className="k-check" style={{ display: "grid", placeItems: "center", width: 80, height: 80, borderRadius: "50%", background: "var(--kuning)", color: "var(--tua)" }}><Check size={44} /></span>
          <h2 id="kata-selesai" className="display h-1 k-title">{word} selesai! <span className="accent">+{word.length * WORD_POINTS}</span></h2>
          <div className="row k-rest" aria-label={"Huruf kata " + word} style={{ justifyContent: "center", "--gap": "8px" }}>
            {Array.from(word).map((ch, i) => {
              const skipped = marks.current[i] === "lewati";
              return <span key={i} className="letter" aria-label={ch + (skipped ? ", dilewati" : ", benar")} style={{ width: 56, height: 60, background: skipped ? "transparent" : "var(--neon)", color: skipped ? "var(--kuning)" : "var(--tua)", border: skipped ? "3px dashed var(--oranye)" : "3px solid transparent" }}>{ch}</span>;
            })}
          </div>
          <section className="card k-rest stack center" aria-label={"Kata berikutnya " + nextWord} style={{ width: "100%", maxWidth: 520, padding: "18px 24px", "--gap": "10px" }}>
            <span className="small" style={{ fontWeight: 700, color: "var(--neon)" }}>Kata berikutnya</span>
            <p className="display k-next" aria-hidden="true" style={{ fontSize: "clamp(2.2rem, 5vw, 3.2rem)", letterSpacing: 8, color: "var(--krem)" }}>
              {Array.from(nextWord).map((ch, i) => <span key={i} style={{ display: "inline-block" }}>{ch}</span>)}
            </p>
            <div className="row" style={{ justifyContent: "center", "--gap": "8px" }}>
              {Array.from(nextWord).map((ch, i) => (
                <span key={i} className="k-tile" style={{ width: 68, height: 68, borderRadius: 18, background: "var(--krem)", display: "grid", placeItems: "center" }}>
                  <img src={handImg(ch)} alt={"Huruf " + ch} width="56" height="56" style={{ objectFit: "contain" }} />
                </span>
              ))}
            </div>
          </section>
          <div className="stack k-rest" style={{ width: "100%", maxWidth: 460, "--gap": "8px" }}>
            <div className="row between small" style={{ fontWeight: 700 }}><span>{wi + 1} dari {words.length} kata selesai</span><span>{points} poin</span></div>
            <div className="progress"><span style={{ width: ((wi + 1) / words.length) * 100 + "%", background: "var(--kuning)" }} /></div>
          </div>
          <button className="btn btn-cream btn-lg k-rest" autoFocus onClick={nextWordStart}>Lanjut ke {nextWord}</button>
          <button className="back k-rest" onClick={() => go(exit)}>Istirahat dulu</button>
        </div>
      )}
    </div>
  );
}
