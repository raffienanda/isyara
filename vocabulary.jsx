import React, { useState } from "react";
import { useSaved } from "./app";
const topics = [
  "halo,pagi,siang,sore,malam,terima kasih,maaf,tolong,nama,saya,kamu,kita,keluarga,ibu,ayah,anak,kakak,adik,kakek,nenek,paman,bibi,sepupu,teman,orang tua,siapa,apa,di mana,kenal,bertemu,datang,pulang,salam",
  "rumah,pintu,jendela,meja,kursi,kamar,dapur,mandi,sabun,air,makan,minum,nasi,susu,buah,sayur,roti,piring,sendok,gelas,baju,sepatu,tidur,bangun,bermain,baca,buku,lagi,cukup,selesai,pilih,mau,lapar,haus",
  "senang,sedih,marah,takut,bingung,malu,tenang,kaget,rindu,suka,sayang,lelah,semangat,bosan,kecewa,puas,khawatir,berani,sabar,lega,nyaman,sakit,baik,buruk,tertawa,menangis,tersenyum,merasa,ingin,cerita,dengar,lihat,bantu",
  "sekolah,guru,murid,kelas,belajar,tanya,jawab,tugas,pensil,tulis",
  "tolong,berhenti,aman,orang tua,rumah sakit,dokter,sakit",
  "hari ini,kemarin,besok,pertama,berikutnya,selesai",
].map((x) => x.split(","));
export function Vocabulary({ level, onWord, word }) {
  const [learned, save] = useSaved("words", []);
  return (
    <section className="sheet">
      <h2>Kosakata latihan</h2>
      <p>
        Pilih makna untuk dipelajari bersama pengajar. Tambahkan contoh video
        sesuai variasi daerah keluarga.
      </p>
      <select
        aria-label="Pilih kosakata"
        value={word || ""}
        onChange={(e) => onWord(e.target.value)}
      >
        <option value="">Pilih kata…</option>
        {topics[level].map((x) => (
          <option key={x} value={x}>
            {learned.includes(x) ? "✓ " : ""}
            {x}
          </option>
        ))}
      </select>
      {word && (
        <button
          disabled={learned.includes(word)}
          onClick={() => save([...learned, word])}
        >
          {learned.includes(word)
            ? "Sudah dipelajari"
            : "Tandai sudah dipelajari"}
        </button>
      )}
    </section>
  );
}
