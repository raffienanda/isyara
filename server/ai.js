import { LEVELS, lettersUpTo, unlockedLevel } from "../shared/levels.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// The student's name never leaves the server. The model only sees "{nama}" and
// numbers about practice, and the placeholder is filled in after the reply.
async function askGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const generationConfig = { responseMimeType: "application/json", temperature: 0.6, maxOutputTokens: 1024 };
  if (MODEL.includes("2.5-flash")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.warn("Gemini", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
    return JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
  } catch (error) {
    console.warn("Gemini gagal:", error.message);
    return null;
  }
}

const RULES = `Aturan penting:
- Jangan pernah menjelaskan bentuk tangan, posisi jari, atau cara memperagakan isyarat apa pun. Contoh isyarat hanya boleh dilihat dari gambar dan video di aplikasi.
- Pakai hanya fakta dari data. Jangan mengarang angka.
- Bahasa Indonesia sederhana, hangat, tidak menggurui. Tulis "Tuli" dengan T kapital.`;

function describe(stats) {
  return JSON.stringify({
    huruf_dikuasai: stats.mastered,
    huruf_sering_dilewati: stats.skipped,
    menit_latihan_7_hari_terakhir: stats.week.map(w => w.minutes),
    hari_aktif_minggu_ini: stats.activeDaysThisWeek,
    hari_sejak_terakhir_latihan: stats.daysSinceActive,
    level_selesai: stats.levelsDone,
    kata_gerak_dilatih: stats.gerak,
    poin: stats.points,
  });
}

function templateSummary(stats) {
  const parts = [];
  if (stats.daysSinceActive === null) parts.push("{nama} belum mulai berlatih.");
  else if (stats.daysSinceActive >= 3) parts.push(`{nama} belum berlatih selama ${stats.daysSinceActive} hari.`);
  else parts.push(`Minggu ini {nama} berlatih ${stats.activeDaysThisWeek} hari dengan total ${stats.weekMinutes} menit.`);
  if (stats.mastered.length) parts.push(`Huruf yang sudah dikuasai: ${stats.mastered.join(", ")}.`);
  if (stats.skipped.length) parts.push(`Huruf ${stats.skipped.join(", ")} masih sering dilewati.`);
  const tips = [];
  if (stats.skipped.length) tips.push(`Latih bersama huruf ${stats.skipped.slice(0, 2).join(" dan ")} selama 5 menit.`);
  if (stats.daysSinceActive === null || stats.daysSinceActive >= 3) tips.push("Sapa {nama} dan tanyakan apakah kamera di rumah bisa dipakai.");
  tips.push("Ajak {nama} mengeja nama anggota keluarga saat makan bersama.");
  tips.push("Puji usahanya, bukan hanya hasilnya.");
  return { text: parts.join(" "), tips: tips.slice(0, 3) };
}

export async function summarize(stats, name) {
  const prompt = `Kamu membantu guru dan orang tua yang mendampingi anak belajar ejaan jari BISINDO (Bahasa Isyarat Indonesia) di aplikasi ISYARA.
Tulis ringkasan progres minggu ini untuk pendamping. Sebut anak sebagai "{nama}".
${RULES}
Data latihan: ${describe(stats)}
Balas JSON: {"ringkasan": "2-3 kalimat", "saran": ["3 saran kegiatan singkat di rumah atau kelas"]}`;
  const reply = await askGemini(prompt);
  const ok = reply && typeof reply.ringkasan === "string" && Array.isArray(reply.saran);
  const result = ok
    ? { text: reply.ringkasan.slice(0, 600), tips: reply.saran.filter(t => typeof t === "string").slice(0, 3).map(t => t.slice(0, 200)), source: "ai" }
    : { ...templateSummary(stats), source: "template" };
  const fill = s => s.replaceAll("{nama}", name);
  return { text: fill(result.text), tips: result.tips.map(fill), source: result.source };
}

export async function smartPractice(stats) {
  const level = unlockedLevel(stats.levelsDone);
  const allowed = new Set(lettersUpTo(level));
  const pool = LEVELS.filter(l => l.n <= level).flatMap(l => l.words);
  const weak = stats.skipped.filter(l => allowed.has(l));
  const fallback = () => {
    const scored = pool.map(w => ({ w, s: [...w].filter(c => weak.includes(c)).length }))
      .sort((a, b) => b.s - a.s || a.w.length - b.w.length);
    const words = scored.slice(0, 3).map(x => x.w);
    const reason = weak.length
      ? `Kamu sering melewati huruf ${weak.slice(0, 2).join(" dan ")}. Coba kata yang memakai huruf itu.`
      : "Pemanasan dengan kata pendek dari level yang sudah terbuka.";
    return { words, reason, source: "aturan" };
  };
  if (!weak.length) return fallback();
  const reply = await askGemini(`Kamu memilih kata latihan ejaan jari BISINDO untuk seorang pelajar.
${RULES}
Huruf yang sering dilewati: ${weak.join(", ")}. Huruf yang sudah dikuasai: ${stats.mastered.join(", ") || "-"}.
Pilih tepat 3 kata dari daftar ini saja: ${pool.join(", ")}.
Utamakan kata yang memakai huruf yang sering dilewati, dan mulai dari yang paling pendek.
Balas JSON: {"kata": ["3 kata dari daftar"], "alasan": "1 kalimat semangat untuk pelajar, sebut hurufnya"}`);
  const words = Array.isArray(reply?.kata) ? reply.kata.map(w => String(w).toUpperCase()).filter(w => pool.includes(w)) : [];
  if (words.length < 2 || typeof reply.alasan !== "string") return fallback();
  return { words: [...new Set(words)].slice(0, 3), reason: reply.alasan.slice(0, 200), source: "ai" };
}
