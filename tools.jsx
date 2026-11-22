import { FacePractice } from "./facepractice";
import { AlphabetPractice } from "./alphabetstage";
import { hasWordPractice, WordPractice, WordReplay } from "./wordpractice";
import { alphabetImage, AlphabetQuiz, Fingerspell, OnlineLesson, SigningLibrary } from "./learning";
import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Download,
  Volume2,
  Plus,
  Trash2,
  Check,
  Hand,
  Users,
  ChevronRight,
} from "lucide-react";
import { family, terms, simplify, scopedKey } from "./data";
import { AccountProgress, useAccount } from "./account";
import { useSaved, nav } from "./app";
import { Vocabulary } from "./vocabulary";
import { Interpreter, Flashcards, Pronunciation } from "./support";
import { LocalVoice } from "./offlinevoice";
import { Room } from "./room";
import { ImportReading } from "./imports";
import { CameraLab, Meter, useDictate } from "./media";
import { ConceptFigure } from "./figure";
const now = () => new Date().toLocaleString("id-ID");
function ToolSwitch({ label, options, value, onChange }) {
  return <div className="toolSwitch" role="group" aria-label={label}>
    {options.map(option => <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>{option}</button>)}
  </div>;
}
function download(name, str, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([str], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Speak({ text }) {
  const [notice, say] = useState("");
  const [rate, setRate] = useState(1), [volume, setVolume] = useState(1);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return (
    <>
      <button
        disabled={!text.trim()}
        onClick={() => {
          if (!window.speechSynthesis) {
            say("Suara sintetis tidak tersedia.");
            return;
          }
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "id-ID";
          u.rate = rate;
          u.volume = volume;
          u.onerror = () => say("Suara tidak tersedia pada perangkat ini.");
          speechSynthesis.speak(u);
        }}
      >
        <Volume2 size={16} />
        Bacakan
      </button>
      <details><summary>Pengaturan suara</summary>
        <label>Kecepatan baca {rate}×<input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e=>setRate(Number(e.target.value))} /></label>
        <label>Volume {Math.round(volume*100)}%<input type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} /></label>
      </details>
      <span role="status">{notice}</span>
    </>
  );
}
function Bridge() {
  const [method, mode] = useState("Alfabet");
  const [view, show] = useState("Pesan untuk guru");
  const [uncertain, countUncertain] = useState(0);
  const [draft, set] = useState(""),
    [sent, send] = useState(""),
    [phrases, save] = useSaved("phrases", [
      "Tolong ulangi.",
      "Saya ingin bertanya.",
      "Boleh ke toilet?",
    ]),
    [info, note] = useState("");
  return (
    <>
      <ToolSwitch label="Bagian Jembatan Isyarat" options={["Pesan untuk guru", "Ruang kelas", "Panduan alfabet", "Juru bahasa isyarat"]} value={view} onChange={show} />
      {view === "Pesan untuk guru" && <div className="bridgeWorkspace">
      <section className="sheet bridgeCamera" aria-labelledby="bridge-camera-title">
        <h2 id="bridge-camera-title">Kamera isyarat</h2>
        <div className="bridgeCameraModes" role="group" aria-label="Mode deteksi kamera">
          {["Alfabet", "10 kata BISINDO", "Kosakata lokal"].map((x) => (
            <button key={x} aria-pressed={method === x} onClick={() => { if (x !== method) countUncertain(0); mode(x); }}>
              {x}
            </button>
          ))}
        </div>
        <CameraLab
          key={method}
          alphabet={method === "Alfabet"}
          recognizeWords={method === "10 kata BISINDO"}
          onUncertain={() => countUncertain(count => count + 1)}
          onMatch={v => {
            countUncertain(0);
            set(x => (method === "Alfabet" ? x + v : [x.trimEnd(), v].filter(Boolean).join(" ")).slice(0, 500));
          }}
        />
        {uncertain >= 2 && <div className="toolSection">
          <p role="status">Kamera beberapa kali ragu. Kamu bisa mengetik pesan atau membuka bantuan JBI.</p>
          <button onClick={() => show("Juru bahasa isyarat")}>Buka bantuan JBI</button>
        </div>}
      </section>
      <div className="sheet">
        <h2>Pesan untuk guru</h2>
        <div className="controls">
          {phrases.map((x) => (
            <button key={x} onClick={() => set(x)}>
              {x}
            </button>
          ))}
        </div>
        <label>
          Periksa teks sebelum ditampilkan
          <textarea
            value={draft}
            onChange={(e) => set(e.target.value)}
            maxLength={500}
          />
        </label>
        <div className="controls">
          <button
            className="primary"
            disabled={!draft.trim()}
            onClick={() => {
              send(draft.trim());
              note("");
            }}
          >
            Tampilkan pesan
          </button>
          <button
            disabled={
              !draft.trim() ||
              phrases.includes(draft.trim()) ||
              phrases.length >= 20
            }
            onClick={() => {
              save([...phrases, draft.trim()]);
              note("Frasa tersimpan.");
            }}
          >
            Simpan frasa
          </button>
        </div>
        <span role="status">{info}</span>
        {sent && (
          <blockquote>
            {sent}
            <br />
            <Speak text={sent} />
            <button onClick={() => show("Ruang kelas")}>Buka ruang untuk kirim pesan</button>
          </blockquote>
        )}
      </div>
      </div>}
      {view === "Ruang kelas" && <>
        <Room message={sent} standalone />
        <a className="relatedLink" href="#class">Buka Transkrip Kelas →</a>
      </>}
      {view === "Panduan alfabet" && <AlphabetGuide />}
      {view === "Juru bahasa isyarat" && <Interpreter />}
    </>
  );
}
function AlphabetGuide() {
  const [letter, set] = useState("A");
  return (
    <section className="sheet">
      <h2>Contoh alfabet BISINDO A–Z</h2>
      <AlphabetPractice />
      <div className="alphabetPicker" role="group" aria-label="Pilih huruf">
        {Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", x => <button key={x} aria-pressed={letter === x} onClick={() => set(x)}>{x}</button>)}
      </div>
        <img
          style={{ width: 300, maxWidth: "100%", height: "auto" }}
          src={alphabetImage(letter)}
          alt={"Contoh konfigurasi tangan untuk huruf " + letter}
        />
    </section>
  );
}
function VideoLesson({ id, reference }) {
  const clipKey = scopedKey(id);
  const [url, set] = useState(""),
    [msg, say] = useState(""),
    [mirror, flip] = useState(false),
    [speed, rate] = useState(1);
  const ref = useRef(),
    db = useRef(),
    version = useRef(0),
    object = useRef("");
  function show(file) {
    URL.revokeObjectURL(object.current);
    object.current = file ? URL.createObjectURL(file) : "";
    set(object.current);
  }
  useEffect(() => {
    let current = true;
    const req = indexedDB.open("isyara-media", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("clips");
    req.onsuccess = () => {
      if (!current) {
        req.result.close();
        return;
      }
      db.current = req.result;
      const read = db.current.transaction("clips").objectStore("clips").get(clipKey);
      read.onsuccess = () => {
        if (current) show(read.result);
      };
    };
    req.onerror = () => say("Penyimpanan video tidak tersedia.");
    return () => {
      current = false;
      db.current?.close();
      URL.revokeObjectURL(object.current);
    };
  }, [clipKey]);
  function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("video/") || file.size > 30 * 1024 * 1024) {
      say("Pilih video hingga 30 MB.");
      return;
    }
    if (!db.current) {
      say("Penyimpanan belum siap.");
      return;
    }
    const tx = db.current.transaction("clips", "readwrite");
    tx.objectStore("clips").put(file, clipKey);
    tx.oncomplete = () => {
      show(file);
      say("Video tersimpan pada perangkat ini.");
    };
    tx.onabort = () => say("Video gagal disimpan. Periksa ruang tersedia.");
  }
  return (
    <div className="sheet">
      <h2>Video isyarat pengajar</h2>
      {!url && reference && <OnlineLesson video={reference.video} title={reference.title} />}
      {url ? (
        <video
          className={"lessonVideo " + (mirror ? "mirror" : "")}
          ref={ref}
          controls
          src={url}
          playsInline
          onLoadedMetadata={() => (ref.current.playbackRate = speed)}
        />
      ) : (
        <p>
          Pilih video pengajar untuk latihan ini, atau pelajari contoh dari
          kamus BISINDO. Video pilihan tersimpan di perangkat ini.
        </p>
      )}
      <div className="controls">
        <label className="file">
          Pilih video
          <input type="file" accept="video/*" onChange={upload} />
        </label>
        {url && (
          <>
            <button
              onClick={() => {
                const v = speed === 1 ? 0.5 : 1;
                rate(v);
                ref.current.playbackRate = v;
              }}
            >
              Kecepatan {speed}×
            </button>
            <button aria-pressed={mirror} onClick={() => flip(!mirror)}>
              Cermin
            </button>
          </>
        )}
      </div>
      <a className="externalLink" href="https://isyaratku.com/" target="_blank" rel="noreferrer">Kamus BISINDO <span>↗ Tab baru</span></a>
      <small role="status">{msg}</small>
    </div>
  );
}
export { VideoLesson };
function Family() {
  const [view, show] = useState("Latihan");
  const [i, sel] = useState(0),
    [mode, pick] = useState("Mimik"),
    [done, save] = useSaved("familyDone", []);
  const [seen, seenSet] = useState("");
  const [word, wordSet] = useState(""),
    [dialect, chooseDialect] = useSaved("familyDialect", "Jakarta");
  const key = i + "-" + mode;
  const hasGuidedPractice = mode === "Percakapan" && hasWordPractice(word);
  const dailyExamples = [["saya", 0], ["makan", 1], ["teman", 0], ["belajar", 3], ["terima kasih", 0], ["maaf", 0], ["siapa", 0]];
  const [dailyWord, dailyLevel] = dailyExamples[new Date().getDay()];
  return (
    <>
      <ToolSwitch label="Bagian BISINDO Keluarga" options={["Latihan", "Video penutur", "Tebak huruf"]} value={view} onChange={show} />
      {view === "Latihan" && <div className="dailyPractice">
        <span><strong>Isyarat hari ini</strong> · {dailyWord}</span>
        <button onClick={() => { sel(dailyLevel); pick("Percakapan"); wordSet(dailyWord); seenSet(""); }}>Latih isyarat</button>
      </div>}
      <div className="familyLayout">
        <div className="chapters">
          {family.map(([name], j) => (
            <button
              key={name}
              aria-pressed={i === j}
              onClick={() => {
                sel(j);
                seenSet("");
                wordSet("");
              }}
            >
              <b>{String(j + 1).padStart(2, "0")}</b>
              {name}
            </button>
          ))}
        </div>
        <section>
          <small>LEVEL {i + 1} / 6</small>
          <h2>{family[i][0]}</h2>
          <p>{family[i][1]}</p>
          {view === "Latihan" && <>
          <ToolSwitch label="Jenis latihan" options={["Mimik", "Satu tangan", "Dua tangan", "Percakapan"]} value={mode} onChange={m => { pick(m); seenSet(""); }} />
          {mode === "Mimik" && <FacePractice key={key} />}
          {mode === "Satu tangan" && <AlphabetPractice key={key} poses="CIL" />}
          {mode === "Dua tangan" && <AlphabetPractice key={key} poses="ADH" />}
          {mode === "Percakapan" && <>
          <Vocabulary level={i} word={word} onWord={next => { wordSet(next); seenSet(""); }} />
          {hasGuidedPractice ? <WordPractice key={word} word={word} /> : <section className="sheet" key={key}>
            <h3>Latihan dengan kamera</h3>
            <CameraLab onMatch={seenSet} />
            {seen && <p>Contoh lokal terdekat: {seen}</p>}
          </section>}
          </>}
          <button className="primary" disabled={done.includes(key)} onClick={() => save([...done, key])}>
            {done.includes(key) ? "Latihan tercatat" : "Catat latihan selesai"}
          </button>
          </>}
          {view === "Video penutur" && <>
          <SigningLibrary key={i} initial={i === 5 ? "cerita" : i === 0 ? "keluarga" : "perkenalan"} />
          <section className="toolSection">
          <h3>Atur video pengajar</h3>
          <ToolSwitch label="Jenis video pengajar" options={["Mimik", "Satu tangan", "Dua tangan", "Percakapan"]} value={mode} onChange={pick} />
          {mode === "Percakapan" && <Vocabulary level={i} word={word} onWord={wordSet} />}
          <label>
            Variasi daerah
            <select
              value={dialect}
              onChange={(e) => chooseDialect(e.target.value)}
            >
              {["Jakarta", "Yogyakarta", "Makassar", "Daerah lain"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {i === 5 && <a className="externalLink" href="https://www.pusbisindo.org/en/video-bercerita-bisindo" target="_blank" rel="noreferrer">Cerita anak di Pusbisindo <span>↗ Tab baru</span></a>}
          <VideoLesson
            reference={i === 0 ? {video:"eY7-QC3ik9o",title:"Video pendamping topik keluarga · Dan Hyuk"} : undefined}            key={[key, dialect, word].join("/")}
            id={["keluarga", key, dialect, word].join("/")}
          />
          </section>
          </>}
          {view === "Tebak huruf" && <AlphabetQuiz />}
        </section>
      </div>
    </>
  );
}
function Literacy() {
  const { account } = useAccount();
  const [input, set] = useState(
      "Air mengalami perubahan wujud menjadi uap dikarenakan menerima energi panas.",
    ),
    [lv, level] = useState("Sederhana"),
    [versions, output] = useState(null),
    [dict, save] = useSaved("dictionary", []),
    [review, lock] = useSaved("reviewed", null),
    [open, select] = useState(null);
  const text = versions?.[lv] ?? "";
  const canReview = account.role === "teacher";
  const terminology = new RegExp(`\\b(${terms.map(term => term[0]).join("|")})\\b`, "gi");
  const selected = open === null ? null : terms[open];
  const context = selected && input.split(/(?<=[.!?])\s+|\n+/).find(line => new RegExp(`\\b${selected[0]}\\b`, "i").test(line));
  const styleMeaning = selected?.[0] === "gaya" && /\b(berpakaian|busana|pakaian|berbicara|penampilan|bahasa)\b/i.test(context ?? "");
  return (
    <>
      <section className="sheet">
        <h2>Sederhanakan bacaan</h2>
        <label>
          Teks pelajaran
          <textarea
            value={input}
            maxLength={12000}
            onChange={(e) => {
              set(e.target.value);
              output(null);
            }}
          />
        </label>
        <ImportReading onText={v => { set(v); output(null); }} />
        <div className="controls">
          <button
            className="primary"
            disabled={!input.trim()}
            onClick={() => { output(Object.fromEntries(["Asli", "Sederhana", "Sangat sederhana"].map(name => [name, simplify(input, name)]))); level("Sederhana"); }}
          >
            Sederhanakan teks
          </button>
        </div>
        {versions && <section className="toolSection">
          <h2>Bandingkan hasil</h2>
          <ToolSwitch label="Tingkat bahasa" options={["Asli", "Sederhana", "Sangat sederhana"]} value={lv} onChange={level} />
          <div className="readingCompare">
            <div><h3>Teks asli</h3><p>{versions.Asli}</p></div>
            {lv !== "Asli" && <label>{lv}<textarea aria-label={"Sunting versi " + lv} value={text} maxLength={12000} onChange={event => output({ ...versions, [lv]: event.target.value })} /></label>}
          </div>
          {lv !== "Asli" && <button disabled={!text.trim()} onClick={() => lock({ input, text: text.trim(), lv, verified: canReview })}>
            {canReview ? "Verifikasi dan simpan" : "Simpan hasil"}
          </button>}
        </section>}
      </section>
      {review && <section className="sheet toolSection">
        <h2>Teks tersimpan</h2>
        {review.verified && <p><strong>Diverifikasi pengajar</strong></p>}
        <p>{review.text}</p>
        {canReview && review.verified && <Room message={review.text} triggerLabel="Bagikan ke ruang kelas" />}
      </section>}
      <section className="sheet">
        <h2>Glosarium</h2>
        <p className="readingPassage">{input.split(terminology).map((part, i) => {
          const index = terms.findIndex(term => term[0] === part.toLocaleLowerCase("id"));
          return i % 2 && index >= 0 ? <button className="readingTerm" aria-pressed={open === index} key={i} onClick={() => select(index)}>{part}</button> : part;
        })}</p>
        <div className="controls">
          {terms.map((t, i) => (
            <button
              key={t[0]}
              aria-pressed={open === i}
              onClick={() => select(i)}
            >
              {t[0]}
            </button>
          ))}
        </div>
        {selected && (
          <blockquote>
            <b>{selected[0]}</b>
            {context && <p><small>Dalam bacaan ini</small><br />{context}</p>}
            <p>{styleMeaning ? "Cara seseorang berpakaian, berbicara, atau menampilkan diri. Contoh: gaya berpakaian Raka sederhana." : `${selected[1]} ${selected[2]}`}</p>
            {selected[0] === "menguap" && <ConceptFigure unit="air" stage={2} />}
            {selected[0] === "fotosintesis" && <ConceptFigure unit="cahaya" stage={2} />}
            <button
              disabled={dict.includes(terms[open][0])}
              onClick={() => save([...dict, terms[open][0]])}
            >
              {dict.includes(terms[open][0])
                ? "Tersimpan"
                : "Simpan ke kamus saya"}
            </button>
          </blockquote>
        )}
      </section>
      <Flashcards words={dict} terms={terms} />
    </>
  );
}
function Transcript() {
  const [mode, setMode] = useState("Mikrofon");
  const [preview, setPreview] = useState(null);
  const [query, search] = useState("");
  const [importantOnly, filterImportant] = useState(false);
  const [recordingConsent, setConsent] = useState(false);
  const [savedRows, saveTranscript] = useSaved("savedTranscript", []);
  const [person, who] = useState("Guru"),
    [line, set] = useState(""),
    [rows, put] = useState(savedRows);
  const add = (t) => {
    if (t.trim())
      put((r) => [
        ...r,
        {
          name: person || "Pembicara",
          text: t.trim(),
          time: new Date().toLocaleTimeString("id-ID"),
        },
      ]);
  };
  const voice = useDictate(add);
  const visibleRows = rows.map((row, index) => ({ ...row, index })).filter(row =>
    (!importantOnly || row.important) && `${row.name} ${row.text}`.toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id")),
  );
  function chooseMode(next) {
    if (next !== mode && voice.active) voice.start();
    setMode(next);
  }
  return (
    <>
    <ToolSwitch label="Cara menambahkan ucapan" options={["Mikrofon", "Rekam luring", "Ketik", "Ruang kelas"]} value={mode} onChange={chooseMode} />
    {mode === "Ruang kelas" ? <Room standalone message={rows.length ? rows.at(-1).name + " — " + rows.at(-1).text : ""} /> : <section className="sheet">
      <h2>{mode === "Mikrofon" ? "Transkripsi langsung" : mode === "Rekam luring" ? "Transkripsi di perangkat" : "Ketik ucapan"}</h2>
      <label>
        Pembicara aktif
        <input
          value={person}
          maxLength={40}
          onChange={(e) => who(e.target.value)}
          disabled={voice.active}
        />
      </label>
      {["Mikrofon", "Rekam luring"].includes(mode) && <label className="option">
        Peserta sudah diberi tahu dan setuju direkam
        <input type="checkbox" checked={recordingConsent} disabled={voice.active} onChange={event => setConsent(event.target.checked)} />
      </label>}
      {mode === "Mikrofon" && <>
      <p>Ganti nama saat pembicara berganti. Transkripsi browser dapat memerlukan internet.</p>
      <button className="primary" disabled={!recordingConsent && !voice.active} onClick={voice.start}>
        {voice.active ? "Hentikan transkripsi" : "Mulai transkripsi suara"}
      </button>
      <p role="status">{voice.status}</p>
      </>}
      {mode === "Rekam luring" && recordingConsent && <LocalVoice onText={set} />}
      {mode !== "Mikrofon" && <form
        onSubmit={(e) => {
          e.preventDefault();
          add(line);
          set("");
        }}
      >
        <label>
          Tambahkan ucapan dengan teks
          <input
            value={line}
            onChange={(e) => set(e.target.value)}
            maxLength={1000}
          />
        </label>
        <button disabled={!line.trim()}>Tambah ucapan</button>
      </form>}
    </section>}
    <section className="sheet transcriptHistory">
      <div className="toolHeading">
        <h2>Riwayat ucapan</h2>
        <div className="controls">
          <button disabled={!rows.length} onClick={() => download("transkrip-kelas.txt", rows.map(x => `${x.time} ${x.name}${x.important ? " · Penting" : ""} — ${x.text}`).join("\n"))}>Unduh transkrip</button>
          <button disabled={!rows.length} onClick={() => window.print()}>Cetak transkrip</button>
        </div>
      </div>
      {!rows.length && <p>Ucapan yang ditambahkan akan muncul di sini.</p>}
      {rows.length > 0 && <>
        <label>Cari di transkrip<input type="search" value={query} onChange={event => search(event.target.value)} /></label>
        <label className="option">Tampilkan poin penting saja<input type="checkbox" checked={importantOnly} onChange={event => filterImportant(event.target.checked)} /></label>
        {!visibleRows.length && <p role="status">Tidak ada ucapan yang cocok.</p>}
      </>}
      <div className="controls">
        <button disabled={!rows.length} onClick={() => saveTranscript(rows)}>Simpan transkrip di perangkat</button>
        {savedRows.length > 0 && <button onClick={() => saveTranscript([])}>Hapus salinan tersimpan</button>}
      </div>
      {savedRows.length > 0 && <p role="status">{savedRows.length} ucapan tersimpan di browser akun ini.</p>}
      <div role="log">
        {visibleRows.map(r => (
          <blockquote
            key={r.index}
            style={{
              borderColor: ["#39758b", "#a75637", "#5c793d", "#805080"][
                Array.from(r.name).reduce((s, c) => s + c.codePointAt(0), 0) % 4
              ],
            }}
          >
            <small>
              {r.name} · {r.time}{r.text.endsWith("?") ? " · Pertanyaan" : r.text.endsWith("!") ? " · Seru" : ""}{r.important ? " · Penting" : ""}
            </small>
            <p>{r.text}</p>
            <div className="controls" role="group" aria-label="Contoh isyarat">
              {["Gerak per kata", "Eja huruf"].map(kind => {
                const active = preview?.row === r.index && preview.kind === kind;
                return <button key={kind} aria-expanded={active} onClick={() => setPreview(active ? null : { row: r.index, kind })}>{kind}</button>;
              })}
            </div>
            <button aria-pressed={Boolean(r.important)} onClick={() => put(current => current.map((line, index) => index === r.index ? { ...line, important: !line.important } : line))}>Poin penting</button>
            {preview?.row === r.index && (preview.kind === "Gerak per kata" ? <WordReplay text={r.text} /> : <Fingerspell text={r.text} />)}
          </blockquote>
        ))}
      </div>
    </section>
    </>
  );
}
function Rhythm() {
  const [listen, listenSet] = useState(false);
  const [count, beat] = useState(0),
    [active, start] = useState(false),
    [tempo, speed] = useState(60),
    [score, hit] = useState("");
  const time = useRef(0);
  useEffect(() => {
    if (!active) return;
    time.current = performance.now();
    const it = setInterval(() => {
      time.current = performance.now();
      beat((n) => n + 1);
    }, 60000 / tempo);
    return () => clearInterval(it);
  }, [active, tempo]);
  return (
    <section className="sheet">
      <h2>Ketukan visual</h2>
      <label>
        Tempo {tempo} ketukan/menit
        <input
          type="range"
          min="40"
          max="100"
          value={tempo}
          onChange={(e) => speed(+e.target.value)}
        />
      </label>
      <div className="rhythm">
        {["ma", "ta", "ha", "ri"].map((x, i) => (
          <b className={active && count % 4 === i ? "lit" : ""} key={x}>
            {x}
          </b>
        ))}
      </div>
      <div className="controls">
        <button
          onClick={() => {
            start(!active);
            beat(0);
            hit("");
          }}
        >
          {active ? "Hentikan" : "Mulai ritme"}
        </button>
        <button
          disabled={!active}
          onClick={() => {
            const d = (performance.now() - time.current) % (60000 / tempo);
            hit(
              Math.min(d, 60000 / tempo - d) < 190
                ? "Ketukan cocok."
                : "Coba ikuti pergantian suku kata.",
            );
          }}
        >
          Ketuk mengikuti ritme
        </button>
      </div>
      <label className="option">
        Ikuti ketukan dengan suara
        <input
          type="checkbox"
          checked={listen}
          onChange={(e) => listenSet(e.target.checked)}
        />
      </label>
      {listen && active && (
        <Meter
          onOnset={() => {
            const elapsed =
              (performance.now() - time.current) % (60000 / tempo);
            hit(
              Math.min(elapsed, 60000 / tempo - elapsed) < 190
                ? "Suara sesuai ketukan."
                : "Coba lagi saat suku kata berganti.",
            );
          }}
        />
      )}
      <p role="status">{score}</p>
    </section>
  );
}
function Speech() {
  const [view, show] = useState("Artikulasi");
  return (
    <>
      <ToolSwitch label="Bagian Studio Wicara" options={["Artikulasi", "Volume & nada", "Ritme", "Cermin wajah"]} value={view} onChange={show} />
      {view === "Artikulasi" && <Pronunciation />}
      {view === "Volume & nada" && <section className="sheet">
        <h2>Volume dan nada suara</h2>
        <p>
          Latihan opsional. Amati perubahan volume relatif terhadap mikrofon
          perangkat.
        </p>
        <Meter />
      </section>}
      {view === "Ritme" && <Rhythm />}
      {view === "Cermin wajah" && <section className="sheet">
        <h2>Cermin wajah</h2>
        <CameraLab faceOnly />
      </section>}
    </>
  );
}
function Progress() {
  return <AccountProgress download={download} />;
}
function Curate() {
  const [view, show] = useState("Usulan kosakata");
  const [list, save] = useSaved("proposals", []),
    [name, set] = useState(""),
    [dialect, zone] = useState(""),
    [desc, note] = useState("");
  return (
    <>
      <ToolSwitch label="Bagian Kurasi Isyarat" options={["Usulan kosakata", "Ruang tinjauan", "Rekam contoh"]} value={view} onChange={show} />
      {view === "Usulan kosakata" && <section className="sheet">
        <h2>Usulkan kosakata</h2>
        <p>
          Catat variasi dan sumber untuk ditinjau bersama penutur Tuli pada
          perangkat ini.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !dialect.trim() || !desc.trim()) return;
            save([
              ...list,
              {
                name: name.trim(),
                dialect: dialect.trim(),
                desc: desc.trim(),
                status: "Menunggu tinjauan",
              },
            ]);
            set("");
            note("");
          }}
        >
          <label>
            Istilah
            <input
              required
              value={name}
              maxLength={80}
              onChange={(e) => set(e.target.value)}
            />
          </label>
          <label>
            Variasi daerah
            <input
              required
              value={dialect}
              maxLength={80}
              onChange={(e) => zone(e.target.value)}
            />
          </label>
          <label>
            Sumber dan konteks
            <textarea
              required
              value={desc}
              maxLength={1000}
              onChange={(e) => note(e.target.value)}
            />
          </label>
          <button className="primary">Simpan usulan</button>
        </form>
        {list.map((x, i) => (
          <blockquote key={i}>
            <b>
              {x.name} · {x.dialect}
            </b>
            <p>{x.desc}</p>
            <label>
              Status lokal
              <select
                value={x.status}
                onChange={(e) =>
                  save(
                    list.map((y, j) =>
                      j === i ? { ...y, status: e.target.value } : y,
                    ),
                  )
                }
              >
                {[
                  "Menunggu tinjauan",
                  "Perlu revisi",
                  "Ditinjau bersama pengajar",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </blockquote>
        ))}
      </section>}
      {view === "Ruang tinjauan" && <Room proposals={list} standalone />}
      {view === "Rekam contoh" && <section className="sheet">
        <h2>Rekam contoh gerakan</h2>
        <p>
          Berikan nama dan peragakan satu gerakan. Hanya rangkaian titik tangan
          yang disimpan. Contoh ini dapat dicoba di Jembatan Isyarat.
        </p>
        <CameraLab train />
      </section>}
    </>
  );
}
function Settings({ prefs, pref }) {
  const { offline, enableOffline } = useAccount();
  const [msg, say] = useState(""),
    [loading, set] = useState(false);
  async function pack() {
    set(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg?.active)
        throw Error(
          "Buka versi produksi melalui HTTPS atau localhost untuk mengunduh paket.",
        );
      const val = await new Promise((res, rej) => {
        const channel = new MessageChannel();
        const t = setTimeout(() => {
          channel.port1.close();
          rej(Error("Unduhan belum selesai. Coba kembali."));
        }, 120000);
        channel.port1.onmessage = (e) => {
          clearTimeout(t);
          res(e.data);
          channel.port1.close();
        };
        reg.active.postMessage("download", [channel.port2]);
      });
      if (val === "Siap luring") {
        enableOffline();
        say("Paket siap. Latihan lokal dapat dibuka ulang di tab ini selama 24 jam.");
      } else say(val);
    } catch (e) {
      say(e.message);
    } finally {
      set(false);
    }
  }
  return (
    <>
      <section className="sheet">
        <h2>Tampilan</h2>
        {[
          ["large", "Teks besar"],
          ["contrast", "Kontras tinggi"],
          ["reduceMotion", "Kurangi animasi"],
        ].map(([k, t]) => (
          <label className="option" key={k}>
            {t}
            <input
              type="checkbox"
              checked={!!prefs[k]}
              onChange={(e) => pref({ ...prefs, [k]: e.target.checked })}
            />
          </label>
        ))}
      </section>
      <section className="sheet">
        <h2>Paket luring</h2>
        <p>
          Simpan materi, OCR, model kamera, dan Whisper untuk transkripsi luring
          pada perangkat ini. Tautan kamus luar dan layanan suara browser
          memerlukan koneksi sesuai perangkat.
        </p>
        <button disabled={loading || offline} onClick={pack}>
          <Download size={16} />
          {loading ? "Mengunduh…" : "Unduh paket luring"}
        </button>
        <p role="status">{msg}</p>
      </section>
    </>
  );
}
export function Tools({ page, prefs, pref }) {
  const map = {
    bridge: Bridge,
    family: Family,
    text: Literacy,
    speech: Speech,
    class: Transcript,
    progress: Progress,
    curate: Curate,
    settings: Settings,
  };
  const C = map[page];
  return (
    <>
      <small>
        {["family"].includes(page)
          ? "BELAJAR"
          : ["settings", "progress", "curate"].includes(page)
            ? "PENDAMPING"
            : "ALAT KELAS"}
      </small>
      <h1>
        {nav.find((x) => x[0] === page)[1]}
        <span>.</span>
      </h1>
      <C prefs={prefs} pref={pref} />
    </>
  );
}
