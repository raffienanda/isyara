import React, { useEffect, useState } from "react";
const alphabet = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const alphabetIllustrations = { D: "D-kontak-v2", J: "J-kelingking" };

export function alphabetImage(letter) {
  return "./alfabet-3d/" + (alphabetIllustrations[letter] ?? letter + "-render") + ".webp";
}

export function Fingerspell({ text }) {
  const letters = text.toUpperCase().match(/[A-Z]+/g)?.join(" ") || "";
  const [index, jump] = useState(0);
  const [playing, play] = useState(false);
  const [delay, pace] = useState(1000);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (index + 1 >= letters.length) play(false);
      else jump(index + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, index, letters, delay]);
  if (!letters) return null;
  const letter = letters[index];
  return <div className="toolSection">
    <p>{letters}</p>
    <figure style={{margin:0, minHeight:175}}>
      {letter !== " " && <img src={alphabetImage(letter)} alt={"Konfigurasi huruf " + letter} style={{height:140,maxWidth:"100%",objectFit:"contain"}} />}
      <figcaption>{letter === " " ? "Jeda antarkata" : letter} · {index + 1} / {letters.length}</figcaption>
    </figure>
    <div className="controls">
      <button disabled={!index} onClick={() => {play(false);jump(index-1);}}>Huruf sebelumnya</button>
      <button onClick={() => {if (!playing && index === letters.length-1) jump(0);play(!playing);}}>{playing ? "Jeda ejaan" : "Putar ejaan"}</button>
      <button disabled={index === letters.length-1} onClick={() => {play(false);jump(index+1);}}>Huruf berikutnya</button>
      <label>Durasi per huruf <select value={delay} onChange={e=>pace(Number(e.target.value))}><option value="500">0,5 detik</option><option value="1000">1 detik</option><option value="2000">2 detik</option></select></label>
    </div>
  </div>;
}

export function OnlineLesson({ video, title }) {
  const [open, show] = useState(false);
  return <section>
    <h3>{title}</h3>
    {open && <iframe title={title} src={"https://www.youtube-nocookie.com/embed/" + video} style={{width:"100%",aspectRatio:"16/9",border:0}} allowFullScreen />}
    <div className="controls">
      <button aria-expanded={open} onClick={()=>show(!open)}>{open ? "Tutup video" : "Putar video YouTube di sini"}</button>
    </div>
    <small>Video dari kanal penerbit memerlukan internet.</small>
  </section>;
}
export function SigningLibrary({ initial = "keluarga" }) {
  const [clip, select] = useState(initial);
  const [speed, rate] = useState(1);
  const [mirror, flip] = useState(false);
  const ref = React.useRef(null);
  const [error, report] = useState("");
  return <section className="sheet">
    <h3>Amati penutur BISINDO</h3>
    <div className="toolSwitch" role="group" aria-label="Rekaman latihan">
      {[["perkenalan", "Perkenalan"], ["keluarga", "Keluarga"], ["cerita", "Cerita pendek"]].map(([key, label]) => <button key={key} aria-pressed={clip === key} onClick={() => { select(key); report(""); }}>{label}</button>)}
    </div>
    <video ref={ref} className={"lessonVideo " + (mirror ? "mirror" : "")} src={"./pelajaran/" + clip + ".mp4"} controls playsInline preload="metadata"
      aria-label={"Rekaman BISINDO " + clip} onLoadedMetadata={()=>{ref.current.playbackRate=speed;}} onError={()=>report("Video gagal dimuat. Buka lagi unit ini saat terhubung.")} />
    <div className="controls">
      <label>Kecepatan video<select value={speed} onChange={e=>{const v=Number(e.target.value);rate(v);ref.current.playbackRate=v;}}><option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1">1×</option></select></label>
      <button aria-pressed={mirror} onClick={()=>flip(!mirror)}>Cerminkan video</button>
    </div>
    <p role="status">{error}</p>
    <small className="videoCredit">Tito Sugiharto · <a href="https://doi.org/10.17632/f33k9w86wr.3" target="_blank" rel="noreferrer" aria-label="BISINDO Video Dataset v3 (tab baru)">BISINDO Video Dataset v3 ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" aria-label="Lisensi CC BY 4.0 (tab baru)">CC BY 4.0 ↗</a>. Video dikompresi dan disesuaikan resolusinya. Variasi daerah tidak dicantumkan.</small>
  </section>;
}
export function AlphabetQuiz() {
  const [round, next] = useState(0);
  const [answer, choose] = useState("");
  const letters = alphabet;
  const correct = letters[(round * 7) % letters.length];
  const options = [correct, letters[(round * 7 + 9) % 26], letters[(round * 7 + 15) % 26]];
  options.sort();
  return <section className="sheet"><h3>Tebak huruf bersama anak</h3>
    <p>Amati bentuk tangan lalu pilih huruf yang sesuai.</p>
    <img src={alphabetImage(correct)} style={{height:150,maxWidth:"100%",objectFit:"contain"}} alt="Ilustrasi 3D konfigurasi tangan untuk ditebak" />
    <div className="controls">{options.map(letter=><button key={letter} disabled={answer===correct} onClick={()=>choose(letter)}>{letter}</button>)}</div>
    <p role="status">{answer && (answer === correct ? "Tepat, huruf " + correct + "." : "Coba perhatikan arah jari lalu pilih lagi.")}</p>
    {answer === correct && <button onClick={()=>{next(round+1);choose("");}}>Soal berikutnya</button>}
  </section>;
}
