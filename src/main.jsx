import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { applyPrefs } from "./api";
import { usePageIn } from "./anim";
import { AuthProvider, Loading, useAuth, useRoute } from "./ui";
import { Intro, Lupa, Masuk, Tentang } from "./pages/Umum";
import { Beranda, KameraMasalah, Kenalan, PilihLevel, SiapKamera, Tangan } from "./pages/Pelajar";
import { Main } from "./pages/Main";
import { Rangkai } from "./pages/Rangkai";
import { Kamus, Kosakata, Profil } from "./pages/Lainnya";
import { Kelas, KelasDetail } from "./pages/Pendamping";

applyPrefs();

function Redirect({ to }) {
  React.useEffect(() => { location.replace("#/" + to); }, [to]);
  return null;
}

function PageIn({ children }) {
  const ref = React.useRef(null);
  const { parts, query } = useRoute();
  usePageIn(ref, parts.join("/") + "?" + query.toString());
  return <div ref={ref}>{children}</div>;
}

function Router() {
  const { user } = useAuth();
  const { parts, query } = useRoute();
  const [page = "", arg] = parts;
  if (user === undefined) return <Loading />;

  const publicPages = { "": Intro, masuk: Masuk, lupa: Lupa, tentang: Tentang };
  if (publicPages[page]) {
    if (page === "masuk" && user) return <Redirect to={user.role === "pelajar" ? "beranda" : "kelas"} />;
    const Page = publicPages[page];
    return <Page query={query} />;
  }
  if (!user) return <Redirect to={"masuk?tab=masuk"} />;

  const shared = { kamus: Kamus, kosakata: Kosakata, profil: Profil };
  if (shared[page]) { const Page = shared[page]; return <Page query={query} />; }

  if (user.role === "pelajar") {
    switch (page) {
      case "kenalan": return <Kenalan />;
      case "beranda": return <Beranda />;
      case "level": return <PilihLevel />;
      case "tangan": return <Tangan level={arg || "1"} />;
      case "kamera": return <SiapKamera level={arg || "1"} />;
      case "kamera-masalah": return <KameraMasalah />;
      case "rangkai": return <Rangkai query={query} />;
      case "main": return <Main key={arg + query.toString()} id={arg || "1"} query={query} />;
      default: return <Redirect to="beranda" />;
    }
  }
  switch (page) {
    case "kelas": return arg ? <KelasDetail key={arg} id={arg} query={query} /> : <Kelas />;
    default: return <Redirect to="kelas" />;
  }
}

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <a className="skip" href="#isi" onClick={e => { e.preventDefault(); document.getElementById("isi")?.focus(); }}>Lewati ke isi</a>
    <PageIn><Router /></PageIn>
  </AuthProvider>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // When a new version takes over an open page, reload once so the page matches the new files.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
    .then(reg => { document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); }); })
    .catch(console.warn));
}
