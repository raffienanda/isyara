# ISYARA

Latihan ejaan jari BISINDO (Bahasa Isyarat Indonesia) dengan webcam, tangan 3D, dan pelatih AI. Untuk siswa Tuli dan orang-orang di sekitarnya: keluarga, teman sekelas, dan guru.

Ada dua peran:

- **Pelajar**: main eja jari per level, eja nama sendiri, kosakata gerak, kamus A–Z, latihan pintar.
- **Pendamping** (guru atau orang tua): buat kelompok dengan kode, pantau progres tiap pelajar, ringkasan AI mingguan, catatan, reset kata sandi pelajar.

## Fitur utama

| Fitur | Cara kerja |
|---|---|
| Pengenal huruf A–Z | MediaPipe membaca 21 titik tangan di browser. Pencocokan dengan contoh dataset BISINDO ditambah model ExtraTrees. Gambar kamera tidak pernah dikirim. |
| Pelatih per jari | Pose dibandingkan dengan contoh terdekat untuk huruf target. Jari yang jauh dari contoh diberi tanda "Betulkan". Ini perkiraan, bukan penilaian pasti. |
| Level bertahap | Level 1: huruf satu tangan (C E I L O R U V). Level 2–4: huruf dua tangan dan huruf bergerak (J, Z). Level berikutnya terbuka setelah level sebelumnya selesai. |
| Latihan pintar | Gemini memilih 3 kata dari daftar kata yang ada, berdasarkan huruf yang sering dilewati. Tanpa kunci API, pemilihan memakai aturan biasa. |
| Ringkasan AI | Pendamping menekan "Buat ringkasan AI". Gemini menerima angka progres saja (tanpa nama, tanpa gambar) dan membalas ringkasan + 3 saran kegiatan. Tanpa kunci API, ringkasan dibuat dari templat. |
| Latihan luring | Service worker menyimpan aplikasi dan model. Progres disimpan di antrean perangkat dan dikirim saat tersambung lagi. |

## Struktur

```
src/            Frontend React (Vite)
  pages/        Halaman: Umum, Pelajar, Main (permainan), Lainnya, Pendamping
  lib/          Pengenal tangan dan gerak (MediaPipe, pencocokan pose)
server/         API Node.js (Hono) + SQLite bawaan Node
shared/         Data level dan kosakata yang dipakai frontend dan server
public/         Model, wasm MediaPipe, gambar tangan 3D, animasi kata, background
```

## Menjalankan di laptop

Butuh Node.js 22.13 atau lebih baru.

```bash
npm install
cp .env.example .env      # opsional: isi GEMINI_API_KEY dan DEMO_PASSWORD
npm run seed              # akun demo: rina (pendamping), budi, sari, ayu, dimas (pelajar)
npm run dev               # buka http://127.0.0.1:5173
```

Kata sandi akun demo diambil dari `DEMO_PASSWORD` di `.env`, atau nilai bawaan di [server/seed.js](server/seed.js). Kode kelas demo dicetak saat `npm run seed`.

Versi produksi di laptop: `npm run build && npm start`, lalu buka http://127.0.0.1:8787.

Kamera hanya jalan di `localhost`/`127.0.0.1` atau di alamat HTTPS.

## Deploy ke server rumah (Docker + Cloudflare Tunnel)

```bash
git clone -b naufal-dev https://github.com/raffienanda/isyara.git && cd isyara
cp .env.example .env && nano .env      # isi GEMINI_API_KEY
docker compose up -d --build
docker compose exec isyara node server/seed.js   # opsional: data demo untuk juri
```

Aplikasi hanya mendengarkan di `127.0.0.1:8787`. Arahkan Cloudflare Tunnel ke sana, misalnya di `~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: isyara.namadomain.my.id
    service: http://localhost:8787
  - service: http_status:404
```

HTTPS dari Cloudflare wajib, karena browser hanya mengizinkan kamera di HTTPS.

Pembaruan: `git pull && docker compose up -d --build`. Database tersimpan di volume Docker `isyara-data`. Cadangkan dengan `docker compose cp isyara:/data ./cadangan`.

## Privasi dan data

- Gambar kamera diproses di perangkat dan tidak dikirim atau disimpan.
- Server menyimpan: nama panggilan, nama pengguna, kata sandi (di-hash scrypt), kelompok, huruf yang dikuasai, waktu latihan, catatan pendamping.
- Pendamping hanya melihat pelajar yang bergabung ke kelompoknya lewat kode.
- Ke Gemini hanya dikirim angka progres. Nama pelajar diganti `{nama}` dan diisi kembali di server.
- AI tidak dipakai untuk mengajarkan bentuk isyarat. Semua contoh tangan berasal dari dataset.

## Batasan

- Pengenal huruf bisa salah, terutama huruf dua tangan yang bersentuhan. Tombol "Lewati huruf" selalu tersedia.
- Pelatih per jari adalah perkiraan dari jarak ke contoh dataset, belum divalidasi penutur Tuli.
- Ejaan BISINDO bisa berbeda antar daerah. Kosakata gerak berlisensi nonkomersial (CC BY-NC 4.0).

Sumber dataset dan lisensi: [public/sumber.txt](public/sumber.txt).
