import React, { useEffect, useMemo, useState } from "react";
import { warmUpCamera } from "../lib/media";
import { canSpeak, speakWord } from "../lib/voice";
import { GERAK, TWO_HANDED } from "../../shared/levels.js";
import { Back, Brand, handImg, useAuth } from "../ui";

const MAX_WORDS = 6, MAX_LETTERS = 12;
const MOVING = new Set(["J", "Z"]);

// Everyday words: greetings, family, home and school.
const IDEAS = ["HALO", "PAGI", "MALAM", "IBU", "AYAH", "KAKAK", "ADIK", "MAKAN", "MINUM", "TIDUR", "GURU", "TEMAN", "BUKU"];

// Letters only, words split by spaces, limited so one round stays short.
function parse(text) {
  return text.toUpperCase().replace(/[^A-Z\s]/g, "").split(/\s+/).filter(Boolean)
    .map(w => w.slice(0, MAX_LETTERS)).slice(0, MAX_WORDS);
}

export function Rangkai({ query }) {
  const { user } = useAuth();
  useEffect(() => warmUpCamera(), []);
  const [text, setText] = useState(() => (query.get("kata") || "").replaceAll(",", " "));
  const words = useMemo(() => parse(text), [text]);
  const letters = words.join("");
  const twoHanded = [...new Set(letters)].filter(ch => TWO_HANDED.has(ch));
  const moving = [...new Set(letters)].filter(ch => MOVING.has(ch));
  const wordSigns = words.filter(w => GERAK.some(g => g.word.replace(" ", "") === w.toLowerCase()));
  const name = (user?.name || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, MAX_LETTERS);
  const add = w => setText(t => (parse(t).includes(w) ? t : (t.trim() + " " + w).trim()));
  const start = "#/main/rangkai?kata=" + words.join(",");

  return (
    <div className="screen bg-krem">
      <header className="topbar"><Back to="beranda">Beranda</Back><Brand /><span style={{ width: 90 }} /></header>
      <main id="isi" className="container stack" style={{ maxWidth: 1080, paddingBottom: 48, "--gap": "clamp(16px, 2.6vh, 26px)" }}>
        <div className="stack" style={{ "--gap": "8px" }}>
          <h1 className="display h-1 green">Mau mengeja apa?</h1>
          <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 620 }}>Ketik kata atau nama. ISYARA menunjukkan bentuk tangan setiap huruf, lalu kamu mengejanya satu per satu di depan kamera.</p>
        </div>

        <form className="card stack" style={{ "--gap": "16px" }} onSubmit={e => { e.preventDefault(); if (words.length) location.hash = start; }}>
          <label className="field" htmlFor="kata">Kata yang ingin dieja <small>Sampai {MAX_WORDS} kata, masing-masing paling banyak {MAX_LETTERS} huruf. Pisahkan dengan spasi.</small></label>
          <div className="row" style={{ "--gap": "12px" }}>
            <input id="kata" className="input display" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
              value={text} onChange={e => setText(e.target.value)} placeholder="Contoh: MAKAN NASI" maxLength={80}
              style={{ flex: 1, minWidth: 0, height: 68, fontSize: "clamp(1.3rem, 4vw, 1.8rem)", letterSpacing: 4, textTransform: "uppercase" }} />
            {canSpeak() && words.length > 0 && (
              <button type="button" className="btn btn-outline" onClick={() => speakWord(words.join(" "))} style={{ flex: "none" }}>Dengarkan</button>
            )}
          </div>
          <div className="stack" style={{ "--gap": "10px" }}>
            <span className="small muted" style={{ fontWeight: 700 }}>Ide kata</span>
            <div className="row" style={{ "--gap": "8px" }}>
              {name && <button type="button" className="btn btn-sm btn-primary" onClick={() => add(name)}>Namaku: {name}</button>}
              {IDEAS.map(w => (
                <button type="button" key={w} className="btn btn-sm btn-outline" aria-pressed={words.includes(w)} onClick={() => add(w)}>{w}</button>
              ))}
            </div>
          </div>
        </form>

        {words.length > 0 && (
          <section className="card stack" aria-labelledby="petunjuk-h" style={{ "--gap": "16px" }}>
            <div className="row between">
              <h2 id="petunjuk-h" className="display h-3">Petunjuk bentuk tangan</h2>
              <span className="small muted">{letters.length} huruf{twoHanded.length ? `, ${twoHanded.length} memakai dua tangan` : ""}{moving.length ? `, ${moving.join(" dan ")} bergerak` : ""}</span>
            </div>
            {words.map((w, wi) => (
              <div key={wi} className="stack" style={{ "--gap": "8px" }}>
                <strong className="display" style={{ fontSize: "1.3rem", letterSpacing: 3 }}>{w}</strong>
                <div className="row" style={{ "--gap": "8px" }}>
                  {Array.from(w).map((ch, i) => (
                    <figure key={i} style={{ margin: 0, width: 84, padding: "8px 6px", borderRadius: 18, background: "rgba(255,255,255,.75)", border: "1px solid var(--garis)", textAlign: "center" }}>
                      <img src={handImg(ch)} alt={"Bentuk tangan huruf " + ch} width="64" height="64" style={{ objectFit: "contain", display: "block", margin: "0 auto" }} loading="lazy" />
                      <figcaption className="display" style={{ fontSize: "1.3rem" }}>{ch}</figcaption>
                      {(TWO_HANDED.has(ch) || MOVING.has(ch)) && <span className="small" style={{ fontWeight: 700, color: "var(--hijau)" }}>{MOVING.has(ch) ? "gerak" : "2 tangan"}</span>}
                    </figure>
                  ))}
                </div>
              </div>
            ))}
            {wordSigns.length > 0 && (
              <p className="alert alert-ok"><strong>{wordSigns.join(", ")}</strong> juga punya isyarat kata sendiri. Selain dieja, kamu bisa mempelajarinya di <a href="#/kosakata">Kosakata gerak</a>.</p>
            )}
            <div className="row" style={{ "--gap": "14px" }}>
              <a className="btn btn-primary btn-lg" href={start}>Mulai eja dengan kamera</a>
              <span className="small muted" style={{ maxWidth: 380 }}>Di layar berikutnya, contoh tangan tampil di kiri. Tahan bentuknya sampai lingkaran kamera penuh, lalu huruf berikutnya muncul.</span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
