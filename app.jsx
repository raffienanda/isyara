import { ConceptFigure } from "./figure";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Menu,
  X,
  ArrowRight,
  ChevronRight,
  Library,
  Volume2,
  Download,
} from "lucide-react";
import { getLocal, saveLocal, units } from "./data";
import { Tools, VideoLesson } from "./tools";
import { CameraLab } from "./media";
import { AccountPanel, AccountProvider, Login, roles, SchoolRoster, useAccount } from "./account";
import "./style.css";
export const nav = [
  ["home", "Ruang belajar"],
  ["science", "Sains Isyarat"],
  ["family", "BISINDO Keluarga"],
  ["bridge", "Jembatan Isyarat"],
  ["text", "Penyederhana teks"],
  ["speech", "Studio wicara"],
  ["class", "Transkrip kelas"],
  ["progress", "Dasbor pendamping"],
  ["curate", "Kurasi isyarat"],
  ["settings", "Preferensi"],
];
export function useSaved(key, init) {
  const [v, s] = useState(() => getLocal(key, init));
  function update(next) {
    const result = typeof next === "function" ? next(v) : next;
    saveLocal(key, result);
    s(result);
  }
  return [v, update];
}
export function Btn({ to, children }) {
  return (
    <a className="btn" href={"#" + to}>
      {children}
      <ArrowRight size={16} />
    </a>
  );
}
function FractionArt() {
  return (
    <div className="art" aria-hidden="true">
      <div className="gridpaper" />
      <div className="tile whole" />
      <div className="tile quarters">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="tile half" />
      <span className="fractionMark">¼</span>
    </div>
  );
}
function Home() {
  const { account } = useAccount();
  const done = getLocal("done", []),
    [filter, setFilter] = useState("Semua");
  if (!roles[account.role].pages.includes("science")) return (
    <>
      <h1>Ruang belajar<span>.</span></h1>
      <section className="sheet">
        <h2>Belajar bersama anak</h2>
        <p>Pilih latihan bahasa isyarat atau kegiatan wicara.</p>
        <div className="controls">
          <Btn to="family">Buka BISINDO Keluarga</Btn>
          <Btn to="speech">Buka Studio Wicara</Btn>
        </div>
      </section>
    </>
  );
  return (
    <>
      <div className="heading">
        <div>
          <small>PERPUSTAKAAN KELAS</small>
          <h1>
            Ruang belajar<span>.</span>
          </h1>
        </div>
        <span className="pageCount">
          <Library size={19} /> 3 unit belajar
        </span>
      </div>
      <div className="hero">
        <div>
          <small>
            MATEMATIKA <b> / </b> PECAHAN
          </small>
          <h2>
            Satu lingkaran,
            <br />
            <em>banyak bagian.</em>
          </h2>
          <p>Geser pembagi lingkaran dan lihat bagaimana pecahan berubah.</p>
          <Btn to="science/pecahan">Jelajahi pecahan</Btn>
        </div>
        <FractionArt />
      </div>
      <div className="sectionTitle">
        <h2>Materi belajar</h2>
        <div className="tabs">
          {["Semua", "Matematika", "IPA"].map((x) => (
            <button
              aria-pressed={x === filter}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="unitList">
        {units.map((u, i) => {
          return (
            (filter === "Semua" || filter === u.area) && (
              <a href={"#science/" + u.id} key={u.id}>
                <i className={"subject s" + i}>
                  <img src={`./logos/${u.id}.webp`} width="40" height="40" alt="" />
                </i>
                <div>
                  <small>{u.area}</small>
                  <strong>{u.title}</strong>
                </div>
                <span>{done.includes(u.id) ? "Selesai" : "Pelajari"}</span>
                <ArrowRight size={19} />
              </a>
            )
          );
        })}
      </div>
    </>
  );
}
function Science({ id }) {
  const { account } = useAccount();
  const unit = units.find((x) => x.id === id) || units[0],
    [n, set] = useState(4),
    [step, stage] = useState(0),
    [result, say] = useState(""),
    [done, save] = useSaved("done", []);
  const [written, write] = useState("");
  const [sharing, showSharing] = useState(false);
  const [camera, showCamera] = useState(false);
  const [cameraChoice, chooseCamera] = useState(null);
  const [videoWide, expandVideo] = useState(false);
  const letters = ["A", "B", "C"];
  function checkAnswer(correct) {
    say(correct ? "Tepat. Unit selesai." : "Belum tepat. Amati contoh dan coba lagi.");
    if (correct && !done.includes(unit.id)) save([...done, unit.id]);
  }
  const lessonLink = new URL("#science/" + unit.id, location.href).href;
  return (
    <>
      <small>{unit.area.toUpperCase()} / UNIT BELAJAR</small>
      <h1>{unit.title}</h1>
      <p className="lead">{unit.desc}</p>
      <section className="sheet">
        <div className="unitSwitch" role="navigation" aria-label="Pilih unit belajar">
          {units.map((u) => (
            <a key={u.id} href={"#science/" + u.id}
              aria-current={u.id === unit.id ? "page" : undefined}>
              <img src={`./logos/${u.id}.webp`} width="32" height="32" alt="" />
              <span><small>{u.area}</small><strong>{u.id}</strong></span>
            </a>
          ))}
        </div>
        <div className={"scienceLesson" + (videoWide ? " videoWide" : "")}>
        <div className="experiment">
          {unit.id === "pecahan" ? (
            <>
              <div
                className="pie"
                style={{
                  background:
                    "repeating-conic-gradient(transparent 0 " +
                    (360 / n - 1) +
                    "deg,#244838 " +
                    (360 / n - 1) +
                    "deg " +
                    360 / n +
                    "deg),conic-gradient(#ed955d 0 " +
                    360 / n +
                    "deg,#deebba " +
                    360 / n +
                    "deg)",
                }}
              />
              <label>
                Bagian sama besar <strong>{n}</strong>
                <input
                  aria-label="Jumlah bagian"
                  type="range"
                  min="2"
                  max="12"
                  value={n}
                  onChange={(e) => set(+e.target.value)}
                />
              </label>
              <b>Satu bagian berwarna jingga = 1/{n}</b>
            </>
          ) : (
            <>
              <ConceptFigure unit={unit.id} stage={step} />
              <h2>
                {
                  (unit.id === "air"
                    ? ["Es padat", "Air cair", "Uap air"]
                    : [
                        "Benih tumbuh",
                        "Daun menerima cahaya",
                        "Tumbuhan membuat makanan",
                      ])[step]
                }
              </h2>
              <div className="controls">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    aria-pressed={step === i}
                    onClick={() => stage(i)}
                  >
                    Tahap {i + 1}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="scienceVideo">
          <button className="videoResize" aria-pressed={videoWide} onClick={() => expandVideo(!videoWide)}>{videoWide ? "Kembalikan ukuran video" : "Perbesar panel video"}</button>
          <VideoLesson reference={unit.id === "pecahan" ? { video: "oX9Mgk6f9UM", title: "Video pendamping penjumlahan pecahan · Asri Endah Rumsijah" } : undefined} key={unit.id} id={"sains-" + unit.id} />
        </div>
        </div>
      </section>
      <section className="sheet">
        <small>CEK PEMAHAMAN</small>
        <h2>{unit.question}</h2>
        <div className="controls">
          {unit.choices.map((x, i) => (
            <button
              key={x}
              onClick={() => {
                checkAnswer(i === unit.answer);
              }}
            >
              {letters[i]}. {x}
            </button>
          ))}
        </div>
        <form onSubmit={event => {
          event.preventDefault();
          const normalize = value => value.normalize("NFKC").toLocaleLowerCase("id").replace(/⁄/g, "/").trim().replace(/\s+/g, " ");
          checkAnswer(normalize(written) === normalize(unit.choices[unit.answer]));
        }}>
          <label>Atau ketik salah satu jawaban<input value={written} onChange={e => write(e.target.value)} /></label>
          <button disabled={!written.trim()}>Periksa jawaban</button>
        </form>
        <button aria-expanded={camera} aria-controls="science-camera" onClick={() => { showCamera(!camera); chooseCamera(null); }}>
          {camera ? "Tutup kamera kuis" : "Jawab dengan eja jari"}
        </button>
        {camera && <section id="science-camera" className="toolSection">
          <h3>Eja huruf pilihanmu</h3>
          <p>Peragakan A, B, atau C, lalu pilih Baca gerakan. Periksa hasil kamera sebelum mengirim jawaban.</p>
          <CameraLab alphabet onMatch={letter => {
            const index = letters.indexOf(letter);
            chooseCamera(index >= 0 ? index : null);
          }} />
          {cameraChoice !== null && <p role="status">Terbaca {letters[cameraChoice]}. {unit.choices[cameraChoice]}</p>}
          <button className="primary" disabled={cameraChoice === null} onClick={() => checkAnswer(cameraChoice === unit.answer)}>Periksa pilihan kamera</button>
        </section>}
        <p role="status">{result}</p>
      </section>
      {["teacher", "gpk"].includes(account.role) && <section className="sheet toolSection">
        <h2>Untuk pengajar</h2>
        <div className="controls">
          <button aria-expanded={sharing} aria-controls="science-share" onClick={() => showSharing(!sharing)}>Bagikan unit</button>
          <button onClick={() => window.print()}>Cetak unit</button>
        </div>
        <div id="science-share" hidden={!sharing}>
          <label>Tautan materi untuk siswa<input readOnly value={lessonLink} onFocus={e => e.target.select()} /></label>
          <a className="externalLink" href={"https://classroom.google.com/share?url=" + encodeURIComponent(lessonLink)} target="_blank" rel="noreferrer">Google Classroom <span>↗ Tab baru</span></a>
        </div>
      </section>}
    </>
  );
}
function App() {
  const { account, offline } = useAccount();
  const [route, go] = useState(location.hash.slice(1) || "home"),
    [open, menu] = useState(false),
    [prefs, pref] = useSaved("prefs", { large: false, contrast: false }),
    [online, net] = useState(navigator.onLine);
  useEffect(() => {
    const hash = () => {
      go(location.hash.slice(1) || "home");
      menu(false);
      window.scrollTo(0, 0);
      document.querySelector("main")?.focus();
    };
    const n = () => net(navigator.onLine);
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", n);
    window.addEventListener("offline", n);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", n);
      window.removeEventListener("offline", n);
    };
  }, []);
  if (!account) return <Login />;
  const [raw, id] = route.split("/");
  const role = roles[account.role];
  const visible = new Set([...role.pages, "settings"]);
  const current = raw === "account" ? ["account", "Akun saya"] :
    raw === "school" ? ["school", "Daftar kelas"] : nav.find((x) => x[0] === raw) || nav[0];
  const page = current[0];
  const allowed = page === "account" || visible.has(page);
  const requiresConnection = offline && ["progress", "curate", "school"].includes(page);
  const sections = [["BELAJAR", nav.slice(0, 3)], ["ALAT KELAS", nav.slice(3, 7)],
    ["PENDAMPING", [...nav.slice(7), ["school", "Daftar kelas"]]]];
  return (
    <div
      className={
        "layout " +
        (prefs.large ? "large " : "") +
        (prefs.contrast ? "contrast " : "") +
        (prefs.reduceMotion ? "reduceMotion" : "")
      }
    >
      <a
        href="#content"
        className="skip"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector("main").focus();
        }}
      >
        Lewati navigasi
      </a>
      {open && (
        <button
          className="scrim"
          aria-label="Tutup menu"
          onClick={() => menu(false)}
        />
      )}
      <aside className={open ? "open" : ""}>
        <a className="brand" href={"#" + role.start}>
          <img src="./logos/isyara.webp" alt="" />
          isyara<span>.</span>
        </a>
        <nav aria-label="Navigasi utama">
          {sections.map(([label, links]) => {
            const entries = links.filter(([key]) => visible.has(key));
            if (!entries.length) return null;
            return <React.Fragment key={label}>
              <small>{label}</small>
              {entries.map(([key, title]) => (
                <a key={key} aria-current={page === key ? "page" : undefined} href={"#" + key}>
                  <img src={`./logos/${key === "school" ? "progress" : key}.webp`} width="27" height="27" alt="" />
                  {title}
                </a>
              ))}
            </React.Fragment>;
          })}
        </nav>
        <div className="sideFoot">
          <span className="sidebarRole">{role.label}</span>
          <span className="dot" /> <span>{online && !offline ? "Terhubung" : "Mode luring"}</span>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="hamb"
            aria-label="Buka menu"
            onClick={() => menu(!open)}
          >
            <Menu />
          </button>
          <span>
            <img className="headerBrand" src="./logos/isyara.webp" width="28" height="28" alt="ISYARA" />
            <ChevronRight size={14} /> <b>{current[1]}</b>
          </span>
          <div className="headerActions">
            <a aria-label="Preferensi aksesibilitas" href="#settings">
              <img src="./logos/settings.webp" width="23" height="23" alt="" /> <span>Aksesibilitas</span>
            </a>
            <a className="accountLink" href="#account">Akun</a>
          </div>
        </header>
        <main tabIndex="-1" id="content" key={route + "/" + account.id}>
          {!allowed || requiresConnection ? (
            <section className="sheet">
              <h1>{current[1]}</h1>
              <p>{requiresConnection ? "Halaman ini memerlukan koneksi ke server." : "Halaman ini tidak tersedia untuk peran akunmu."}</p>
              <a href={"#" + (requiresConnection ? "settings" : role.start)}>{requiresConnection ? "Buka Preferensi" : "Kembali ke halaman awal"}</a>
            </section>
          ) : page === "account" ? (
            <AccountPanel />
          ) : page === "school" ? (
            <SchoolRoster />
          ) : page === "home" ? (
            <Home />
          ) : page === "science" ? (
            <Science id={id} />
          ) : (
            <Tools page={page} prefs={prefs} pref={pref} />
          )}
        </main>
      </div>
    </div>
  );
}
createRoot(document.querySelector("#root")).render(<AccountProvider><App /></AccountProvider>);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
      .then(registration => registration.update()).catch(console.warn),
  );
