import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, flushProgress } from "./api";
import { ALPHABET } from "../shared/levels.js";

/* ---------- Routing (hash based, so the static host needs no rewrites) ---------- */
function readRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(query) };
}
export function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}
export const go = path => { location.hash = "#/" + path.replace(/^\//, ""); };

/* ---------- Session ---------- */
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const refresh = useCallback(() => api("/saya").then(d => setUser(d.user)).catch(() => setUser(u => u ?? null)), []);
  useEffect(() => { refresh(); flushProgress(); }, [refresh]);
  const logout = async () => { await api("/keluar", { method: "POST" }).catch(() => {}); setUser(null); go(""); };
  return <AuthContext.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const reload = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    return api(path).then(data => setState({ data, error: "", loading: false }))
      .catch(e => setState(s => ({ ...s, error: e.message, loading: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: data => setState(s => ({ ...s, data })) };
}

/* ---------- Assets ---------- */
const SPECIAL = { D: "D-kontak-v2", J: "J-kelingking" };
export const handImg = letter => `./alfabet-3d/${SPECIAL[letter] ?? letter + "-render"}.webp`;
export const gerakVideo = (word, n = 1) => `./gerak/${word.replaceAll(" ", "_")}-${n}.mp4`;

export const TIPS = {
  A: "Satukan ujung telunjuk dan ibu jari kedua tangan di depan dada.",
  C: "Lengkungkan telunjuk dan ibu jari membentuk huruf C. Lipat tiga jari lainnya.",
  D: "Tegakkan satu telunjuk. Sentuhkan telunjuk dan ibu jari tangan lain yang melengkung ke sisinya.",
  J: "Untuk kamera, luruskan kelingking ke samping dan lipat jari lainnya.",
  M: "Tempelkan tiga jari ke telapak tangan lain yang terbuka.",
  N: "Tempelkan dua jari ke telapak tangan lain yang terbuka.",
  Y: "Pertahankan titik sentuh telunjuk seperti contoh dan perlihatkan kedua pergelangan.",
};
export const tipFor = letter => TIPS[letter] || "Perhatikan posisi jari dan arah telapak pada contoh, lalu tirukan perlahan.";

/* ---------- Small components ---------- */
export function Brand({ to = "", light = false }) {
  return (
    <a className="brand" href={"#/" + to} aria-label="ISYARA, beranda" style={{ color: light ? "var(--krem)" : undefined }}>
      <img src="./logos/isyara.webp" alt="" width="42" height="42" />
      <span>isyara<b>.</b></span>
    </a>
  );
}

export const ArrowRight = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ArrowLeft = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const Spark = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.2 6.3L20.5 10.5l-6.3 2.2L12 19l-2.2-6.3L3.5 10.5l6.3-2.2z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" /></svg>
);
export const Lock = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const Check = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
);

export function Back({ to, children = "Kembali" }) {
  return <a className="back" href={"#/" + to}><ArrowLeft />{children}</a>;
}

export function LetterMap({ mastered = [], skipped = [], size = 48, height = 50 }) {
  return (
    <>
      <div className="letters" style={{ "--size": size + "px", "--h": height + "px" }}>
        {ALPHABET.map(ch => {
          const done = mastered.includes(ch), skip = !done && skipped.includes(ch);
          return <span key={ch} className={"letter" + (done ? " done" : skip ? " skip" : "")}
            aria-label={`Huruf ${ch}, ${done ? "dikuasai" : skip ? "perlu diulang" : "belum dicoba"}`}>{ch}</span>;
        })}
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--hijau)" }} />Dikuasai</span>
        <span><i style={{ border: "2px dashed var(--oranye-teks)" }} />Perlu diulang</span>
        <span><i style={{ background: "var(--pasir)" }} />Belum dicoba</span>
      </div>
    </>
  );
}

export function Loading({ error, onRetry, dark }) {
  return (
    <div className={"screen center" + (dark ? " bg-hijau on-dark" : " bg-krem")} style={{ gap: 16 }}>
      {error ? <>
        <p className="alert alert-error">{error}</p>
        {onRetry && <button className="btn btn-primary" onClick={onRetry}>Coba lagi</button>}
      </> : <p className="muted" role="status">Memuat…</p>}
    </div>
  );
}

export const relTime = ms => {
  if (!ms) return "belum pernah";
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days <= 0) return "hari ini";
  if (days === 1) return "kemarin";
  return days + " hari lalu";
};
