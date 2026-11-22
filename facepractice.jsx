import React, { useRef, useState } from "react";
import { CameraLab } from "./media";

const exercises = [
  { title: "Angkat alis", hint: "Angkat kedua alis sambil melihat lurus.", channel: "browInnerUp", threshold: .28 },
  { title: "Buka mulut", hint: "Buka rahang perlahan dan tahan sebentar.", channel: "jawOpen", threshold: .32 },
  { title: "Senyum", hint: "Tarik kedua sudut bibir ke atas.", channel: "mouthSmileLeft", other: "mouthSmileRight", threshold: .35 },
  { title: "Kerutkan alis", hint: "Dekatkan kedua alis dan tahan sebentar.", channel: "browDownLeft", other: "browDownRight", threshold: .28 },
];

export function FacePractice() {
  const stage = useRef(null);
  const since = useRef(null);
  const [index, select] = useState(0);
  const [status, report] = useState("Aktifkan kamera untuk memulai.");
  const target = exercises[index];
  const raised = index === 0;
  const frowned = index === 3;

  function observe(points, channels, edges, now) {
    const canvas = stage.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points) {
      since.current = null;
      report("Hadapkan wajah ke kamera.");
      return;
    }
    const [left, right, top, bottom] = [234, 454, 10, 152].map(i => points[i]);
    const centerX = (left.x + right.x) / 2;
    const centerY = (top.y + bottom.y) / 2;
    const scale = 240 / Math.max(.05, bottom.y - top.y, Math.abs(right.x - left.x));
    ctx.beginPath();
    for (const {start, end} of edges) {
      const a = points[start], b = points[end];
      ctx.moveTo(180 - (a.x - centerX) * scale, 160 + (a.y - centerY) * scale);
      ctx.lineTo(180 - (b.x - centerX) * scale, 160 + (b.y - centerY) * scale);
    }
    ctx.strokeStyle = "#78e7b7";
    ctx.lineWidth = .65;
    ctx.stroke();
    const value = name => channels?.find(channel => channel.categoryName === name)?.score ?? 0;
    const score = target.other ? Math.min(value(target.channel),value(target.other)) : value(target.channel);
    if (score < target.threshold) {
      since.current = null;
      report(target.hint);
      return;
    }
    since.current ??= now;
    report(now - since.current >= 450 ? "Gerakan target terbaca. Kamu bisa lanjut." : "Tahan sebentar…");
  }

  return <section className="sheet facePractice">
    <h3>Latihan mimik</h3>
    <div className="controls">{exercises.map((exercise,i) =>
      <button key={exercise.title} aria-pressed={i===index} onClick={()=>{select(i);since.current=null;report(exercise.hint);}}>{exercise.title}</button>
    )}</div>
    <p>{target.hint}</p>
    <div className="faceStages">
      <figure><figcaption>Contoh ekspresi</figcaption>
        <svg viewBox="0 0 360 320" role="img" aria-label={target.title}>
          <ellipse cx="180" cy="158" rx="86" ry="112" fill="#d8ead9" stroke="#24604b" strokeWidth="3" />
          <path d={raised ? "M119 110 Q144 91 166 105 M194 105 Q216 91 241 110" : frowned ? "M120 122 L164 140 M196 140 L240 122" : "M119 125 Q142 115 166 125 M194 125 Q218 115 241 125"} fill="none" stroke="#24604b" strokeWidth="8" strokeLinecap="round"/>
          <circle cx="145" cy="151" r="7" fill="#24604b"/><circle cx="215" cy="151" r="7" fill="#24604b"/>
          <path d="M180 158 L171 187 Q180 192 187 186" fill="none" stroke="#24604b" strokeWidth="3" />
          {index === 1 ? <ellipse cx="180" cy="222" rx="23" ry="26" fill="#24604b"/> :
            <path d={index === 2 ? "M145 207 Q180 260 215 207 Z" : "M157 220 Q180 225 203 220"} fill={index===2?"#24604b":"none"} stroke="#24604b" strokeWidth="6" strokeLinecap="round"/>}
        </svg>
      </figure>
      <figure><figcaption>Jaring wajah langsung</figcaption><canvas ref={stage} width="360" height="320" aria-label="Jaring wajah dari kamera"/></figure>
    </div>
    <CameraLab faceOnly onFaceFrame={observe}/>
    <p role="status">{status}</p>
  </section>;
}
