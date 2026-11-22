import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { CameraLab } from "./media";
import { alphabetImage } from "./learning";
import { twoHanded } from "./shape";

const levels = [
  ["MAKAN", "IBU", "BUKU"],
  ["AYAH", "SUSU", "ADIK"],
  ["KAKAK", "MAAF", "TEMAN", "BELAJAR"],
];

export function AlphabetPractice({ poses }) {
  const dialog = useRef(null);
  const opener = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) dialog.current.showModal();
  }, [open]);

  return <>
    <button ref={opener} className="primary" onClick={() => setOpen(true)}>
      {poses ? "Mulai latihan bentuk tangan" : "Latihan eja jari"}
    </button>
    <dialog ref={dialog} className="spellDialog" aria-label="Praktik BISINDO" onClose={() => {
      setOpen(false);
      opener.current?.focus();
    }}>
      {open && <AlphabetStage poses={poses} onClose={() => dialog.current.close()} />}
    </dialog>
  </>;
}

function AlphabetStage({ poses, onClose }) {
  const [level, setLevel] = useState(0);
  const [lesson, setLesson] = useState(0);
  const [index, advance] = useState(0);
  const [hint, say] = useState("Aktifkan kamera, lalu tirukan bentuk tangan pada contoh.");
  const hold = useRef({ since: null, frames: 0, release: false, misses: 0 });
  const title = useRef(null);
  const focusExercise = useRef(false);
  const word = poses ?? levels[level][lesson];
  const letter = word[index];
  const complete = !letter;
  const nextLevel = poses ? null : levels[level + 1];

  useEffect(() => {
    if (complete || focusExercise.current) {
      title.current?.focus();
      focusExercise.current = false;
    }
  }, [complete]);

  function begin(next, restart = false) {
    setLesson(next);
    advance(0);
    hold.current = { since: null, frames: 0, release: false, misses: 0 };
    focusExercise.current = restart;
    say(restart ? "Aktifkan kamera, lalu tirukan huruf pertama." : "Tirukan huruf pertama.");
  }

  function observe(candidate, handCount, now, contactNeeded) {
    const state = hold.current;
    if (!letter || state.accepted === index) return;
    if (state.release) {
      state.misses = candidate === letter ? 0 : state.misses + 1;
      if (state.misses >= 3) state.release = false;
      say("Lepaskan pose sebentar, lalu peragakan lagi untuk huruf yang berulang.");
      return;
    }
    if (candidate !== letter) {
      // Keep a nearly completed hold through one momentary tracking dropout.
      if (!candidate && handCount > 0 && !contactNeeded &&
        state.frames >= 2 && !state.trackingGap && now - state.lastMatch < 240) {
        state.trackingGap = true;
        return;
      }
      state.since = null;
      state.frames = 0;
      state.trackingGap = false;
      say(!handCount ? "Posisikan tangan di dalam bingkai." : twoHanded.has(letter) && handCount < 2 ? "Baru satu tangan terbaca. Miringkan sedikit kedua tangan agar jari dan pergelangan terlihat, sambil menjaga titik sentuh." : letter === "A" && contactNeeded ? "Satukan ujung kedua telunjuk dan kedua ibu jari." : candidate
        ? "Terbaca " + candidate + ". Coba bentuk " + letter + " seperti contoh."
        : "Bentuk huruf belum terbaca. Pastikan semua jari terlihat.");
      return;
    }
    state.since ??= now;
    state.frames++;
    state.lastMatch = now;
    say("Tahan sebentar…");
    if (state.frames < 4 || now - state.since < 500) return;
    hold.current = { since: null, frames: 0, accepted: index, release: word[index+1] === letter, misses: 0 };
    if (!poses && index+1 === word.length && lesson+1 < levels[level].length) {
      begin(lesson+1);
      say(word + " selesai. Tirukan huruf pertama kata berikutnya.");
      return;
    }
    advance(index+1);
    say(letter + " cocok.");
  }

  return <section className={"alphabetStage" + (complete ? " isComplete" : "")} aria-label={poses ? "Latihan bentuk tangan" : "Latihan eja kata"}>
    <div className="spellHead">
      <button autoFocus onClick={onClose}>Kembali</button>
      {complete ? <span className="spellFinishLabel">{poses ? "Latihan bentuk tangan" : "Latihan eja jari"}</span> : <>
      <div className="spellTitle"><small>{poses ? "TIRUKAN POSE" : `LEVEL ${level+1} · KATA ${lesson+1}/${levels[level].length}`}</small><h2 ref={title} tabIndex={-1}>{poses ? "Bentuk tangan" : word}</h2></div>
      <div className="spellLetters" aria-label={index+" dari "+word.length+" huruf selesai"}>
        {Array.from(word,(ch,i)=><span key={i} data-done={i<index} aria-current={i===index?"step":undefined}>{ch}</span>)}
      </div>
      </>}
    </div>
    {letter ? <div className="spellWorkspace">
      <div className="spellExample">
        <div className="alphabetPair" aria-live="polite">
          <img className="mirror" src={alphabetImage(letter)} alt={"Contoh tangan untuk huruf "+letter}/>
          <span>{letter}</span>
        </div>
          <p>{letter === "A" ? "Satukan telunjuk dan ibu jari di depan dada. Pastikan kedua tangan masuk bingkai." : letter === "C" ? "Bentuk bukaan dengan telunjuk dan ibu jari. Lipat tiga jari lainnya." : letter === "M" ? "Tempelkan tiga jari ke telapak yang terbuka."
            : letter === "N" ? "Tempelkan dua jari ke telapak yang terbuka."
            : letter === "D" ? "Tegakkan satu telunjuk. Sentuhkan ujung telunjuk dan ibu jari dari tangan yang melengkung ke sisi telunjuk itu."
            : letter === "J" ? "Untuk pose di kamera, luruskan kelingking ke samping dan lipat jari lainnya."
            : letter === "Y" ? "Pertahankan titik sentuh telunjuk seperti contoh dan perlihatkan kedua pergelangan."
            : twoHanded.has(letter) ? "Perhatikan posisi kedua tangan." : "Perhatikan posisi jari dan arah telapak."}</p>
      </div>
      <div className="spellCamera">
        <CameraLab alphabet expectedLetter={letter} onLetterFrame={observe}/>
        <p role="status">{hint}</p>
      </div>
    </div> : <div className="spellComplete">
      <div className="spellCheck" aria-hidden="true"><Check size={32} strokeWidth={2.5} /></div>
      <h2 ref={title} tabIndex={-1}>{poses ? "Latihan selesai" : nextLevel ? `Level ${level + 1} selesai` : "Semua level selesai"}</h2>
      <p className="spellSummary">{poses ? `${word.length} bentuk tangan berhasil ditirukan.` : nextLevel
        ? `${levels[level].length} kata berhasil dieja di level ini.`
        : `${levels.reduce((total, words) => total + words.length, 0)} kata berhasil dieja.`}</p>
      {!poses && <ol className="spellLevelTrack" aria-label="Progres level">
        {levels.map((_, step) => <li key={step} data-complete={step <= level}>
          {step <= level && <Check size={15} aria-hidden="true" />}
          <span>Level {step + 1}</span>
          <span className="spellVisuallyHidden">{step <= level ? " selesai" : " belum selesai"}</span>
        </li>)}
      </ol>}
      {nextLevel && <p className="spellNextWord">Kata berikutnya <strong>{nextLevel[0]}</strong></p>}
      <div className="spellFinishActions">
        {nextLevel ? <button className="primary" onClick={() => { setLevel(level + 1); begin(0, true); }}>
          Lanjut ke Level {level + 2} <ArrowRight size={18} aria-hidden="true" />
        </button> : <button className="primary" onClick={onClose}>Selesai <Check size={18} aria-hidden="true" /></button>}
        <button className="spellReplay" onClick={() => begin(0, true)}>
          <RotateCcw size={17} aria-hidden="true" /> {poses ? "Ulangi latihan" : "Ulangi level"}
        </button>
      </div>
    </div>}
  </section>;
}
