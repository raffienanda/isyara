import React, { useEffect, useMemo, useRef, useState } from "react";
import { CameraLab } from "./media";
import { loadMotionBank } from "./motion";
import { getLocal, saveLocal } from "./data";
import { Room, recordPractice } from "./room";

const fingers = [[0,1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
function DiagramFallback({frames,word}) {
  const clip = useMemo(() => frames.map(([nose,hands]) => [nose,
    hands.filter(hand => hand.some(([x,y]) => x !== 0 || y !== 0))
  ]).filter(([,hands]) => hands.length), [frames]);
  const [frame,seek]=useState(0);
  const [playing,toggle]=useState(()=>!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [slow,pace]=useState(false);
  const [mirror,flip]=useState(false);
  useEffect(()=>{
    if(!playing || !clip.length) return;
    const timer=setTimeout(()=>seek((frame+1)%clip.length), frame===clip.length-1 ? 750 : slow ? 140 : 70);
    return ()=>clearTimeout(timer);
  },[playing,frame,clip,slow]);
  const box=useMemo(()=>{
    const points=clip.flatMap(([n,h])=>[[n[0]*640-51,n[1]*480-72],[n[0]*640+51,n[1]*480+82],...h.flat().map(([x,y])=>[x*640,y*480])]);
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    return [Math.min(...xs)-20,Math.min(...ys)-20,Math.max(...xs)-Math.min(...xs)+40,Math.max(...ys)-Math.min(...ys)+40].join(" ");
  },[clip]);
  if(!clip.length) return <p>Contoh ini belum terbaca. Pilih penutur lain.</p>;
  const [nose,hands]=clip[frame];
  const [x,y]=[nose[0]*640,nose[1]*480];
  return <div className="motionDemo">
    <svg viewBox={box} style={{transform:mirror ? "scaleX(-1)" : undefined}} role="img" aria-label={"Contoh lintasan tangan untuk "+word}>
      <ellipse cx={x} cy={y-8} rx="38" ry="49" fill="#dae4d3" stroke="#a5b99e" strokeWidth="2"/>
      <path d={`M${x-61} ${y+84} Q${x} ${y+34} ${x+61} ${y+84}`} stroke="#b1c2a8" fill="#dce7d5" strokeWidth="2"/>
      {hands.map((hand,i)=>{
        const coords=chain=>chain.map(k=>[hand[k][0]*640,hand[k][1]*480].join(",")).join(" ");
        const ink=i===0?"#204f40":"#96532b", fill=i===0?"#83b698":"#e7ae79";
        return <g key={i}><polygon points={coords([0,1,5,9,13,17])} fill={fill} stroke={ink} strokeWidth="3"/>
          {fingers.map((chain,j)=><g key={j} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={coords(chain)} stroke={ink} strokeWidth="7"/><polyline points={coords(chain)} stroke={fill} strokeWidth="4"/>
          </g>)}</g>;
      })}
    </svg>
    <label>Posisi gerakan<input type="range" min="0" max={clip.length-1} value={frame} onChange={e=>{toggle(false);seek(+e.target.value);}}/></label>
    <div className="controls"><button onClick={()=>toggle(!playing)}>{playing?"Jeda contoh":"Putar contoh"}</button><button aria-pressed={slow} onClick={()=>pace(!slow)}>Perlambat</button><button aria-pressed={mirror} onClick={()=>flip(!mirror)}>Cermin</button></div>
  </div>;
}
function Demonstration({frames,word,example=0}) {
  const player=useRef(null);
  const [failed,setFailed]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [duration,setDuration]=useState(0);
  const [position,seek]=useState(0);
  const [slow,pace]=useState(false);
  const [mirror,flip]=useState(false);
  if(failed) return <DiagramFallback frames={frames} word={word}/>;
  function togglePlayback() {
    const video=player.current;
    if(video.paused) video.play().catch(()=>setPlaying(false));
    else video.pause();
  }
  return <div className="motionDemo">
    <video ref={player} src={"./gerak/"+word.replaceAll(" ","_")+"-"+(example+1)+".mp4"}
      className="handAnimation" style={{transform:mirror?"scaleX(-1)":undefined}}
      aria-label={"Animasi tangan BISINDO untuk kata "+word}
      muted loop playsInline preload="auto"
      onLoadedMetadata={e=>{const video=e.currentTarget;setDuration(video.duration);
        if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) video.play().catch(()=>setPlaying(false));
      }}
      onTimeUpdate={e=>seek(e.currentTarget.currentTime)}
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setFailed(true)}/>
    <label>Posisi gerakan<input type="range" min="0" max={duration || 1} step="0.01" value={position}
      disabled={!duration} onChange={e=>{player.current.pause();player.current.currentTime=Number(e.target.value);seek(Number(e.target.value));}}/></label>
    <div className="controls"><button onClick={togglePlayback}>{playing?"Jeda contoh":"Putar contoh"}</button>
      <button aria-pressed={slow} onClick={()=>{player.current.playbackRate=slow?1:.5;pace(!slow);}}>Perlambat</button>
      <button aria-pressed={mirror} onClick={()=>flip(!mirror)}>Cermin</button></div>
  </div>;
}
const familyActivities = {
  "apa": "Masukkan benda ke kantong. Anak boleh meraba lalu menanyakan isinya.",
  "belajar": "Pilih kegiatan yang ingin kalian pelajari bersama hari ini.",
  "hari": "Tunjuk satu hari di kalender dan ceritakan rencana keluarga.",
  "maaf": "Peragakan situasi ketika mainan teman tersenggol. Bergantianlah meminta maaf.",
  "makan": "Saat menyiapkan meja, ajak anak memilih waktu untuk makan bersama.",
  "saya": "Bergantian memperkenalkan diri sambil melihat satu sama lain.",
  "siapa": "Lihat foto keluarga dan bergantian menanyakan orang yang ada di foto.",
  "teman": "Pilih foto atau gambar teman, lalu ceritakan kegiatan bersama.",
  "terima kasih": "Bergantian menyerahkan benda dan mengucapkan terima kasih.",
  "tuli": "Baca cerita dari penutur Tuli bersama anak dan bicarakan tokohnya."
};
export function hasWordPractice(word) {
  return Object.hasOwn(familyActivities, word);
}

export function WordPractice({ word }) {
  const [bank,load]=useState(null),[message,notify]=useState(""),[retry,attempt]=useState(0);
  useEffect(()=>{let live=true;loadMotionBank().then(data=>{if(live)load(data)}).catch(()=>{if(live)notify("Contoh gagal dimuat.")});return()=>{live=false}},[retry]);
  const [example,selectExample]=useState(0);
  const [studied,update]=useState(()=>getLocal("practiceWords",[]));
  return <section className="sheet guidedWords"><h3>Latihan isyarat: {word}</h3>
    {bank ? <>
      <div className="wordStages">
        <section><h4>Amati gerakan</h4><Demonstration key={word+example} frames={bank[word][example]} example={example} word={word}/></section>
        <section><h4>Tirukan di kamera</h4><CameraLab targetWord={word} guided/></section>
      </div>
      <div className="toolSwitch" role="group" aria-label="Contoh penutur">
        {bank[word].map((_,i)=><button key={i} aria-pressed={example === i} onClick={() => selectExample(i)}>Penutur {i+1}</button>)}
      </div>
      <p><strong>Coba bersama anak.</strong> {familyActivities[word]}</p>
      <button onClick={async()=>{const list=[...new Set([...getLocal("practiceWords",[]),word])];saveLocal("practiceWords",list);update(list);notify("Latihan tersimpan di perangkat.");try{if(await recordPractice(word)) notify("Latihan tersimpan di perangkat dan ruang pendamping.");}catch{notify("Tersimpan di perangkat. Selama sesi ruang ini masih aktif, kiriman dicoba lagi saat tersambung.");}}}>Catat latihan kata {word}</button>
      <p>{studied.length} kata telah dilatih.</p></> : <button onClick={()=>attempt(retry+1)}>Muat contoh latihan</button>}
    <p role="status">{message}</p>
    {bank && <Room progressOnly triggerLabel="Bagikan progres ke pendamping" />}
  </section>;
}
export function WordReplay({text}) {
  const [bank,load]=useState(null),[index,step]=useState(0),[error,report]=useState("");
  useEffect(()=>{
    let live=true;
    loadMotionBank().then(data=>{if(live){load(data);report("");}}).catch(()=>{if(live)report("Contoh gagal dimuat. Tutup lalu buka kembali.");});
    return ()=>{live=false;};
  },[]);
  const words=text.toLocaleLowerCase("id").match(/terima\s+kasih|[a-z]+/g)?.map(w=>w.replace(/\s+/g," ")) || [];
  if(!words.length) return null;
  const word=words[index] || words[0];
  return <div className="toolSection">
    <p>Pilih kata untuk melihat contoh gerak.</p>
      <div className="controls">{words.map((w,i)=><button key={i} aria-pressed={i===index} onClick={()=>step(i)}>{w}</button>)}</div>
      {bank ? bank[word] ? <Demonstration key={word} frames={bank[word][0]} word={word}/> : <p>Contoh kata “{word}” belum ada. Pilih Eja huruf untuk melihat ejaannya.</p> : <p role="status">{error || "Memuat contoh…"}</p>}
  </div>;
}
