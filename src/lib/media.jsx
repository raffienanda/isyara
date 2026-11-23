import { loadWordModels, compareWord } from "./motion";
import React, { useState, useRef, useEffect } from "react";
import { Camera, Mic, Square, Hand } from "lucide-react";
import { classifyAlphabet, describeHands, matchLetter, recognizesOverlap, touchesA } from "./shape";
const getLocal = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem("isyara:" + key)) ?? fallback; } catch { return fallback; }
};
const saveLocal = (key, value) => localStorage.setItem("isyara:" + key, JSON.stringify(value));
const pauseTracks = (s) => s?.getTracks().forEach((t) => t.stop());
const loadOptionalModel = url => fetch(url)
  .then(response => response.ok ? response.json() : null)
  .catch(() => null);
/* Shared MediaPipe setup. The wasm runtime and each landmarker are created once per page
   load and reused by every camera view, so switching words or pages does not reload them. */
/* The wasm runtime and the models are byte-identical copies of the official MediaPipe
   releases, which are also on fast public CDNs. Fetching them there spares the home
   server's slow upload. Same-origin copies remain the fallback (offline, blocked CDN). */
// eslint-disable-next-line no-undef
const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${__MEDIAPIPE_VERSION__}/wasm`;
const MODELS = {
  hand: ["https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", "./models/hand.task"],
  face: ["https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", "./models/face.task"],
};
const timeout = ms => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
// On localhost the same-origin copy is faster than any CDN.
const useCdn = () => navigator.onLine && !/^(localhost|127\.|\[::1\])/.test(location.hostname);

const modelPromises = {};
function modelBytes(name) {
  modelPromises[name] ??= (async () => {
    const [cdn, local] = MODELS[name];
    if (useCdn()) {
      try {
        const res = await fetch(cdn, { mode: "cors", signal: timeout(20000) });
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
      } catch { /* fall back to the copy on our own server */ }
    }
    const res = await fetch(local);
    if (!res.ok) throw Error("Model " + name + " gagal dimuat");
    return new Uint8Array(await res.arrayBuffer());
  })().catch(error => { delete modelPromises[name]; throw error; });
  return modelPromises[name];
}

const visionPromises = {};
function loadVision(local = false) {
  const key = local ? "lokal" : "cdn";
  visionPromises[key] ??= (async () => {
    const mod = await import("@mediapipe/tasks-vision");
    let base = "./wasm";
    if (!local && useCdn()) {
      try {
        const probe = await fetch(CDN_WASM + "/vision_wasm_internal.js", { method: "HEAD", mode: "cors", signal: timeout(3000) });
        if (probe.ok) base = CDN_WASM;
      } catch { /* keep the local runtime */ }
    }
    // MediaPipe only requests the wasm once the model is ready; start it now so both
    // downloads overlap. The later request is served from the browser cache.
    fetch(base + "/vision_wasm_internal.wasm").catch(() => {});
    const files = await mod.FilesetResolver.forVisionTasks(base);
    return { HandLandmarker: mod.HandLandmarker, FaceLandmarker: mod.FaceLandmarker, files, local: base === "./wasm" };
  })().catch(error => { delete visionPromises[key]; throw error; });
  return visionPromises[key];
}

// Download the runtime and the model at the same time, and retry once on the local runtime.
async function createLandmarker(kind, model, options) {
  const [vision, bytes] = await Promise.all([loadVision(), modelBytes(model)]);
  const make = v => v[kind].createFromOptions(v.files, { ...options, baseOptions: { modelAssetBuffer: bytes } });
  try {
    return await make(vision);
  } catch (error) {
    if (vision.local) throw error;
    return make(await loadVision(true));
  }
}

const handPromises = {};
function handLandmarker(alphabet) {
  const key = alphabet ? "alfabet" : "kata";
  handPromises[key] ??= createLandmarker("HandLandmarker", "hand", {
    runningMode: "VIDEO",
    numHands: 2,
    ...(alphabet && { minHandDetectionConfidence: .2, minHandPresenceConfidence: .25, minTrackingConfidence: .3 }),
  }).catch(error => { delete handPromises[key]; throw error; });
  return handPromises[key];
}
let facePromise;
function faceLandmarker() {
  facePromise ??= createLandmarker("FaceLandmarker", "face", {
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  }).catch(error => { facePromise = null; throw error; });
  return facePromise;
}
let alphabetPromise;
function loadAlphabetData() {
  alphabetPromise ??= Promise.all([
    fetch("./alphabet.json").then(r => { if (!r.ok) throw Error("Alfabet belum tersedia"); return r.json(); }),
    loadOptionalModel("./model-alfabet-tumpang-tindih.json"),
    loadOptionalModel("./models/alfabet-satu-tangan.json"),
    loadOptionalModel("./models/alfabet-dua-tangan.json"),
  ]).then(([bank, overlap, one, two]) => ({ bank, overlap, models: [one, two] }))
    .catch(error => { alphabetPromise = null; throw error; });
  return alphabetPromise;
}

/* Start downloading and compiling the recognizer in the background, e.g. while the
   student is still choosing a level, so the camera is ready when the game opens. */
export function warmUpCamera({ words = false } = {}) {
  const run = () => {
    const quiet = p => p.catch(() => {});
    quiet(loadAlphabetData());
    quiet(modelBytes("hand"));
    quiet(handLandmarker(true));
    if (words) { quiet(handLandmarker(false)); quiet(faceLandmarker()); quiet(loadWordModels()); }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 2500 });
  else setTimeout(run, 800);
}

const overlapViews = [[480, 0], [480, Math.PI / 12], [550, 0], [480, -Math.PI / 6]];
const overlapRecoveryViews = [
  [670, 0, "hand"],
  [610, 0],
  [600, Math.PI / 9, "palm"],
  [600, Math.PI * 8 / 45, "hand"],
  [550, -Math.PI / 6],
  [480, -Math.PI / 6, null, true],
  [600, Math.PI / 9, "palm", true],
];
function handCrop(hand, center, size) {
  if (!hand || !center) return { x: 0, y: 0, zoom: size };
  const xs = hand.map(point => point.x), ys = hand.map(point => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY);
  const x = center === "palm" ? (hand[0].x + hand[9].x) / 2 : (minX + maxX) / 2;
  const y = center === "palm" ? (hand[0].y + hand[9].y) / 2 : (minY + maxY) / 2;
  return {
    x: (x - .5) * 600 / 480,
    y: (y - .5) * 600 / 480,
    zoom: 480 * Math.max(.9, Math.min(2.4, size / (2.3 * 600 * span))),
  };
}
function vector(h, f) {
  const hands = h.landmarks
    .map((points, i) => ({ points, side: h.handedness[i]?.[0]?.categoryName }))
    .sort((a, b) => String(a.side).localeCompare(String(b.side)));
  if (!hands.length) return null;
  const v = [hands.length * 5];
  const nose = f?.faceLandmarks[0]?.[1];
  for (let i = 0; i < 2; i++) {
    const p = hands[i]?.points;
    if (!p) {
      v.push(...Array(18).fill(0));
      continue;
    }
    const base = p[0],
      size = Math.max(0.03, Math.hypot(p[9].x - base.x, p[9].y - base.y));
    for (const k of [4, 8, 12, 16, 20, 5, 17, 9])
      v.push((p[k].x - base.x) / size, (p[k].y - base.y) / size);
    v.push((base.x - (nose?.x ?? 0.5)) * 3, (base.y - (nose?.y ?? 0.5)) * 3);
  }
  return v;
}
function distance(a, b) {
  let total = 0;
  for (let k = 0; k < 12; k++) {
    const x = a[Math.round((k * (a.length - 1)) / 11)],
      y = b[Math.round((k * (b.length - 1)) / 11)];
    if (!x || !y || x.length !== y.length) return Infinity;
    total += Math.sqrt(
      x.reduce((sum, n, i) => sum + (n - y[i]) ** 2, 0) / x.length,
    );
  }
  return total / 12;
}
export function CameraLab({
  onMatch,
  onUncertain,
  onLetterFrame,
  expectedLetter,
  onFaceFrame,
  train = false,
  faceOnly = false,
  alphabet = false,
  targetWord = "",
  guided = false,
  recognizeWords = false,
  autoStart = false,
  className = "",
}) {
  const bank = useRef([]),
    letters = useRef([]);
  const video = useRef(null),
    canvas = useRef(null),
    running = useRef(false),
    generation = useRef(0),
    stopper = useRef(() => {}),
    seq = useRef([]),
    recording = useRef(false),
    timer = useRef(0);
  const [tracking, setTracking] = useState(""),
    [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState("Kamera mati."),
    [label, setLabel] = useState(""),
    [choices, suggest] = useState([]),
    [saving, setSaving] = useState(false);
  const faceObserver = useRef(onFaceFrame);
  faceObserver.current = onFaceFrame;
  const letterObserver = useRef(onLetterFrame);
  letterObserver.current = onLetterFrame;
  const letterTarget = useRef(expectedLetter);
  letterTarget.current = expectedLetter;
  const currentWord=useRef(targetWord);
  const nextRead=useRef(0);
  useEffect(()=>{
    currentWord.current=targetWord;
    if (!guided) return;
    clearTimeout(timer.current);
    recording.current=false;
    setSaving(false);
    nextRead.current=performance.now()+600;
    setMsg(running.current ? "Hadapkan wajah dan tangan ke kamera." : "Aktifkan kamera untuk mencoba kata ini.");
  },[targetWord,guided]);
  function stop() {
    generation.current++;
    running.current = false;
    stopper.current();
    faceObserver.current?.(null);
    const overlay = canvas.current;
    overlay?.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
    clearTimeout(timer.current);
    recording.current = false;
    setSaving(false);
    suggest([]);
    setActive(false);
    setBusy(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      running.current = false;
      stopper.current();
      clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (autoStart) start();
    // Start once on mount; later changes to autoStart are ignored on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const panel = video.current?.closest("details");
    function pauseIfHidden() {
      if (document.hidden || (panel && !panel.open)) {
        stop();
        setMsg("Kamera mati.");
      }
    }
    panel?.addEventListener("toggle",pauseIfHidden);
    document.addEventListener("visibilitychange",pauseIfHidden);
    return () => {
      panel?.removeEventListener("toggle",pauseIfHidden);
      document.removeEventListener("visibilitychange",pauseIfHidden);
    };
  }, []);
  async function start() {
    const id = ++generation.current;
    let stream, hm, fm, overlapModel, alphabetModels;
    setBusy(true);
    setMsg("Menyiapkan kamera dan AI pengenal tangan…");
    // Landmarkers are shared across camera views, so releasing only stops the camera.
    const release = () => {
      pauseTracks(stream);
      hm = null;
      fm = null;
    };
    stopper.current = release;
    let slow;
    try {
      // Models download while the camera permission prompt is still open.
      const ready = Promise.all([
        loadVision(),
        faceOnly ? null : handLandmarker(alphabet),
        alphabet ? null : faceLandmarker(),
        targetWord || recognizeWords ? loadWordModels() : null,
        alphabet ? loadAlphabetData() : null,
      ]);
      ready.catch(() => {});
      slow = setTimeout(() => {
        if (id === generation.current) setMsg("Mengunduh AI pengenal tangan. Hanya lama di kunjungan pertama, setelah itu langsung siap…");
      }, 2500);
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      if (id !== generation.current) {
        release();
        return;
      }
      video.current.srcObject = stream;
      await video.current.play();
      const [vision, hand, face, words, alpha] = await ready;
      clearTimeout(slow);
      var { HandLandmarker, FaceLandmarker } = vision;
      if (words) bank.current = words;
      if (alpha) {
        bank.current = alpha.bank;
        overlapModel = letterObserver.current ? alpha.overlap : null;
        alphabetModels = alpha.models;
      }
      hm = hand;
      fm = face;
      // A previous view may have left the shared landmarker in IMAGE mode.
      if (hm) await hm.setOptions({ runningMode: "VIDEO" });
      if (id !== generation.current) {
        release();
        return;
      }
      running.current = true;
      setActive(true);
      setBusy(false);
      setMsg("Siap berlatih.");
      const paddedFrame = alphabet ? document.createElement("canvas") : null;
      if (paddedFrame) paddedFrame.width = paddedFrame.height = 600;
      const paddedContext = paddedFrame?.getContext("2d");
      let prev = 0;
      const views = overlapModel ? [...overlapViews, ...overlapRecoveryViews] : overlapViews;
      let primaryHand, overlapTarget, overlapView = 0, missedFrames = 0, retryAsImage = false;
      async function tick(now) {
        if (!running.current || id !== generation.current) return;
        try {
          if (now - prev > 115 && video.current.readyState >= 2) {
            prev = now;
            const feed = video.current;
            const face = fm?.detectForVideo(feed, now);
            const c = canvas.current;
            const ctx = c.getContext("2d");
            const {videoWidth, videoHeight} = feed;
            let hand, visibleHands;
            const expected = letterTarget.current;
            const needsOverlapRetry = alphabet && (expected === "N" || expected === "Y");
            const viewCount = needsOverlapRetry ? views.length : overlapViews.length;
            if (overlapTarget !== expected) {
              overlapTarget = expected;
              overlapView = 0;
              missedFrames = 0;
              primaryHand = null;
            }
            if (paddedContext) {
              const [size, angle, center, mirrored] = views[overlapView];
              if (Boolean(mirrored) !== retryAsImage) {
                // Restart hand detection for the last retry instead of reusing
                // the video track that may have locked onto only one hand.
                await hm.setOptions({ runningMode: mirrored ? "IMAGE" : "VIDEO" });
                if (!running.current || id !== generation.current) return;
                retryAsImage = Boolean(mirrored);
              }
              const crop = handCrop(primaryHand, center, center && !primaryHand ? 480 : size);
              const resize = crop.zoom / Math.max(videoWidth, videoHeight);
              const width = videoWidth * resize, height = videoHeight * resize;
              const x = (600-width)/2 - crop.x * crop.zoom;
              const y = (600-height)/2 - crop.y * crop.zoom;
              paddedContext.fillStyle = "#969696";
              paddedContext.fillRect(0,0,600,600);
              paddedContext.save();
              paddedContext.translate(300, 300);
              paddedContext.rotate(angle);
              if (mirrored) paddedContext.scale(-1, 1);
              paddedContext.drawImage(feed, x-300, y-300, width, height);
              paddedContext.restore();
              hand = retryAsImage ? hm.detect(paddedFrame) : hm.detectForVideo(paddedFrame, now);
              if (angle || mirrored) {
                const cos = Math.cos(angle), sin = Math.sin(angle), sign = mirrored ? -1 : 1;
                // Undo the rotation and reflection before comparing or drawing points.
                hand.landmarks = hand.landmarks.map(group => group.map(point => ({
                  ...point,
                  x: .5 + sign * ((point.x-.5)*cos + (point.y-.5)*sin),
                  y: .5 - (point.x-.5)*sin + (point.y-.5)*cos,
                })));
              }
              if (needsOverlapRetry && overlapView === 0) primaryHand = hand.landmarks[0];
              visibleHands = hand.landmarks.map(group => group.map(point => ({
                x:(point.x*600-x)/width, y:(point.y*600-y)/height,
              })));
            } else {
              hand = hm?.detectForVideo(feed, now);
              visibleHands = hand?.landmarks ?? [];
            }
            if (c.width !== videoWidth || c.height !== videoHeight) {
              c.width = videoWidth;
              c.height = videoHeight;
            }
            ctx.clearRect(0, 0, c.width, c.height);
            const scale = Math.max(0.7, Math.min(c.width,c.height) / 480);
            for (const group of visibleHands) {
              ctx.beginPath();
              ctx.lineCap = "round";
              for (const {start,end} of HandLandmarker.HAND_CONNECTIONS) {
                ctx.moveTo(group[start].x * c.width, group[start].y * c.height);
                ctx.lineTo(group[end].x * c.width, group[end].y * c.height);
              }
              ctx.lineWidth = 5 * scale;
              ctx.strokeStyle = "#17372c";
              ctx.stroke();
              ctx.lineWidth = 2.5 * scale;
              ctx.strokeStyle = "#70ffd2";
              ctx.stroke();
              ctx.fillStyle = "#ffeb80";
              for (const q of group) {
                ctx.beginPath();
                ctx.arc(q.x * c.width, q.y * c.height, 3 * scale, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            const points = face?.faceLandmarks[0];
            if (points) {
              ctx.strokeStyle = "#ffe575";
              ctx.lineWidth = 2;
              for (const contour of [
                [70, 63, 105, 66, 107],
                [336, 296, 334, 293, 300],
                [61, 40, 37, 0, 267, 270, 291, 314, 17, 84, 61],
              ]) {
                ctx.beginPath();
                contour.forEach((index, i) => {
                  const point = points[index];
                  if (i === 0)
                    ctx.moveTo(point.x * c.width, point.y * c.height);
                  else ctx.lineTo(point.x * c.width, point.y * c.height);
                });
                ctx.stroke();
              }
            }
            const scores = face?.faceBlendshapes[0]?.categories;
            const score = (name) =>
              Math.round(
                (scores?.find((x) => x.categoryName === name)?.score || 0) *
                  100,
              );
            faceObserver.current?.(points, scores, FaceLandmarker.FACE_LANDMARKS_TESSELATION, now);
            const rotation = face?.facialTransformationMatrixes[0]?.data;
            const angle = rotation
              ? Math.round(
                  (Math.atan2(rotation[8], rotation[10]) * 180) / Math.PI,
                )
              : 0;
            const facial = points
              ? "Alis " +
                score("browInnerUp") +
                "% · bukaan rahang " +
                score("jawOpen") +
                "% · putaran kepala " +
                Math.abs(angle) +
                "°"
              : "Wajah belum terbaca";
            const match = alphabet && (letterObserver.current || recording.current)
              ? matchLetter(describeHands(hand), bank.current, expected) ??
                (!needsOverlapRetry && expected !== "A" ? classifyAlphabet(hand.landmarks, alphabetModels) : null)
              : null;
            const validatingA = match === "A" || (alphabet && letterTarget.current === "A");
            const aPose = validatingA && touchesA(hand);
            const contactNeeded = validatingA && !aPose;
            let candidate = aPose ? "A" : match === "A" ? null : match;
            if (needsOverlapRetry) {
              if (overlapModel && recognizesOverlap(hand.landmarks, expected, overlapModel)) candidate = expected;
              else if (candidate === expected && (overlapModel || hand.landmarks.length !== 2)) candidate = null;
            }
            if (alphabet && expected) {
              if (candidate === expected) {
                missedFrames = 0;
              } else if (++missedFrames >= 3) {
                overlapView = (overlapView + 1) % viewCount;
                missedFrames = 0;
              }
            }
            if (alphabet && letterObserver.current) {
              letterObserver.current(candidate, hand.landmarks.length, now, contactNeeded, hand);

            }
            if (guided && !recording.current && points && hand?.landmarks.length && now>=nextRead.current) {
              capture();
            }
            if (recording.current && (targetWord || recognizeWords)) {
              if (points && hand?.landmarks.length) {
                seq.current.push([[points[1].x,points[1].y],hand.landmarks.map(h=>h.map(p=>[p.x,p.y]))]);
              }
            } else if (recording.current && alphabet) {
              letters.current.push(candidate);
            } else if (recording.current) {
              const v = hand && vector(hand, face);
              if (v) seq.current.push(v);
            } else if (!recording.current)
              setTracking(
                alphabet
                  ? hand.landmarks.length + " tangan terbaca"
                  : (hand ? hand.landmarks.length + " tangan · " : "") + facial,
              );
          }
          requestAnimationFrame(tick);
        } catch {
          if (id !== generation.current) return;
          stop();
          setMsg("Pelacakan terhenti. Aktifkan kembali kamera.");
        }
      }
      requestAnimationFrame(tick);
    } catch (e) {
      clearTimeout(slow);
      release();
      if (id === generation.current) {
        setBusy(false);
        setMsg(
          e.name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan kamera di pengaturan browser."
            : "Kamera atau model belum tersedia. Periksa perangkat dan unduhan.",
        );
      }
    }
  }
  function capture() {
    suggest([]);
    seq.current = [];
    letters.current = [];
    recording.current = true;
    setSaving(true);
    setMsg("Peragakan satu isyarat selama dua detik…");
    timer.current = setTimeout(() => {
      recording.current = false;
      setSaving(false);
      nextRead.current=performance.now()+2400;
      if (alphabet) {
        const reads = letters.current;
        const counts = {};
        for (const ch of reads) if (ch) counts[ch] = (counts[ch] || 0) + 1;
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (reads.length >= 5 && best && best[1] / reads.length >= 0.65) {
          onMatch?.(best[0]);
          setMsg(
            "Kandidat huruf " +
              best[0] +
              " · kecocokan antar-frame " +
              Math.round((100 * best[1]) / reads.length) +
              "%. Periksa hasil ejaan.",
          );
        } else {
          const candidates = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([letter]) => letter);
          suggest(candidates);
          onUncertain?.();
          setMsg(candidates.length ? "Hasil antar-frame berbeda. Pilih huruf jika sesuai, atau ulangi." : "Huruf belum terbaca konsisten. Ulangi gerakan.");
        }
        return;
      }
      let a = seq.current;
      if (a.length < 5) {
        onUncertain?.();
        setMsg("Tangan belum cukup terlihat. Ulangi latihan.");
        return;
      }
      if (targetWord || recognizeWords) {
        const match = compareWord(a, bank.current);
        if (recognizeWords) {
          suggest(match.candidates.map(item=>item.word));
          if (!match.clear || !match.candidates.length) onUncertain?.();
          const leading = match.candidates[0];
          setMsg(leading ? `Kandidat AI: ${leading.word} · dukungan model ${Math.round(leading.score * 100)}%. Pilih kata jika sesuai.` : "Belum menemukan gerakan yang sesuai dalam 10 kata latihan.");
          return;
        }
        if (!match.clear) {
          setMsg("Gerakan belum dapat dibedakan. Putar contoh lalu coba lagi dengan wajah dan kedua tangan dalam bingkai.");
        } else if (match.word === currentWord.current) {
          onMatch?.(currentWord.current);
          setMsg("Lintasan tangan mendekati contoh kata " + currentWord.current + ". Periksa kembali bersama pendamping.");
        } else {
          setMsg("Gerakan lebih dekat ke contoh kata " + match.word + ". Amati kembali posisi awal dan akhir kata " + currentWord.current + ".");
        }
        return;
      }
      let lib = getLocal("samples", []);
      if (train) {
        try {
          saveLocal("samples", [...lib, { label: label.trim(), a }]);
          setMsg("Contoh lokal tersimpan.");
        } catch {
          setMsg("Penyimpanan perangkat penuh.");
        }
        return;
      }
      let hits = lib
        .map((x) => ({ label: x.label, dist: distance(a, x.a) }))
        .sort((x, y) => x.dist - y.dist);
      const nearby = [...new Set(hits.filter(hit => hit.dist <= 0.55).map(hit => hit.label))].slice(0,3);
      if (nearby.length && (hits[0].dist > 0.42 || hits.some(hit => hit.label !== hits[0].label && hit.dist-hits[0].dist < 0.05))) {
        suggest(nearby);
        onUncertain?.();
        setMsg("Gerakan mendekati contoh berikut. Pilih yang sesuai atau ulangi.");
        return;
      }
      if (!hits.length || hits[0].dist > 0.42) {
        onUncertain?.();
        setMsg(
          hits.length
            ? "Belum cocok dengan contoh lokal."
            : "Tambahkan contoh gerakan lewat Kurasi Isyarat dahulu.",
        );
        return;
      }
      onMatch?.(hits[0].label);
      setMsg("Draf dari contoh lokal. Periksa hasil sebelum digunakan.");
    }, 2050);
  }
  return (
    <section className={"camera " + className + (active ? " running" : "")}>
      <div className="viewer">
        <video ref={video} playsInline muted />
        <canvas width="640" height="480" ref={canvas} />
        {!active && <Camera size={42} />}
      </div>
      {active && <small>{tracking}</small>}
      {active && choices.length > 0 && <div className="controls" aria-label="Kandidat isyarat">
        {choices.map(value => <button key={value} onClick={()=>{onMatch?.(value);suggest([]);setMsg("Pilihan diterapkan.");}}>{value}</button>)}
      </div>}
      <p role="status">{msg}</p>
      <div className="controls">
        <button
          disabled={busy}
          onClick={() => (active ? (stop(), setMsg("Kamera mati.")) : start())}
        >
          {active ? "Matikan kamera" : busy ? "Memuat…" : "Aktifkan kamera"}
        </button>
        {train && (
          <input
            aria-label="Nama isyarat"
            placeholder="Nama isyarat lokal"
            maxLength={80}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        )}
        {!faceOnly && !guided && !onLetterFrame && (
          <button
            disabled={!active || saving || (train && !label.trim())}
            onClick={capture}
          >
            {saving
              ? "Membaca gerak…"
              : train
                ? "Simpan contoh gerakan"
                : "Baca gerakan"}
          </button>
        )}
      </div>
    </section>
  );
}
// Autocorrelation estimates periodicity in a short, centred microphone frame.
function fundamental(samples, sampleRate, rms) {
  if (rms < 0.014) return null;
  const maxLag = Math.min(Math.floor(sampleRate / 75), samples.length / 2);
  let best = 0, period = 0, previous = 0, before = 0;
  for (let lag = Math.floor(sampleRate / 600); lag <= maxLag; lag++) {
    let cross = 0, left = 0, right = 0;
    for (let i = 0; i < 512; i += 2) {
      const a = samples[i] - 128, b = samples[i + lag] - 128;
      cross += a*b; left += a*a; right += b*b;
    }
    const score = cross / (Math.sqrt(left * right) || 1);
    if (previous > before && previous >= score && previous > best + 0.025) {
      best = previous; period = lag - 1;
    }
    before = previous; previous = score;
  }
  return best > 0.75 ? Math.round(sampleRate / period) : null;
}

export function Meter({ onOnset } = {}) {
  const [contour, plot] = useState([]);
  const [target, aim] = useState("naik");
  const onset = useRef(onOnset);
  onset.current = onOnset;
  const close = useRef(() => {}),
    token = useRef(0),
    [vol, set] = useState(0),
    [on, toggle] = useState(false),
    [msg, say] = useState(""),
    [limit, change] = useState(20);
  useEffect(
    () => () => {
      token.current++;
      close.current();
    },
    [],
  );
  async function start() {
    let stream, ctx, frame;
    const id = ++token.current;
    close.current = () => {
      pauseTracks(stream);
      cancelAnimationFrame(frame);
      if (ctx && ctx.state !== "closed") ctx.close();
    };
    toggle(true);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== token.current) {
        pauseTracks(stream);
        return;
      }
      ctx = new AudioContext();
      await ctx.resume();
      if (id !== token.current) return;
      const node = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(node);
      const buf = new Uint8Array(node.fftSize);
      plot([]);
      let lastPitch = -Infinity;
      let previous = 0,
        lastOnset = 0;
      function tick() {
        node.getByteTimeDomainData(buf);
        const rms = Math.sqrt(
          buf.reduce((sum, x) => sum + ((x - 128) / 128) ** 2, 0) / buf.length,
        );
        const level = Math.min(100, Math.round(250 * rms));
        const now = performance.now();
        if (now - lastPitch >= 75) {
          lastPitch = now;
          const hz = fundamental(buf, ctx.sampleRate, rms);
          plot(points => [...points.slice(-39), hz]);
        }
        if (level >= 7 && level > previous * 1.6 + 2 && now - lastOnset > 140) {
          lastOnset = now;
          onset.current?.();
        }
        previous = previous * 0.6 + level * 0.4;
        set(level);
        frame = requestAnimationFrame(tick);
      }
      tick();
      say("Mikrofon aktif.");
    } catch {
      if (id === token.current) {
        close.current();
        toggle(false);
        say("Mikrofon belum tersedia. Periksa izin perangkat.");
      }
    }
  }
  return (
    <>
      <label>
        Target volume relatif{" "}
        <input
          type="range"
          min="5"
          max="80"
          value={limit}
          onChange={(e) => change(+e.target.value)}
        />
        {limit}%
      </label>
      <meter min="0" max="100" value={vol} />
      <p>
        {on
          ? vol + "% · " + (vol < limit ? "Di bawah target" : "Target tercapai")
          : msg}
      </p>
      <button
        onClick={() =>
          on
            ? (token.current++,
              close.current(),
              toggle(false),
              set(0),
              say("Mikrofon mati."))
            : start()
        }
      >
        <Mic size={16} />
        {on ? "Matikan mikrofon" : "Ukur volume"}
      </button>
      {!onOnset && <section className="toolSection">
        <h3>Latihan intonasi</h3>
        <div className="toolSwitch" role="group" aria-label="Pola intonasi">
          <button aria-pressed={target === "naik"} onClick={() => aim("naik")}>Nada naik</button>
          <button aria-pressed={target === "turun"} onClick={() => aim("turun")}>Nada turun</button>
        </div>
        <p>Panjangkan satu vokal. Ikuti arah garis putus-putus dengan nada suaramu.</p>
        <svg viewBox="0 0 320 100" role="img" aria-label="Kontur nada tiga detik terakhir" style={{width:"100%",maxWidth:480}}>
          <path d={target === "naik" ? "M4 80 L316 20" : "M4 20 L316 80"} fill="none" stroke="#b26b36" strokeWidth="2" strokeDasharray="5 4"/>
          {contour.map((hz,i) => hz && <circle key={i} cx={4 + (40-contour.length+i)*8} cy={94-Math.max(0,Math.min(1,Math.log2(hz/75)/3))*88} r="3" fill="currentColor"/>)}
        </svg>
        <p>{!on ? "Mikrofon mati." : contour.at(-1) ? "Nada terukur " + contour.at(-1) + " Hz." : "Nada belum terbaca."}</p>
      </section>}
    </>
  );
}
export function useDictate(onText) {
  const rec = useRef(),
    cb = useRef(onText);
  cb.current = onText;
  const [status, set] = useState(""),
    [active, toggle] = useState(false);
  useEffect(
    () => () => {
      if (rec.current) {
        rec.current.onresult = null;
        rec.current.onend = null;
        rec.current.onerror = null;
        rec.current.abort();
      }
    },
    [],
  );
  function start() {
    if (active) {
      rec.current.stop();
      return;
    }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) {
      set("Browser ini belum mendukung transkripsi. Gunakan input teks.");
      return;
    }
    const r = new R();
    rec.current = r;
    r.lang = "id-ID";
    r.continuous = true;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) cb.current(e.results[i][0].transcript);
    };
    r.onerror = (e) =>
      set(
        "Transkripsi terhenti (" +
          e.error +
          "). Gunakan input teks atau coba kembali.",
      );
    r.onend = () => toggle(false);
    try {
      r.start();
      toggle(true);
      set("Mendengarkan…");
    } catch {
      set("Mikrofon belum siap.");
    }
  }
  return {
    start,
    active,
    status:
      !active && status === "Mendengarkan…" ? "Sesi suara selesai." : status,
  };
}
