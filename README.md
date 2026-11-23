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
| Level bertahap | Level 1: huruf satu tangan (C E I L O R U V). Level 2–4: huruf dua tangan dan huruf bergerak (J, Z). Tiap level punya 18–27 kata yang hanya memakai huruf yang sudah terbuka (95 kata total). Satu putaran berisi 8 kata, kata yang belum pernah selesai didahulukan. Level berikutnya terbuka setelah satu putaran selesai. |
| Rangkai kata | Ketik kata atau nama apa saja (sampai 6 kata). Halaman ini menunjukkan bentuk tangan setiap huruf, menandai huruf dua tangan dan huruf bergerak, lalu membuka latihan kamera untuk kata itu. |
| Suara | Huruf yang benar disebut dengan nama huruf Indonesia (ce, u, ce, i), lalu katanya disebut utuh ("cuci"). Memakai suara bawaan browser, bisa dimatikan di layar main atau Profil. Ditujukan untuk pendamping yang mendengar. |
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
npm run dev               # buka http://127.0.0.1:5173
```

Di halaman Masuk ada tombol **Coba langsung**: sekali klik masuk sebagai pelajar demo (Budi) atau pendamping demo (Bu Rina), tanpa kata sandi. Akun demo: `demo.rina` (pendamping), `demo.budi`, `demo.sari`, `demo.ayu`, `demo.dimas`, `demo.nadia`, `demo.fajar`, `demo.rizki`, `demo.lala` (pelajar), kode Kelas 4A `4A27`, kata sandi `isyara-demo` (atau nilai `DEMO_PASSWORD`). Data demo dibangun ulang otomatis setiap hari mulai pukul 07.00 WIB, jadi dashboard selalu berisi latihan 7 hari terakhir dan perubahan pengunjung pada akun demo dikembalikan. Kata sandi akun demo tidak bisa diganti. Bangun ulang manual: `npm run seed`. Nama pengguna berawalan `demo.` tidak bisa dipakai untuk daftar biasa, jadi tombol demo tidak pernah membuka akun orang lain. Matikan tombol demo dengan `DEMO_LOGIN=0` di `.env`.

Versi produksi di laptop: `npm run build && npm start`, lalu buka http://127.0.0.1:8787.

Kamera hanya jalan di `localhost`/`127.0.0.1` atau di alamat HTTPS.

## Deploy di hp-server (yang sedang dipakai, tanpa Docker)

ISYARA berjalan sebagai layanan systemd milik pengguna, memakai Node dari nvm:

- Folder: `~/apps/isyara` (branch `naufal-dev`), data SQLite di `~/apps/isyara/data`
- Konfigurasi: `~/apps/isyara/.env` (port 8797, hanya `127.0.0.1`)
- Layanan: `isyara.service` dan `isyara-tunnel.service` di `~/.config/systemd/user/`

Perbarui setelah push:

```bash
ssh hp-server
cd ~/apps/isyara && git pull && PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH npm ci && PATH=~/.nvm/versions/node/v24.18.0/bin:$PATH npm run build
systemctl --user restart isyara
```

Alamat publik: **https://isyara.web.id**. Domain terdaftar di DomaiNesia dengan nameserver Cloudflare. Trafik masuk lewat tunnel Cloudflare `ifw` yang sudah berjalan di hp-server (`cloudflared.service`), dengan route Published application `isyara.web.id` ke `http://localhost:8797`. Sertifikat HTTPS dikelola Cloudflare (Universal SSL).

Cadangan kalau domain bermasalah: nyalakan quick tunnel dengan `systemctl --user start isyara-tunnel`, lalu lihat alamat sementaranya dengan `journalctl --user -u isyara-tunnel | grep trycloudflare`.

## Deploy dengan Docker + Cloudflare Tunnel (alternatif)

```bash
git clone -b naufal-dev https://github.com/raffienanda/isyara.git && cd isyara
cp .env.example .env && nano .env      # isi GEMINI_API_KEY
docker compose up -d --build
```

Aplikasi hanya mendengarkan di `127.0.0.1:8787`. Arahkan Cloudflare Tunnel ke sana, misalnya di `~/.cloudflared/config.yml`:

```yaml
ingress:
  - hostname: isyara.web.id
    service: http://localhost:8787
  - service: http_status:404
```

HTTPS dari Cloudflare wajib, karena browser hanya mengizinkan kamera di HTTPS.

Pembaruan: `git pull && docker compose up -d --build`. Database tersimpan di volume Docker `isyara-data`. Cadangkan dengan `docker compose cp isyara:/data ./cadangan`.

## Privasi dan data

- Gambar kamera diproses di perangkat dan tidak dikirim atau disimpan.
- Runtime wasm dan model MediaPipe diunduh dari CDN resmi (jsDelivr, storage.googleapis.com) karena jauh lebih cepat dari upload server rumah. File-nya identik dengan salinan di `public/`, dan salinan itu dipakai otomatis kalau CDN tidak bisa dijangkau atau sedang luring.
- Server menyimpan: nama panggilan, nama pengguna, kata sandi (di-hash scrypt), kelompok, huruf yang dikuasai, waktu latihan, catatan pendamping.
- Pendamping hanya melihat pelajar yang bergabung ke kelompoknya lewat kode.
- Ke Gemini hanya dikirim angka progres. Nama pelajar diganti `{nama}` dan diisi kembali di server.
- AI tidak dipakai untuk mengajarkan bentuk isyarat. Semua contoh tangan berasal dari dataset.

## Batasan

- Pengenal huruf bisa salah, terutama huruf dua tangan yang bersentuhan. Tombol "Lewati huruf" selalu tersedia.
- Pelatih per jari adalah perkiraan dari jarak ke contoh dataset, belum divalidasi penutur Tuli.
- Ejaan BISINDO bisa berbeda antar daerah. Kosakata gerak berlisensi nonkomersial (CC BY-NC 4.0).

Sumber dataset dan lisensi: [public/sumber.txt](public/sumber.txt).
