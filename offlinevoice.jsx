import React, { useEffect, useRef, useState } from "react";
export function LocalVoice({ onText }) {
  const [status, say] = useState(""),
    [phase, set] = useState("idle");
  const worker = useRef(),
    session = useRef(0),
    clean = useRef(() => {}),
    end = useRef(() => {}),
    callback = useRef(onText);
  callback.current = onText;
  useEffect(
    () => () => {
      session.current++;
      clean.current();
      worker.current?.terminate();
    },
    [],
  );
  function load() {
    set("loading");
    say("Menyiapkan model suara lokal…");
    const w = new Worker(new URL("./asr/transcribe.js", document.baseURI), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.error) {
        say(data.error);
        set("idle");
        w.terminate();
        worker.current = null;
        return;
      }
      if (data.ready) {
        say("Model siap. Pilih rekam saat giliran bicara.");
        set("ready");
        return;
      }
      if (data.text) {
        callback.current(data.text);
        say("Draf transkrip siap diperiksa.");
      } else say("Ucapan belum terbaca.");
      set("ready");
    };
    w.onerror = () => {
      say("Mesin suara belum tersedia di browser ini.");
      set("idle");
      w.terminate();
      worker.current = null;
    };
    w.postMessage({});
  }
  async function record() {
    set("asking");
    const id = ++session.current;
    let stream, context, proc, timer;
    const chunks = [];
    let len = 0;
    const release = () => {
      clearTimeout(timer);
      if (proc) {
        proc.onaudioprocess = null;
        proc.disconnect();
      }
      stream?.getTracks().forEach((t) => t.stop());
      if (context && context.state !== "closed") context.close();
    };
    clean.current = release;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (id !== session.current) {
        release();
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (id !== session.current) {
        release();
        return;
      }
      const sr = context.sampleRate;
      const src = context.createMediaStreamSource(stream);
      proc = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      src.connect(proc);
      proc.connect(silent);
      silent.connect(context.destination);
      proc.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        len += chunks.at(-1).length;
      };
      set("recording");
      say("Merekam hingga 12 detik.");
      let ended = false;
      end.current = () => {
        if (ended) return;
        ended = true;
        release();
        const input = new Float32Array(len);
        let offset = 0;
        for (const part of chunks) {
          input.set(part, offset);
          offset += part.length;
        }
        const audio = new Float32Array(Math.floor((len * 16000) / sr));
        let energy = 0;
        for (let i = 0; i < audio.length; i++) {
          const a = Math.floor((i * sr) / 16000),
            b = Math.min(
              input.length,
              Math.max(a + 1, Math.floor(((i + 1) * sr) / 16000)),
            );
          let sum = 0;
          for (let j = a; j < b; j++) sum += input[j];
          audio[i] = sum / (b - a);
          energy += audio[i] ** 2;
        }
        if (audio.length < 5000 || energy / audio.length < 0.000006) {
          say("Suara terlalu pendek atau pelan. Ulangi rekaman.");
          set("ready");
          return;
        }
        set("working");
        say("Menyalin ucapan pada perangkat…");
        worker.current?.postMessage({ audio }, [audio.buffer]);
      };
      timer = setTimeout(() => end.current(), 12000);
    } catch {
      release();
      if (id === session.current) {
        set("ready");
        say("Izin mikrofon diperlukan untuk merekam.");
      }
    }
  }
  return (
    <div>
      <p>
        Whisper Tiny Bahasa Indonesia memproses potongan suara hingga 12 detik.
        Unduh paket luring lebih dulu untuk memakainya tanpa internet. Periksa
        hasil sebelum menambahkan ucapan.
      </p>
      <button
        disabled={["loading", "working", "asking"].includes(phase)}
        onClick={() =>
          phase === "idle"
            ? load()
            : phase === "recording"
              ? end.current()
              : record()
        }
      >
        {phase === "idle"
          ? "Siapkan model suara"
          : phase === "ready"
            ? "Rekam ucapan"
            : phase === "recording"
              ? "Selesai merekam"
              : "Memproses…"}
      </button>
      <p role="status">{status}</p>
    </div>
  );
}
