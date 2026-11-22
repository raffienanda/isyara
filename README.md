# ISYARA

Aplikasi web untuk belajar bersama siswa Tuli, orang tua dan guru. Halaman utama berisi materi pecahan, air dan tumbuhan. Modul lain dapat diakses dari navigasi samping atau menu pada ponsel.

## Menjalankan dari sumber

Jalankan `npm ci` kemudian `npm run build`. Dari direktori proyek, jalankan `npm run preview` dan buka http://127.0.0.1:4183. Preview produksi menggunakan PHP 8.1+ dengan ekstensi PDO SQLite. Untuk menyunting antarmuka, gunakan `npm run dev`. Ruang antarperangkat dan pengujian service worker memerlukan preview produksi.

## Instalasi di Rumahweb

Ekstrak ZIP website langsung ke `public_html` untuk domain utama cPanel. Pastikan `index.html`, `account.php`, dan `room.php` berdampingan. Pada pemasangan akun pertama, ekstrak ZIP data akun ke direktori Home cPanel sehingga `isyara-private/accounts.sqlite` sejajar dengan `public_html`. Simpan database tersebut saat memperbarui website. Kredensial awal disimpan terpisah di perangkat pengelola.

Gunakan HTTPS, PHP 8.1 atau lebih baru dengan `pdo_sqlite`, dan direktori temporer privat yang dapat ditulis untuk ruang kelas. Setelah ekstrak, masuk dengan akun awal dan uji pengiriman satu pesan antarbrowser. Paket ini dapat dijalankan langsung oleh PHP dan aset statisnya sudah dibangun.

Peran aktif adalah Siswa, Orang Tua, dan Guru. Guru dapat membuka seluruh menu, termasuk Daftar Kelas dan Kurasi Isyarat. Dasbor Guru menampilkan progres dan catatan siswa di kelas yang diajar. Pembaruan website menonaktifkan login dari peran lama dengan tetap menyimpan catatan mereka di database.

## Uji alur

1. Buka Sains Isyarat, ubah jumlah potongan lingkaran, jawab kuis, lalu periksa Dasbor Pendamping.
2. Pada Jembatan Isyarat, uji kamera atau pilih frasa cepat. Koreksi teks sebelum menampilkan atau membacakan pesan. Untuk meneruskan ke perangkat lain, buat ruang dan bagikan kode secara privat.
3. Pada BISINDO Keluarga, pilih tema, variasi daerah dan kata. Video pengajar bisa diimpor dengan izin pemilik. Video disimpan dalam IndexedDB perangkat pengguna. Progres disimpan pada browser.
4. Pada Penyederhana teks, impor gambar cetak atau PDF dengan lapisan teks. Periksa hasil OCR dan sunting bacaan sebelum menyimpan versi tinjauan. Perubahan teks memakai aturan bahasa lokal.
5. Setelah masuk, unduh paket luring dari Preferensi. Putuskan internet dan muat ulang tab yang sama. Materi, pembacaan berkas lokal serta model kamera dan suara dapat digunakan dari cache browser. Sesi latihan lokal berlaku 24 jam setelah unduh. Login pertama, data kelas, dan sinkronisasi memerlukan server.
6. Pada Transkrip kelas, buka transkripsi luring, siapkan model, lalu rekam satu giliran bicara. Hasil menjadi draf yang bisa diedit. Nama pembicara dipilih manual. Mode suara browser terpisah dan dapat memerlukan layanan daring.

## Batas uji coba

Kandidat A–Z berasal dari perbandingan titik tangan terhadap contoh dataset, dan bisa salah. Dalam pemeriksaan internal terhadap 97 foto dengan titik tangan terbaca, menggunakan 444 referensi terpisah dan ambang yang dipilih dengan melihat hasil kelompok foto tersebut, 28 huruf cocok, 5 keliru dan 64 tidak menghasilkan kandidat. Ini pemeriksaan pengembangan, bukan evaluasi independen pada pengguna. Pencocokan frasa menggunakan contoh gerakan yang dilatih pada perangkat. Makna BISINDO, kualitas variasi daerah, dan performa pada anak belum divalidasi.

