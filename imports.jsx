import React, { useRef, useState, useEffect } from "react";
export function ImportReading({ onText }) {
  const [status, set] = useState(""),
    [busy, wait] = useState(false);
  const ver = useRef(0),
    worker = useRef(null);
  useEffect(
    () => () => {
      ver.current++;
      worker.current?.terminate();
    },
    [],
  );
  async function read(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) {
      set("Pilih berkas di bawah 24 MB.");
      return;
    }
    const id = ++ver.current;
    let text = "",
      task = null,
      ocr = null;
    wait(true);
    set("Membaca berkas pada perangkat…");
    try {
      if (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      ) {
        const lib = await import("pdfjs-dist");
        lib.GlobalWorkerOptions.workerSrc = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
        ).default;
        task = lib.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          isEvalSupported: false,
        });
        const pdf = await task.promise;
        for (
          let n = 1;
          n <= pdf.numPages && text.length < 12000 && id === ver.current;
          n++
        ) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text += content.items.map((x) => x.str).join(" ") + "\n";
          page.cleanup();
        }
      } else if (file.type.startsWith("image/")) {
        const { createWorker } = await import("tesseract.js");
        const asset = (path) => new URL("./ocr/" + path, document.baseURI).href;
        ocr = await createWorker("ind", 1, {
          workerPath: asset("worker.min.js"),
          corePath: asset("tesseract-core-lstm.wasm.js"),
          langPath: asset(""),
          logger: (m) => {
            if (ver.current === id && m.status === "recognizing text")
              set("Membaca gambar " + Math.round(m.progress * 100) + "%");
          },
        });
        if (id !== ver.current) return;
        worker.current = ocr;
        text = (await ocr.recognize(file)).data.text;
      } else text = await file.text();
      if (id === ver.current) {
        if (text.trim()) {
          onText(text.slice(0, 12000).trim());
          set("Teks siap diperiksa.");
        } else
          set(
            "Teks belum ditemukan. Untuk PDF hasil pindai, unggah gambar halamannya.",
          );
      }
    } catch {
      if (id === ver.current)
        set(
          "Berkas tidak dapat dibaca. Coba gambar yang lebih jelas atau tempel teks.",
        );
    } finally {
      if (ocr && worker.current === ocr) {
        worker.current = null;
        await ocr.terminate();
      } else if (ocr) await ocr.terminate().catch(() => {});
      await task?.destroy();
      if (id === ver.current) wait(false);
    }
  }
  return (
    <div>
      <label className="file">
        {busy ? "Memproses…" : "Buka foto, PDF, atau TXT"}
        <input
          aria-label="Impor bahan bacaan"
          disabled={busy}
          type="file"
          accept="image/*,.pdf,.txt"
          onChange={read}
        />
      </label>
      <p role="status">{status}</p>
    </div>
  );
}
