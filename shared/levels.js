// Shared by the browser and the server so word lists and level rules never drift apart.
export const LEVELS = [
  { n: 1, name: "Satu tangan", letters: "CEILORUV",
    desc: "Lihat tangan 3D, lalu tirukan bentuknya dengan tangan utamamu.",
    words: ["LUCU", "CUCI", "OLI", "REL", "LELE", "CUCU", "ULIR", "LIUR"] },
  { n: 2, name: "Dua tangan I", letters: "ABDFGH",
    desc: "Huruf yang memakai dua tangan. Pastikan kedua tangan masuk ke bingkai kamera.",
    words: ["ABU", "BACA", "BOLA", "DUA", "HARI", "GULA", "BIRU", "DARI"] },
  { n: 3, name: "Dua tangan II", letters: "KMNPQS",
    desc: "Bentuk dua tangan dengan titik sentuh yang lebih rapat. Perhatikan jari yang menempel.",
    words: ["MAKAN", "KAMU", "NASI", "SAPU", "MINUM", "PIKNIK", "SUSU", "KAKAK"] },
  { n: 4, name: "Gerak & tantangan", letters: "TWXYJZ",
    desc: "Huruf J dan Z memakai gerakan. Kata di level ini lebih panjang.",
    words: ["TEMAN", "WAKTU", "JAWAB", "KAYU", "ZEBRA", "JUJUR", "TIDUR", "TOPI"] },
];

export const TWO_HANDED = new Set("ABDFGHKMNPQSTWXY");
export const ALPHABET = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

export const WORD_POINTS = 10;

export const GERAK = [
  { word: "saya", group: "DIRI", meaning: "Menunjuk diri sendiri.", example: "Saya Budi." },
  { word: "teman", group: "ORANG", meaning: "Orang yang dekat dan sering bermain atau belajar bersama.", example: "Sari teman saya." },
  { word: "tuli", group: "ORANG", meaning: "Identitas komunitas orang Tuli yang memakai bahasa isyarat.", example: "Saya Tuli." },
  { word: "makan", group: "KEGIATAN", meaning: "Memasukkan makanan ke mulut.", example: "Ayo makan." },
  { word: "belajar", group: "KEGIATAN", meaning: "Mencari tahu dan berlatih sesuatu.", example: "Kita belajar bersama." },
  { word: "hari", group: "WAKTU", meaning: "Satuan waktu dari pagi sampai malam.", example: "Hari ini cerah." },
  { word: "terima kasih", group: "SOPAN SANTUN", meaning: "Ungkapan rasa senang karena dibantu.", example: "Terima kasih, Bu Guru." },
  { word: "maaf", group: "SOPAN SANTUN", meaning: "Ungkapan menyesal atau minta izin.", example: "Maaf, saya terlambat." },
  { word: "apa", group: "KATA TANYA", meaning: "Menanyakan benda atau hal.", example: "Ini apa?" },
  { word: "siapa", group: "KATA TANYA", meaning: "Menanyakan orang.", example: "Siapa namamu?" },
];

export function lettersUpTo(level) {
  return LEVELS.filter(l => l.n <= level).map(l => l.letters).join("");
}

export function unlockedLevel(levelsDone) {
  let top = 1;
  for (const l of LEVELS) if (levelsDone.includes(l.n) && l.n < LEVELS.length) top = Math.max(top, l.n + 1);
  return top;
}
