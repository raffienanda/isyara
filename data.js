export const units = [
  {
    id: "pecahan",
    area: "Matematika",
    title: "Pecahan dalam satu lingkaran",
    desc: "Bagi satu lingkaran menjadi bagian yang sama besar.",
    question: "Satu dari empat bagian sama besar ditulis sebagai …",
    choices: ["1/4", "4/1", "1/2"],
    answer: 0,
  },
  {
    id: "air",
    area: "IPA",
    title: "Perjalanan setetes air",
    desc: "Amati perubahan air saat menerima atau melepaskan panas.",
    question: "Apa yang terjadi saat air cair berubah menjadi uap?",
    choices: ["Membeku", "Menguap", "Mencair"],
    answer: 1,
  },
  {
    id: "cahaya",
    area: "IPA",
    title: "Cahaya dan tumbuhan",
    desc: "Jelajahi peran cahaya dalam fotosintesis.",
    question: "Apa sumber energi untuk fotosintesis?",
    choices: ["Tanah", "Air", "Cahaya"],
    answer: 2,
  },
];
export const family = [
  [
    "Salam dan keluarga",
    "Sapa anggota keluarga secara bergiliran. Tunggu hingga lawan bicara siap melihat.",
  ],
  [
    "Rutinitas rumah",
    "Tawarkan dua pilihan minuman. Beri anak waktu untuk menyampaikan pilihannya.",
  ],
  [
    "Emosi",
    "Pilih situasi yang ingin diceritakan. Perhatikan tangan dan wajah lawan bicara.",
  ],
  [
    "Sekolah",
    "Ceritakan satu kegiatan di kelas dan minta pasangan mengulang bagian yang belum jelas.",
  ],
  [
    "Kesehatan dan keselamatan",
    "Latih cara meminta bantuan dengan pendamping.",
  ],
  [
    "Bercerita",
    "Ceritakan kembali tiga peristiwa secara berurutan dan beri giliran pada anak.",
  ],
];
export const terms = [
  [
    "pecahan",
    "Bagian dari satu keseluruhan.",
    "Satu potong dari empat potong kue yang sama besar adalah seperempat.",
  ],
  [
    "menguap",
    "Berubah dari cair menjadi gas.",
    "Air di genangan perlahan menguap.",
  ],
  [
    "fotosintesis",
    "Cara tumbuhan membuat makanan dengan bantuan cahaya.",
    "Daun memakai energi cahaya untuk membuat gula.",
  ],
  [
    "energi",
    "Kemampuan untuk menyebabkan perubahan.",
    "Energi panas membuat es mencair.",
  ],
  ["gaya", "Tarikan atau dorongan.", "Dorongan tangan membuat bola bergerak."],
];
export function simplify(text, level) {
  let out = text.trim();
  if (level === "Asli") return out;
  for (const [a, b] of [
    ["merupakan", "adalah"],
    ["oleh karena itu", "karena itu"],
    ["melakukan pengamatan terhadap", "mengamati"],
    ["dikarenakan", "karena"],
    ["guna", "untuk"],
    ["mengalami perubahan wujud menjadi", "berubah menjadi"],
    ["sejumlah", "beberapa"],
    ["besar kepala", "sombong"],
  ])
    out = out.replace(new RegExp("\\b" + a + "\\b", "gi"), b);
  if (level === "Sangat sederhana")
    out = out
      .replace(/[,;]\s*(sedangkan|tetapi|sehingga)\s+/gi, ". $1 ")
      .replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
  return out;
}
let localOwner = null;
export function setLocalOwner(id) {
  localOwner = id;
}
export function scopedKey(key) {
  return localOwner === null ? key : `account/${localOwner}/${key}`;
}
export function getLocal(key, initial) {
  try {
    return JSON.parse(localStorage.getItem("isyara:" + (key === "prefs" ? key : scopedKey(key)))) ?? initial;
  } catch {
    return initial;
  }
}
export function saveLocal(key, value) {
  localStorage.setItem("isyara:" + (key === "prefs" ? key : scopedKey(key)), JSON.stringify(value));
  if (["done", "practiceWords", "familyDone"].includes(key)) window.dispatchEvent(new Event("isyara-activity"));
}
