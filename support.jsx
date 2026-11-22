import React, { useRef, useState } from "react";
import { getLocal, saveLocal } from "./data";
import { CameraLab } from "./media";
export function Interpreter() {
  const [link, save] = useState(() => getLocal("interpreter", "")),
    [input, set] = useState(link),
    [msg, note] = useState("");
  function submit(e) {
    e.preventDefault();
    try {
      const url = new URL(input);
      if (url.protocol !== "https:") throw Error();
      saveLocal("interpreter", url.href);
      save(url.href);
      note("Kontak pendamping tersimpan.");
    } catch {
      note("Masukkan tautan ruang video HTTPS yang diberikan pendamping.");
    }
  }
  return (
    <section className="sheet">
      <h2>Hubungi juru bahasa isyarat</h2>
      <p>
        Gunakan ruang video yang diberikan JBI atau sekolahmu. Ketersediaan
        pendamping dikonfirmasi langsung oleh sekolah.
      </p>
      {link && (
        <a
          className="externalLink"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ruang video JBI <span>↗ Tab baru</span>
        </a>
      )}
      <form onSubmit={submit}>
        <label>
          Tautan pertemuan dari sekolah
          <input
            type="url"
            required
            value={input}
            onChange={(e) => set(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <button>Simpan kontak</button>
      </form>
      <p role="status">{msg}</p>
    </section>
  );
}
export function Flashcards({ words, terms }) {
  const [i, next] = useState(0),
    [shown, show] = useState(false),
    items = terms.filter((x) => words.includes(x[0]));
  if (!items.length) return null;
  const current = items[i % items.length];
  return (
    <section className="sheet">
      <h2>Kartu kamus saya</h2>
      <small>
        {1 + (i % items.length)} / {items.length}
      </small>
      <h3>{current[0]}</h3>
      {shown && <p>{current[1]}</p>}
      <div className="controls">
        <button onClick={() => show(!shown)}>
          {shown ? "Tutup arti" : "Lihat arti"}
        </button>
        <button
          onClick={() => {
            next(i + 1);
            show(false);
          }}
        >
          Kartu berikutnya
        </button>
      </div>
    </section>
  );
}
export function Pronunciation() {
  const [sound, choose] = useState("p");
  const [phase, setPhase] = useState(0);
  const [camera, showCamera] = useState(false);
  const [feedback, setFeedback] = useState("");
  const sampleAt = useRef(0);
  const guide = {
    p: ["Rapatkan bibir", "Lepaskan bibir", "pa · pi · pu"],
    b: ["Rapatkan bibir", "Lepaskan bibir sambil bersuara", "ba · bi · bu"],
    m: [
      "Rapatkan bibir",
      "Pertahankan bibir tertutup saat membunyikan m",
      "ma · mi · mu",
    ],
  };
  const closed = phase === 0 || sound === "m";
  const nasal = phase === 1 && sound === "m";
  const voiced = phase === 1 && sound !== "p";
  function observe(points, scores, _edges, time) {
    if (!points) { setFeedback("Wajah belum terbaca."); return; }
    if (time - sampleAt.current < 160) return;
    sampleAt.current = time;
    const lipGap = Math.hypot(points[13].x - points[14].x, points[13].y - points[14].y);
    const lipWidth = Math.hypot(points[61].x - points[291].x, points[61].y - points[291].y);
    if (lipWidth <= 0) return;
    const gap = lipGap / lipWidth;
    setFeedback(closed
      ? (gap < .06 ? "Bibir tampak rapat." : "Coba rapatkan bibir.")
      : (gap > .075 ? "Bibir tampak terbuka." : "Coba lepaskan bibir."));
  }
  return (
    <section className="sheet">
      <h2>Amati gerak bibir</h2>
      <div className="tabs">
        {Object.keys(guide).map((k) => (
          <button key={k} aria-pressed={sound === k} onClick={() => { choose(k); setPhase(0); setFeedback(""); }}>
            /{k}/
          </button>
        ))}
      </div>
      <div className="toolSwitch" role="group" aria-label="Tahap artikulasi">
        {["Posisi awal", "Saat bunyi"].map((label, index) => <button key={label} aria-pressed={phase === index} onClick={() => { setPhase(index); setFeedback(""); }}>{label}</button>)}
      </div>
      <p><strong>{guide[sound][phase]}</strong> · {guide[sound][2]}</p>
      <div className="articulationViews">
        <figure>
          <figcaption>Tampak depan</figcaption>
          <svg viewBox="0 0 200 142" role="img" aria-label={closed ? "Skema bibir tertutup" : "Skema bibir terbuka"}>
            <path d={closed ? "M40 71 Q68 52 88 59 L100 63 L112 59 Q132 52 160 71 Q103 103 40 71Z" : "M40 68 Q70 45 100 56 Q130 45 160 68 Q145 106 100 106 Q55 106 40 68Z"} fill="var(--speech-lip)" stroke="currentColor" strokeWidth="2" />
            <path d={closed ? "M40 71 Q100 76 160 71" : "M56 70 Q98 62 144 70 Q132 91 100 91 Q68 91 56 70Z"} fill={closed ? "none" : "currentColor"} stroke="currentColor" strokeWidth="2" />
          </svg>
        </figure>
        <figure>
          <figcaption>Penampang samping</figcaption>
          <svg viewBox="0 0 230 142" role="img" aria-label={nasal ? "Skema udara keluar melalui hidung" : voiced ? "Skema pita suara bergetar" : "Skema rongga mulut dan saluran udara"}>
            <path d="M185 16 Q124 0 62 25 L44 49 L31 51 Q23 55 39 59 L38 69 M38 79 Q43 113 80 116 L94 138 M185 16 Q210 55 183 95 L174 137" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            <path d="M37 58 Q78 29 114 48 Q141 61 146 99 L146 132 M39 68 Q89 53 116 63" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M50 89 Q70 67 106 86 Q126 95 139 103 Q95 115 50 89Z" fill="var(--speech-lip)" stroke="currentColor" />
            <path d={closed ? "M33 68 Q49 74 33 80" : "M32 68 L44 72 M34 88 L48 85"} fill="none" stroke="var(--speech-lip)" strokeWidth="5" strokeLinecap="round" />
            {phase === 1 && <path d={nasal ? "M150 127 Q137 50 42 53 L24 55 M33 49 L24 55 L35 59" : "M150 127 Q127 72 43 77 L16 77 M27 72 L16 77 L27 83"} fill="none" stroke="var(--switch-active)" strokeWidth="3" strokeDasharray="5 3" />}
            {voiced && <path d="M136 119 L142 114 L148 123 L155 114 L161 119" fill="none" stroke="var(--speech-lip)" strokeWidth="3" />}
          </svg>
        </figure>
      </div>
      {phase === 1 && <p>{nasal ? "Udara mengalir lewat hidung." : "Udara keluar lewat mulut."} {voiced ? "Rasakan getaran dengan menyentuhkan tangan dengan lembut ke leher." : "Bunyi ini dilatih tanpa getaran pita suara."}</p>}
      <button aria-expanded={camera} onClick={() => { showCamera(!camera); setFeedback(""); }}>{camera ? "Tutup latihan kamera" : "Coba posisi bibir di kamera"}</button>
      {camera && <><CameraLab faceOnly onFaceFrame={observe} /><p role="status">{feedback || "Aktifkan kamera untuk melihat posisi bibir."}</p></>}
      <p>Skema menunjukkan posisi target. Kamera membantu mengamati buka-tutup bibir. Gunakan panduan terapis untuk memilih latihan.</p>
    </section>
  );
}