Tiga rekaman perkenalan, keluarga, dan cerita pendek dari BISINDO Video Dataset disertakan untuk latihan luring. Video pengajar per kata, rekaman variasi daerah, dan kontak JBI khusus sekolah masih perlu dilengkapi. Kurasi masih berupa usulan dan pencatatan tinjauan pada perangkat. Pengguna dapat mengirim pesan, hasil bacaan, atau catatan yang dipilih ke ruang server. Kode ruang memberi akses pada percakapan. Ruang berakhir setelah 24 jam dan data kedaluwarsa dibersihkan pada permintaan berikutnya. Pilot dengan data siswa sungguhan memerlukan pengelolaan akses sekolah dan persetujuan yang sesuai.

Latihan wicara menyediakan skema gerak /p/, /b/, dan /m/, umpan balik buka-tutup bibir, volume relatif, serta ketukan visual. Belum ada estimasi posisi lidah, penilaian klinis, atau validasi terapis. Avatar penerjemah, penerjemahan percakapan bebas dan pemisahan pembicara otomatis belum tersedia. Sumber dan atribusi terdapat di public/sumber.txt.
## Latihan kata dan ruang pendamping

Kelas keluarga menyediakan sepuluh contoh animasi berdasarkan koordinat tangan pada dataset WL-BISINDO-10class. Nama kata mengikuti label sumber. Daerah dan ketepatan materi untuk pengajaran anak belum dikonfirmasi penutur Tuli. Mode “10 kata BISINDO” pada Jembatan Isyarat menyediakan kandidat dari kosakata yang sama. Transkrip menyediakan contoh untuk kata yang tersedia dan ejaan untuk istilah lain.

Ruang progres menggunakan satu kode per siswa dan berlaku 24 jam. Tekan “Catat latihan kata” sesudah masuk ruang untuk membagikan kata kepada pendamping. Catatan menunjukkan latihan yang dilaporkan pengguna. Ruang kurasi menyediakan usulan dan pembaruan status bersama; kode memberi pemegangnya akses meninjau. Tidak ada verifikasi identitas peninjau.

Pada 50 rangkaian titik (10 kata, 5 sampel per kata) dari satu penutur yang terpisah dari tiga penutur referensi, pencocok memberikan 17 kandidat pertama yang tepat dan cukup terpisah, 5 keliru dan 28 abstensi. Ini evaluasi internal atas lintasan dataset, bukan pengujian kamera pada keluarga. Lihat public/sumber.txt untuk lisensi aset nonkomersial.


Pengenal 10 kata menggabungkan 96 pohon keputusan ExtraTrees dengan pencocokan lintasan dari contoh. Model dilatih secara lokal dari 240 sampel tiga penutur (8 per kata per penutur, dengan pencerminan). Hasil latihan otomatis hanya ditampilkan jika dukungan model kuat atau kedua metode sepakat. Pada 90 sampel dari satu penutur lain, versi baru menghasilkan 27 tepat, 0 keliru, 63 ragu. Versi sebelumnya menghasilkan 27 tepat, 11 keliru, 52 ragu pada sampel yang sama. Pengujian ini memakai titik gerak dataset, tidak mengukur akurasi webcam pada keluarga atau kosakata di luar daftar. Pada mode komunikasi, kandidat tetap dikonfirmasi manual. Model mengikuti lisensi nonkomersial sumber.

Saat perangkat terputus, kata latihan yang sudah dicatat ke ruang aktif menunggu di penyimpanan sesi tab tersebut. Buka kelas keluarga atau dasbor saat kembali terhubung selama ruang masih berlaku agar kiriman masuk. Keluar dari ruang membuang antrean sesi itu. Riwayat kata pada perangkat tetap tersedia.
